#!/usr/bin/env bash
# Smoke-tests the Docker Compose packaging end to end: non-root execution,
# MariaDB/API health ordering, data persistence across a restart, optional
# auth enabled/disabled, and an SPA deep link. Run this from a machine with
# real container registry access (a dev machine or the target Pi) after
# `docker compose build`; it is not run automatically anywhere.
#
# Usage: scripts/docker-smoke-test.sh [--keep]
#   --keep   Leave the stack running afterwards instead of tearing it down.

set -euo pipefail
cd "$(dirname "$0")/.."

KEEP=0
[ "${1:-}" = "--keep" ] && KEEP=1

COMPOSE_ENV_FILE="$(mktemp)"
API_PORT="${API_PORT:-18080}"
cat > "$COMPOSE_ENV_FILE" <<EOF
API_PORT=${API_PORT}
DB_ROOT_PASSWORD=smoke-root
DB_NAME=apr_smoke
DB_USER=apr_smoke
DB_PASSWORD=smoke-password
AUTH_TOKEN=
CORS_ORIGIN=http://localhost:${API_PORT}
EOF

COMPOSE=(docker compose --env-file "$COMPOSE_ENV_FILE" -p apr-smoke)
BASE_URL="http://localhost:${API_PORT}"
PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); echo "  PASS: $1"; }
fail() { FAIL=$((FAIL + 1)); echo "  FAIL: $1"; }

cleanup() {
  if [ "$KEEP" -eq 0 ]; then
    echo "==> Tearing down"
    "${COMPOSE[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
  else
    echo "==> Leaving stack up (env file: $COMPOSE_ENV_FILE, project: apr-smoke)"
  fi
  [ "$KEEP" -eq 0 ] && rm -f "$COMPOSE_ENV_FILE"
}
trap cleanup EXIT

wait_for_healthy() {
  local service="$1" timeout="${2:-120}" waited=0
  echo "==> Waiting for ${service} to report healthy (timeout ${timeout}s)"
  while [ "$waited" -lt "$timeout" ]; do
    local cid status
    cid="$("${COMPOSE[@]}" ps -q "$service" 2>/dev/null || true)"
    if [ -n "$cid" ]; then
      status="$(docker inspect --format '{{.State.Health.Status}}' "$cid" 2>/dev/null || true)"
      [ "$status" = "healthy" ] && return 0
    fi
    sleep 3
    waited=$((waited + 3))
  done
  return 1
}

echo "==> Building and starting the stack (AUTH_TOKEN unset: LAN-open)"
"${COMPOSE[@]}" up -d --build

if wait_for_healthy mariadb 120 && wait_for_healthy api 120; then
  pass "mariadb and api both report healthy (health ordering)"
else
  fail "mariadb/api did not become healthy in time"
  "${COMPOSE[@]}" logs --tail=100
  exit 1
fi

echo "==> Checking the api container runs as a non-root user"
API_UID="$("${COMPOSE[@]}" exec -T api id -u | tr -d '\r')"
if [ "$API_UID" != "0" ] && [ -n "$API_UID" ]; then
  pass "api container runs as uid ${API_UID}, not root"
else
  fail "api container is running as root (uid ${API_UID:-unknown})"
fi

echo "==> Checking auth-disabled access to a protected route"
if curl -fsS -o /dev/null "${BASE_URL}/api/repositories"; then
  pass "protected route reachable without a session when AUTH_TOKEN is unset"
else
  fail "protected route rejected an unauthenticated request while auth is disabled"
fi

echo "==> Registering a repository so we can check persistence after a restart"
if curl -fsS -X POST "${BASE_URL}/api/repos" \
  -H 'content-type: application/json' \
  -d '{"url":"https://github.com/octocat/Hello-World"}' >/dev/null; then
  pass "registered a repository before restart"
else
  fail "could not register a repository before restart"
fi

echo "==> Checking an SPA deep link is served (not a 404) with the app shell"
DEEP_LINK_BODY="$(curl -fsS "${BASE_URL}/reviews/some-client-side-route")"
if echo "$DEEP_LINK_BODY" | grep -q 'id="root"'; then
  pass "SPA deep link serves the app shell instead of a 404"
else
  fail "SPA deep link did not return the app shell"
fi

echo "==> Restarting the stack to check persistence"
"${COMPOSE[@]}" restart mariadb api
wait_for_healthy mariadb 120 && wait_for_healthy api 120

if curl -fsS "${BASE_URL}/api/repositories" | grep -q 'Hello-World'; then
  pass "repository data and review-work state survive a restart"
else
  fail "repository registered before restart is missing afterwards"
fi

echo "==> Enabling AUTH_TOKEN and confirming protected routes now require a session"
sed -i.bak 's/^AUTH_TOKEN=.*/AUTH_TOKEN=smoke-test-token/' "$COMPOSE_ENV_FILE" && rm -f "${COMPOSE_ENV_FILE}.bak"
"${COMPOSE[@]}" up -d api
wait_for_healthy api 60

STATUS="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/api/repositories")"
if [ "$STATUS" = "401" ]; then
  pass "protected route requires a session once AUTH_TOKEN is set"
else
  fail "expected 401 on a protected route with AUTH_TOKEN set, got ${STATUS}"
fi

HEALTH_STATUS="$(curl -s -o /dev/null -w '%{http_code}' "${BASE_URL}/api/health")"
if [ "$HEALTH_STATUS" != "401" ]; then
  pass "/api/health stays reachable without a session even with AUTH_TOKEN set"
else
  fail "/api/health was rejected even though it must stay public"
fi

COOKIE_JAR="$(mktemp)"
if curl -fsS -c "$COOKIE_JAR" -X POST "${BASE_URL}/api/session/login" \
  -H 'content-type: application/json' \
  -d '{"token":"smoke-test-token"}' >/dev/null \
  && curl -fsS -b "$COOKIE_JAR" -o /dev/null "${BASE_URL}/api/repositories"; then
  pass "logging in with the correct token authorizes subsequent requests"
else
  fail "login with the correct token did not authorize subsequent requests"
fi
rm -f "$COOKIE_JAR"

echo
echo "==> ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]

#!/bin/sh
# Applies pending database migrations, then starts the API. Migrations are
# idempotent (CREATE ... IF NOT EXISTS plus a tracked migrations table), so
# running this on every container start is safe. Retries briefly in case
# MariaDB's healthcheck passes a moment before it accepts connections.
set -e

attempt=0
max_attempts=10
until node dist/db/migrate.js; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "Database migration failed after ${max_attempts} attempts." >&2
    exit 1
  fi
  echo "Database not ready yet (attempt ${attempt}/${max_attempts}); retrying in 3s..." >&2
  sleep 3
done

exec node dist/index.js

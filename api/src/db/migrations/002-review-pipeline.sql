-- Durable repository identity, job queue, and server-side settings for M3+.
-- Every statement is idempotent because MariaDB DDL can commit independently
-- from the schema_migrations marker if a migration is interrupted.

ALTER TABLE repos
  ADD COLUMN IF NOT EXISTS canonical_url VARCHAR(255) NULL AFTER url;

UPDATE repos
SET canonical_url = LOWER(
  CASE
    WHEN url LIKE 'https://github.com/%' THEN TRIM(TRAILING '.git' FROM url)
    WHEN url LIKE 'github.com/%' THEN CONCAT('https://', TRIM(TRAILING '.git' FROM url))
    ELSE url
  END
)
WHERE canonical_url IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_repos_canonical_url
  ON repos (canonical_url);

ALTER TABLE dependencies
  MODIFY status ENUM('ok','outdated','major','unknown') NOT NULL;

CREATE TABLE IF NOT EXISTS review_jobs (
  id            CHAR(36) PRIMARY KEY,
  repo_id       INT NOT NULL,
  status        ENUM('queued','running','succeeded','failed') NOT NULL DEFAULT 'queued',
  stage         ENUM('queued','cloning','analyzing','narrating','persisting','complete') NOT NULL DEFAULT 'queued',
  active        TINYINT UNSIGNED NULL DEFAULT 1,
  attempt_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  review_id     INT NULL,
  error_code    VARCHAR(64) NULL,
  error_message VARCHAR(512) NULL,
  requested_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  started_at    DATETIME NULL,
  completed_at  DATETIME NULL,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE SET NULL,
  UNIQUE KEY uq_review_jobs_repo_active (repo_id, active),
  INDEX idx_review_jobs_queue (status, requested_at),
  INDEX idx_review_jobs_repo_requested (repo_id, requested_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(64) PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

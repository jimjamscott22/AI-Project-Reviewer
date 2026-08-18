-- AI Project Reviewer — MariaDB schema.
-- Normalized per-review child tables, one row per review per list item, so the
-- API can reassemble the exact joined shape the frontend expects (see
-- ../../../frontend/src/data/types.ts Repo / ../../../frontend/src/data/sampleData.ts).
-- Extends the table list sketched in design_handoff_ai_project_reviewer/IMPLEMENTATION_PLAN.md
-- with two tables the plan didn't spell out (review_summary_items, portfolio_readiness)
-- because the prototype's "Project Summary" cards and portfolio blurb/verdict need
-- somewhere to live too.

CREATE TABLE IF NOT EXISTS repos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  slug         VARCHAR(64)  NOT NULL UNIQUE,
  name         VARCHAR(128) NOT NULL,
  url          VARCHAR(255) NOT NULL,
  visibility   ENUM('Public','Private') NOT NULL DEFAULT 'Public',
  language     VARCHAR(64)  NOT NULL DEFAULT '',
  framework    VARCHAR(64)  NOT NULL DEFAULT '',
  hue          SMALLINT     NOT NULL DEFAULT 0,
  connected_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviews (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  repo_id       INT NOT NULL,
  overall_score TINYINT UNSIGNED NOT NULL,
  grade         VARCHAR(16) NOT NULL,
  ai_summary    TEXT NOT NULL,
  generated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repo_id) REFERENCES repos(id) ON DELETE CASCADE,
  INDEX idx_reviews_repo_generated (repo_id, generated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- "Project Summary" cards on the review header (Type / Docker / README / CI / Tests / Activity).
CREATE TABLE IF NOT EXISTS review_summary_items (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  review_id INT NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  icon     VARCHAR(32) NOT NULL,
  label    VARCHAR(64) NOT NULL,
  value    VARCHAR(64) NOT NULL,
  tone     ENUM('good','warn','') NOT NULL DEFAULT '',
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_summary_review_pos (review_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insights-column category scores (Documentation / Testing / Docker / CI-CD / Security / Maintainability).
CREATE TABLE IF NOT EXISTS review_categories (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  review_id INT NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  category VARCHAR(32) NOT NULL,
  icon     VARCHAR(32) NOT NULL,
  score    TINYINT UNSIGNED NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_categories_review_pos (review_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI Review tab: strengths / needs-improvement / next-steps lists.
CREATE TABLE IF NOT EXISTS review_items (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  review_id INT NOT NULL,
  kind     ENUM('strength','improvement','next_step') NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  body     TEXT NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_items_review_kind_pos (review_id, kind, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Portfolio Readiness card: verdict tag + blurb + footer (one row per review).
CREATE TABLE IF NOT EXISTS portfolio_readiness (
  review_id INT PRIMARY KEY,
  verdict   VARCHAR(32) NOT NULL,
  blurb     TEXT NOT NULL,
  footer    TEXT NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Portfolio Readiness checklist rows.
CREATE TABLE IF NOT EXISTS portfolio_checks (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  review_id INT NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  label    VARCHAR(64) NOT NULL,
  done     BOOL NOT NULL DEFAULT FALSE,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_checks_review_pos (review_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Code Quality tab metric tiles (Lint issues / Complexity / Duplication / Type hints, ...).
CREATE TABLE IF NOT EXISTS quality_metrics (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  review_id INT NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  label    VARCHAR(32) NOT NULL,
  value    VARCHAR(16) NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_metrics_review_pos (review_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Shared by Code Quality ("Findings") and Security tabs.
-- `title` carries the finding text for quality rows and the bold title for security
-- rows; `detail` is only populated for security rows.
CREATE TABLE IF NOT EXISTS findings (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  review_id INT NOT NULL,
  tab      ENUM('quality','security') NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  severity ENUM('high','med','warn','info','ok') NOT NULL,
  title    VARCHAR(255) NOT NULL,
  detail   TEXT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_findings_review_tab_pos (review_id, tab, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dependencies tab rows.
CREATE TABLE IF NOT EXISTS dependencies (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  review_id INT NOT NULL,
  position  TINYINT UNSIGNED NOT NULL,
  package   VARCHAR(64) NOT NULL,
  installed VARCHAR(24) NOT NULL,
  latest    VARCHAR(24) NOT NULL,
  status    ENUM('ok','outdated','major') NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE,
  INDEX idx_deps_review_pos (review_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per review: LOC / issue / PR / contributor counts and the rendered
-- Structure-tab file tree (newline-joined, as the frontend expects it).
CREATE TABLE IF NOT EXISTS repo_stats (
  review_id    INT PRIMARY KEY,
  loc          INT NOT NULL DEFAULT 0,
  open_issues  INT NOT NULL DEFAULT 0,
  prs          INT NOT NULL DEFAULT 0,
  contributors INT NOT NULL DEFAULT 1,
  commits_14d  INT NOT NULL DEFAULT 0,
  structure    TEXT NOT NULL,
  FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

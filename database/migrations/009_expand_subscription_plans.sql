PRAGMA foreign_keys=off;

CREATE TABLE new_users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free', 'creator', 'pro'))
);

INSERT INTO new_users (id, username, password_hash, created_at, plan)
SELECT id, username, password_hash, created_at,
  CASE WHEN plan = 'premium' THEN 'pro' ELSE plan END
FROM users;

DROP TABLE users;
ALTER TABLE new_users RENAME TO users;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

PRAGMA foreign_keys=on;

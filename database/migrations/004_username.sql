ALTER TABLE users RENAME COLUMN email TO username;
UPDATE users SET username = lower(trim(username));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);

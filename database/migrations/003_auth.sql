CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
ALTER TABLE carousels ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
DELETE FROM carousels;
CREATE INDEX idx_sessions_user ON sessions(user_id);

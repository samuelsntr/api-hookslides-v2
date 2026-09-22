ALTER TABLE carousels ADD COLUMN user_deleted_at TEXT;

CREATE INDEX IF NOT EXISTS idx_carousels_user_history
ON carousels(user_id, user_deleted_at, created_at DESC);

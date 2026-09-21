ALTER TABLE carousels ADD COLUMN language TEXT NOT NULL DEFAULT 'english' CHECK (language IN ('english', 'indonesian'));

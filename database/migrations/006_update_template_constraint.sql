PRAGMA foreign_keys=off;

CREATE TABLE new_carousels (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('topic', 'article', 'youtube')),
  original_input TEXT NOT NULL,
  extracted_content TEXT,
  strategy TEXT NOT NULL CHECK (strategy IN ('viral_hook', 'storytelling', 'actionable_value')),
  template TEXT NOT NULL CHECK (template IN ('template_1', 'template_2', 'template_3', 'template_4')),
  slides_json TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  caption_ideas_json TEXT NOT NULL DEFAULT '[]',
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE
);

INSERT INTO new_carousels SELECT * FROM carousels;
DROP TABLE carousels;
ALTER TABLE new_carousels RENAME TO carousels;
CREATE INDEX idx_carousels_created_at ON carousels(created_at DESC);

PRAGMA foreign_keys=on;

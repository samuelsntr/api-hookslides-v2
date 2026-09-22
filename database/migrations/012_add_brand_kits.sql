CREATE TABLE brand_assets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  byte_size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_brand_assets_user ON brand_assets(user_id);

CREATE TABLE brand_kits (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  heading_font TEXT NOT NULL,
  body_font TEXT NOT NULL,
  default_template TEXT CHECK (default_template IS NULL OR default_template IN ('template_1', 'template_2', 'template_3', 'template_4')),
  logo_asset_id TEXT REFERENCES brand_assets(id) ON DELETE SET NULL,
  is_default INTEGER NOT NULL DEFAULT 1 CHECK (is_default IN (0, 1)),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_brand_kits_default_user ON brand_kits(user_id) WHERE is_default = 1;
CREATE INDEX idx_brand_kits_user ON brand_kits(user_id, updated_at DESC);

ALTER TABLE carousels ADD COLUMN brand_kit_id TEXT REFERENCES brand_kits(id) ON DELETE SET NULL;
ALTER TABLE carousels ADD COLUMN brand_kit_revision INTEGER;
ALTER TABLE carousels ADD COLUMN brand_snapshot_json TEXT;
ALTER TABLE carousels ADD COLUMN brand_logo_asset_id TEXT REFERENCES brand_assets(id) ON DELETE SET NULL;
ALTER TABLE carousels ADD COLUMN style_overrides_json TEXT;

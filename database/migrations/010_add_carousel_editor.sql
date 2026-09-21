ALTER TABLE carousels ADD COLUMN original_slides_json TEXT;
ALTER TABLE carousels ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
UPDATE carousels SET original_slides_json = slides_json WHERE original_slides_json IS NULL;

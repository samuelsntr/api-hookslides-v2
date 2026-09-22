function parseJson(value) {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

function toBrandKit(row) {
  if (!row) return null;
  return {
    id: row.id,
    brandName: row.name,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    accentColor: row.accent_color,
    headingFont: row.heading_font,
    bodyFont: row.body_font,
    defaultTemplate: row.default_template,
    logoAssetId: row.logo_asset_id,
    logoUrl: row.logo_asset_id ? `/api/brand-assets/${row.logo_asset_id}` : null,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createBrandRepository(db) {
  const findKitRow = db.prepare('SELECT * FROM brand_kits WHERE user_id = ? AND is_default = 1');
  return {
    findDefault(userId) { return toBrandKit(findKitRow.get(userId)); },
    saveDefault({ id, userId, name, primaryColor, secondaryColor, accentColor, headingFont, bodyFont, defaultTemplate, logoAssetId, now }) {
      const existing = findKitRow.get(userId);
      if (existing) {
        db.prepare(`UPDATE brand_kits SET name = ?, primary_color = ?, secondary_color = ?, accent_color = ?,
          heading_font = ?, body_font = ?, default_template = ?, logo_asset_id = ?, revision = revision + 1, updated_at = ?
          WHERE id = ? AND user_id = ?`).run(name, primaryColor, secondaryColor, accentColor, headingFont, bodyFont, defaultTemplate, logoAssetId, now, existing.id, userId);
      } else {
        db.prepare(`INSERT INTO brand_kits (id, user_id, name, primary_color, secondary_color, accent_color, heading_font,
          body_font, default_template, logo_asset_id, is_default, revision, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?)`)
          .run(id, userId, name, primaryColor, secondaryColor, accentColor, headingFont, bodyFont, defaultTemplate, logoAssetId, now, now);
      }
      return toBrandKit(findKitRow.get(userId));
    },
    clearLogo(userId, now) {
      const existing = findKitRow.get(userId);
      if (!existing) return null;
      db.prepare('UPDATE brand_kits SET logo_asset_id = NULL, revision = revision + 1, updated_at = ? WHERE id = ?').run(now, existing.id);
      return { kit: toBrandKit(findKitRow.get(userId)), oldAssetId: existing.logo_asset_id };
    },
    createAsset({ id, userId, relativePath, mimeType, width, height, byteSize, createdAt }) {
      db.prepare(`INSERT INTO brand_assets (id, user_id, relative_path, mime_type, width, height, byte_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, userId, relativePath, mimeType, width, height, byteSize, createdAt);
      return this.findAsset(id, userId);
    },
    findAsset(id, userId) { return db.prepare('SELECT * FROM brand_assets WHERE id = ? AND user_id = ?').get(id, userId) || null; },
    findAssetById(id) { return db.prepare('SELECT * FROM brand_assets WHERE id = ?').get(id) || null; },
    assetIsReferenced(id) {
      return Boolean(db.prepare(`SELECT 1 FROM brand_kits WHERE logo_asset_id = ? UNION ALL
        SELECT 1 FROM carousels WHERE brand_logo_asset_id = ? LIMIT 1`).get(id, id));
    },
    deleteAsset(id) { return db.prepare('DELETE FROM brand_assets WHERE id = ?').run(id).changes > 0; },
    getSnapshot(userId) {
      const kit = toBrandKit(findKitRow.get(userId));
      if (!kit) return null;
      return {
        brandKitId: kit.id,
        brandKitRevision: kit.revision,
        logoAssetId: kit.logoAssetId,
        theme: {
          brandName: kit.brandName,
          primaryColor: kit.primaryColor,
          secondaryColor: kit.secondaryColor,
          accentColor: kit.accentColor,
          headingFont: kit.headingFont,
          bodyFont: kit.bodyFont,
          logoUrl: kit.logoUrl,
          showLogo: Boolean(kit.logoAssetId),
        },
        defaultTemplate: kit.defaultTemplate,
      };
    },
    parseStyleOverrides: parseJson,
  };
}

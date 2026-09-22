import crypto from 'node:crypto';
import { AppError } from '../constants/errors.js';
import { hasEntitlement } from '../constants/plans.js';
import { successResponse } from '../utils/apiResponse.js';

function requireBrandKit(user) {
  if (!hasEntitlement(user.plan, 'brandKit')) throw new AppError('Brand Kit is available on the Pro plan.', {
    status: 403, code: 'FEATURE_NOT_AVAILABLE', details: { feature: 'brandKit', requiredPlans: ['pro'] },
  });
}

export function createBrandController({ repository, storage }) {
  return {
    get: (req, res, next) => { try { requireBrandKit(req.user); return successResponse(res, 200, 'Brand Kit retrieved.', repository.findDefault(req.user.id)); } catch (error) { next(error); } },
    save: (req, res, next) => { try {
      requireBrandKit(req.user);
      const existing = repository.findDefault(req.user.id);
      const item = repository.saveDefault({ id: crypto.randomUUID(), userId: req.user.id, ...req.body, logoAssetId: existing?.logoAssetId || null, now: new Date().toISOString() });
      return successResponse(res, existing ? 200 : 201, existing ? 'Brand Kit updated.' : 'Brand Kit created.', item);
    } catch (error) { next(error); } },
    uploadLogo: async (req, res, next) => { let stored = null; try {
      requireBrandKit(req.user);
      if (!req.file) throw new AppError('Choose a PNG, JPEG, or WebP logo.', { status: 400, code: 'LOGO_REQUIRED' });
      const existing = repository.findDefault(req.user.id);
      if (!existing) throw new AppError('Save your Brand Kit before uploading a logo.', { status: 409, code: 'BRAND_KIT_REQUIRED' });
      const assetId = crypto.randomUUID();
      try { stored = await storage.normalize(req.file.buffer, assetId); }
      catch (error) {
        const tooLarge = error?.message === 'IMAGE_DIMENSIONS_TOO_LARGE';
        throw new AppError(tooLarge ? 'Logo dimensions are too large.' : 'This logo file is invalid or unsupported.', { status: 400, code: tooLarge ? 'LOGO_DIMENSIONS_TOO_LARGE' : 'INVALID_LOGO' });
      }
      repository.createAsset({ id: assetId, userId: req.user.id, ...stored, createdAt: new Date().toISOString() });
      const kit = repository.saveDefault({
        id: existing.id, userId: req.user.id, name: existing.brandName, primaryColor: existing.primaryColor,
        secondaryColor: existing.secondaryColor, accentColor: existing.accentColor, headingFont: existing.headingFont,
        bodyFont: existing.bodyFont, defaultTemplate: existing.defaultTemplate, logoAssetId: assetId, now: new Date().toISOString(),
      });
      if (existing.logoAssetId && !repository.assetIsReferenced(existing.logoAssetId)) {
        const old = repository.findAsset(existing.logoAssetId, req.user.id);
        if (old) await storage.remove(old.relative_path);
        repository.deleteAsset(existing.logoAssetId);
      }
      return successResponse(res, 200, 'Logo uploaded.', kit);
    } catch (error) { if (stored) await storage.remove(stored.relativePath).catch(() => {}); next(error); } },
    removeLogo: async (req, res, next) => { try {
      requireBrandKit(req.user);
      const result = repository.clearLogo(req.user.id, new Date().toISOString());
      if (!result) throw new AppError('Brand Kit not found.', { status: 404, code: 'NOT_FOUND' });
      if (result.oldAssetId && !repository.assetIsReferenced(result.oldAssetId)) {
        const old = repository.findAsset(result.oldAssetId, req.user.id);
        if (old) await storage.remove(old.relative_path);
        repository.deleteAsset(result.oldAssetId);
      }
      return successResponse(res, 200, 'Logo removed.', result.kit);
    } catch (error) { next(error); } },
    asset: async (req, res, next) => { try {
      const asset = repository.findAsset(req.params.id, req.user.id);
      if (!asset) throw new AppError('Brand asset not found.', { status: 404, code: 'NOT_FOUND' });
      res.set({ 'Content-Type': asset.mime_type, 'Cache-Control': 'private, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin' });
      return res.sendFile(storage.resolve(asset.relative_path));
    } catch (error) { next(error); } },
  };
}

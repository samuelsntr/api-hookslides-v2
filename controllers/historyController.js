import { AppError } from '../constants/errors.js';
import { successResponse } from '../utils/apiResponse.js';
import { hasEntitlement } from '../constants/plans.js';

function requireCanvasEditor(user) {
  if (!hasEntitlement(user.plan, 'canvasEditor')) {
    throw new AppError('Canvas Editor is available on Creator and Pro plans.', {
      status: 403,
      code: 'FEATURE_NOT_AVAILABLE',
      details: { feature: 'canvasEditor', requiredPlans: ['creator', 'pro'] },
    });
  }
}

export const createHistoryController = (repository) => ({
  list: (req, res, next) => { try { const result = repository.listCarousels({ ...req.query, userId: req.user.id }); return successResponse(res, 200, 'History retrieved successfully.', { items: result.items, pagination: { ...req.query, total: result.total, totalPages: Math.ceil(result.total / req.query.limit) } }); } catch (error) { next(error); } },
  get: (req, res, next) => { try { const item = repository.findCarouselById(req.params.id, req.user.id); if (!item) throw new AppError('Carousel not found.', { status: 404, code: 'NOT_FOUND' }); return successResponse(res, 200, 'History item retrieved successfully.', item); } catch (error) { next(error); } },
  getEditor: (req, res, next) => { try { requireCanvasEditor(req.user); const item = repository.findCarouselById(req.params.id, req.user.id); if (!item) throw new AppError('Carousel not found.', { status: 404, code: 'NOT_FOUND' }); return successResponse(res, 200, 'Carousel editor loaded.', item); } catch (error) { next(error); } },
  updateEditor: (req, res, next) => { try {
    requireCanvasEditor(req.user);
    const existing = repository.findCarouselById(req.params.id, req.user.id);
    if (!existing) throw new AppError('Carousel not found.', { status: 404, code: 'NOT_FOUND' });
    const item = repository.updateCarouselSlides({ id: req.params.id, userId: req.user.id, slides: req.body.slides, expectedRevision: req.body.expectedRevision, updatedAt: new Date().toISOString() });
    if (!item) {
      const latest = repository.findCarouselById(req.params.id, req.user.id);
      if (!latest) throw new AppError('Carousel not found.', { status: 404, code: 'NOT_FOUND' });
      throw new AppError('This carousel changed in another tab. Reload before saving again.', { status: 409, code: 'EDIT_CONFLICT', details: { currentRevision: latest.revision } });
    }
    return successResponse(res, 200, 'Carousel changes saved.', item);
  } catch (error) { next(error); } },
  remove: (req, res, next) => { try { if (!repository.deleteCarousel(req.params.id, req.user.id)) throw new AppError('Carousel not found.', { status: 404, code: 'NOT_FOUND' }); return successResponse(res, 200, 'Carousel deleted successfully.', null); } catch (error) { next(error); } }
});

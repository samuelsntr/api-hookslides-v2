import { AppError } from '../constants/errors.js';
import { successResponse } from '../utils/apiResponse.js';
export const createHistoryController = (repository) => ({
  list: (req, res, next) => { try { const result = repository.listCarousels({ ...req.query, userId: req.user.id }); return successResponse(res, 200, 'History retrieved successfully.', { items: result.items, pagination: { ...req.query, total: result.total, totalPages: Math.ceil(result.total / req.query.limit) } }); } catch (error) { next(error); } },
  get: (req, res, next) => { try { const item = repository.findCarouselById(req.params.id, req.user.id); if (!item) throw new AppError('Carousel not found.', { status: 404, code: 'NOT_FOUND' }); return successResponse(res, 200, 'History item retrieved successfully.', item); } catch (error) { next(error); } },
  remove: (req, res, next) => { try { if (!repository.deleteCarousel(req.params.id, req.user.id)) throw new AppError('Carousel not found.', { status: 404, code: 'NOT_FOUND' }); return successResponse(res, 200, 'Carousel deleted successfully.', null); } catch (error) { next(error); } }
});

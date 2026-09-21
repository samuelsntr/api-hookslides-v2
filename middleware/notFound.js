import { AppError } from '../constants/errors.js';

export function notFound(req, res, next) {
  next(new AppError('Route not found.', { status: 404, code: 'NOT_FOUND' }));
}

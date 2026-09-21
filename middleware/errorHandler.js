import { errorResponse } from '../utils/apiResponse.js';
import { logger } from '../config/logger.js';

export function errorHandler(error, req, res, next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = error.code || 'INTERNAL_ERROR';
  if (status >= 500) logger.error({ err: error, requestId: req.id, code }, 'request failed');
  else logger.warn({ requestId: req.id, code }, 'request rejected');
  return errorResponse(res, status, status >= 500 ? 'Internal server error.' : error.message, code, status >= 500 ? undefined : error.details);
}

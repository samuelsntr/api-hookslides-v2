import { AppError } from '../constants/errors.js';

export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) return next(new AppError('Validation failed.', { status: 400, code: 'VALIDATION_ERROR', details: result.error.issues }));
  if (source === 'query') {
    req.validatedQuery = result.data;
  } else {
    req[source] = result.data;
  }
  next();
};

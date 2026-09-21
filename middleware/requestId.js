import { createId } from '../utils/ids.js';

export function requestId(req, res, next) {
  const id = req.get('x-request-id') || createId();
  req.id = id;
  res.set('x-request-id', id);
  next();
}

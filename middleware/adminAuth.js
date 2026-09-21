import crypto from 'node:crypto';
import { AppError } from '../constants/errors.js';
import { env } from '../config/env.js';

export function adminAuth(req, res, next) {
  const secret = req.headers['x-admin-password'] || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
  const expected = process.env.ADMIN_PASSWORD || env.adminPassword;

  if (!expected) {
    return next(new AppError('Admin password is not configured on the server.', { status: 500, code: 'CONFIG_ERROR' }));
  }

  if (!secret) {
    return next(new AppError('Admin authentication required.', { status: 401, code: 'UNAUTHORIZED' }));
  }

  const secretBuf = Buffer.from(String(secret));
  const expectedBuf = Buffer.from(String(expected));

  if (secretBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(secretBuf, expectedBuf)) {
    return next(new AppError('Invalid admin credentials.', { status: 401, code: 'UNAUTHORIZED' }));
  }

  next();
}

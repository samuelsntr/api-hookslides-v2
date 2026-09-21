import { PLAN_ENTITLEMENTS } from './plans.js';

export const PLAN_LIMITS = Object.fromEntries(
  Object.entries(PLAN_ENTITLEMENTS).map(([plan, entitlements]) => [plan, entitlements.monthlyCarousels]),
);

export class AppError extends Error {
  constructor(message, { status = 500, code = 'INTERNAL_ERROR', details } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

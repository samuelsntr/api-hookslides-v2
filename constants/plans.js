export const PLANS = ['free', 'creator', 'pro'];

export const PLAN_ENTITLEMENTS = {
  free: { canvasEditor: false, monthlyCarousels: 5 },
  creator: { canvasEditor: true, monthlyCarousels: 50 },
  pro: { canvasEditor: true, monthlyCarousels: Infinity },
};

export function normalizePlan(plan) {
  if (plan === 'premium') return 'pro';
  return PLANS.includes(plan) ? plan : 'free';
}

export function getEntitlements(plan) {
  return PLAN_ENTITLEMENTS[normalizePlan(plan)];
}

export function hasEntitlement(plan, entitlement) {
  return Boolean(getEntitlements(plan)[entitlement]);
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { getEntitlements, hasEntitlement, normalizePlan } from '../constants/plans.js';

test('canvas editor is restricted to Creator and Pro', () => {
  assert.equal(hasEntitlement('free', 'canvasEditor'), false);
  assert.equal(hasEntitlement('creator', 'canvasEditor'), true);
  assert.equal(hasEntitlement('pro', 'canvasEditor'), true);
});

test('legacy premium accounts retain Pro access', () => {
  assert.equal(normalizePlan('premium'), 'pro');
  assert.equal(getEntitlements('premium').canvasEditor, true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { createDatabase } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';

test('admin endpoints require x-admin-password header', async () => {
  const db = createDatabase(':memory:');
  runMigrations(db);
  const testUserId = '11111111-1111-4111-8111-111111111111';
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(testUserId, 'plan_test_user', 'unused', '2026-09-21T00:00:00.000Z');
  const app = createApp({ database: db });
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();

  // Test unauthorized request
  const unauthRes = await fetch(`http://127.0.0.1:${port}/api/admin/stats`);
  const unauthBody = await unauthRes.json();
  assert.equal(unauthRes.status, 401);
  assert.equal(unauthBody.success, false);
  assert.equal(unauthBody.error.code, 'UNAUTHORIZED');

  // Test invalid password
  const wrongRes = await fetch(`http://127.0.0.1:${port}/api/admin/stats`, {
    headers: { 'x-admin-password': 'wrong-password' }
  });
  assert.equal(wrongRes.status, 401);

  // Test verify endpoint with correct password
  const verifyRes = await fetch(`http://127.0.0.1:${port}/api/admin/verify`, {
    headers: { 'x-admin-password': 'secretadmin' }
  });
  const verifyBody = await verifyRes.json();
  assert.equal(verifyRes.status, 200);
  assert.equal(verifyBody.success, true);
  assert.equal(verifyBody.data.authenticated, true);

  // Test stats endpoint with correct password
  const statsRes = await fetch(`http://127.0.0.1:${port}/api/admin/stats`, {
    headers: { 'x-admin-password': 'secretadmin' }
  });
  const statsBody = await statsRes.json();
  assert.equal(statsRes.status, 200);
  assert.equal(statsBody.success, true);
  assert.equal(typeof statsBody.data.totalUsers, 'number');
  assert.equal(typeof statsBody.data.totalCarousels, 'number');
  assert.ok(Array.isArray(statsBody.data.generations7Days));
  assert.ok(Array.isArray(statsBody.data.generations30Days));

  // Test users list endpoint
  const usersRes = await fetch(`http://127.0.0.1:${port}/api/admin/users`, {
    headers: { 'x-admin-password': 'secretadmin' }
  });
  const usersBody = await usersRes.json();
  assert.equal(usersRes.status, 200);
  assert.ok(Array.isArray(usersBody.data.items));

  // Admin can upgrade a user to Pro (stored as the existing premium plan).
  const upgradeRes = await fetch(`http://127.0.0.1:${port}/api/admin/users/${testUserId}/plan`, {
    method: 'PATCH',
    headers: { 'x-admin-password': 'secretadmin', 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'premium' })
  });
  const upgradeBody = await upgradeRes.json();
  assert.equal(upgradeRes.status, 200);
  assert.equal(upgradeBody.data.plan, 'premium');
  assert.equal(db.prepare('SELECT plan FROM users WHERE id = ?').get(testUserId).plan, 'premium');

  // The endpoint is strictly limited to supported plans.
  const invalidPlanRes = await fetch(`http://127.0.0.1:${port}/api/admin/users/${testUserId}/plan`, {
    method: 'PATCH',
    headers: { 'x-admin-password': 'secretadmin', 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'enterprise' })
  });
  assert.equal(invalidPlanRes.status, 400);

  // Non-admin callers cannot change subscriptions.
  const unauthorizedPlanRes = await fetch(`http://127.0.0.1:${port}/api/admin/users/${testUserId}/plan`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'free' })
  });
  assert.equal(unauthorizedPlanRes.status, 401);

  // Test carousels list endpoint
  const carouselsRes = await fetch(`http://127.0.0.1:${port}/api/admin/carousels`, {
    headers: { 'x-admin-password': 'secretadmin' }
  });
  const carouselsBody = await carouselsRes.json();
  assert.equal(carouselsRes.status, 200);
  assert.ok(Array.isArray(carouselsBody.data.items));

  server.close();
  db.close();
});

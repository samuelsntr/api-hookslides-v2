import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { createDatabase } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';

test('admin endpoints require x-admin-password header', async () => {
  const db = createDatabase(':memory:');
  runMigrations(db);
  const testUserId = '11111111-1111-4111-8111-111111111111';
  const testCarouselId = '22222222-2222-4222-8222-222222222222';
  db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(testUserId, 'plan_test_user', 'unused', '2026-09-21T00:00:00.000Z');
  db.prepare(`
    INSERT INTO carousels (
      id, title, source_type, original_input, strategy, template, slides_json,
      created_at, updated_at, user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    testCarouselId,
    'Admin delete test',
    'topic',
    'A test topic',
    'viral_hook',
    'template_1',
    '[]',
    '2026-09-21T00:00:00.000Z',
    '2026-09-21T00:00:00.000Z',
    testUserId
  );
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

  // Admin can upgrade a user to Pro.
  const upgradeRes = await fetch(`http://127.0.0.1:${port}/api/admin/users/${testUserId}/plan`, {
    method: 'PATCH',
    headers: { 'x-admin-password': 'secretadmin', 'content-type': 'application/json' },
    body: JSON.stringify({ plan: 'pro' })
  });
  const upgradeBody = await upgradeRes.json();
  assert.equal(upgradeRes.status, 200);
  assert.equal(upgradeBody.data.plan, 'pro');
  assert.equal(db.prepare('SELECT plan FROM users WHERE id = ?').get(testUserId).plan, 'pro');

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

  // User-hidden carousels remain available to admins and can be filtered.
  db.prepare('UPDATE carousels SET user_deleted_at = ? WHERE id = ?')
    .run('2026-09-22T00:00:00.000Z', testCarouselId);
  const hiddenCarouselsRes = await fetch(`http://127.0.0.1:${port}/api/admin/carousels?visibility=hidden`, {
    headers: { 'x-admin-password': 'secretadmin' }
  });
  const hiddenCarouselsBody = await hiddenCarouselsRes.json();
  assert.equal(hiddenCarouselsRes.status, 200);
  assert.equal(hiddenCarouselsBody.data.items.some((item) => item.id === testCarouselId && item.hiddenByUserAt), true);

  const visibleCarouselsRes = await fetch(`http://127.0.0.1:${port}/api/admin/carousels?visibility=visible`, {
    headers: { 'x-admin-password': 'secretadmin' }
  });
  const visibleCarouselsBody = await visibleCarouselsRes.json();
  assert.equal(visibleCarouselsBody.data.items.some((item) => item.id === testCarouselId), false);

  const invalidVisibilityRes = await fetch(`http://127.0.0.1:${port}/api/admin/carousels?visibility=deleted`, {
    headers: { 'x-admin-password': 'secretadmin' }
  });
  assert.equal(invalidVisibilityRes.status, 400);

  // Non-admin callers cannot delete another user's carousel.
  const unauthorizedDeleteRes = await fetch(`http://127.0.0.1:${port}/api/admin/carousels/${testCarouselId}`, {
    method: 'DELETE'
  });
  assert.equal(unauthorizedDeleteRes.status, 401);
  assert.ok(db.prepare('SELECT id FROM carousels WHERE id = ?').get(testCarouselId));

  // Admin can permanently delete a carousel regardless of ownership.
  const deleteRes = await fetch(`http://127.0.0.1:${port}/api/admin/carousels/${testCarouselId}`, {
    method: 'DELETE',
    headers: { 'x-admin-password': 'secretadmin' }
  });
  const deleteBody = await deleteRes.json();
  assert.equal(deleteRes.status, 200);
  assert.equal(deleteBody.data.id, testCarouselId);
  assert.equal(db.prepare('SELECT id FROM carousels WHERE id = ?').get(testCarouselId), undefined);

  // Repeating the deletion returns a clear not-found response.
  const missingDeleteRes = await fetch(`http://127.0.0.1:${port}/api/admin/carousels/${testCarouselId}`, {
    method: 'DELETE',
    headers: { 'x-admin-password': 'secretadmin' }
  });
  const missingDeleteBody = await missingDeleteRes.json();
  assert.equal(missingDeleteRes.status, 404);
  assert.equal(missingDeleteBody.error.code, 'NOT_FOUND');

  server.close();
  db.close();
});

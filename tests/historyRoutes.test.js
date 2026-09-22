import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../app.js';
import { createDatabase } from '../database/connection.js';
import { runMigrations } from '../database/migrate.js';
import { createHistoryRepository } from '../services/history/historyRepository.js';
import { tokenHash } from '../services/auth.js';

test('authenticated history API lists lightweight items, soft-deletes, and restores', async () => {
  const db = createDatabase(':memory:');
  runMigrations(db);
  const userId = '11111111-1111-4111-8111-111111111111';
  const carouselId = '22222222-2222-4222-8222-222222222222';
  const rawSession = 'history-test-session';
  db.prepare('INSERT INTO users (id, username, password_hash, created_at, plan) VALUES (?, ?, ?, ?, ?)')
    .run(userId, 'history_api_user', 'unused', '2026-09-22T00:00:00.000Z', 'creator');
  db.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash(rawSession), userId, '2099-01-01T00:00:00.000Z');
  const history = createHistoryRepository(db);
  const slides = ['hook', 'context', 'value', 'value', 'takeaway', 'cta'].map((type, index) => ({ type, heading: `Heading ${index}`, body: `Body ${index}` }));
  history.createCarousel({
    id: carouselId, userId, title: 'History API carousel', sourceType: 'topic', originalInput: 'Private original input', extractedContent: 'Large extracted content', source: null,
    strategy: 'viral_hook', template: 'template_1', language: 'english', slides, summary: 'Summary', captionIdeas: [], hashtags: [],
    createdAt: '2026-09-22T00:00:00.000Z', updatedAt: '2026-09-22T00:00:00.000Z',
  });

  const app = createApp({ database: db, services: { generation: {}, extraction: {}, history } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const headers = { cookie: `sid=${rawSession}` };

  try {
    const listRes = await fetch(`http://127.0.0.1:${port}/api/history?page=1&limit=9`, { headers });
    const listBody = await listRes.json();
    assert.equal(listRes.status, 200);
    assert.equal(listBody.data.items.length, 1);
    assert.equal(listBody.data.items[0].coverSlide.heading, 'Heading 0');
    assert.equal('originalInput' in listBody.data.items[0], false);
    assert.equal('extractedContent' in listBody.data.items[0], false);

    const deleteRes = await fetch(`http://127.0.0.1:${port}/api/history/${carouselId}`, { method: 'DELETE', headers });
    assert.equal(deleteRes.status, 200);
    assert.ok(db.prepare('SELECT user_deleted_at FROM carousels WHERE id = ?').get(carouselId).user_deleted_at);

    const hiddenDetailRes = await fetch(`http://127.0.0.1:${port}/api/history/${carouselId}`, { headers });
    assert.equal(hiddenDetailRes.status, 404);

    const restoreRes = await fetch(`http://127.0.0.1:${port}/api/history/${carouselId}/restore`, { method: 'POST', headers });
    assert.equal(restoreRes.status, 200);
    const restoredDetailRes = await fetch(`http://127.0.0.1:${port}/api/history/${carouselId}`, { headers });
    assert.equal(restoredDetailRes.status, 200);
  } finally {
    server.close();
    db.close();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { runMigrations } from '../database/migrate.js';
import { createHistoryRepository } from '../services/history/historyRepository.js';

test('source attribution metadata survives carousel persistence', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.prepare('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run('user-1', 'source-test', 'unused', '2026-09-21T00:00:00.000Z');

    const repository = createHistoryRepository(db);
    const source = {
      type: 'article',
      url: 'https://example.com/article',
      title: 'Example article',
      domain: 'example.com',
      channelName: null,
    };
    repository.createCarousel({
      id: 'carousel-1',
      userId: 'user-1',
      title: 'Carousel title',
      sourceType: 'article',
      originalInput: source.url,
      extractedContent: 'Useful article content.',
      source,
      strategy: 'viral_hook',
      template: 'template_1',
      language: 'indonesian',
      slides: [],
      summary: 'Summary',
      captionIdeas: [],
      hashtags: [],
      createdAt: '2026-09-21T00:00:00.000Z',
      updatedAt: '2026-09-21T00:00:00.000Z',
    });

    const saved = repository.findCarouselById('carousel-1', 'user-1');
    assert.deepEqual(saved.source, source);
    assert.equal(saved.language, 'indonesian');
  } finally {
    db.close();
  }
});

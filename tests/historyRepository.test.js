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

test('carousel content edits preserve the AI version and reject stale revisions', () => {
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.prepare('INSERT INTO users (id, username, password_hash, created_at, plan) VALUES (?, ?, ?, ?, ?)')
      .run('user-editor', 'editor-test', 'unused', '2026-09-21T00:00:00.000Z', 'creator');
    const repository = createHistoryRepository(db);
    const slides = ['hook', 'context', 'value', 'value', 'takeaway', 'cta'].map((type, index) => ({ type, heading: `Heading ${index}`, body: `Body ${index}` }));
    repository.createCarousel({
      id: 'carousel-editor', userId: 'user-editor', title: 'Editable carousel', sourceType: 'topic', originalInput: 'Topic', extractedContent: 'Topic', source: null,
      strategy: 'viral_hook', template: 'template_1', language: 'english', slides, summary: 'Summary', captionIdeas: [], hashtags: [],
      createdAt: '2026-09-21T00:00:00.000Z', updatedAt: '2026-09-21T00:00:00.000Z',
    });

    const edited = slides.map((slide, index) => index === 0 ? { ...slide, heading: 'Edited heading' } : slide);
    const saved = repository.updateCarouselSlides({ id: 'carousel-editor', userId: 'user-editor', slides: edited, expectedRevision: 1, updatedAt: '2026-09-21T00:01:00.000Z' });
    assert.equal(saved.revision, 2);
    assert.equal(saved.slides[0].heading, 'Edited heading');
    assert.equal(saved.originalSlides[0].heading, 'Heading 0');
    assert.equal(repository.updateCarouselSlides({ id: 'carousel-editor', userId: 'user-editor', slides, expectedRevision: 1, updatedAt: '2026-09-21T00:02:00.000Z' }), null);
    assert.equal(repository.updateCarouselSlides({ id: 'carousel-editor', userId: 'another-user', slides, expectedRevision: 2, updatedAt: '2026-09-21T00:02:00.000Z' }), null);
  } finally {
    db.close();
  }
});

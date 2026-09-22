import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import { runMigrations } from '../database/migrate.js';
import { createBrandRepository } from '../services/brand/brandRepository.js';
import { createLogoStorage } from '../services/brand/logoStorage.js';
import { hasEntitlement } from '../constants/plans.js';

test('Brand Kit is Pro-only and stores a future-ready default profile', () => {
  assert.equal(hasEntitlement('free', 'brandKit'), false);
  assert.equal(hasEntitlement('creator', 'brandKit'), false);
  assert.equal(hasEntitlement('pro', 'brandKit'), true);
  const db = new Database(':memory:');
  try {
    runMigrations(db);
    db.prepare('INSERT INTO users (id, username, password_hash, created_at, plan) VALUES (?, ?, ?, ?, ?)')
      .run('u1', 'brandowner', 'hash', '2026-09-22T00:00:00.000Z', 'pro');
    const repository = createBrandRepository(db);
    const saved = repository.saveDefault({ id: 'kit-1', userId: 'u1', name: 'Acme', primaryColor: '#112233', secondaryColor: '#F7F7F7', accentColor: '#FF5500', headingFont: 'fraunces', bodyFont: 'inter', defaultTemplate: 'template_2', logoAssetId: null, now: '2026-09-22T00:00:00.000Z' });
    assert.equal(saved.revision, 1);
    assert.equal(repository.getSnapshot('u1').theme.brandName, 'Acme');
    const updated = repository.saveDefault({ id: 'ignored', userId: 'u1', name: 'Acme 2', primaryColor: '#112233', secondaryColor: '#F7F7F7', accentColor: '#FF5500', headingFont: 'fraunces', bodyFont: 'inter', defaultTemplate: null, logoAssetId: null, now: '2026-09-22T01:00:00.000Z' });
    assert.equal(updated.id, 'kit-1');
    assert.equal(updated.revision, 2);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM brand_kits WHERE user_id = ?').get('u1').count, 1);
  } finally { db.close(); }
});

test('logo storage normalizes images into the configured uploads directory', async () => {
  const uploadsPath = fs.mkdtempSync(path.join(os.tmpdir(), 'hookslides-brand-'));
  const storage = createLogoStorage({ uploadsPath });
  await storage.ensureReady();
  const input = await sharp({ create: { width: 1800, height: 600, channels: 4, background: '#e24b2c' } }).png().toBuffer();
  const output = await storage.normalize(input, 'asset-id');
  assert.equal(output.mimeType, 'image/webp');
  assert.equal(output.width, 1200);
  assert.equal(output.height, 400);
  assert.ok(fs.existsSync(storage.resolve(output.relativePath)));
  await storage.remove(output.relativePath);
  fs.rmSync(uploadsPath, { recursive: true, force: true });
});

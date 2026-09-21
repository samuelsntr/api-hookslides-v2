import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { runMigrations } from '../database/migrate.js';

test('plan and editor migrations preserve legacy users, sessions, and carousels', () => {
  const db = new Database(':memory:');
  const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../database/migrations');
  try {
    db.pragma('foreign_keys = ON');
    db.exec('CREATE TABLE schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
    const legacyMigrations = fs.readdirSync(migrationsDirectory).filter((name) => name.endsWith('.sql') && name < '009').sort();
    for (const name of legacyMigrations) {
      const sql = fs.readFileSync(path.join(migrationsDirectory, name), 'utf8');
      const disablesForeignKeys = /PRAGMA\s+foreign_keys\s*=\s*off/i.test(sql);
      if (disablesForeignKeys) db.pragma('foreign_keys = OFF');
      db.exec(sql);
      if (disablesForeignKeys) db.pragma('foreign_keys = ON');
      db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run(name, new Date().toISOString());
    }

    db.prepare('INSERT INTO users (id, username, password_hash, created_at, plan) VALUES (?, ?, ?, ?, ?)')
      .run('legacy-user', 'legacy', 'hash', '2026-01-01T00:00:00.000Z', 'premium');
    db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run('legacy-session', 'legacy-user', '2099-01-01T00:00:00.000Z');
    db.prepare(`INSERT INTO carousels
      (id, user_id, title, source_type, original_input, strategy, template, slides_json, created_at, updated_at, caption_ideas_json, hashtags_json, language)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run('legacy-carousel', 'legacy-user', 'Title', 'topic', 'Topic', 'viral_hook', 'template_1', '[]', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', '[]', '[]', 'english');

    runMigrations(db);

    assert.equal(db.prepare('SELECT plan FROM users WHERE id = ?').get('legacy-user').plan, 'pro');
    assert.equal(db.prepare('SELECT user_id FROM sessions WHERE id = ?').get('legacy-session').user_id, 'legacy-user');
    assert.deepEqual(db.prepare('SELECT revision, original_slides_json FROM carousels WHERE id = ?').get('legacy-carousel'), { revision: 1, original_slides_json: '[]' });
    assert.deepEqual(db.pragma('foreign_key_check'), []);
  } finally {
    db.close();
  }
});

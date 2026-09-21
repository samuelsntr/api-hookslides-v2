import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { createDatabase } from './connection.js';

export function runMigrations(db) {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');
  for (const name of fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort()) {
    if (db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(name)) continue;
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    const disablesForeignKeys = /PRAGMA\s+foreign_keys\s*=\s*off/i.test(sql);
    if (disablesForeignKeys) db.pragma('foreign_keys = OFF');
    try {
      db.transaction(() => {
        db.exec(sql);
        db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(name, new Date().toISOString());
      })();
    } finally {
      if (disablesForeignKeys) db.pragma('foreign_keys = ON');
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const db = createDatabase(env.databasePath);
  runMigrations(db);
  db.close();
}

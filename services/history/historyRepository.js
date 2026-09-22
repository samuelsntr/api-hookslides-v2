import { toCarousel } from '../../models/carousel.js';
import { AppError, PLAN_LIMITS } from '../../constants/errors.js';

// Calendar-month bounds as ISO strings, e.g. now=2026-08-27 -> [2026-08-01T00:00:00.000Z, 2026-09-01T00:00:00.000Z)
function currentMonthRange(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function createHistoryRepository(db) {
  const insert = db.prepare(`INSERT INTO carousels
    (id, user_id, title, source_type, original_input, extracted_content, source_json, strategy, template, language, slides_json, original_slides_json, revision, summary, caption_ideas_json, hashtags_json, created_at, updated_at)
    VALUES (@id, @userId, @title, @sourceType, @originalInput, @extractedContent, @sourceJson, @strategy, @template, @language, @slidesJson, @originalSlidesJson, 1, @summary, @captionIdeasJson, @hashtagsJson, @createdAt, @updatedAt)`);
  const countThisMonth = db.prepare('SELECT COUNT(*) AS count FROM carousels WHERE user_id = ? AND created_at >= ? AND created_at < ?');

  function runInsert(record) {
    insert.run({
      ...record,
      language: record.language || 'english',
      sourceJson: record.source ? JSON.stringify(record.source) : null,
      slidesJson: JSON.stringify(record.slides),
      originalSlidesJson: JSON.stringify(record.slides),
      captionIdeasJson: JSON.stringify(record.captionIdeas),
      hashtagsJson: JSON.stringify(record.hashtags),
    });
    return record;
  }

  // Atomic check-and-insert: better-sqlite3 transactions run as one sync unit on Node's
  // single thread, so no other request can interleave between the count and the insert.
  // ponytail: single-process guarantee only; if the server is ever horizontally scaled,
  // swap for a DB-level constraint (e.g. a unique per-month usage row with UPSERT).
  const createCarouselIfAllowed = db.transaction((record, plan) => {
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    if (limit !== Infinity) {
      const { start, end } = currentMonthRange();
      const { count } = countThisMonth.get(record.userId, start, end);
      if (count >= limit) {
        throw new AppError('Monthly carousel generation limit reached.', {
          status: 429,
          code: 'GENERATION_LIMIT_REACHED',
          details: { usage: `${count}/${limit}`, resetsAt: end },
        });
      }
    }
    return runInsert(record);
  });

  return {
    createCarousel: runInsert,
    createCarouselIfAllowed,
    countThisMonth(userId) {
      const { start, end } = currentMonthRange();
      return countThisMonth.get(userId, start, end).count;
    },
    listCarousels({ page = 1, limit = 20, userId }) {
      const total = db.prepare('SELECT COUNT(*) AS total FROM carousels WHERE user_id = ? AND user_deleted_at IS NULL').get(userId).total;
      const rows = db.prepare(`SELECT id, title, source_type, source_json, template, language, summary, slides_json, created_at, updated_at
        FROM carousels
        WHERE user_id = ? AND user_deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?`).all(userId, limit, (page - 1) * limit);
      return {
        items: rows.map((row) => {
          let source = null;
          let coverSlide = null;
          try { source = row.source_json ? JSON.parse(row.source_json) : null; } catch { source = null; }
          try {
            const slides = JSON.parse(row.slides_json || '[]');
            coverSlide = Array.isArray(slides) ? slides[0] || null : null;
          } catch { coverSlide = null; }
          return {
            id: row.id,
            title: row.title,
            sourceType: row.source_type,
            source,
            template: row.template,
            language: row.language || 'english',
            summary: row.summary,
            coverSlide,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        }),
        total,
      };
    },
    findCarouselById(id, userId) { return toCarousel(db.prepare('SELECT * FROM carousels WHERE id = ? AND user_id = ? AND user_deleted_at IS NULL').get(id, userId)); },
    updateCarouselSlides({ id, userId, slides, expectedRevision, updatedAt }) {
      const result = db.prepare(`UPDATE carousels
        SET slides_json = ?, revision = revision + 1, updated_at = ?
        WHERE id = ? AND user_id = ? AND user_deleted_at IS NULL AND revision = ?`)
        .run(JSON.stringify(slides), updatedAt, id, userId, expectedRevision);
      if (!result.changes) return null;
      return toCarousel(db.prepare('SELECT * FROM carousels WHERE id = ? AND user_id = ? AND user_deleted_at IS NULL').get(id, userId));
    },
    hideCarousel(id, userId, deletedAt) {
      return db.prepare('UPDATE carousels SET user_deleted_at = ? WHERE id = ? AND user_id = ? AND user_deleted_at IS NULL')
        .run(deletedAt, id, userId).changes > 0;
    },
    restoreCarousel(id, userId) {
      return db.prepare('UPDATE carousels SET user_deleted_at = NULL WHERE id = ? AND user_id = ? AND user_deleted_at IS NOT NULL')
        .run(id, userId).changes > 0;
    }
  };
}

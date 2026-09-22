import { AppError } from '../constants/errors.js';
import { toCarousel } from '../models/carousel.js';

export function createAdminController(db) {
  return {
    verify(req, res) {
      res.json({
        success: true,
        message: 'Admin credentials verified.',
        data: { authenticated: true, timestamp: new Date().toISOString() }
      });
    },

    getStats(req, res) {
      const nowIso = new Date().toISOString();
      const totalUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get()?.count || 0;
      const totalCarousels = db.prepare('SELECT COUNT(*) AS count FROM carousels').get()?.count || 0;
      const activeSessions = db.prepare('SELECT COUNT(DISTINCT user_id) AS count FROM sessions WHERE expires_at > ?').get(nowIso)?.count || 0;
      
      const planBreakdown = db.prepare(`
        SELECT COALESCE(plan, 'free') AS plan, COUNT(*) AS count 
        FROM users 
        GROUP BY plan
      `).all();

      const sourceTypeBreakdown = db.prepare(`
        SELECT source_type AS sourceType, COUNT(*) AS count 
        FROM carousels 
        GROUP BY source_type
      `).all();

      const strategyBreakdown = db.prepare(`
        SELECT strategy, COUNT(*) AS count 
        FROM carousels 
        GROUP BY strategy
      `).all();

      const templateBreakdown = db.prepare(`
        SELECT template, COUNT(*) AS count 
        FROM carousels 
        GROUP BY template
      `).all();

      function getDailySeries(days) {
        const result = [];
        const map = new Map();
        const rows = db.prepare(`
          SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count 
          FROM carousels 
          WHERE created_at >= date('now', '-' || ? || ' days')
          GROUP BY substr(created_at, 1, 10)
        `).all(days);
        
        for (const row of rows) {
          map.set(row.date, row.count);
        }

        const now = new Date();
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 86400000);
          const dateStr = d.toISOString().slice(0, 10);
          result.push({
            date: dateStr,
            count: map.get(dateStr) || 0
          });
        }
        return result;
      }

      const generations7Days = getDailySeries(7);
      const generations30Days = getDailySeries(30);

      res.json({
        success: true,
        message: 'Admin stats retrieved.',
        data: {
          totalUsers,
          totalCarousels,
          activeSessions,
          planBreakdown,
          sourceTypeBreakdown,
          strategyBreakdown,
          templateBreakdown,
          generations7Days,
          generations30Days,
          recentGenerations: generations30Days
        }
      });
    },

    getUsers(req, res) {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
      const offset = (page - 1) * limit;
      const search = (req.query.q || '').trim();
      const plan = (req.query.plan || '').trim();

      const conditions = [];
      const params = [];

      if (search) {
        conditions.push('(u.username LIKE ? OR u.id LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
      }

      if (plan) {
        conditions.push('u.plan = ?');
        params.push(plan);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRow = db.prepare(`
        SELECT COUNT(*) AS total 
        FROM users u 
        ${whereClause}
      `).get(...params);
      const total = countRow?.total || 0;

      const users = db.prepare(`
        SELECT 
          u.id, 
          u.username, 
          COALESCE(u.plan, 'free') AS plan, 
          u.created_at,
          (SELECT COUNT(*) FROM carousels c WHERE c.user_id = u.id) AS carousels_count,
          (SELECT MAX(c.created_at) FROM carousels c WHERE c.user_id = u.id) AS last_active_at,
          (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.expires_at > ?) AS active_sessions_count
        FROM users u
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `).all(new Date().toISOString(), ...params, limit, offset);

      res.json({
        success: true,
        message: 'Users list retrieved.',
        data: {
          items: users,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    },

    getUserById(req, res, next) {
      const { id } = req.params;
      const user = db.prepare(`
        SELECT id, username, COALESCE(plan, 'free') AS plan, created_at
        FROM users 
        WHERE id = ?
      `).get(id);

      if (!user) {
        return next(new AppError('User not found.', { status: 404, code: 'NOT_FOUND' }));
      }

      const carousels = db.prepare(`
        SELECT id, title, source_type, strategy, template, created_at, updated_at, user_deleted_at
        FROM carousels 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT 20
      `).all(id);

      const stats = db.prepare(`
        SELECT 
          COUNT(*) AS total_carousels,
          MAX(created_at) AS last_carousel_at
        FROM carousels 
        WHERE user_id = ?
      `).get(id);

      res.json({
        success: true,
        message: 'User details retrieved.',
        data: {
          ...user,
          stats,
          recentCarousels: carousels
        }
      });
    },

    updateUserPlan(req, res, next) {
      const { id } = req.params;
      const { plan } = req.body;
      const result = db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, id);

      if (result.changes === 0) {
        return next(new AppError('User not found.', { status: 404, code: 'NOT_FOUND' }));
      }

      const user = db.prepare('SELECT id, username, plan, created_at FROM users WHERE id = ?').get(id);
      return res.json({
        success: true,
        message: plan === 'free' ? 'User changed to the Free plan.' : `User changed to the ${plan === 'pro' ? 'Pro' : 'Creator'} plan.`,
        data: user,
      });
    },

    getCarousels(req, res) {
      const query = req.validatedQuery || req.query;
      const page = Math.max(1, parseInt(query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
      const offset = (page - 1) * limit;
      const search = (query.q || '').trim();
      const sourceType = (query.sourceType || '').trim();
      const strategy = (query.strategy || '').trim();
      const userId = (query.userId || '').trim();
      const visibility = query.visibility || 'all';

      const conditions = [];
      const params = [];

      if (search) {
        conditions.push('(c.title LIKE ? OR c.original_input LIKE ? OR u.username LIKE ?)');
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (sourceType) {
        conditions.push('c.source_type = ?');
        params.push(sourceType);
      }

      if (strategy) {
        conditions.push('c.strategy = ?');
        params.push(strategy);
      }

      if (userId) {
        conditions.push('c.user_id = ?');
        params.push(userId);
      }

      if (visibility === 'visible') {
        conditions.push('c.user_deleted_at IS NULL');
      } else if (visibility === 'hidden') {
        conditions.push('c.user_deleted_at IS NOT NULL');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const countRow = db.prepare(`
        SELECT COUNT(*) AS total 
        FROM carousels c
        LEFT JOIN users u ON c.user_id = u.id
        ${whereClause}
      `).get(...params);
      const total = countRow?.total || 0;

      const rows = db.prepare(`
        SELECT 
          c.id,
          c.user_id,
          u.username,
          c.title,
          c.source_type,
          c.strategy,
          c.template,
          c.summary,
          c.slides_json,
          c.caption_ideas_json,
          c.hashtags_json,
          c.created_at,
          c.updated_at,
          c.user_deleted_at
        FROM carousels c
        LEFT JOIN users u ON c.user_id = u.id
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
      `).all(...params, limit, offset);

      const items = rows.map((row) => {
        let slideCount = 0;
        try {
          const parsed = JSON.parse(row.slides_json || '[]');
          slideCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch {
          slideCount = 0;
        }

        return {
          id: row.id,
          userId: row.user_id,
          username: row.username || 'Anonymous / Legacy',
          title: row.title,
          sourceType: row.source_type,
          strategy: row.strategy,
          template: row.template,
          summary: row.summary,
          slideCount,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          hiddenByUserAt: row.user_deleted_at || null
        };
      });

      res.json({
        success: true,
        message: 'Carousels list retrieved.',
        data: {
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    },

    getCarouselById(req, res, next) {
      const { id } = req.params;
      const row = db.prepare(`
        SELECT c.*, u.username
        FROM carousels c
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.id = ?
      `).get(id);

      if (!row) {
        return next(new AppError('Carousel not found.', { status: 404, code: 'NOT_FOUND' }));
      }

      const carousel = toCarousel(row);
      res.json({
        success: true,
        message: 'Carousel details retrieved.',
        data: {
          ...carousel,
          user: {
            id: row.user_id,
            username: row.username || 'Anonymous / Legacy'
          }
        }
      });
    },

    deleteCarousel(req, res, next) {
      const { id } = req.params;
      const result = db.prepare('DELETE FROM carousels WHERE id = ?').run(id);

      if (result.changes === 0) {
        return next(new AppError('Carousel not found.', { status: 404, code: 'NOT_FOUND' }));
      }

      return res.json({
        success: true,
        message: 'Carousel deleted successfully.',
        data: { id }
      });
    }
  };
}

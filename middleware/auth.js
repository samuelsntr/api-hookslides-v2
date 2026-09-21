import { AppError } from '../constants/errors.js';
import { tokenHash } from '../services/auth.js';
export function auth({ db }) { return (req,res,next) => { const token=req.headers.cookie?.match(/sid=([^;]+)/)?.[1]; const row=token&&db.prepare('SELECT u.id,u.username,u.plan FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>?').get(tokenHash(token),new Date().toISOString()); if(!row)return next(new AppError('Authentication required.',{status:401,code:'UNAUTHORIZED'})); req.user=row; req.sessionId=token; next(); }; }

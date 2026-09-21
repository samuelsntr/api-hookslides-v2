import crypto from 'node:crypto';
const hash = (value, salt = crypto.randomBytes(16).toString('hex')) => new Promise((resolve, reject) => crypto.scrypt(value, salt, 64, (e, key) => e ? reject(e) : resolve(`${salt}:${key.toString('hex')}`)));
const verify = (value, stored) => new Promise((resolve, reject) => { const [salt, hex] = stored.split(':'); crypto.scrypt(value, salt, 64, (e, key) => e ? reject(e) : resolve(crypto.timingSafeEqual(key, Buffer.from(hex, 'hex')))); });
export const normalizeUsername = (username) => username.trim().toLowerCase();
export const validUsername = (username) => /^[a-z0-9_]{3,32}$/.test(username);
export const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');
export function createAuthRepository(db) { return { async register(username, password) { username=normalizeUsername(username); if(db.prepare('SELECT id FROM users WHERE username=?').get(username)) return null; const id=crypto.randomUUID(); db.prepare('INSERT INTO users (id,username,password_hash,created_at) VALUES (?,?,?,?)').run(id,username,await hash(password),new Date().toISOString()); return {id,username,plan:'free'}; }, async login(username,password) { const row=db.prepare('SELECT * FROM users WHERE username=?').get(normalizeUsername(username)); if(!row || !(await verify(password,row.password_hash))) return null; return {id:row.id,username:row.username,plan:row.plan}; }, find(id) { return db.prepare('SELECT id,username,plan FROM users WHERE id=?').get(id); } }; }
export const sessionId = () => crypto.randomBytes(32).toString('hex');

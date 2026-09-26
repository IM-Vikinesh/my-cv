import crypto from 'node:crypto';

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
export const MAX_MESSAGES = 200;

export class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.status(status).json(body);
}

export function fail(res, err) {
  if (err instanceof AppError) {
    return sendJson(res, err.status, { error: err.message });
  }
  console.error('[api] unhandled', err);
  return sendJson(res, 500, { error: 'Server error. Check the function logs in Vercel.' });
}

/* ----------------------------- configuration ----------------------------- */

export function adminToken() {
  return (process.env.ADMIN_TOKEN || '').trim();
}

export function adminUser() {
  return (process.env.ADMIN_USER || 'admin').trim();
}

export function requireConfigured() {
  if (!adminToken()) {
    throw new AppError(
      503,
      'Admin access is not configured. Set the ADMIN_TOKEN environment variable in Vercel and redeploy.'
    );
  }
}

/* --------------------------- stateless sessions -------------------------- */
// The session token is a signed "username.expiresAt" pair. It carries no
// secrets (the HMAC key never leaves the server) and needs no session store,
// so it survives cold starts and works across every device you sign in on.

function b64url(input) {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function unb64url(input) {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function sign(payload) {
  return crypto.createHmac('sha256', adminToken()).update(payload).digest('base64url');
}

export function createSession(username) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${username}.${expiresAt}`;
  return { token: `${b64url(payload)}.${sign(payload)}`, username, expiresAt };
}

export function readSession(req) {
  requireConfigured();
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!bearer) throw new AppError(401, 'Sign in to continue.');

  const dot = bearer.lastIndexOf('.');
  if (dot < 1) throw new AppError(401, 'Session expired. Please sign in again.');

  let payload;
  let provided;
  try {
    payload = unb64url(bearer.slice(0, dot));
    provided = bearer.slice(dot + 1);
  } catch {
    throw new AppError(401, 'Session expired. Please sign in again.');
  }

  const expected = sign(payload);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new AppError(401, 'Session expired. Please sign in again.');
  }

  const sep = payload.lastIndexOf('.');
  const username = payload.slice(0, sep);
  const expiresAt = Number(payload.slice(sep + 1));
  if (!username || !Number.isFinite(expiresAt) || Date.now() > expiresAt) {
    throw new AppError(401, 'Session expired. Please sign in again.');
  }
  return { username, expiresAt };
}

export function verifyPassword(candidate, expected) {
  const a = Buffer.from(String(candidate ?? ''));
  const b = Buffer.from(String(expected ?? ''));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/* --------------------------------- database ------------------------------- */
// `@vercel/postgres` is created lazily so a missing database surfaces as a
// clear 503 instead of a module-load crash on every route.

let dbPromise = null;

async function connect() {
  if (!process.env.POSTGRES_URL && !process.env.POSTGRES_URL_NON_POOLING) {
    throw new AppError(
      503,
      'No database connected. Create a Postgres database in the Vercel project, link it, then redeploy.'
    );
  }
  const { sql } = await import('@vercel/postgres');
  return sql;
}

export async function db() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const sql = await connect();
      await sql`
        CREATE TABLE IF NOT EXISTS portfolio_state (
          id          text PRIMARY KEY,
          payload     jsonb NOT NULL,
          updated_at  timestamptz NOT NULL DEFAULT now()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS portfolio_messages (
          id          serial PRIMARY KEY,
          name        text NOT NULL,
          email       text NOT NULL,
          subject     text,
          message     text NOT NULL,
          created_at  timestamptz NOT NULL DEFAULT now()
        )
      `;
      return sql;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/* ------------------------------ input cleaning ---------------------------- */

const str = (value, max) => String(value ?? '').trim().slice(0, max);

export function cleanMessage(input) {
  const name = str(input && input.name, 120);
  const email = str(input && input.email, 200);
  const subject = str(input && input.subject, 200);
  const message = str(input && input.message, 5000);
  if (!name) throw new AppError(400, 'Please fill in your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AppError(400, 'Please enter a valid email.');
  if (!message) throw new AppError(400, 'Please write a message.');
  return { name, email, subject, message };
}

export async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new AppError(413, 'Payload too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new AppError(400, 'Invalid JSON body.');
  }
}

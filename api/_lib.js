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

// Signs sessions. Deliberately separate from the password: once the owner
// changes their password in Firestore, existing sessions must stay valid, so
// the two secrets cannot be the same value.
export function sessionSecret() {
  return (process.env.SESSION_SECRET || '').trim() || adminToken();
}

export function requireConfigured() {
  if (!sessionSecret()) {
    throw new AppError(
      503,
      'Admin access is not configured. Set SESSION_SECRET (and ADMIN_TOKEN) in Vercel and redeploy.'
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
  return crypto.createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
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

/* ---------------------------- password storage --------------------------- */
// The owner can set their own password from the admin panel, so it cannot live
// in an environment variable. It is stored in Firestore as a salted scrypt
// hash: if somebody ever reads the database they get a hash, not a password.

const SCRYPT = { N: 16384, r: 8, p: 1 };

export const MIN_PASSWORD_LENGTH = 8;

export function hashSecret(value) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(value), salt, 64, SCRYPT);
  return { algo: 'scrypt', salt: salt.toString('base64'), hash: hash.toString('base64') };
}

export function verifySecret(candidate, record) {
  if (!record || record.algo !== 'scrypt' || !record.salt || !record.hash) return false;
  let expected;
  try {
    expected = Buffer.from(record.hash, 'base64');
  } catch {
    return false;
  }
  if (!expected.length) return false;
  let actual;
  try {
    actual = crypto.scryptSync(String(candidate ?? ''), Buffer.from(record.salt, 'base64'), expected.length, SCRYPT);
  } catch {
    return false;
  }
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function checkPasswordPolicy(password) {
  const value = String(password ?? '');
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(400, 'Use at least ' + MIN_PASSWORD_LENGTH + ' characters.');
  }
  if (value.length > 200) {
    throw new AppError(400, 'That password is too long.');
  }
  if (value === adminUser()) {
    throw new AppError(400, 'The password cannot be the same as your username.');
  }
  return value;
}

// Prefers the password the owner set in the panel, and falls back to
// ADMIN_TOKEN until they set one. If Firestore is unreachable the fallback
// still applies, so a database outage cannot lock the owner out.
export async function verifyPasswordCandidate(candidate) {
  let record = null;
  try {
    record = await (await db()).getAdminCredential();
  } catch {
    record = null;
  }
  if (record) return verifySecret(candidate, record);
  return verifyPassword(candidate, adminToken());
}

/* --------------------------- brute-force throttling ---------------------- */
// A password the owner chose may be weaker than a generated one, so repeated
// failures are counted per address and temporarily locked out. The address is
// hashed, so no visitor IP is stored in plain text.

const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

export function clientKey(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const raw = (typeof forwarded === 'string' ? forwarded.split(',')[0] : '') || (req.socket && req.socket.remoteAddress) || 'unknown';
  return crypto.createHash('sha256').update(String(raw).trim()).digest('base64url').slice(0, 32);
}

export async function lockoutRemaining(req) {
  let attempt = null;
  try {
    attempt = await (await db()).getLoginAttempt(clientKey(req));
  } catch {
    return 0;
  }
  if (!attempt || !attempt.lockedUntil) return 0;
  return Math.max(0, attempt.lockedUntil - Date.now());
}

export async function noteFailedAttempt(req) {
  try {
    await (await db()).noteLoginFailure(clientKey(req), MAX_ATTEMPTS, ATTEMPT_WINDOW_MS, LOCK_MS);
  } catch {
    /* throttling is best-effort; never block a legitimate sign-in on it */
  }
}

export async function clearFailedAttempts(req) {
  try {
    await (await db()).clearLoginAttempt(clientKey(req));
  } catch {
    /* ignore */
  }
}

/* -------------------------------- firebase -------------------------------- */
// Firestore is only ever reached through these functions using the Admin SDK,
// which bypasses Firestore security rules. The service account never reaches
// the browser, and the rules can stay completely closed.

let storePromise = null;

function normaliseKey(value) {
  // A private key pasted into a single-line env var arrives with literal
  // backslash-n sequences instead of real newlines.
  return String(value || '').replace(/\\n/g, '\n');
}

function serviceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  if (raw) {
    let json;
    try {
      json = raw.startsWith('{') ? JSON.parse(raw) : JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch (e) {
      throw new AppError(500, 'FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON.');
    }
    const sa = {
      projectId: json.project_id || json.projectId,
      clientEmail: json.client_email || json.clientEmail,
      privateKey: normaliseKey(json.private_key || json.privateKey),
    };
    if (sa.projectId && sa.clientEmail && sa.privateKey) return sa;
    throw new AppError(500, 'FIREBASE_SERVICE_ACCOUNT is missing project_id, client_email or private_key.');
  }

  const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
  const privateKey = normaliseKey(process.env.FIREBASE_PRIVATE_KEY);
  if (projectId && clientEmail && privateKey) return { projectId, clientEmail, privateKey };

  throw new AppError(
    503,
    'Firebase is not connected. Add the service account as FIREBASE_SERVICE_ACCOUNT in Vercel, then redeploy.'
  );
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  if (typeof value._seconds === 'number') return new Date(value._seconds * 1000).toISOString();
  return null;
}

async function buildStore() {
  const [{ initializeApp, cert, getApps, getApp }, { getFirestore, FieldValue }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ]);

  const sa = serviceAccount();
  const app = getApps().length ? getApp() : initializeApp({ credential: cert(sa) });
  const db = getFirestore(app);

  const siteRef = db.collection('portfolio').doc('site');
  const messages = db.collection('portfolioMessages');
  const configRef = db.collection('config').doc('admin');
  const attempts = db.collection('loginAttempts');

  return {
    async getData() {
      const snap = await siteRef.get();
      if (!snap.exists) return null;
      const value = snap.data() || {};
      return { data: value.data ?? null, updatedAt: toIso(value.updatedAt) };
    },

    async setData(data) {
      await siteRef.set({ data, updatedAt: FieldValue.serverTimestamp() });
      // Read back so the client stores the exact stamp later polls compare to.
      // Firestore can briefly hand back an unresolved server timestamp on a
      // read-after-write, so fall back rather than returning null: the client
      // treats a null stamp as "unknown" and would re-apply once per poll.
      const snap = await siteRef.get();
      const readBack = toIso((snap.data() || {}).updatedAt);
      return { updatedAt: readBack || new Date().toISOString() };
    },

    async listMessages() {
      const snap = await messages.orderBy('createdAt', 'desc').limit(MAX_MESSAGES).get();
      return snap.docs.map((docSnap) => {
        const value = docSnap.data() || {};
        return {
          id: docSnap.id,
          name: value.name || '',
          email: value.email || '',
          subject: value.subject || '',
          message: value.message || '',
          createdAt: toIso(value.createdAt),
        };
      });
    },

    async addMessages(list) {
      const batch = db.batch();
      for (const message of list) {
        batch.set(messages.doc(), { ...message, createdAt: FieldValue.serverTimestamp() });
      }
      await batch.commit();
      await this.trimMessages();
      return list.length;
    },

    // Keeps the newest MAX_MESSAGES and drops the rest, so an unattended
    // contact form cannot grow without bound.
    async trimMessages() {
      const stale = await messages.orderBy('createdAt', 'desc').offset(MAX_MESSAGES).limit(200).get();
      if (stale.empty) return;
      const batch = db.batch();
      stale.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    },

    async deleteMessage(id) {
      const ref = messages.doc(String(id));
      if (!ref.id || ref.path.length > 1500) throw new AppError(400, 'Provide a valid message id.');
      await ref.delete();
      return 1;
    },

    async clearMessages() {
      let removed = 0;
      for (;;) {
        const snap = await messages.orderBy('createdAt', 'desc').limit(400).get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach((docSnap) => batch.delete(docSnap.ref));
        await batch.commit();
        removed += snap.size;
        if (snap.size < 400) break;
      }
      return removed;
    },

    // The password the owner set from the admin panel. Absent until they do.
    async getAdminCredential() {
      const snap = await configRef.get();
      return snap.exists ? snap.data() || null : null;
    },

    async setAdminCredential(record) {
      await configRef.set({ ...record, updatedAt: FieldValue.serverTimestamp() });
    },

    async getLoginAttempt(key) {
      const snap = await attempts.doc(key).get();
      return snap.exists ? snap.data() || null : null;
    },

    async noteLoginFailure(key, max, windowMs, lockMs) {
      const now = Date.now();
      const current = await this.getLoginAttempt(key);
      const within = current && now - (current.firstAt || 0) < windowMs;
      const count = within ? (current.count || 0) + 1 : 1;
      await attempts.doc(key).set({
        count,
        firstAt: within ? current.firstAt : now,
        lockedUntil: count >= max ? now + lockMs : 0,
      });
      return count;
    },

    async clearLoginAttempt(key) {
      await attempts.doc(key).delete();
    },
  };
}

export async function db() {
  if (!storePromise) {
    storePromise = buildStore().catch((err) => {
      storePromise = null;
      throw err;
    });
  }
  return storePromise;
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

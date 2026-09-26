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

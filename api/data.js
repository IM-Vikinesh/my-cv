import { AppError, db, fail, readJsonBody, readSession, sendJson } from './_lib.js';

export default async function handler(req, res) {
  try {
    const method = req.method;
    if (method !== 'GET' && method !== 'PUT') {
      res.setHeader('Allow', 'GET, PUT');
      return sendJson(res, 405, { error: 'Use GET or PUT.' });
    }

    // Reject unauthenticated writes before spending a Firestore call on them.
    if (method === 'PUT') readSession(req);

    const store = await db();

    if (method === 'GET') {
      // Portfolio content is public by definition, so this is unauthenticated.
      // `no-store` (see vercel.json) keeps the Vercel edge from serving a stale copy.
      const row = await store.getData();
      if (!row) return sendJson(res, 200, { data: null, updatedAt: null });
      return sendJson(res, 200, { data: row.data, updatedAt: row.updatedAt });
    }

    const body = await readJsonBody(req);
    const data = body && body.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError(400, 'Expected a JSON object under "data".');
    }
    if (JSON.stringify(data).length > 512 * 1024) {
      throw new AppError(413, 'Site content is too large to store.');
    }

    const { updatedAt } = await store.setData(data);
    return sendJson(res, 200, { ok: true, updatedAt });
  } catch (err) {
    return fail(res, err);
  }
}

import { AppError, db, fail, readJsonBody, readSession, sendJson } from './_lib.js';

const ROW_ID = 'site';

export default async function handler(req, res) {
  try {
    const method = req.method;
    if (method !== 'GET' && method !== 'PUT') {
      res.setHeader('Allow', 'GET, PUT');
      return sendJson(res, 405, { error: 'Use GET or PUT.' });
    }

    // Reject unauthenticated writes before spending a database connection on them.
    if (method === 'PUT') readSession(req);

    const sql = await db();

    if (method === 'GET') {
      // Portfolio content is public by definition, so this is unauthenticated.
      // `no-store` (see vercel.json) keeps the Vercel edge from serving a stale copy.
      const { rows } = await sql`SELECT payload, updated_at FROM portfolio_state WHERE id = ${ROW_ID}`;
      if (!rows.length) return sendJson(res, 200, { data: null, updatedAt: null });
      return sendJson(res, 200, { data: rows[0].payload, updatedAt: rows[0].updated_at });
    }

    const body = await readJsonBody(req);
    const data = body && body.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new AppError(400, 'Expected a JSON object under "data".');
    }
    if (JSON.stringify(data).length > 512 * 1024) {
      throw new AppError(413, 'Site content is too large to store.');
    }

    const { rows } = await sql`
      INSERT INTO portfolio_state (id, payload, updated_at)
      VALUES (${ROW_ID}, ${sql.json(data)}, now())
      ON CONFLICT (id) DO UPDATE
        SET payload = EXCLUDED.payload, updated_at = now()
      RETURNING updated_at
    `;
    return sendJson(res, 200, { ok: true, updatedAt: rows[0].updated_at });
  } catch (err) {
    return fail(res, err);
  }
}

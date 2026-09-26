import { AppError, MAX_MESSAGES, cleanMessage, db, fail, readJsonBody, readSession, sendJson } from './_lib.js';

export default async function handler(req, res) {
  try {
    const method = req.method;
    if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return sendJson(res, 405, { error: 'Use GET, POST or DELETE.' });
    }

    if (method === 'GET' || method === 'DELETE') readSession(req);

    const sql = await db();

    if (method === 'GET') {
      const { rows } = await sql`
        SELECT id, name, email, subject, message, created_at
        FROM portfolio_messages
        ORDER BY created_at DESC, id DESC
        LIMIT ${MAX_MESSAGES}
      `;
      return sendJson(res, 200, {
        messages: rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          subject: r.subject,
          message: r.message,
          createdAt: r.created_at,
        })),
      });
    }

    if (method === 'POST') {
      const body = await readJsonBody(req);
      const incoming = Array.isArray(body) ? body : [body];
      if (!incoming.length) throw new AppError(400, 'Nothing to save.');
      if (incoming.length > MAX_MESSAGES) throw new AppError(400, 'Too many messages in one request.');

      const cleaned = incoming.map(cleanMessage);
      let saved = 0;
      await sql.begin(async (tx) => {
        for (const m of cleaned) {
          await tx`
            INSERT INTO portfolio_messages (name, email, subject, message)
            VALUES (${m.name}, ${m.email}, ${m.subject}, ${m.message})
          `;
          saved += 1;
        }
      });
      await sql`
        DELETE FROM portfolio_messages
        WHERE id NOT IN (SELECT id FROM portfolio_messages ORDER BY created_at DESC, id DESC LIMIT ${MAX_MESSAGES})
      `;
      return sendJson(res, 201, { ok: true, saved });
    }

    const body = await readJsonBody(req);
    if (body && body.all === true) {
      const { rowCount } = await sql`DELETE FROM portfolio_messages`;
      return sendJson(res, 200, { ok: true, deleted: rowCount });
    }
    const id = Number(body && body.id);
    if (!Number.isInteger(id)) throw new AppError(400, 'Provide a numeric message id.');
    const { rowCount } = await sql`DELETE FROM portfolio_messages WHERE id = ${id}`;
    return sendJson(res, 200, { ok: true, deleted: rowCount });
  } catch (err) {
    return fail(res, err);
  }
}

import { AppError, MAX_MESSAGES, cleanMessage, db, fail, readJsonBody, readSession, sendJson } from './_lib.js';

export default async function handler(req, res) {
  try {
    const method = req.method;
    if (method !== 'GET' && method !== 'POST' && method !== 'DELETE') {
      res.setHeader('Allow', 'GET, POST, DELETE');
      return sendJson(res, 405, { error: 'Use GET, POST or DELETE.' });
    }

    if (method === 'GET' || method === 'DELETE') readSession(req);

    const store = await db();

    if (method === 'GET') {
      return sendJson(res, 200, { messages: await store.listMessages() });
    }

    if (method === 'POST') {
      const body = await readJsonBody(req);
      const incoming = Array.isArray(body) ? body : [body];
      if (!incoming.length) throw new AppError(400, 'Nothing to save.');
      if (incoming.length > MAX_MESSAGES) throw new AppError(400, 'Too many messages in one request.');

      const cleaned = incoming.map(cleanMessage);
      const saved = await store.addMessages(cleaned);
      return sendJson(res, 201, { ok: true, saved });
    }

    const body = await readJsonBody(req);
    if (body && body.all === true) {
      return sendJson(res, 200, { ok: true, deleted: await store.clearMessages() });
    }
    if (body && (body.id === undefined || body.id === null || body.id === '')) {
      throw new AppError(400, 'Provide a message id.');
    }
    return sendJson(res, 200, { ok: true, deleted: await store.deleteMessage(body.id) });
  } catch (err) {
    return fail(res, err);
  }
}

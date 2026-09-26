import {
  createSession,
  fail,
  readJsonBody,
  sendJson,
  verifyPassword,
  adminToken,
  adminUser,
  requireConfigured,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Use POST.' });
  }

  try {
    requireConfigured();
    const { username, password } = await readJsonBody(req);
    const okUser = verifyPassword(String(username ?? '').trim(), adminUser());
    const okPass = verifyPassword(password, adminToken());
    if (!okUser || !okPass) {
      return sendJson(res, 401, { error: 'Invalid username or password.' });
    }
    const session = createSession(adminUser());
    return sendJson(res, 200, session);
  } catch (err) {
    return fail(res, err);
  }
}

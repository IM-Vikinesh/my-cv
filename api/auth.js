import {
  adminToken,
  adminUser,
  checkPasswordPolicy,
  clearFailedAttempts,
  createSession,
  db,
  fail,
  hashSecret,
  lockoutRemaining,
  noteFailedAttempt,
  readJsonBody,
  readSession,
  sendJson,
  verifyPassword,
  verifyPasswordCandidate,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Use POST.' });
  }

  try {
    const body = await readJsonBody(req);
    const action = (body && body.action) || 'login';

    // `await` matters: returning the promise directly would let its
    // rejection escape this try/catch and surface as an unhandled error.
    if (action === 'change-password') return await changePassword(req, res, body);
    if (action !== 'login') return sendJson(res, 400, { error: 'Unknown action.' });

    // Throttle before doing any password work, so guessing is expensive.
    const waitMs = await lockoutRemaining(req);
    if (waitMs > 0) {
      const minutes = Math.max(1, Math.ceil(waitMs / 60000));
      return sendJson(res, 429, {
        error: 'Too many failed sign-in attempts. Try again in ' + minutes + ' minute' + (minutes === 1 ? '' : 's') + '.',
      });
    }

    requireConfiguredForLogin();
    const { username, password } = body;
    const okUser = verifyPassword(String(username ?? '').trim(), adminUser());
    const okPass = await verifyPasswordCandidate(password);
    if (!okUser || !okPass) {
      await noteFailedAttempt(req);
      return sendJson(res, 401, { error: 'Invalid username or password.' });
    }

    await clearFailedAttempts(req);
    return sendJson(res, 200, createSession(adminUser()));
  } catch (err) {
    return fail(res, err);
  }
}

function requireConfiguredForLogin() {
  // A session secret is always needed to sign the token, even when the
  // password itself now lives in Firestore.
  if (!(process.env.SESSION_SECRET || '').trim() && !adminToken()) {
    const err = new Error('Admin access is not configured. Set SESSION_SECRET and ADMIN_TOKEN in Vercel and redeploy.');
    err.status = 503;
    throw err;
  }
}

async function changePassword(req, res, body) {
  // Must already be signed in, and must prove the current password. Without
  // the second check a stolen session could lock the owner out permanently.
  readSession(req);
  requireConfiguredForLogin();

  const current = body.currentPassword;
  const next = body.newPassword;

  if (!(await verifyPasswordCandidate(current))) {
    await noteFailedAttempt(req);
    return sendJson(res, 401, { error: 'Your current password is not correct.' });
  }

  const policyChecked = checkPasswordPolicy(next);
  if (policyChecked === String(current ?? '')) {
    return sendJson(res, 400, { error: 'The new password must be different from the current one.' });
  }

  await (await db()).setAdminCredential(hashSecret(policyChecked));
  await clearFailedAttempts(req);

  return sendJson(res, 200, {
    ok: true,
    message: 'Password updated. Use it the next time you sign in.',
  });
}

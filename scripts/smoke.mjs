/**
 * End-to-end smoke test against the running dev server and Firebase emulators.
 *
 * Exercises the whole hybrid access model over real HTTP: sign-in, event creation, code
 * redemption, a direct-to-bucket upload, finalize, media URL minting, moderation, code
 * rotation, and the guardrails that are supposed to say no.
 *
 * Run with the emulators and `npm run dev` already up:
 *   node scripts/smoke.mjs
 */
import { Buffer } from 'node:buffer';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const PROJECT = 'wallboard-dev';
const API_KEY = 'demo-api-key';

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** A cookie jar just big enough to act like one browser session. */
function newSession() {
  return { cookies: new Map() };
}

function cookieHeader(session) {
  return [...session.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function absorbCookies(session, response) {
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const [pair] = raw.split(';');
    const index = pair.indexOf('=');
    const name = pair.slice(0, index);
    const value = pair.slice(index + 1);
    if (value === '') session.cookies.delete(name);
    else session.cookies.set(name, value);
  }
}

async function call(session, path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(session.cookies.size ? { Cookie: cookieHeader(session) } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  absorbCookies(session, response);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  return { status: response.status, payload };
}

async function authRequest(path, body) {
  const response = await fetch(`${AUTH}/${path}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`Auth emulator ${path}: ${JSON.stringify(json)}`);
  return json;
}

/** A real, identified account. */
async function signUp(email) {
  const { idToken } = await authRequest('accounts:signUp', {
    email,
    password: 'smoke-password-123',
    returnSecureToken: true,
  });
  const session = newSession();
  const result = await call(session, '/api/session', { method: 'POST', body: { idToken } });
  if (result.status !== 200) throw new Error(`Session exchange failed: ${JSON.stringify(result)}`);
  return { session, actor: result.payload.data.actor };
}

/** A code-only visitor. */
async function signInAnonymously() {
  const { idToken } = await authRequest('accounts:signUp', { returnSecureToken: true });
  const session = newSession();
  const result = await call(session, '/api/session', { method: 'POST', body: { idToken } });
  if (result.status !== 200) throw new Error(`Anon session failed: ${JSON.stringify(result)}`);
  return { session, actor: result.payload.data.actor };
}

/** A 1x1 PNG — small, but a real image with real magic bytes. */
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function uploadThroughTarget(target, bytes) {
  const response = await fetch(target.url, {
    method: target.method,
    headers: target.headers,
    body: new Uint8Array(bytes),
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
}

/**
 * Clears the rate-limit buckets in the emulator.
 *
 * The suite deliberately makes more join attempts than the per-IP limit allows, so without
 * this a second run would be throttled by its own first run. Only the rate-limit
 * collection is touched — events, posts and users from previous runs are left alone.
 */
async function resetRateLimits() {
  const root = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
  const headers = { Authorization: 'Bearer owner' };
  const listed = await fetch(`${root}/rateLimits?pageSize=300`, { headers });
  if (!listed.ok) return;
  const { documents = [] } = await listed.json();
  await Promise.all(
    documents.map((doc) =>
      fetch(`${root}/${doc.name.split('/documents/')[1]}`, {
        method: 'DELETE',
        headers,
      }),
    ),
  );
  if (documents.length) console.log(`  (cleared ${documents.length} rate-limit buckets)\n`);
}

async function main() {
  console.log(`\nWallboard smoke test → ${BASE}\n`);
  await resetRateLimits();

  // --- identity ------------------------------------------------------------
  const stamp = Date.now();
  const host = await signUp(`host-${stamp}@example.com`);
  check('host signs in and gets a session', host.actor?.uid?.length > 0);
  check('host is not anonymous', host.actor?.isAnonymous === false);

  const guest = await signInAnonymously();
  check('guest gets an anonymous session', guest.actor?.isAnonymous === true);

  // --- event creation ------------------------------------------------------
  const created = await call(host.session, '/api/events/create', {
    method: 'POST',
    body: {
      title: 'Smoke test party',
      description: 'Automated run',
      expiryPresetId: '24h',
      themeId: 'sunset',
      allowedKinds: ['text', 'image', 'video', 'audio'],
    },
  });
  check('host creates an event', created.status === 200, JSON.stringify(created.payload));
  const eventId = created.payload?.data?.event?.id;
  const joinCode = created.payload?.data?.joinCode;
  check('event returns a join code once', typeof joinCode === 'string' && joinCode.length === 8);

  const anonCreate = await call(guest.session, '/api/events/create', {
    method: 'POST',
    body: { title: 'Nope', expiryPresetId: '1h' },
  });
  check('anonymous visitor cannot create an event', anonCreate.status === 403);

  // --- joining -------------------------------------------------------------
  const badJoin = await call(guest.session, '/api/events/join', {
    method: 'POST',
    body: { code: 'ZZZZZZZZ' },
  });
  check('a wrong code is rejected', badJoin.status === 404);

  const guestJoin = await call(guest.session, '/api/events/join', {
    method: 'POST',
    body: { code: joinCode },
  });
  check('guest redeems the code', guestJoin.status === 200, JSON.stringify(guestJoin.payload));
  check('guest joins as a viewer, not a poster', guestJoin.payload?.data?.role === 'viewer');
  check('guest is told they cannot post', guestJoin.payload?.data?.canPost === false);

  const repeatJoin = await call(guest.session, '/api/events/join', {
    method: 'POST',
    body: { code: joinCode },
  });
  check('re-joining is idempotent', repeatJoin.payload?.data?.alreadyMember === true);

  const member = await signUp(`member-${stamp}@example.com`);
  const memberJoin = await call(member.session, '/api/events/join', {
    method: 'POST',
    body: { code: joinCode },
  });
  check('signed-in visitor joins as a member', memberJoin.payload?.data?.role === 'member');

  // --- access boundaries ---------------------------------------------------
  const outsider = await signUp(`outsider-${stamp}@example.com`);
  const outsiderPeek = await call(outsider.session, `/api/events/${eventId}`);
  check('a non-member cannot read the event', outsiderPeek.status === 404);

  const guestCode = await call(guest.session, `/api/events/${eventId}/code`);
  check('a guest cannot read the join code', guestCode.status === 403 || guestCode.status === 404);

  const memberCode = await call(member.session, `/api/events/${eventId}/code`);
  check('a plain member cannot read the join code', memberCode.status === 403);

  const hostCode = await call(host.session, `/api/events/${eventId}/code`);
  check('the host can read the join code', hostCode.status === 200);
  check('the code read back matches', hostCode.payload?.data?.code === joinCode);

  // --- posting -------------------------------------------------------------
  const guestPost = await call(guest.session, '/api/posts', {
    method: 'POST',
    body: { eventId, body: 'guests should not get through' },
  });
  check('an anonymous guest cannot post', guestPost.status === 403);

  const textPost = await call(member.session, '/api/posts', {
    method: 'POST',
    body: { eventId, body: 'Hello from the smoke test' },
  });
  check('a member posts text', textPost.status === 200, JSON.stringify(textPost.payload));

  const emptyPost = await call(member.session, '/api/posts', {
    method: 'POST',
    body: { eventId, body: '   ' },
  });
  check('an empty post is rejected', emptyPost.status === 400);

  // --- media upload --------------------------------------------------------
  const target = await call(member.session, '/api/posts/upload-target', {
    method: 'POST',
    body: { eventId, kind: 'image', mimeType: 'image/png', bytes: PNG_BYTES.length },
  });
  check('member gets an upload target', target.status === 200, JSON.stringify(target.payload));

  await uploadThroughTarget(target.payload.data, PNG_BYTES);

  const mediaPost = await call(member.session, '/api/posts', {
    method: 'POST',
    body: {
      eventId,
      body: 'With a picture',
      upload: {
        uploadId: target.payload.data.uploadId,
        kind: 'image',
        width: 1,
        height: 1,
      },
    },
  });
  check(
    'the upload finalizes into a post',
    mediaPost.status === 200,
    JSON.stringify(mediaPost.payload),
  );
  const postId = mediaPost.payload?.data?.post?.id;
  check('the post carries one media asset', mediaPost.payload?.data?.post?.media?.length === 1);

  const oversized = await call(member.session, '/api/posts/upload-target', {
    method: 'POST',
    body: { eventId, kind: 'image', mimeType: 'image/png', bytes: 500 * 1024 * 1024 },
  });
  check('an oversized upload is refused up front', oversized.status === 400);

  const wrongType = await call(member.session, '/api/posts/upload-target', {
    method: 'POST',
    body: { eventId, kind: 'image', mimeType: 'application/x-msdownload', bytes: 1024 },
  });
  check('a disallowed MIME type is refused', wrongType.status === 400);

  // A client that lies about its size still gets caught, because finalize measures the
  // object that actually landed rather than trusting the declaration.
  const honestTarget = await call(member.session, '/api/posts/upload-target', {
    method: 'POST',
    body: { eventId, kind: 'audio', mimeType: 'audio/mpeg', bytes: 1024 },
  });
  await uploadThroughTarget(honestTarget.payload.data, PNG_BYTES);
  const mismatched = await call(member.session, '/api/posts', {
    method: 'POST',
    body: {
      eventId,
      body: '',
      upload: { uploadId: honestTarget.payload.data.uploadId, kind: 'image' },
    },
  });
  check('finalize refuses an upload claimed as the wrong kind', mismatched.status === 400);

  // --- media URLs ----------------------------------------------------------
  const media = await call(member.session, `/api/media/${eventId}?postId=${postId}`);
  check('a member gets media URLs', media.status === 200, JSON.stringify(media.payload));
  check(
    'media URLs are time-bound',
    (media.payload?.data?.media?.[0]?.urlExpiresAt ?? 0) > Date.now(),
  );

  const outsiderMedia = await call(outsider.session, `/api/media/${eventId}?postId=${postId}`);
  check('a non-member gets no media URLs', outsiderMedia.status === 404);

  // --- moderation ----------------------------------------------------------
  const outsiderDelete = await call(outsider.session, `/api/posts/${eventId}/${postId}`, {
    method: 'DELETE',
  });
  check(
    'a non-member cannot delete a post',
    outsiderDelete.status === 404 || outsiderDelete.status === 403,
  );

  const hostDelete = await call(host.session, `/api/posts/${eventId}/${postId}`, {
    method: 'DELETE',
  });
  check(
    'the host can remove any post',
    hostDelete.status === 200,
    JSON.stringify(hostDelete.payload),
  );

  const deleteAgain = await call(host.session, `/api/posts/${eventId}/${postId}`, {
    method: 'DELETE',
  });
  check('deleting twice is a no-op, not an error path', deleteAgain.status === 404);

  // --- code rotation -------------------------------------------------------
  const rotated = await call(host.session, `/api/events/${eventId}/code`, { method: 'POST' });
  check('the host rotates the code', rotated.status === 200);
  check('rotation produces a different code', rotated.payload?.data?.code !== joinCode);

  const staleJoin = await call(outsider.session, '/api/events/join', {
    method: 'POST',
    body: { code: joinCode },
  });
  check('the old code stops working immediately', staleJoin.status === 404);

  const freshJoin = await call(outsider.session, '/api/events/join', {
    method: 'POST',
    body: { code: rotated.payload.data.code },
  });
  check('the new code works', freshJoin.status === 200);

  // --- ending the event ----------------------------------------------------
  const memberEnd = await call(member.session, `/api/events/${eventId}/end`, { method: 'POST' });
  check('a member cannot end the event', memberEnd.status === 403);

  const hostEnd = await call(host.session, `/api/events/${eventId}/end`, { method: 'POST' });
  check('the host ends the event', hostEnd.status === 200);

  const postAfterEnd = await call(member.session, '/api/posts', {
    method: 'POST',
    body: { eventId, body: 'too late' },
  });
  check('posting to an ended event is refused', postAfterEnd.status === 410);

  const detailAfterEnd = await call(host.session, `/api/events/${eventId}`);
  check('the event reads as ended', detailAfterEnd.payload?.data?.event?.status === 'ended');

  // --- security headers ----------------------------------------------------
  const headResponse = await fetch(`${BASE}/`);
  const csp = headResponse.headers.get('content-security-policy') ?? '';
  check('CSP is present with a nonce', csp.includes("'nonce-"));
  check('CSP forbids framing', csp.includes("frame-ancestors 'none'"));
  check('CSP forbids objects', csp.includes("object-src 'none'"));
  check('nosniff is set', headResponse.headers.get('x-content-type-options') === 'nosniff');
  check('referrer policy is set', !!headResponse.headers.get('referrer-policy'));
  check('the framework version is not advertised', !headResponse.headers.get('x-powered-by'));

  // --- sign out ------------------------------------------------------------
  await call(member.session, '/api/session', { method: 'DELETE' });
  const afterSignOut = await call(member.session, `/api/events/${eventId}`);
  check('signing out revokes API access', afterSignOut.status === 401);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\nSmoke test crashed:', error);
  process.exit(1);
});

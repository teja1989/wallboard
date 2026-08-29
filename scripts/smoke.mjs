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
import { readFile } from 'node:fs/promises';

const BASE = process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:3000';
const AUTH = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const PROJECT = 'marquee-dev';
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

/**
 * Refuses to run against a server that is not this build.
 *
 * `next start` fails with EADDRINUSE when an older instance is still holding the port — and
 * that older instance keeps answering perfectly well, so every readiness check passes and the
 * suite quietly tests the previous build. It has produced a confident, entirely fictitious
 * failure report more than once. Next writes a fresh id into `.next/BUILD_ID` on every build
 * and serves its assets under that id, so asking for one is a direct question: are you the
 * build on disk?
 *
 * Skipped when there is no local build to compare against, which is the case when this is
 * pointed at a deployed environment.
 */
async function assertServerIsThisBuild() {
  let buildId;
  try {
    buildId = (await readFile(new URL('../.next/BUILD_ID', import.meta.url), 'utf8')).trim();
  } catch {
    return;
  }
  if (!buildId) return;

  const probe = await fetch(`${BASE}/_next/static/${buildId}/_buildManifest.js`).catch(() => null);
  if (probe?.ok) return;

  console.error(
    `\nThe server at ${BASE} is not serving this build (${buildId}).\n` +
      'An older `next start` is probably still holding the port — the new one exits with\n' +
      'EADDRINUSE while the old one keeps answering. Stop it and start again:\n\n' +
      "  kill $(ps -eo pid,args | grep '[n]ext-server' | awk '{print $1}')\n" +
      '  npm run build && npm start\n',
  );
  process.exit(1);
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

/**
 * The same account twice.
 *
 * Most of this suite makes a fresh address per run, but the owner's is fixed by config —
 * `OWNER_EMAILS` names one address and that is the one that gets the role. So the second run
 * would collide on sign-up, and falling back to a password sign-in is what makes the owner
 * assertions re-runnable rather than green exactly once.
 */
async function signUpOrIn(email) {
  let idToken;
  try {
    ({ idToken } = await authRequest('accounts:signUp', {
      email,
      password: 'smoke-password-123',
      returnSecureToken: true,
    }));
  } catch {
    ({ idToken } = await authRequest('accounts:signInWithPassword', {
      email,
      password: 'smoke-password-123',
      returnSecureToken: true,
    }));
  }
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

/** A 1x1 WebP, standing in for the resized copies a browser would encode. */
const WEBP_BYTES = Buffer.from('UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==', 'base64');

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
  await assertServerIsThisBuild();

  console.log(`\nMarquee smoke test → ${BASE}\n`);
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
      occasion: 'party',
      hostedBy: 'The smoke test',
      expiryPresetId: '24h',
      templateId: 'sunset',
      startsAt: Date.now() + 3 * 24 * 60 * 60 * 1000,
      location: { name: 'The Rooftop', address: '14 Bridge Street', url: null },
      rsvp: { enabled: true, allowPlusOnes: true, maxPartySize: 4 },
      allowedKinds: ['text', 'image', 'video', 'audio'],
    },
  });
  check('host creates an event', created.status === 200, JSON.stringify(created.payload));
  const eventId = created.payload?.data?.event?.id;
  const joinCode = created.payload?.data?.joinCode;
  check('event returns a join code once', typeof joinCode === 'string' && joinCode.length === 8);

  // The plan is written onto the event at creation, not derived from global state when read.
  // Before this, every event was stamped `free` and merely behaved as pro, so turning billing
  // on would have downgraded every live event and revoked its archive mid-event.
  const stamped = await call(host.session, `/api/events/${eventId}`);
  check(
    'the event is stamped with the plan it was granted, not free',
    stamped.payload?.data?.event?.plan === 'pro',
    JSON.stringify(stamped.payload?.data?.event?.plan),
  );

  const anonCreate = await call(guest.session, '/api/events/create', {
    method: 'POST',
    body: { title: 'Nope', occasion: 'party', expiryPresetId: '24h' },
  });
  check('anonymous visitor cannot create an event', anonCreate.status === 403);

  const badDates = await call(host.session, '/api/events/create', {
    method: 'POST',
    body: {
      title: 'Backwards',
      occasion: 'party',
      expiryPresetId: '24h',
      startsAt: Date.now() + 86_400_000,
      endsAt: Date.now(),
    },
  });
  check('an end time before the start time is rejected', badDates.status === 400);

  const badLink = await call(host.session, '/api/events/create', {
    method: 'POST',
    body: {
      title: 'Dodgy link',
      occasion: 'party',
      expiryPresetId: '24h',
      location: { name: 'X', address: '', url: 'javascript:alert(1)' },
    },
  });
  check('a non-http location link is rejected', badLink.status === 400);

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

  const outsider = await signUp(`outsider-${stamp}@example.com`);
  const member = await signUp(`member-${stamp}@example.com`);
  const memberJoin = await call(member.session, '/api/events/join', {
    method: 'POST',
    body: { code: joinCode },
  });
  check('signed-in visitor joins as a member', memberJoin.payload?.data?.role === 'member');

  // --- RSVP ----------------------------------------------------------------
  const guestRsvp = await call(guest.session, `/api/events/${eventId}/rsvp`, {
    method: 'POST',
    body: { status: 'yes', adults: 2, children: 1 },
  });
  check(
    'an anonymous guest can answer the invitation',
    guestRsvp.status === 200,
    JSON.stringify(guestRsvp.payload),
  );
  check('their party size is recorded', guestRsvp.payload?.data?.rsvp?.partySize === 3);
  check(
    'the breakdown is recorded, not just the total',
    guestRsvp.payload?.data?.rsvp?.adults === 2 && guestRsvp.payload?.data?.rsvp?.children === 1,
    JSON.stringify(guestRsvp.payload?.data?.rsvp),
  );

  const oversizedParty = await call(member.session, `/api/events/${eventId}/rsvp`, {
    method: 'POST',
    body: { status: 'yes', adults: 9 },
  });
  check('a party larger than the host allowed is refused', oversizedParty.status === 400);

  const memberRsvp = await call(member.session, `/api/events/${eventId}/rsvp`, {
    method: 'POST',
    body: { status: 'maybe', adults: 2, children: 1 },
  });
  check('a member can answer maybe', memberRsvp.status === 200);
  check('maybe does not carry a party', memberRsvp.payload?.data?.rsvp?.partySize === 1);
  check('maybe carries no children either', memberRsvp.payload?.data?.rsvp?.children === 0);

  const changed = await call(member.session, `/api/events/${eventId}/rsvp`, {
    method: 'POST',
    body: { status: 'no' },
  });
  check('a guest can change their mind', changed.status === 200);
  check('the change is recognised as a change', changed.payload?.data?.rsvp?.status === 'no');

  const badStatus = await call(member.session, `/api/events/${eventId}/rsvp`, {
    method: 'POST',
    body: { status: 'pending' },
  });
  check('pending cannot be chosen as an answer', badStatus.status === 400);

  const strangerRsvp = await call(outsider.session, `/api/events/${eventId}/rsvp`, {
    method: 'POST',
    body: { status: 'yes' },
  });
  check('someone without the code cannot RSVP', strangerRsvp.status === 404);

  // --- guest list ----------------------------------------------------------
  const guestList = await call(host.session, `/api/events/${eventId}/guests`);
  check(
    'the host sees the guest list',
    guestList.status === 200,
    JSON.stringify(guestList.payload),
  );
  check('the host sees private notes', guestList.payload?.data?.canSeeNotes === true);

  const tally = guestList.payload?.data?.tally;
  // Host said yes (1), the anonymous guest brought two adults and a child (3), the member
  // said no. The headcount is people, not replies — which is the number a host is actually
  // trying to find out.
  check('the headcount adds up', tally?.attending === 4, JSON.stringify(tally));
  check('the tally counts the refusal', tally?.no === 1, JSON.stringify(tally));

  const guestView = await call(member.session, `/api/events/${eventId}/guests`);
  check('a member sees the guest list', guestView.status === 200);
  check('a member does not see private notes', guestView.payload?.data?.canSeeNotes === false);
  check(
    'private notes are absent from a member response entirely',
    (guestView.payload?.data?.guests ?? []).every((g) => g.note === undefined),
  );

  const strangerGuests = await call(outsider.session, `/api/events/${eventId}/guests`);
  check('a non-member cannot see the guest list', strangerGuests.status === 404);

  // --- access boundaries ---------------------------------------------------
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
    body: {
      eventId,
      kind: 'image',
      mimeType: 'image/png',
      bytes: PNG_BYTES.length,
      variants: ['preview', 'display'],
    },
  });
  check('member gets an upload target', target.status === 200, JSON.stringify(target.payload));
  check(
    'the target includes one slot per resized copy',
    Boolean(target.payload?.data?.variants?.preview && target.payload?.data?.variants?.display),
    JSON.stringify(target.payload),
  );

  await uploadThroughTarget(target.payload.data.original, PNG_BYTES);
  await uploadThroughTarget(target.payload.data.variants.preview, WEBP_BYTES);
  await uploadThroughTarget(target.payload.data.variants.display, WEBP_BYTES);

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
        variants: ['preview', 'display'],
      },
    },
  });
  check(
    'the upload finalizes into a post',
    mediaPost.status === 200,
    JSON.stringify(mediaPost.payload),
  );
  const postId = mediaPost.payload?.data?.post?.id;
  const asset = mediaPost.payload?.data?.post?.media?.[0];
  check('the post carries one media asset', mediaPost.payload?.data?.post?.media?.length === 1);
  check(
    'the resized copies are promoted alongside the original',
    Boolean(asset?.previewPath && asset?.displayPath),
    JSON.stringify(asset),
  );

  // A derivative that never lands must not break the post — the wall falls back to the
  // original rather than showing a hole.
  const partialTarget = await call(member.session, '/api/posts/upload-target', {
    method: 'POST',
    body: {
      eventId,
      kind: 'image',
      mimeType: 'image/png',
      bytes: PNG_BYTES.length,
      variants: ['preview', 'display'],
    },
  });
  await uploadThroughTarget(partialTarget.payload.data.original, PNG_BYTES);
  await uploadThroughTarget(partialTarget.payload.data.variants.preview, WEBP_BYTES);
  const partialPost = await call(member.session, '/api/posts', {
    method: 'POST',
    body: {
      eventId,
      body: 'Half resized',
      upload: {
        uploadId: partialTarget.payload.data.uploadId,
        kind: 'image',
        variants: ['preview', 'display'],
      },
    },
  });
  const partialAsset = partialPost.payload?.data?.post?.media?.[0];
  check(
    'a missing derivative leaves the post intact',
    partialPost.status === 200 && !!partialAsset?.previewPath && partialAsset?.displayPath === null,
    JSON.stringify(partialPost.payload),
  );

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
  await uploadThroughTarget(honestTarget.payload.data.original, PNG_BYTES);
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
  // One batch for the whole wall. The paths come from the client's own listener, and the
  // route authorises them by prefix rather than re-reading every post.
  const wallPaths = [asset.objectPath, asset.previewPath, asset.displayPath];
  const media = await call(member.session, `/api/media/${eventId}`, {
    method: 'POST',
    body: { paths: wallPaths },
  });
  check('a member gets media URLs', media.status === 200, JSON.stringify(media.payload));
  check(
    'every requested path is signed in one round trip',
    wallPaths.every((path) => typeof media.payload?.data?.urls?.[path] === 'string'),
    JSON.stringify(media.payload),
  );
  check('media URLs are time-bound', (media.payload?.data?.expiresAt ?? 0) > Date.now());

  // The prefix is the access control, so a path belonging to another event must not sign.
  const foreign = await call(member.session, `/api/media/${eventId}`, {
    method: 'POST',
    body: { paths: ['events/someotherevent01/posts/somepost123/original.png'] },
  });
  check(
    'a path from another event is refused a URL',
    foreign.status === 200 && Object.keys(foreign.payload?.data?.urls ?? {}).length === 0,
    JSON.stringify(foreign.payload),
  );

  const traversal = await call(member.session, `/api/media/${eventId}`, {
    method: 'POST',
    body: { paths: [`events/${eventId}/posts/../private/joinCode`] },
  });
  check('a traversal path is rejected outright', traversal.status === 400);

  const outsiderMedia = await call(outsider.session, `/api/media/${eventId}`, {
    method: 'POST',
    body: { paths: wallPaths },
  });
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

  // --- email invitations ---------------------------------------------------
  const addInvites = await call(host.session, `/api/events/${eventId}/invites`, {
    method: 'POST',
    body: {
      invitees: [
        { email: `guest1-${stamp}@example.com`, name: 'Guest One' },
        { email: `guest2-${stamp}@example.com`, name: 'Guest Two' },
      ],
    },
  });
  check('the host adds addresses', addInvites.status === 200, JSON.stringify(addInvites.payload));
  check('both were added', addInvites.payload?.data?.added === 2);

  const readd = await call(host.session, `/api/events/${eventId}/invites`, {
    method: 'POST',
    body: { invitees: [{ email: `guest1-${stamp}@example.com`, name: 'Guest One' }] },
  });
  check('re-adding the same address is a no-op', readd.payload?.data?.duplicates === 1);

  const badAddress = await call(host.session, `/api/events/${eventId}/invites`, {
    method: 'POST',
    body: { invitees: [{ email: 'not-an-address' }] },
  });
  check('a malformed address is rejected', badAddress.status === 400);

  const memberAdds = await call(member.session, `/api/events/${eventId}/invites`, {
    method: 'POST',
    body: { invitees: [{ email: `sneaky-${stamp}@example.com` }] },
  });
  check('a member cannot add to the invite list', memberAdds.status === 403);

  const memberReadsList = await call(member.session, `/api/events/${eventId}/invites`);
  check('a member cannot read the invite list', memberReadsList.status === 403);

  const sendInvites = await call(host.session, `/api/events/${eventId}/invites/send`, {
    method: 'POST',
    body: { kind: 'invitation' },
  });
  check(
    'the host sends the invitation',
    sendInvites.status === 200,
    JSON.stringify(sendInvites.payload),
  );
  check(
    'both were sent',
    sendInvites.payload?.data?.sent === 2,
    JSON.stringify(sendInvites.payload),
  );

  const resend = await call(host.session, `/api/events/${eventId}/invites/send`, {
    method: 'POST',
    body: { kind: 'invitation' },
  });
  check('the invitation is not sent twice', resend.payload?.data?.sent === 0);

  const memberSends = await call(member.session, `/api/events/${eventId}/invites/send`, {
    method: 'POST',
    body: { kind: 'invitation' },
  });
  check('a member cannot send', memberSends.status === 403);

  // --- reading the email before sending it ------------------------------------
  const emailPreview = await call(host.session, `/api/events/${eventId}/email-preview`);
  check('the host can read the email first', emailPreview.status === 200);
  check(
    'and it is the real message, with a working link in it',
    (emailPreview.payload?.data?.html ?? '').includes(rotated.payload.data.code),
    'the preview should carry the actual join code, not a placeholder',
  );
  check(
    'the subject comes with it',
    typeof emailPreview.payload?.data?.subject === 'string' &&
      emailPreview.payload.data.subject.length > 0,
  );

  const reminderPreview = await call(
    host.session,
    `/api/events/${eventId}/email-preview?kind=reminder`,
  );
  check('the reminder can be read too', reminderPreview.payload?.data?.kind === 'reminder');

  const nonsenseKind = await call(
    host.session,
    `/api/events/${eventId}/email-preview?kind=whatever`,
  );
  check(
    'an unknown kind falls back rather than erroring',
    nonsenseKind.payload?.data?.kind === 'invitation',
  );

  // It renders a working invitation link, so it is as sensitive as the code itself.
  const memberPreview = await call(member.session, `/api/events/${eventId}/email-preview`);
  check('a member cannot read the email preview', memberPreview.status === 403);

  // --- the funnel ------------------------------------------------------------
  // Counters are aggregate and server-written. Nothing here can be forged by a client, and
  // nothing here names a guest.
  const funnel = await call(host.session, `/api/events/${eventId}/funnel`);
  check('the host can read the funnel', funnel.status === 200, JSON.stringify(funnel.payload));

  const totals = (funnel.payload?.data?.days ?? []).reduce((sum, day) => {
    for (const [name, value] of Object.entries(day.counts ?? {})) {
      sum[name] = (sum[name] ?? 0) + value;
    }
    return sum;
  }, {});

  check('invitations sent are counted', totals.inviteSent >= 2, JSON.stringify(totals));
  check('posts are counted', totals.postCreated >= 1, JSON.stringify(totals));

  /*
    Exactly two, and that is the assertion rather than "at least one".

    Three replies landed on this event above: the guest said yes, the member said maybe, and
    the member then changed to no. The change must not count — a funnel that counts reply
    *actions* is one whose "what fraction of guests reply" ratio creeps above the truth in
    proportion to how much people fiddle with their answer, and nothing about the number looks
    wrong while it happens. A `>=` here would have passed against the bug.
  */
  check(
    'a first reply is counted, and a change of mind is not',
    totals.rsvpAnswered === 2,
    JSON.stringify(totals),
  );
  check(
    'the yes is counted separately, and only on a first reply',
    totals.rsvpYes === 1,
    JSON.stringify(totals),
  );
  check(
    'the tally, not the funnel, is what knows who is actually coming',
    stamped.payload?.data?.event?.rsvpTally !== undefined,
  );
  check(
    'the counters carry no identifiers, only sums',
    (funnel.payload?.data?.days ?? []).every((day) =>
      Object.values(day.counts ?? {}).every((value) => typeof value === 'number'),
    ),
  );

  const memberFunnel = await call(member.session, `/api/events/${eventId}/funnel`);
  check('a member cannot read the funnel', memberFunnel.status === 403);

  // A genuine stranger, not `outsider` — they joined with the rotated code further up and are
  // a member by now, which would have made this assert the member case twice over.
  const stranger = await signUp(`stranger-${stamp}@example.com`);
  const strangerFunnel = await call(stranger.session, `/api/events/${eventId}/funnel`);
  check(
    'a non-member is not even told the event exists',
    strangerFunnel.status === 404,
    `status ${strangerFunnel.status}`,
  );

  // --- scheduled reminders ---------------------------------------------------
  // The nudge used to go only when a host pressed a button, which most never do. The job that
  // replaces it emails other people's guests unattended, so the assertions that matter are the
  // lock on the door and the promise that it cannot send the same slot twice.
  const unauthorizedRun = await call(newSession(), '/api/internal/reminders', {
    method: 'POST',
    body: {},
  });
  check(
    'the reminder job refuses a caller with no secret',
    unauthorizedRun.status === 401,
    `status ${unauthorizedRun.status}`,
  );

  const wrongSecret = await call(newSession(), '/api/internal/reminders', {
    method: 'POST',
    body: {},
    headers: { Authorization: 'Bearer not-the-secret' },
  });
  check('and refuses a wrong one', wrongSecret.status === 401, `status ${wrongSecret.status}`);

  const taskSecret = process.env.CLEANUP_TASK_SECRET;
  if (taskSecret) {
    const runOnce = await call(newSession(), '/api/internal/reminders', {
      method: 'POST',
      body: {},
      headers: { Authorization: `Bearer ${taskSecret}` },
    });
    check('the reminder job runs', runOnce.status === 200, JSON.stringify(runOnce.payload));
    check(
      'it reports what it looked at',
      typeof runOnce.payload?.data?.eventsConsidered === 'number',
      JSON.stringify(runOnce.payload?.data),
    );

    // Nothing in this suite is within a reminder window — every event is created days out
    // with a fresh `createdAt`, and a slot that fell due before the invitation existed is
    // deliberately skipped. So the honest assertion is that it sends nothing, twice.
    check(
      'and sends nothing when no slot is due',
      runOnce.payload?.data?.sent === 0,
      JSON.stringify(runOnce.payload?.data),
    );

    const runTwice = await call(newSession(), '/api/internal/reminders', {
      method: 'POST',
      body: {},
      headers: { Authorization: `Bearer ${taskSecret}` },
    });
    check(
      'a second run is safe to make',
      runTwice.status === 200 && runTwice.payload?.data?.sent === 0,
      JSON.stringify(runTwice.payload?.data),
    );
  } else {
    console.log('  SKIP  reminder job run (CLEANUP_TASK_SECRET not set in this environment)');
  }

  // The host's own switch, which is what stops this being something done *to* them.
  const remindOff = await call(host.session, `/api/events/${eventId}/settings`, {
    method: 'PATCH',
    body: { rsvp: { autoRemind: false } },
  });
  check(
    'the host can turn reminders off',
    remindOff.status === 200,
    JSON.stringify(remindOff.payload),
  );

  const afterOff = await call(host.session, `/api/events/${eventId}`);
  check(
    'and it sticks',
    afterOff.payload?.data?.event?.rsvp?.autoRemind === false,
    JSON.stringify(afterOff.payload?.data?.event?.rsvp),
  );

  const memberRemind = await call(member.session, `/api/events/${eventId}/settings`, {
    method: 'PATCH',
    body: { rsvp: { autoRemind: true } },
  });
  check(
    'a guest cannot switch it back on',
    memberRemind.status === 403 || memberRemind.status === 404,
    `status ${memberRemind.status}`,
  );

  /*
    The settings route used to validate a date, a venue, a dress code and every RSVP setting
    and then apply none of them — a host who typed the wrong date could not fix it, and the
    request came back 200 saying nothing was wrong.
  */
  const movedDate = Date.now() + 21 * 24 * 60 * 60 * 1000;
  const edited = await call(host.session, `/api/events/${eventId}/settings`, {
    method: 'PATCH',
    body: {
      startsAt: movedDate,
      dressCode: 'Black tie',
      hostedBy: 'The smoke test, renamed',
      rsvp: { question: 'Any dietary requirements?' },
    },
  });
  check(
    'the host edits the invitation after publishing',
    edited.status === 200,
    JSON.stringify(edited.payload),
  );
  check('the date actually moves', edited.payload?.data?.event?.startsAt === movedDate);
  check('the dress code lands', edited.payload?.data?.event?.dressCode === 'Black tie');
  check(
    'who it is from lands',
    edited.payload?.data?.event?.hostedBy === 'The smoke test, renamed',
  );
  check(
    'an rsvp setting lands',
    edited.payload?.data?.event?.rsvp?.question === 'Any dietary requirements?',
    JSON.stringify(edited.payload?.data?.event?.rsvp),
  );
  check(
    'and a partial rsvp patch leaves its siblings alone',
    edited.payload?.data?.event?.rsvp?.autoRemind === false,
    JSON.stringify(edited.payload?.data?.event?.rsvp),
  );

  // The venue and the zone survive an unrelated edit. Both fields defaulted to null in the
  // patch schema, so every edit would have quietly erased them — and an event with no zone
  // shows every guest the wrong hour, which is a bug this project has already fixed once.
  // Deliberately not the title: the deletion test further down types the event's name to
  // confirm, and renaming it here would break that in a way that looks like a delete bug.
  const keptVenue = await call(host.session, `/api/events/${eventId}/settings`, {
    method: 'PATCH',
    body: { description: 'Automated run, edited' },
  });
  check(
    'an unrelated edit does not erase the venue',
    keptVenue.payload?.data?.event?.location?.name === 'The Rooftop',
    JSON.stringify(keptVenue.payload?.data?.event?.location),
  );

  const backwards = await call(host.session, `/api/events/${eventId}/settings`, {
    method: 'PATCH',
    body: { endsAt: movedDate - 60_000 },
  });
  check(
    'an end before the start is refused even when only one of them is sent',
    backwards.status === 400,
    `status ${backwards.status}`,
  );

  const nothing = await call(host.session, `/api/events/${eventId}/settings`, {
    method: 'PATCH',
    body: { rsvp: {} },
  });
  check(
    'a request that changes nothing is a 400, not a 500',
    nothing.status === 400,
    `status ${nothing.status}`,
  );

  // --- the rollup across every event ----------------------------------------
  // Seven counters were being written and nothing read them. This is the read path, and the
  // permission on it: `admin:*` is platform-only by construction, so hosting a hundred events
  // grants nothing here.
  const hostRollup = await call(host.session, '/api/admin/funnel');
  check(
    'an ordinary host cannot read the rollup',
    hostRollup.status === 403,
    `status ${hostRollup.status}`,
  );

  const guestRollup = await call(guest.session, '/api/admin/funnel');
  check(
    'nor can a code-only visitor',
    guestRollup.status === 401 || guestRollup.status === 403,
    `status ${guestRollup.status}`,
  );

  /*
    The positive path needs the address the *server* calls an owner, and this script reads its
    own environment rather than the server's.

    In CI they are the same thing — one job-level `env:` block feeds both — so this just works.
    Locally the server reads `.env.local` and this process does not, so running
    `npm run smoke` bare leaves this unset and the check is skipped, and running it with a
    different value than `.env.local` holds produces a confusing "role is user" failure that
    looks like broken authorization and is really a mismatched address. Locally:

      OWNER_EMAILS=$(grep OWNER_EMAILS .env.local | cut -d= -f2) npm run smoke

    Skipped rather than guessed when unset: an assertion that signed up the wrong address
    would "pass" by being refused, which is the worst kind of green.
  */
  const ownerEmail = (process.env.OWNER_EMAILS ?? '').split(',')[0]?.trim();
  if (ownerEmail) {
    const owner = await signUpOrIn(ownerEmail);
    check(
      'the configured owner gets the owner role',
      owner.actor?.role === 'owner',
      JSON.stringify(owner.actor?.role),
    );

    const rollup = await call(owner.session, '/api/admin/funnel');
    check('the owner reads the rollup', rollup.status === 200, JSON.stringify(rollup.payload));
    check(
      'it sums across events rather than naming one',
      typeof rollup.payload?.data?.events === 'number' &&
        rollup.payload?.data?.totals !== undefined,
      JSON.stringify(rollup.payload?.data),
    );
    check(
      'the totals are integers and nothing else — no ids, no paths',
      Object.values(rollup.payload?.data?.totals ?? {}).every((v) => typeof v === 'number'),
      JSON.stringify(rollup.payload?.data?.totals),
    );
    check(
      'the rollup has picked up this run',
      (rollup.payload?.data?.totals?.rsvpAnswered ?? 0) >= 2,
      JSON.stringify(rollup.payload?.data?.totals),
    );
  } else {
    console.log('  SKIP  owner rollup (OWNER_EMAILS not set in this environment)');
  }

  // --- the gift list --------------------------------------------------------
  // The whole point of this feature is one number — do guests click? — so the read path,
  // the occasion gate and the click beacon all have to actually work.
  //
  // A birthday, because the main smoke event is a `party` and parties do not carry a gift
  // list. That asymmetry is the feature, and it gets asserted below.
  const giftEvent = await call(host.session, '/api/events/create', {
    method: 'POST',
    body: {
      title: 'Smoke test birthday',
      occasion: 'birthday',
      hostedBy: 'The smoke test',
      expiryPresetId: '24h',
      startsAt: Date.now() + 5 * 24 * 60 * 60 * 1000,
      rsvp: { enabled: true, allowPlusOnes: true, maxPartySize: 4 },
      allowedKinds: ['text'],
    },
  });
  const giftEventId = giftEvent.payload?.data?.event?.id;
  const giftJoinCode = giftEvent.payload?.data?.joinCode;
  check(
    'host creates a gifting occasion',
    giftEvent.status === 200,
    JSON.stringify(giftEvent.payload),
  );

  const giftAllowed = await call(host.session, `/api/events/${giftEventId}/registry`);
  check(
    'a birthday carries a gift list',
    giftAllowed.payload?.data?.allowed === true,
    JSON.stringify(giftAllowed.payload),
  );

  const partyRegistry = await call(host.session, `/api/events/${eventId}/registry`);
  check(
    'a party does not carry a gift list',
    partyRegistry.payload?.data?.allowed === false,
    JSON.stringify(partyRegistry.payload),
  );

  const addedLink = await call(host.session, `/api/events/${giftEventId}/registry`, {
    method: 'POST',
    body: { url: 'https://www.amazon.com/wedding/registry/SMOKE', label: '', note: '' },
  });
  check('the host adds a gift link', addedLink.status === 200, JSON.stringify(addedLink.payload));
  check(
    'a link with no name is named after where it points',
    addedLink.payload?.data?.link?.label === 'Amazon',
    JSON.stringify(addedLink.payload?.data?.link),
  );
  const linkId = addedLink.payload?.data?.link?.id;

  // The one that matters: a registry row is a link we put in front of the whole guest list.
  const badRegistryLink = await call(host.session, `/api/events/${giftEventId}/registry`, {
    method: 'POST',
    body: { url: 'javascript:alert(1)' },
  });
  check('a non-http gift link is refused', badRegistryLink.status === 400);

  // Refused on the occasion, not merely hidden in the UI — a host who found the endpoint
  // must not be able to put a gift list on a memorial.
  const partyAdd = await call(host.session, `/api/events/${eventId}/registry`, {
    method: 'POST',
    body: { url: 'https://example.com/registry' },
  });
  check(
    'a gift list cannot be added to an occasion that does not carry one',
    partyAdd.status === 400,
    `status ${partyAdd.status}`,
  );

  // The beacon is unauthenticated on purpose: the reader may be a guest with no session.
  const clicked = await call(newSession(), `/api/events/${giftEventId}/registry/click`, {
    method: 'POST',
    body: { linkId },
  });
  check('a gift-list tap is counted without a session', clicked.status === 200);

  const afterClick = await call(host.session, `/api/events/${giftEventId}/registry`);
  check(
    'the click lands on the link the host can see',
    afterClick.payload?.data?.links?.[0]?.clickCount === 1,
    JSON.stringify(afterClick.payload?.data?.links),
  );

  const giftFunnel = await call(host.session, `/api/events/${giftEventId}/funnel`);
  const giftTotals = (giftFunnel.payload?.data?.days ?? []).reduce((sum, day) => {
    for (const [name, value] of Object.entries(day.counts ?? {})) {
      sum[name] = (sum[name] ?? 0) + value;
    }
    return sum;
  }, {});
  check(
    'the tap also reaches the funnel, which is the number the business case needs',
    giftTotals.giftLinkClicked >= 1,
    JSON.stringify(giftTotals),
  );

  const strangerRegistry = await call(stranger.session, `/api/events/${giftEventId}/registry`);
  check(
    'a stranger is not told the gift list exists',
    strangerRegistry.status === 404,
    `status ${strangerRegistry.status}`,
  );

  const memberAdd = await call(member.session, `/api/events/${giftEventId}/registry`, {
    method: 'POST',
    body: { url: 'https://evil.example/mine' },
  });
  check(
    'a guest cannot put their own link on somebody else invitation',
    memberAdd.status === 403 || memberAdd.status === 404,
    `status ${memberAdd.status}`,
  );

  const removed = await call(host.session, `/api/events/${giftEventId}/registry/${linkId}`, {
    method: 'DELETE',
  });
  check('the host removes a gift link', removed.status === 200, JSON.stringify(removed.payload));

  // --- the planning list ----------------------------------------------------
  // Reuses the birthday, which has a named plan and a date to count backwards from.
  //
  // The entitlement gate is *not* asserted here: with billing off every event is created on
  // `previewPlanId`, so no event this suite can make is on the free tier. That case is unit
  // tested against a plan id directly, which is what the dev skill says to do rather than
  // stubbing a flag.
  const plan = await call(host.session, `/api/events/${giftEventId}/plan`);
  check('the host reads the plan', plan.status === 200, JSON.stringify(plan.payload));
  const seeded = plan.payload?.data?.milestones ?? [];
  check('it arrives already written', seeded.length > 0, `${seeded.length} rows`);
  check(
    'nothing is stored until the host touches it',
    plan.payload?.data?.saved === false,
    JSON.stringify(plan.payload?.data?.saved),
  );
  check(
    'a birthday gets the birthday list, not the generic one',
    seeded.some((row) => row.templateKey === 'cake'),
    JSON.stringify(seeded.map((row) => row.templateKey)),
  );
  check(
    'every row has a date, counted back from the event',
    seeded.every((row) => typeof row.dueAt === 'number'),
    JSON.stringify(seeded.map((row) => row.dueAt)),
  );
  check(
    'the rows carry the live fields that make this more than a checklist',
    seeded.some((row) => row.live === 'headcount'),
    JSON.stringify(seeded.map((row) => row.live)),
  );
  check(
    'the live numbers come back with it',
    typeof plan.payload?.data?.live?.headcount === 'number',
    JSON.stringify(plan.payload?.data?.live),
  );

  // Ticking an unsaved row has to write the whole template out first, and exactly once.
  const firstRow = seeded[0];
  const ticked = await call(host.session, `/api/events/${giftEventId}/plan/${firstRow.id}`, {
    method: 'PATCH',
    body: { done: true },
  });
  check('the host ticks a row off', ticked.status === 200, JSON.stringify(ticked.payload));
  check('it comes back done', ticked.payload?.data?.milestone?.done === true);
  check(
    'the server sets the time it was done, not the client',
    typeof ticked.payload?.data?.milestone?.doneAt === 'number',
  );

  const afterTick = await call(host.session, `/api/events/${giftEventId}/plan`);
  check('the plan is saved once it has been touched', afterTick.payload?.data?.saved === true);
  check(
    'writing the template out did not duplicate it',
    (afterTick.payload?.data?.milestones ?? []).length === seeded.length,
    `${(afterTick.payload?.data?.milestones ?? []).length} vs ${seeded.length}`,
  );
  check(
    'the tick survived',
    (afterTick.payload?.data?.milestones ?? []).filter((row) => row.done).length === 1,
  );

  // A second tick on a different row must not re-seed either.
  const secondRow = (afterTick.payload?.data?.milestones ?? [])[1];
  await call(host.session, `/api/events/${giftEventId}/plan/${secondRow.id}`, {
    method: 'PATCH',
    body: { done: true },
  });
  const afterSecondTick = await call(host.session, `/api/events/${giftEventId}/plan`);
  check(
    'a second tick still does not duplicate the list',
    (afterSecondTick.payload?.data?.milestones ?? []).length === seeded.length,
    `${(afterSecondTick.payload?.data?.milestones ?? []).length}`,
  );

  const planFunnel = await call(host.session, `/api/events/${giftEventId}/funnel`);
  const planTotals = (planFunnel.payload?.data?.days ?? []).reduce((sum, day) => {
    for (const [name, value] of Object.entries(day.counts ?? {})) {
      sum[name] = (sum[name] ?? 0) + value;
    }
    return sum;
  }, {});
  check(
    'ticking a row is counted, so we learn whether the plan is used',
    planTotals.milestoneCompleted === 2,
    JSON.stringify(planTotals.milestoneCompleted),
  );

  // Untick and re-tick: the counter moves on the transition, not on every request.
  await call(host.session, `/api/events/${giftEventId}/plan/${secondRow.id}`, {
    method: 'PATCH',
    body: { done: true },
  });
  const notInflated = await call(host.session, `/api/events/${giftEventId}/funnel`);
  const stillTwo = (notInflated.payload?.data?.days ?? []).reduce(
    (sum, day) => sum + (day.counts?.milestoneCompleted ?? 0),
    0,
  );
  check('ticking an already-ticked row does not inflate the count', stillTwo === 2, `${stillTwo}`);

  /*
    The one that would lose a host's data.

    The handler applies a patch by spreading it over the stored row, so a schema field that
    defaults instead of staying absent silently overwrites. `budget` briefly carried
    `.default(null)`, which meant a bare `{ done: true }` wiped whatever the host had budgeted.
  */
  const budgeted = await call(host.session, `/api/events/${giftEventId}/plan/${secondRow.id}`, {
    method: 'PATCH',
    body: { budget: 4200 },
  });
  check('a row takes a budget', budgeted.payload?.data?.milestone?.budget === 4200);

  const tickedAgain = await call(host.session, `/api/events/${giftEventId}/plan/${secondRow.id}`, {
    method: 'PATCH',
    body: { done: false },
  });
  check(
    'unticking a row does not wipe its budget',
    tickedAgain.payload?.data?.milestone?.budget === 4200,
    JSON.stringify(tickedAgain.payload?.data?.milestone),
  );

  const emptyPatch = await call(host.session, `/api/events/${giftEventId}/plan/${secondRow.id}`, {
    method: 'PATCH',
    body: {},
  });
  check('a patch that changes nothing is refused', emptyPatch.status === 400);

  const added = await call(host.session, `/api/events/${giftEventId}/plan`, {
    method: 'POST',
    body: { title: 'Borrow more chairs', categoryId: 'admin' },
  });
  check('the host adds their own row', added.status === 200, JSON.stringify(added.payload));
  check('an added row is not a template row', added.payload?.data?.milestone?.templateKey === null);
  check(
    'and cannot claim a live number the host did not earn',
    added.payload?.data?.milestone?.live === null,
  );

  const namelessRow = await call(host.session, `/api/events/${giftEventId}/plan`, {
    method: 'POST',
    body: { title: '   ' },
  });
  check('a row with no name is refused', namelessRow.status === 400);

  const removedRow = await call(
    host.session,
    `/api/events/${giftEventId}/plan/${added.payload?.data?.milestone?.id}`,
    { method: 'DELETE' },
  );
  check('the host removes a row', removedRow.status === 200);

  // A real member of *this* event, so the refusal below is about the host gate rather than
  // about not being in the room at all — `member` joined the party further up, not this.
  await call(member.session, '/api/events/join', {
    method: 'POST',
    body: { code: giftJoinCode },
  });

  const memberPlan = await call(member.session, `/api/events/${giftEventId}/plan`);
  check(
    'a guest cannot read the host planning notes',
    memberPlan.status === 403,
    `status ${memberPlan.status}`,
  );

  // 404 rather than 403 for somebody not in the event at all, matching the funnel and the
  // guest list: a member already knows the event exists, a stranger must not learn it.
  const strangerPlan = await call(stranger.session, `/api/events/${giftEventId}/plan`);
  check(
    'nor is a stranger told the plan exists',
    strangerPlan.status === 404,
    `status ${strangerPlan.status}`,
  );

  const memberTick = await call(member.session, `/api/events/${giftEventId}/plan/${secondRow.id}`, {
    method: 'PATCH',
    body: { done: true },
  });
  check(
    'a guest cannot tick the host list off for them',
    memberTick.status === 403,
    `status ${memberTick.status}`,
  );

  // The write path hides exactly as much as the read path and no more: a difference between
  // them is itself a disclosure.
  const strangerTick = await call(
    stranger.session,
    `/api/events/${giftEventId}/plan/${secondRow.id}`,
    { method: 'PATCH', body: { done: true } },
  );
  check(
    'and a stranger is told nothing either way',
    strangerTick.status === 404,
    `status ${strangerTick.status}`,
  );

  // --- add to calendar ------------------------------------------------------
  // The link in an email, which has to work with no session and no JavaScript — the reader
  // is not a member yet, which is precisely why they were sent an invitation.
  const currentCode = rotated.payload.data.code;
  const icsResponse = await fetch(`${BASE}/i/${currentCode}/calendar`);
  const ics = await icsResponse.text();

  check('anyone holding the code can fetch the calendar file', icsResponse.status === 200);
  check(
    'it is served as a calendar, not as text a browser would just display',
    (icsResponse.headers.get('content-type') ?? '').includes('text/calendar'),
  );
  check(
    'it downloads under the event name rather than opening in the tab',
    (icsResponse.headers.get('content-disposition') ?? '').startsWith('attachment;'),
  );
  check('it is a well-formed iCalendar file', ics.startsWith('BEGIN:VCALENDAR\r\n'));
  check('with exactly one event in it', (ics.match(/BEGIN:VEVENT/g) ?? []).length === 1);
  check(
    'the time is written in UTC, so it lands correctly in any zone',
    /DTSTART:\d{8}T\d{6}Z/.test(ics),
  );
  check('and it brings its own reminders', ics.includes('BEGIN:VALARM'));

  const staleCalendar = await fetch(`${BASE}/i/${joinCode}/calendar`);
  check('a rotated-away code cannot fetch the calendar either', staleCalendar.status === 404);

  const nonsenseCalendar = await fetch(`${BASE}/i/ZZZZZZZZ/calendar`);
  check('a code that was never real gets nothing', nonsenseCalendar.status === 404);

  // --- guests by phone, per-guest links, and what "seen" is worth ------------
  const byPhone = await call(host.session, `/api/events/${eventId}/invites`, {
    method: 'POST',
    body: { invitees: [{ phone: '+1 415 555 0148', name: 'Phone Only' }] },
  });
  check('a guest can be added by phone alone', byPhone.payload?.data?.added === 1);

  const sameNumberAgain = await call(host.session, `/api/events/${eventId}/invites`, {
    method: 'POST',
    body: { invitees: [{ phone: '(415) 555-0148', name: 'Phone Only' }] },
  });
  check(
    'the same number written differently is the same person',
    sameNumberAgain.payload?.data?.duplicates === 1,
    JSON.stringify(sameNumberAgain.payload),
  );

  const undialable = await call(host.session, `/api/events/${eventId}/invites`, {
    method: 'POST',
    body: { invitees: [{ phone: '12', name: 'Nope' }] },
  });
  check(
    'a number we could never dial is refused, not stored',
    undialable.payload?.data?.invalid === 1,
  );

  const noContact = await call(host.session, `/api/events/${eventId}/invites`, {
    method: 'POST',
    body: { invitees: [{ name: 'No Way To Reach Them' }] },
  });
  check('a guest with no address and no number is rejected', noContact.status === 400);

  const listWithLinks = await call(host.session, `/api/events/${eventId}/invites`);
  const listed = listWithLinks.payload?.data?.invitees ?? [];
  check(
    'the list comes back with the join code for the relay panel',
    typeof listWithLinks.payload?.data?.joinCode === 'string',
  );
  check(
    'every guest has their own link token',
    listed.length > 0 && listed.every((i) => typeof i.token === 'string' && i.token.length >= 16),
  );
  check('no two guests share a token', new Set(listed.map((i) => i.token)).size === listed.length);

  const tracked = listed.find((i) => i.email === `guest1-${stamp}@example.com`);
  check('the emailed guest reads as sent', tracked?.status === 'sent', JSON.stringify(tracked));

  // The whole point of the beacon. A plain server-side fetch of the invitation — which is
  // exactly what Outlook Safe Links and Proofpoint do to every URL they scan — must not
  // count as a person having looked.
  const scannerFetch = await fetch(`${BASE}/i/${rotated.payload.data.code}?g=${tracked.token}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Proofpoint-URL-Scanner/1.0)' },
  });
  check('the invitation page still renders for a scanner', scannerFetch.status === 200);

  const afterScan = await call(host.session, `/api/events/${eventId}/invites`);
  const notSeen = (afterScan.payload?.data?.invitees ?? []).find((i) => i.id === tracked.id);
  check('a link scanner fetching the page is not a view', notSeen?.status === 'sent');
  check('and it did not inflate the view count', (notSeen?.viewCount ?? 0) === 0);

  const beacon = await call(guest.session, `/api/events/${eventId}/invites/view`, {
    method: 'POST',
    body: { token: tracked.token },
  });
  check('the beacon records a view', beacon.status === 200);

  const afterBeacon = await call(host.session, `/api/events/${eventId}/invites`);
  const seen = (afterBeacon.payload?.data?.invitees ?? []).find((i) => i.id === tracked.id);
  check('the guest now reads as seen', seen?.status === 'seen', JSON.stringify(seen));
  check('and the view was counted once', seen?.viewCount === 1);

  // An invitation pasted into a group chat carries the code and no token. That open still
  // counts toward the funnel — it is most of them — but it must not be attributed to anybody.
  const anonymousOpen = await call(newSession(), `/api/events/${eventId}/invites/view`, {
    method: 'POST',
    body: {},
  });
  check('an open with no token is accepted', anonymousOpen.status === 200);

  const afterAnonymous = await call(host.session, `/api/events/${eventId}/invites`);
  const stillOne = (afterAnonymous.payload?.data?.invitees ?? []).find((i) => i.id === tracked.id);
  check(
    'and is attributed to nobody',
    stillOne?.viewCount === 1,
    JSON.stringify(stillOne?.viewCount),
  );
  check('and the first view was stamped', typeof seen?.firstViewedAt === 'number');

  const again = await call(guest.session, `/api/events/${eventId}/invites/view`, {
    method: 'POST',
    body: { token: tracked.token },
  });
  check('a second beacon is accepted', again.status === 200);
  const afterSecond = await call(host.session, `/api/events/${eventId}/invites`);
  const deduped = (afterSecond.payload?.data?.invitees ?? []).find((i) => i.id === tracked.id);
  check('but coming straight back is one visit, not two', deduped?.viewCount === 1);

  const forgedToken = await call(guest.session, `/api/events/${eventId}/invites/view`, {
    method: 'POST',
    body: { token: 'f'.repeat(32) },
  });
  // It must not say whether the token was real: answering would let anyone holding an event
  // id test tokens, or confirm that a particular person is on the guest list.
  check('an unknown token is not confirmed or denied', forgedToken.status === 200);

  const malformedToken = await call(guest.session, `/api/events/${eventId}/invites/view`, {
    method: 'POST',
    body: { token: 'not-hex!' },
  });
  check('a malformed token is refused outright', malformedToken.status === 400);

  const badUnsub = await call(guest.session, '/api/unsubscribe', {
    method: 'POST',
    body: { eventId, email: `guest1-${stamp}@example.com`, token: 'f'.repeat(32) },
  });
  check('a forged unsubscribe token is refused', badUnsub.status === 403);

  // --- the account ----------------------------------------------------------
  // The account is the one page that reads across everything a host owns, so it is worth
  // proving the endpoint behind it separately from the page that renders it.
  const account = await call(host.session, '/api/account');
  check('the account reads back', account.status === 200);
  check('it names the host', typeof account.payload?.data?.profile?.displayName === 'string');
  check(
    'it does not leak the uid of anyone else',
    account.payload?.data?.profile?.uid === host.actor.uid,
  );
  check('it reports a plan', typeof account.payload?.data?.billing?.effectivePlan === 'string');
  check('it counts what the host has made', account.payload?.data?.stats?.events >= 1);

  const anonAccount = await call(guest.session, '/api/account');
  check('a code-only guest has no account to read', anonAccount.status === 403);

  const renamed = await call(host.session, '/api/account', {
    method: 'PATCH',
    body: { displayName: 'Renamed Host' },
  });
  check('the host renames themselves', renamed.status === 200);
  const afterRename = await call(host.session, '/api/account');
  check(
    'the new name is what reads back',
    afterRename.payload?.data?.profile?.displayName === 'Renamed Host',
  );

  const emptyName = await call(host.session, '/api/account', {
    method: 'PATCH',
    body: { displayName: '   ' },
  });
  check('an empty name is refused', emptyName.status === 400);

  const mine = await call(host.session, '/api/events/mine');
  check('the host lists their own invitations', mine.status === 200);
  check(
    'and only their own',
    mine.payload?.data?.events?.every(
      (event) => event.hostUid === undefined || event.hostUid === host.actor.uid,
    ) === true,
  );

  const guestMine = await call(guest.session, '/api/events/mine');
  check(
    'a code-only guest hosts nothing',
    guestMine.status === 403 || guestMine.payload?.data?.events?.length === 0,
  );

  // --- billing --------------------------------------------------------------
  // Billing is off by default, so checkout must refuse rather than silently succeed.
  const checkout = await call(host.session, '/api/billing/checkout', {
    method: 'POST',
    body: { planId: 'event', eventId },
  });
  check('checkout is closed while billing is in preview', checkout.status === 403);

  const badWebhook = await fetch(`${BASE}/api/billing/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nothing: true }),
  });
  check('a webhook with no event type is accepted but does nothing', badWebhook.status === 200);

  // --- archive and deletion -------------------------------------------------
  const memberArchive = await call(member.session, `/api/events/${eventId}/archive`);
  check('a member cannot download the archive', memberArchive.status === 403);

  const archive = await fetch(`${BASE}/api/events/${eventId}/archive`, {
    headers: { Cookie: cookieHeader(host.session) },
  });
  check('the host downloads the archive', archive.status === 200, String(archive.status));
  check(
    'the archive is a zip',
    archive.headers.get('content-type') === 'application/zip',
    archive.headers.get('content-type') ?? 'none',
  );
  const archiveBytes = Buffer.from(await archive.arrayBuffer());
  check('the archive has content', archiveBytes.length > 200, `${archiveBytes.length} bytes`);
  // Local file header magic — proves this is a real zip, not an error page.
  check('the archive is a valid zip', archiveBytes.subarray(0, 2).toString() === 'PK');

  const wrongConfirm = await call(host.session, `/api/events/${eventId}/delete`, {
    method: 'POST',
    body: { confirm: 'something else' },
  });
  check('deletion needs the exact event name', wrongConfirm.status === 400);

  const memberDeletes = await call(member.session, `/api/events/${eventId}/delete`, {
    method: 'POST',
    body: { confirm: 'Smoke test party' },
  });
  check('a member cannot delete the event', memberDeletes.status === 403);

  // A title created on a phone comes back with an autocorrected apostrophe; the host types a
  // straight one. The button used to stay grey and the request used to 400, which is
  // indistinguishable from a broken delete.
  const curly = await call(host.session, '/api/events/create', {
    method: 'POST',
    body: {
      title: 'Ada\u2019s 40th',
      occasion: 'party',
      hostedBy: 'Smoke',
      expiryPresetId: '24h',
      startsAt: Date.now() + 86400000,
      rsvp: { enabled: true, allowPlusOnes: true, maxPartySize: 4 },
      allowedKinds: ['text'],
    },
  });
  check('an event can be named with a curly apostrophe', curly.status === 200);

  const straightTyped = await call(
    host.session,
    `/api/events/${curly.payload.data.event.id}/delete`,
    {
      method: 'POST',
      body: { confirm: "ada's 40th" },
    },
  );
  check(
    'a straight apostrophe confirms a curly-quoted title',
    straightTyped.status === 200,
    JSON.stringify(straightTyped.payload),
  );

  const untitledish = await call(host.session, `/api/events/${eventId}/delete`, {
    method: 'POST',
    body: { confirm: '   ' },
  });
  check('whitespace alone never confirms anything', untitledish.status === 400);

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

  // This suite only ever runs against the emulators, so the CSP must allow them. It is a
  // regression guard with real history: the emulator allowance used to be keyed on
  // NODE_ENV rather than on whether emulators are actually in use, so a production build
  // pointed at the emulators — exactly what CI runs — had every Firebase call blocked, and
  // sign-in failed silently in the browser while every server-side check here still passed.
  check(
    'CSP allows the emulator origins it is being run against',
    csp.includes('http://127.0.0.1:*'),
    csp,
  );
  check(
    'CSP does not force https onto the local emulators',
    !csp.includes('upgrade-insecure-requests'),
    csp,
  );
  check('nosniff is set', headResponse.headers.get('x-content-type-options') === 'nosniff');
  check('referrer policy is set', !!headResponse.headers.get('referrer-policy'));
  check('the framework version is not advertised', !headResponse.headers.get('x-powered-by'));

  // The delivery history hangs off the invitee. Firestore does not delete a document's
  // subcollections with it, so this is what proves the delete sweeps recursively rather
  // than leaving a record of who read what alive under a guest list that no longer exists.
  const historyPath =
    `http://127.0.0.1:8080/v1/projects/marquee-dev/databases/(default)/documents` +
    `/events/${eventId}/invitees/${tracked.id}/deliveries`;
  const historyBefore = await fetch(historyPath, { headers: { Authorization: 'Bearer owner' } });
  const historyBeforeBody = await historyBefore.json();
  check(
    'the guest has a delivery history while the event lives',
    (historyBeforeBody.documents ?? []).length > 0,
  );

  // --- deletion, last, because it destroys everything above -----------------
  const deleted = await call(host.session, `/api/events/${eventId}/delete`, {
    method: 'POST',
    body: { confirm: 'smoke TEST party' },
  });
  check(
    'the host deletes the event, case-insensitively',
    deleted.status === 200,
    JSON.stringify(deleted.payload),
  );

  const afterDelete = await call(host.session, `/api/events/${eventId}`);
  check('the event is gone', afterDelete.status === 404);

  const historyAfter = await fetch(historyPath, { headers: { Authorization: 'Bearer owner' } });
  const historyAfterBody = await historyAfter.json();
  check(
    'deleting the event takes the delivery history with it',
    (historyAfterBody.documents ?? []).length === 0,
    JSON.stringify(historyAfterBody).slice(0, 200),
  );

  const codeAfterDelete = await call(outsider.session, '/api/events/join', {
    method: 'POST',
    body: { code: rotated.payload.data.code },
  });
  check('the join code stops working immediately', codeAfterDelete.status === 404);

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

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

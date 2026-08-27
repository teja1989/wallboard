/**
 * One event, end to end, the way a real host would do it.
 *
 * Unlike `smoke.mjs`, which asserts a hundred things and tears everything down, this walks
 * a single invitation through its whole life and *leaves it standing* so you can open it in
 * a browser: create, invite, send, open as a guest, reply, and read the host's list back.
 *
 * It prints the links at each step. Point it at a local build or at production.
 *
 *   node scripts/walkthrough.mjs                              # local, against the emulators
 *   BASE=https://marqueersvp.com node scripts/walkthrough.mjs # the real thing
 *
 * Guests default to `@example.com`, which is reserved by RFC 2606 and cannot receive mail.
 * To send somewhere real, pass your own:
 *
 *   GUESTS="you+one@gmail.com,you+two@gmail.com" node scripts/walkthrough.mjs
 *
 * Against production this creates a real event that real people could open, so it prints
 * the delete command at the end rather than tidying up behind your back.
 */

const BASE = process.env.BASE ?? 'http://127.0.0.1:3000';
const AUTH = process.env.AUTH_EMULATOR ?? 'http://127.0.0.1:9099';
const API_KEY = process.env.API_KEY ?? 'demo-api-key';
const LOCAL = BASE.includes('127.0.0.1') || BASE.includes('localhost');

const stamp = Date.now();
const HOST_EMAIL = process.env.HOST_EMAIL ?? `host-${stamp}@example.com`;
const GUESTS = (process.env.GUESTS ?? `ada-${stamp}@example.com,grace-${stamp}@example.com`)
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

let step = 0;
function say(what, detail = '') {
  step += 1;
  console.log(`\n${String(step).padStart(2, '0')}. ${what}`);
  if (detail) console.log(`    ${detail}`);
}
function ok(what, detail = '') {
  console.log(`    ✓ ${what}${detail ? ` — ${detail}` : ''}`);
}
function stop(why) {
  console.error(`\n✗ ${why}`);
  process.exit(1);
}

/** A session is a cookie jar plus the uid behind it. */
function newSession() {
  return { cookies: new Map() };
}

function cookieHeader(session) {
  return [...session.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

function absorb(session, response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  for (const line of raw) {
    const [pair] = line.split(';');
    const index = pair.indexOf('=');
    if (index > 0) session.cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }
}

async function call(session, path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(session.cookies.size ? { Cookie: cookieHeader(session) } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  absorb(session, response);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text.slice(0, 300) };
  }
  return { status: response.status, payload };
}

/**
 * Signs someone in.
 *
 * Only possible against the emulators, which hand out ID tokens for the asking. Against
 * production the script cannot impersonate anybody, so it stops and tells you to drive the
 * browser yourself — which is the correct outcome, not a limitation to work around.
 */
async function signIn(session, email) {
  if (!LOCAL) {
    stop(
      'Signing in only works against the emulators.\n' +
        '  Against production, do the walkthrough in a browser — the steps below are the same.',
    );
  }

  const response = await fetch(
    `${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'walkthrough-password', returnSecureToken: true }),
    },
  );
  const body = await response.json();
  if (!body.idToken) stop(`Could not sign in as ${email}: ${JSON.stringify(body).slice(0, 200)}`);

  const exchanged = await call(session, '/api/session', {
    method: 'POST',
    body: { idToken: body.idToken },
  });
  if (exchanged.status !== 200) stop(`Session exchange failed: ${JSON.stringify(exchanged)}`);
  return exchanged.payload?.data?.actor;
}

async function main() {
  console.log(`\nMarquee walkthrough — ${BASE}`);
  console.log(`Host:   ${HOST_EMAIL}`);
  console.log(`Guests: ${GUESTS.join(', ')}`);
  if (!LOCAL) console.log('\n⚠  This is production. The event it creates will be real.');

  const host = newSession();
  say('Sign in as the host');
  const actor = await signIn(host, HOST_EMAIL);
  ok('signed in', actor?.uid);

  // A zone deliberately not the machine's, so the times below prove they are rendered in
  // the event's zone rather than the reader's.
  const timeZone = 'America/Los_Angeles';

  say('Create the event', `timezone ${timeZone}`);
  const created = await call(host, '/api/events/create', {
    method: 'POST',
    body: {
      title: `Walkthrough ${new Date(stamp).toISOString().slice(0, 16)}`,
      description: 'Created by scripts/walkthrough.mjs. Safe to delete.',
      occasion: 'party',
      hostedBy: 'The Walkthrough',
      templateId: 'sunset',
      startsAt: stamp + 7 * 24 * 60 * 60 * 1000,
      endsAt: null,
      timeZone,
      location: { name: 'The back garden', address: '1 Example Street', url: null },
      dressCode: '',
      rsvp: {
        enabled: true,
        deadline: null,
        allowPlusOnes: true,
        maxPartySize: 4,
        askNote: false,
        question: null,
      },
      expiryPresetId: '7d',
      whoCanPost: 'members',
      allowedKinds: ['text', 'image', 'video', 'audio'],
    },
  });
  if (created.status !== 200) stop(`Create failed: ${JSON.stringify(created.payload)}`);

  const eventId = created.payload.data.event.id;
  const joinCode = created.payload.data.joinCode;
  ok('created', eventId);
  ok('join code', joinCode);
  ok('shareable link', `${BASE}/i/${joinCode}`);

  say('Add the guests');
  const added = await call(host, `/api/events/${eventId}/invites`, {
    method: 'POST',
    body: { invitees: GUESTS.map((email, i) => ({ email, name: `Guest ${i + 1}` })) },
  });
  if (added.status !== 200) stop(`Adding guests failed: ${JSON.stringify(added.payload)}`);
  ok(`${added.payload.data.added} added`);

  say('Read the list back — everyone has their own link');
  const listed = await call(host, `/api/events/${eventId}/invites`);
  const invitees = listed.payload.data.invitees;
  for (const invitee of invitees) {
    ok(invitee.email, `${BASE}/i/${joinCode}?g=${invitee.token}`);
  }

  say('Send the invitation');
  const sent = await call(host, `/api/events/${eventId}/invites/send`, {
    method: 'POST',
    body: { kind: 'invitation' },
  });
  ok(`${sent.payload?.data?.sent ?? 0} sent, ${sent.payload?.data?.failed ?? 0} failed`);
  console.log(
    LOCAL
      ? '    Mail goes to the `mailOutbox` collection — open http://127.0.0.1:4000/firestore to read it.'
      : '    If EMAIL_DRIVER is still `outbox`, nothing was actually sent. See docs/SETUP.md.',
  );

  const target = invitees[0];
  say('Open the first guest’s invitation, the way they would');
  const beacon = await call(newSession(), `/api/events/${eventId}/invites/view`, {
    method: 'POST',
    body: { token: target.token },
  });
  ok('view recorded', `status ${beacon.status}`);

  say('What the host sees now');
  const after = await call(host, `/api/events/${eventId}/invites`);
  for (const invitee of after.payload.data.invitees) {
    ok(
      invitee.email,
      `${invitee.status}${invitee.viewCount ? ` · seen ${invitee.viewCount}×` : ''}`,
    );
  }

  say('Check the time reads correctly for someone in another zone');
  const detail = await call(host, `/api/events/${eventId}`);
  ok('stored zone', detail.payload?.data?.event?.timeZone ?? '(none)');
  const startsAt = detail.payload?.data?.event?.startsAt;
  if (startsAt) {
    const inZone = new Intl.DateTimeFormat('en-US', {
      timeZone,
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date(startsAt));
    const inTokyo = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tokyo',
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date(startsAt));
    ok('guests are told', inZone);
    console.log(`    (a reader in Tokyo would previously have been told: ${inTokyo})`);
  }

  console.log('\n─────────────────────────────────────────────');
  console.log('Open these in a browser:');
  console.log(`  Invitation   ${BASE}/i/${joinCode}`);
  for (const invitee of invitees) {
    console.log(`  ${invitee.email.padEnd(34)} ${BASE}/i/${joinCode}?g=${invitee.token}`);
  }
  console.log(`  Host view    ${BASE}/e/${eventId}`);
  console.log('\nWhen you are done, delete it from the host panel — or:');
  console.log(`  POST ${BASE}/api/events/${eventId}/delete  {"confirm":"<the event title>"}`);
  console.log('');
}

main().catch((error) => stop(error instanceof Error ? error.message : String(error)));

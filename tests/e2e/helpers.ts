import type { APIRequestContext, Page } from '@playwright/test';

/**
 * Test helpers.
 *
 * Sign-in goes through the app's real email-link flow rather than a shortcut. That matters
 * here specifically: the live wall reads Firestore directly under the visitor's own
 * identity, so a session cookie alone is not enough — the Firebase client SDK has to be
 * signed in too, exactly as it is for a real user. Faking the cookie would let these tests
 * pass while the wall stayed empty in production.
 *
 * The Auth emulator hands out the out-of-band link that would otherwise arrive by email.
 */

const EMULATOR = 'http://127.0.0.1:9099';
const PROJECT = 'wallboard-dev';
const API_KEY = 'demo-api-key';

interface OobCode {
  email: string;
  oobCode: string;
  oobLink: string;
  requestType: string;
}

/** The most recent sign-in link the emulator issued for this address. */
async function latestSignInLink(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.get(`${EMULATOR}/emulator/v1/projects/${PROJECT}/oobCodes`);
  const { oobCodes = [] } = (await response.json()) as { oobCodes?: OobCode[] };

  const match = [...oobCodes]
    .reverse()
    .find((code) => code.email === email && code.requestType === 'EMAIL_SIGNIN');

  if (!match) throw new Error(`No sign-in link issued for ${email}`);
  return match.oobLink;
}

/**
 * Rewrites the emulator's action link into the redirect a real Firebase action handler
 * would produce: the app's own /auth/finish page carrying the one-time code.
 */
function toAppSignInLink(oobLink: string, baseUrl: string): string {
  const source = new URL(oobLink);
  const oobCode = source.searchParams.get('oobCode');
  if (!oobCode) throw new Error(`Sign-in link carried no oobCode: ${oobLink}`);

  const target = new URL('/auth/finish', baseUrl);
  target.searchParams.set('apiKey', API_KEY);
  target.searchParams.set('mode', 'signIn');
  target.searchParams.set('oobCode', oobCode);
  target.searchParams.set('lang', 'en');
  return target.toString();
}

/**
 * Signs in as a real account through the app's UI: request the link, retrieve it from the
 * emulator, then follow it. Ends with both the Firebase client SDK and the server session
 * signed in as the same person.
 */
export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/create');
  const baseUrl = new URL(page.url()).origin;

  await page.getByRole('button', { name: /use an email link instead/i }).click();
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('button', { name: /send me a link/i }).click();

  // Wait for the emulator to have actually issued the code before reaching for it.
  await page.waitForTimeout(300);
  const link = toAppSignInLink(await latestSignInLink(page.request, email), baseUrl);

  await page.goto(link);
  // /auth/finish redirects home once the credential has been exchanged for a session.
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/finish'), { timeout: 20_000 });
}

/**
 * Signs in as a code-only guest, the way the join page does: land on it and let the page
 * bootstrap an anonymous identity.
 */
export async function signInAsGuest(page: Page): Promise<void> {
  await page.goto('/join');
  await page.waitForFunction(
    () => document.cookie !== null && !!document.querySelector('#join-code'),
    undefined,
    { timeout: 10_000 },
  );
  // The anonymous sign-in happens in an effect; give it a beat to land the session.
  await page.waitForTimeout(600);
}

/** Calls the app's JSON API from inside the page, so the session cookie rides along. */
export async function apiCall<T>(
  page: Page,
  path: string,
  body?: unknown,
  method: 'POST' | 'DELETE' = 'POST',
): Promise<{ status: number; payload: T }> {
  return page.evaluate(
    async ({ path: p, body: b, method: m }) => {
      const response = await fetch(p, {
        method: m,
        headers: b === undefined ? {} : { 'Content-Type': 'application/json' },
        body: b === undefined ? undefined : JSON.stringify(b),
        credentials: 'same-origin',
      });
      return { status: response.status, payload: await response.json() };
    },
    { path, body, method },
  ) as Promise<{ status: number; payload: T }>;
}

export interface CreatedEvent {
  eventId: string;
  joinCode: string;
}

/** Creates an event through the API, for tests whose subject is not the create form. */
export async function createEvent(page: Page, title: string): Promise<CreatedEvent> {
  const { status, payload } = await apiCall<{
    ok: boolean;
    data: { event: { id: string }; joinCode: string };
  }>(page, '/api/events/create', {
    title,
    expiryPresetId: '24h',
    allowedKinds: ['text', 'image', 'video', 'audio'],
  });
  if (status !== 200) throw new Error(`Event creation failed: ${JSON.stringify(payload)}`);
  return { eventId: payload.data.event.id, joinCode: payload.data.joinCode };
}

/**
 * The join endpoint is rate-limited per IP, and the whole suite shares one. Clearing the
 * buckets between runs keeps the tests from throttling themselves.
 */
export async function resetRateLimits(request: APIRequestContext): Promise<void> {
  const root = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
  const headers = { Authorization: 'Bearer owner' };
  const listed = await request.get(`${root}/rateLimits?pageSize=300`, { headers });
  if (!listed.ok()) return;
  const { documents = [] } = (await listed.json()) as { documents?: { name: string }[] };
  for (const document of documents) {
    const path = document.name.split('/documents/')[1];
    await request.delete(`${root}/${path}`, { headers });
  }
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000)}@example.com`;
}

import { cookies } from 'next/headers';
import {
  currentActor,
  createSessionCookie,
  clearedSessionCookieOptions,
  sessionCookieOptions,
} from '@/lib/authz/session';
import { ApiError, limitByIp, ok, parseBody, route } from '@/lib/server/api';
import { sessionSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Exchanges a freshly-minted Firebase ID token for an httpOnly session cookie. The ID
 * token never persists in the browser: it exists for the length of this one request, which
 * is what keeps XSS from being able to steal a durable credential.
 */
export const POST = route(async (request) => {
  await limitByIp(request, 'sessionPerIp');
  const { idToken } = await parseBody(request, sessionSchema);

  let session: Awaited<ReturnType<typeof createSessionCookie>>;
  try {
    session = await createSessionCookie(idToken);
  } catch {
    throw new ApiError('unauthenticated', 'That sign-in could not be verified.');
  }

  const cookieStore = await cookies();
  cookieStore.set({ ...sessionCookieOptions(session.maxAgeSeconds), value: session.value });

  const actor = await currentActor();
  return ok({ actor });
});

/** Returns the caller, or null. Used by the client to hydrate after a reload. */
export const GET = route(async () => ok({ actor: await currentActor() }));

/** Sign out. Clearing the cookie is enough; the Firebase session is not reusable without it. */
export const DELETE = route(async () => {
  const cookieStore = await cookies();
  cookieStore.set({ ...clearedSessionCookieOptions(), value: '' });
  return ok({ signedOut: true });
});

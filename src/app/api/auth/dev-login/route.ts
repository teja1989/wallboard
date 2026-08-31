import { z } from 'zod';
import { appConfig, serverConfig } from '@/config';
import { auth } from '@/lib/firebase/admin';
import { ApiError, ok, parseBody, route } from '@/lib/server/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const devLoginSchema = z.object({
  email: z.string().email(),
  displayName: z.string().default(''),
});

/**
 * Dev-only fast sign-in route.
 *
 * Creates or fetches a test account in the Auth Emulator and mints a custom token,
 * bypassing OAuth popup blocks and redirect friction on localhost.
 *
 * **This route is unauthenticated and it grants the `owner` claim.** Anyone who can reach it
 * can become any user, including a platform owner, by naming an email. That is acceptable
 * against an emulator seeded with fake data and catastrophic anywhere else, so the guard
 * below fails *closed*: the route is off unless emulators are explicitly in use, and off in
 * a production build no matter what.
 *
 * It was previously guarded as `NODE_ENV === 'production' && !useEmulators`, which is the
 * same condition negated wrongly — it opened the route on any build where
 * `NEXT_PUBLIC_USE_EMULATORS` was true, and that value is a build argument, not a secret.
 * The shipped image happens to set it false, so the hole was never live; it was one
 * Dockerfile line away from being live, which is not a margin worth keeping.
 */
export const POST = route(async (request) => {
  if (process.env.NODE_ENV === 'production' || !appConfig.useEmulators) {
    throw new ApiError('forbidden', 'Dev login is disabled outside the emulators.');
  }

  const { email, displayName } = await parseBody(request, devLoginSchema);
  const normalizedEmail = email.toLowerCase().trim();

  let userRecord;
  try {
    userRecord = await auth().getUserByEmail(normalizedEmail);
  } catch {
    userRecord = await auth().createUser({
      email: normalizedEmail,
      displayName: displayName.trim() || normalizedEmail.split('@')[0],
      emailVerified: true,
    });
  }

  // Set owner claim if listed in OWNER_EMAILS
  if (serverConfig().ownerEmails.includes(normalizedEmail)) {
    await auth().setCustomUserClaims(userRecord.uid, { role: 'owner' });
  }

  // Generate a custom token for the client SDK and a session cookie for the browser
  const customToken = await auth().createCustomToken(userRecord.uid);

  // Mint ID token via emulator REST or direct session
  // In Firebase Admin, we can mint a session cookie using a mock ID token or use client SDK signInWithCustomToken
  return ok({
    customToken,
    uid: userRecord.uid,
    email: userRecord.email,
    displayName: userRecord.displayName,
  });
});

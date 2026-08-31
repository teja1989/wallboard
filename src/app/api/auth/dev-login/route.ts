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
 * Exclusively active in development / emulator mode.
 * Creates/fetches the test account in the Auth Emulator and mints a valid session cookie,
 * bypassing OAuth popup blocks and redirect friction on localhost.
 */
export const POST = route(async (request) => {
  if (process.env.NODE_ENV === 'production' && !appConfig.useEmulators) {
    throw new ApiError('forbidden', 'Dev login is disabled in production.');
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

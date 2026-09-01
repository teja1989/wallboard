import './_bootstrap';
import { parseArgs } from 'node:util';
import { PLATFORM_ROLES, type PlatformRole } from '../src/config/roles.config';

/**
 * Grants a platform role by setting a Firebase custom claim.
 *
 * Deliberately a CLI and not a web form: role escalation should require access to the
 * deployment's credentials, not merely a signed-in browser session. There is no code path
 * in the app that can raise anyone's platform role.
 *
 *   npm run grant -- --email someone@example.com --role admin
 *   npm run grant -- --email someone@example.com --role user     # revoke
 */
async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      role: { type: 'string' },
    },
  });

  if (!values.email || !values.role) {
    console.error(
      'Usage: npm run grant -- --email <address> --role <' + PLATFORM_ROLES.join('|') + '>',
    );
    process.exit(1);
  }

  if (!PLATFORM_ROLES.includes(values.role as PlatformRole)) {
    console.error(`Unknown role "${values.role}". Expected one of: ${PLATFORM_ROLES.join(', ')}`);
    process.exit(1);
  }

  const role = values.role as PlatformRole;

  // Imported lazily so the argument checks above run before any Firebase connection.
  const { auth, db } = await import('../src/lib/firebase/admin');
  const { collections } = await import('../src/config/app.config');

  const user = await auth()
    .getUserByEmail(values.email)
    .catch(() => null);

  if (!user) {
    console.error(`No account found for ${values.email}. They must sign in once first.`);
    process.exit(1);
  }

  await auth().setCustomUserClaims(user.uid, role === 'user' ? {} : { role });
  // The Firestore copy is a mirror for the admin console's list views; the claim above is
  // what any authorization decision actually reads.
  await db().collection(collections.users).doc(user.uid).set({ role }, { merge: true });
  // Force a fresh token so the change takes effect on their next request, not whenever
  // their current token happens to expire.
  await auth().revokeRefreshTokens(user.uid);

  console.log(`${values.email} (${user.uid}) is now: ${role}`);
  console.log('They will need to sign in again for the change to take effect.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

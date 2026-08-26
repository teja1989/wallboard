import { z } from 'zod';

/**
 * Environment parsing. Fails fast and loudly at boot rather than at first use.
 *
 * Two schemas, deliberately: anything in `clientEnvSchema` is inlined into the browser
 * bundle by Next, so only NEXT_PUBLIC_* values may live there. Server secrets are parsed
 * lazily so that importing this module from a client component cannot leak them.
 */

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const csv = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );

const clientEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
  NEXT_PUBLIC_USE_EMULATORS: booleanish.default(false),
  NEXT_PUBLIC_EMULATOR_HOST: z.string().default('127.0.0.1'),
  NEXT_PUBLIC_EMULATOR_AUTH_PORT: z.coerce.number().int().default(9099),
  NEXT_PUBLIC_EMULATOR_FIRESTORE_PORT: z.coerce.number().int().default(8080),
  NEXT_PUBLIC_EMULATOR_STORAGE_PORT: z.coerce.number().int().default(9199),
  NEXT_PUBLIC_SITE_URL: z.string().url().default('http://localhost:3000'),
});

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Storage driver. `emulator` needs no GCP account; `gcs` needs ADC + a real bucket. */
  STORAGE_DRIVER: z.enum(['emulator', 'gcs']).default('emulator'),
  GCS_BUCKET: z.string().optional(),
  /** Service-account JSON. Omitted under emulators and on Cloud Run (uses ADC). */
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  /** Secret mixed into join-code hashes so a Firestore leak is not a code leak. */
  JOIN_CODE_PEPPER: z.string().min(16, 'JOIN_CODE_PEPPER must be at least 16 characters'),
  /** Shared secret for the internal cleanup endpoint when not using Cloud Scheduler OIDC. */
  CLEANUP_TASK_SECRET: z.string().min(16).optional(),
  /** Emails bootstrapped to the OWNER role on first sign-in. */
  OWNER_EMAILS: csv,
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function format(error: z.ZodError): string {
  return error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');
}

/**
 * Referenced with literal keys so Next's build-time inlining can find them.
 * Do not refactor to a dynamic lookup.
 */
const rawClientEnv = {
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_USE_EMULATORS: process.env.NEXT_PUBLIC_USE_EMULATORS,
  NEXT_PUBLIC_EMULATOR_HOST: process.env.NEXT_PUBLIC_EMULATOR_HOST,
  NEXT_PUBLIC_EMULATOR_AUTH_PORT: process.env.NEXT_PUBLIC_EMULATOR_AUTH_PORT,
  NEXT_PUBLIC_EMULATOR_FIRESTORE_PORT: process.env.NEXT_PUBLIC_EMULATOR_FIRESTORE_PORT,
  NEXT_PUBLIC_EMULATOR_STORAGE_PORT: process.env.NEXT_PUBLIC_EMULATOR_STORAGE_PORT,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

const clientParsed = clientEnvSchema.safeParse(rawClientEnv);
if (!clientParsed.success) {
  throw new Error(
    `Invalid public environment. Copy .env.example to .env.local and fill it in:\n${format(clientParsed.error)}`,
  );
}

export const clientEnv: ClientEnv = clientParsed.data;

let serverEnvCache: ServerEnv | null = null;

/** Server-only. Throws if called from the browser bundle. */
export function serverEnv(): ServerEnv {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() was called in the browser. Server secrets stay on the server.');
  }
  if (serverEnvCache) return serverEnvCache;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid server environment:\n${format(parsed.error)}`);
  }
  if (parsed.data.STORAGE_DRIVER === 'gcs' && !parsed.data.GCS_BUCKET) {
    throw new Error('STORAGE_DRIVER=gcs requires GCS_BUCKET to be set.');
  }
  serverEnvCache = parsed.data;
  return serverEnvCache;
}

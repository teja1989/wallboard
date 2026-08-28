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
  /**
   * Whether to offer the Google button. Configuring Google sign-in needs an OAuth client
   * and a consent screen, which is console work no deploy pipeline can do for you — so a
   * fresh project turns this off and offers the email link alone, rather than showing a
   * button that fails with `auth/operation-not-allowed` on the first click.
   */
  NEXT_PUBLIC_GOOGLE_SIGN_IN: booleanish.default(true),
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

  /**
   * Mail. Defaults to `outbox` so a half-configured deploy writes to a collection nobody
   * reads rather than sending real invitations to real guests.
   */
  EMAIL_DRIVER: z.enum(['outbox', 'resend']).default('outbox'),
  RESEND_API_KEY: z.string().optional(),
  /**
   * Who invitations come from. Must be on a domain verified with the provider, or every
   * send fails SPF and lands in spam — assuming it leaves at all.
   *
   * Overridable so a preview deploy, or a first test before DNS has propagated, can send
   * from the provider's own sandbox domain instead.
   */
  EMAIL_FROM_ADDRESS: z.string().email().default('invitations@marqueersvp.com'),

  /**
   * Address lookup. Optional: with no key the address field stays a plain text box, which
   * is what a deploy that has not been given one should get rather than a broken search.
   *
   * Server-side only — never a NEXT_PUBLIC_. A key in the bundle is a key on someone
   * else's bill.
   */
  GOOGLE_MAPS_API_KEY: z.string().optional(),

  /**
   * Payments. Defaults to `mock` so a deploy that forgets its keys cannot half-take real
   * money — the mock checkout refuses to run outside development.
   */
  BILLING_DRIVER: z.enum(['mock', 'stripe']).default('mock'),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_EVENT: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
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
  NEXT_PUBLIC_GOOGLE_SIGN_IN: process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN,
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
  if (parsed.data.EMAIL_DRIVER === 'resend' && !parsed.data.RESEND_API_KEY) {
    throw new Error('EMAIL_DRIVER=resend requires RESEND_API_KEY to be set.');
  }
  if (parsed.data.BILLING_DRIVER === 'stripe') {
    // Failing at boot beats failing at checkout, where the cost is a lost sale and a
    // customer who thinks the product is broken.
    const missing = (
      [
        ['STRIPE_SECRET_KEY', parsed.data.STRIPE_SECRET_KEY],
        ['STRIPE_WEBHOOK_SECRET', parsed.data.STRIPE_WEBHOOK_SECRET],
        ['STRIPE_PRICE_EVENT', parsed.data.STRIPE_PRICE_EVENT],
        ['STRIPE_PRICE_PRO', parsed.data.STRIPE_PRICE_PRO],
      ] as const
    )
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`BILLING_DRIVER=stripe requires: ${missing.join(', ')}`);
    }
  }
  serverEnvCache = parsed.data;
  return serverEnvCache;
}

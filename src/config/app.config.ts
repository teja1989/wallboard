import { clientEnv, serverEnv } from './env.config';
import { sessionConfig } from './limits.config';

/**
 * Composed application config. Import this rather than reading process.env anywhere else.
 */

export const appConfig = {
  siteUrl: clientEnv.NEXT_PUBLIC_SITE_URL,
  useEmulators: clientEnv.NEXT_PUBLIC_USE_EMULATORS,
  firebase: {
    apiKey: clientEnv.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: clientEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: clientEnv.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  emulator: {
    host: clientEnv.NEXT_PUBLIC_EMULATOR_HOST,
    authPort: clientEnv.NEXT_PUBLIC_EMULATOR_AUTH_PORT,
    firestorePort: clientEnv.NEXT_PUBLIC_EMULATOR_FIRESTORE_PORT,
    storagePort: clientEnv.NEXT_PUBLIC_EMULATOR_STORAGE_PORT,
  },
  session: sessionConfig,
  auth: {
    /** Off until an OAuth client exists for the project. See docs/DEPLOYMENT.md. */
    googleSignIn: clientEnv.NEXT_PUBLIC_GOOGLE_SIGN_IN,
  },
} as const;

/** Server-only slice. Throws in the browser via serverEnv(). */
export function serverConfig() {
  const env = serverEnv();
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    storage: {
      driver: env.STORAGE_DRIVER,
      bucket: env.GCS_BUCKET ?? clientEnv.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
    joinCodePepper: env.JOIN_CODE_PEPPER,
    email: {
      driver: env.EMAIL_DRIVER,
      fromAddress: env.EMAIL_FROM_ADDRESS,
    },
    resendApiKey: env.RESEND_API_KEY,
    places: {
      apiKey: env.GOOGLE_MAPS_API_KEY,
      enabled: Boolean(env.GOOGLE_MAPS_API_KEY),
    },
    billing: {
      driver: env.BILLING_DRIVER,
    },
    stripe: {
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    },
    cleanupSecret: env.CLEANUP_TASK_SECRET,
    ownerEmails: env.OWNER_EMAILS,
    serviceAccountJson: env.FIREBASE_SERVICE_ACCOUNT_JSON,
  } as const;
}

/** Firestore collection and subcollection names, in one place. */
export const collections = {
  users: 'users',
  events: 'events',
  joinCodes: 'joinCodes',
  rateLimits: 'rateLimits',
  auditLogs: 'auditLogs',
  // Subcollections of events/{eventId}
  members: 'members',
  posts: 'posts',
  private: 'private',
  rsvpNotes: 'rsvpNotes',
  invitees: 'invitees',
  /** Aggregate funnel counters, one document per day. No per-visitor rows — see funnel.ts. */
  funnel: 'funnel',
  // Subcollection of events/{eventId}/invitees/{inviteeId}
  deliveries: 'deliveries',
  // Development only: where the outbox driver puts mail instead of sending it.
  mailOutbox: 'mailOutbox',
} as const;

/** Fixed document ids. */
export const docIds = {
  joinCode: 'joinCode',
} as const;

/** Storage object path builders. Keeps prefixes consistent for lifecycle rules and sweeps. */
export const storagePaths = {
  pending: (eventId: string, uploadId: string, ext: string) =>
    `events/${eventId}/pending/${uploadId}${ext}`,
  /** A derivative, staged alongside the original it came from. */
  pendingVariant: (eventId: string, uploadId: string, variant: string) =>
    `events/${eventId}/pending/${uploadId}.${variant}.webp`,
  post: (eventId: string, postId: string, ext: string) =>
    `events/${eventId}/posts/${postId}/original${ext}`,
  /** Resized copies. These are what the wall and the lightbox actually load. */
  variant: (eventId: string, postId: string, variant: string) =>
    `events/${eventId}/posts/${postId}/${variant}.webp`,
  eventPrefix: (eventId: string) => `events/${eventId}/`,
  /** Everything a post owns, for prefix deletion. */
  postPrefix: (eventId: string, postId: string) => `events/${eventId}/posts/${postId}/`,
} as const;

import { z } from 'zod';
import {
  POST_KINDS,
  IMAGE_VARIANT_IDS,
  contentLimits,
  defaultTemplateId,
  emailConfig,
  templates,
  expiryPresets,
  joinCodeConfig,
  mediaRules,
  occasions,
  rsvpChoices,
  type MediaKind,
} from '@/config';

/**
 * Request schemas. Every route handler parses its input through one of these — there is no
 * other way into the write path. Bounds come from config so client and server cannot drift.
 */

/**
 * Strips control, zero-width and bidi-override characters that render invisibly or break
 * layout. Matching control characters is the entire point here, so the rule against them
 * does not apply.
 */
// eslint-disable-next-line no-control-regex
const INVISIBLE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g;

const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(INVISIBLE, '').trim())
    .pipe(z.string().max(max));

const templateIds = templates.map((t) => t.id) as [string, ...string[]];
const presetIds = expiryPresets.map((p) => p.id) as [string, ...string[]];
const occasionIds = occasions.map((o) => o.id) as [string, ...string[]];
const rsvpChoiceIds = [...rsvpChoices] as [string, ...string[]];

/**
 * An event happens at a point in time, and the invitation is worthless if that time is
 * wrong. Bounded to a sane window so a typo cannot store a date in the year 30000.
 */
const eventTimestamp = z
  .number()
  .int()
  .min(Date.UTC(2000, 0, 1))
  .max(Date.UTC(2100, 0, 1))
  .nullable();

/** A maps link the host pasted. http(s) only — anything else is a redirect waiting to happen. */
const externalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => {
    if (value === '') return true;
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'That does not look like a web address.')
  .transform((value) => (value === '' ? null : value))
  .nullable();

const locationSchema = z
  .object({
    name: cleanText(contentLimits.locationNameMaxLength).default(''),
    address: cleanText(contentLimits.locationAddressMaxLength).default(''),
    url: externalUrl.default(null),
  })
  .nullable()
  .default(null);

const rsvpSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  deadline: eventTimestamp.default(null),
  allowPlusOnes: z.boolean().default(true),
  maxPartySize: z.number().int().min(1).max(contentLimits.maxPartySize).default(2),
  askNote: z.boolean().default(false),
  question: cleanText(contentLimits.rsvpQuestionMaxLength)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .default(null),
});

export const joinCodeSchema = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, '').toUpperCase())
  .pipe(
    z
      .string()
      .length(joinCodeConfig.length)
      .regex(new RegExp(`^[${joinCodeConfig.alphabet}]+$`), 'That is not a valid code.'),
  );

export const eventIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,40}$/);
export const postIdSchema = z.string().regex(/^[A-Za-z0-9_-]{10,40}$/);
export const uidSchema = z.string().min(1).max(128);

export const createEventSchema = z
  .object({
    title: cleanText(contentLimits.eventTitleMaxLength).pipe(z.string().min(1, 'Give it a name.')),
    description: cleanText(contentLimits.eventDescriptionMaxLength).default(''),
    occasion: z.enum(occasionIds),
    hostedBy: cleanText(contentLimits.hostedByMaxLength).default(''),
    templateId: z.enum(templateIds).default(defaultTemplateId),
    startsAt: eventTimestamp.default(null),
    endsAt: eventTimestamp.default(null),
    location: locationSchema,
    dressCode: cleanText(contentLimits.dressCodeMaxLength).default(''),
    rsvp: rsvpSettingsSchema.prefault({}),
    expiryPresetId: z.enum(presetIds),
    whoCanPost: z.enum(['members', 'anyone']).default('members'),
    allowedKinds: z
      .array(z.enum(POST_KINDS))
      .min(1)
      .default([...POST_KINDS]),
  })
  .refine((v) => v.startsAt === null || v.endsAt === null || v.endsAt >= v.startsAt, {
    path: ['endsAt'],
    message: 'The end time is before the start time.',
  });
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    title: cleanText(contentLimits.eventTitleMaxLength).pipe(z.string().min(1)).optional(),
    description: cleanText(contentLimits.eventDescriptionMaxLength).optional(),
    hostedBy: cleanText(contentLimits.hostedByMaxLength).optional(),
    templateId: z.enum(templateIds).optional(),
    startsAt: eventTimestamp.optional(),
    endsAt: eventTimestamp.optional(),
    location: locationSchema.optional(),
    dressCode: cleanText(contentLimits.dressCodeMaxLength).optional(),
    rsvp: rsvpSettingsSchema.partial().optional(),
    whoCanPost: z.enum(['members', 'anyone']).optional(),
    allowedKinds: z.array(z.enum(POST_KINDS)).min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const extendEventSchema = z.object({ expiryPresetId: z.enum(presetIds) });

export const joinEventSchema = z.object({
  code: joinCodeSchema,
  displayName: cleanText(contentLimits.displayNameMaxLength).optional(),
});
export type JoinEventInput = z.infer<typeof joinEventSchema>;

const mediaKinds = Object.keys(mediaRules) as [MediaKind, ...MediaKind[]];

/**
 * Client-declared upload facts. Treated as a *request*, not a truth: the server re-checks
 * the real size and stored content type at finalize before the post is created.
 */
export const uploadTargetSchema = z
  .object({
    eventId: eventIdSchema,
    kind: z.enum(mediaKinds),
    mimeType: z.string().min(1).max(128),
    bytes: z.number().int().positive(),
    durationSeconds: z
      .number()
      .nonnegative()
      .max(24 * 60 * 60)
      .nullable()
      .default(null),
    /** Which resized copies the browser managed to produce. */
    variants: z.array(z.enum(IMAGE_VARIANT_IDS)).default([]),
  })
  .superRefine((v, ctx) => {
    const rule = mediaRules[v.kind];
    if (!rule.mimeTypes.includes(v.mimeType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['mimeType'],
        message: `${v.mimeType} is not supported for ${v.kind}.`,
      });
    }
    if (v.bytes > rule.maxBytes) {
      ctx.addIssue({
        code: 'custom',
        path: ['bytes'],
        message: `That ${v.kind} is larger than the ${Math.round(rule.maxBytes / (1024 * 1024))} MB limit.`,
      });
    }
    if (
      rule.maxDurationSeconds !== null &&
      v.durationSeconds !== null &&
      v.durationSeconds > rule.maxDurationSeconds
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationSeconds'],
        message: `That ${v.kind} is longer than ${rule.maxDurationSeconds} seconds.`,
      });
    }
  });
export type UploadTargetInput = z.infer<typeof uploadTargetSchema>;

export const createPostSchema = z
  .object({
    eventId: eventIdSchema,
    body: cleanText(contentLimits.postBodyMaxLength).default(''),
    upload: z
      .object({
        uploadId: z.string().regex(/^[A-Za-z0-9_-]{10,64}$/),
        kind: z.enum(mediaKinds),
        durationSeconds: z.number().nonnegative().nullable().default(null),
        width: z.number().int().positive().max(20000).nullable().default(null),
        height: z.number().int().positive().max(20000).nullable().default(null),
        /**
         * Which derivatives were uploaded. A claim, not a fact — finalize checks each one
         * actually landed and is within its cap before wiring it up.
         */
        variants: z.array(z.enum(IMAGE_VARIANT_IDS)).default([]),
      })
      .nullable()
      .default(null),
  })
  .refine((v) => v.body.length > 0 || v.upload !== null, 'Write something or add a file.');
export type CreatePostInput = z.infer<typeof createPostSchema>;

/**
 * A guest's reply. `partySize` is validated again on the server against the host's own
 * `maxPartySize`, because this schema cannot know which event it is for.
 */
export const rsvpSchema = z.object({
  status: z.enum(rsvpChoiceIds),
  /**
   * Who is coming, not just how many. "Two people" and "one adult and a toddler" are very
   * different for a host counting chairs, meals and car seats, and asking is free.
   *
   * The total is derived server-side rather than accepted, so `adults + children` and
   * `partySize` cannot disagree.
   */
  adults: z.number().int().min(1).max(contentLimits.maxPartySize).default(1),
  children: z
    .number()
    .int()
    .min(0)
    .max(contentLimits.maxPartySize - 1)
    .default(0),
  note: cleanText(contentLimits.rsvpNoteMaxLength).default(''),
  answer: cleanText(contentLimits.rsvpAnswerMaxLength).default(''),
  displayName: cleanText(contentLimits.displayNameMaxLength).optional(),
});
export type RsvpInput = z.infer<typeof rsvpSchema>;

/**
 * Addresses a host is adding to their guest list.
 *
 * Deliberately narrow: this is the only way an address enters the system, and there is no
 * endpoint anywhere that accepts a message body. A host adds people to *their* event and
 * sends *that event's* invitation — which is what stops this being a spam relay.
 */
/** A guest's personal link token: hex, fixed width, never anything else. */
export const guestTokenSchema = z
  .string()
  .regex(/^[0-9a-f]{16,64}$/, 'That is not a valid invitation link.');

export const addInviteesSchema = z.object({
  invitees: z
    .array(
      z
        .object({
          email: z
            .string()
            .trim()
            .toLowerCase()
            .max(254)
            .pipe(z.string().email('That does not look like an email address.'))
            .nullish(),
          // Validated properly server-side by libphonenumber; this only bounds the input.
          phone: z.string().trim().max(32).nullish(),
          name: cleanText(contentLimits.displayNameMaxLength).default(''),
        })
        // People are known by one or the other, and increasingly by the number rather than
        // the address. Requiring both would exclude most of a phone's contact list.
        .refine((entry) => Boolean(entry.email) || Boolean(entry.phone), {
          message: 'Each guest needs either an email address or a phone number.',
        }),
    )
    .min(1, 'Add at least one person.')
    .max(emailConfig.maxInviteesPerRequest),
});
export type AddInviteesInput = z.infer<typeof addInviteesSchema>;

export const sendInvitesSchema = z.object({
  kind: z.enum(['invitation', 'reminder']).default('invitation'),
});

export const unsubscribeSchema = z.object({
  eventId: eventIdSchema,
  email: z.string().trim().toLowerCase().max(254).pipe(z.string().email()),
  token: z.string().regex(/^[0-9a-f]{32}$/),
});

/** The host types the event's name to confirm. Compared case-insensitively server-side. */
export const deleteEventSchema = z.object({
  confirm: z
    .string()
    .min(1)
    .max(contentLimits.eventTitleMaxLength + 10),
});

/**
 * Object paths the wall wants URLs for.
 *
 * Bounded so one request cannot ask us to sign an unbounded list, and shaped so nothing
 * exotic reaches the signer. The prefix check that actually authorises these lives in the
 * route, because only it knows which event is being asked about.
 */
export const mediaUrlsSchema = z.object({
  paths: z
    .array(
      z
        .string()
        .max(300)
        // Exactly the shape `storagePaths.post` and `storagePaths.variant` produce: one
        // post id, then one file name. No nesting, and no `..` — object names are literal
        // in GCS, but the emulator adapter puts them on a real filesystem.
        .regex(/^events\/[A-Za-z0-9_-]+\/posts\/[A-Za-z0-9_-]+\/[A-Za-z0-9_.-]+$/)
        .refine((path) => !path.includes('..'), 'That is not a media path.'),
    )
    .min(1)
    .max(contentLimits.wallPageSize * 3),
});

export const checkoutSchema = z.object({
  planId: z.enum(['event', 'pro']),
  /** Required for a per-event unlock; meaningless for a subscription. */
  eventId: eventIdSchema.optional(),
});

/**
 * The one field of a profile its owner may change.
 *
 * Cleaned like every other display name, and bounded by the same limit, because this is the
 * same string that appears on an invitation and beside every post on a wall.
 */
export const updateAccountSchema = z.object({
  displayName: cleanText(contentLimits.displayNameMaxLength).pipe(
    z.string().min(1, 'A name cannot be empty.'),
  ),
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const sessionSchema = z.object({ idToken: z.string().min(20).max(8192) });

export const displayNameSchema = z.object({
  displayName: cleanText(contentLimits.displayNameMaxLength).pipe(z.string().min(1)),
});

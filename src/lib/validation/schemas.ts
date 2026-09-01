import { z } from 'zod';
import {
  MILESTONE_CATEGORY_IDS,
  POST_KINDS,
  IMAGE_VARIANT_IDS,
  adminLimits,
  contentLimits,
  defaultTemplateId,
  emailConfig,
  placesConfig,
  templates,
  expiryPresets,
  joinCodeConfig,
  mediaRules,
  occasions,
  planningLimits,
  registryLimits,
  fundsConfig,
  hostAssignableEventRoles,
  rsvpChoices,
  type MediaKind,
} from '@/config';
import { isValidTimeZone } from '@/lib/utils';

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

/**
 * The event's timezone, as the host's browser reports it.
 *
 * Validated against the runtime's own zone database rather than a regex: an unparseable
 * zone would throw inside Intl at render time, on the invitation, for every guest.
 */
const timeZone = z
  .string()
  .max(64)
  .refine(isValidTimeZone, 'That is not a timezone this system knows.')
  .nullable();

const timeZoneSchema = timeZone.default(null);

const location = z
  .object({
    name: cleanText(contentLimits.locationNameMaxLength).default(''),
    address: cleanText(contentLimits.locationAddressMaxLength).default(''),
    url: externalUrl.default(null),
    // Present only when the host chose a suggestion. Bounded to a real globe so a bad
    // coordinate cannot reach the map proxy or the timezone lookup.
    placeId: z.string().trim().max(256).nullish(),
    lat: z.number().min(-90).max(90).nullish(),
    lng: z.number().min(-180).max(180).nullish(),
  })
  .nullable();

const locationSchema = location.default(null);

/**
 * The RSVP settings, in two shapes.
 *
 * **`.partial()` does not undo `.default()`**, and that has now cost two bugs. A field with a
 * default is already optional, so a "partial" update parses into a *complete* object with
 * every unmentioned field filled in from its default — and a handler that writes what it
 * parsed silently resets the settings the request never mentioned. Patching the reminder
 * switch quietly put `maxPartySize` back to two and blanked the host's custom question.
 *
 * The same shape caused the milestone-budget bug: ticking a box wiped the row's budget. So
 * the field definitions live here once, and the two schemas differ in exactly one way —
 * creation fills a blank in, an update leaves it absent.
 */
const rsvpFields = {
  enabled: z.boolean(),
  deadline: eventTimestamp,
  allowPlusOnes: z.boolean(),
  maxPartySize: z.number().int().min(1).max(contentLimits.maxPartySize),
  askNote: z.boolean(),
  question: cleanText(contentLimits.rsvpQuestionMaxLength)
    .transform((value) => (value === '' ? null : value))
    .nullable(),
  autoRemind: z.boolean(),
};

const rsvpSettingsSchema = z.object({
  enabled: rsvpFields.enabled.default(true),
  deadline: rsvpFields.deadline.default(null),
  allowPlusOnes: rsvpFields.allowPlusOnes.default(true),
  maxPartySize: rsvpFields.maxPartySize.default(2),
  question: rsvpFields.question.default(null),
  askNote: rsvpFields.askNote.default(false),
  // Defaults on. Chasing replies is the part of hosting people forget, and the host can turn
  // it off in one tap — but a default of off would mean the feature only helps hosts who go
  // looking for it, which is the same failure the manual nudge button already had.
  autoRemind: rsvpFields.autoRemind.default(true),
});

/** No defaults anywhere: absent has to mean "leave it alone". See the note above. */
const rsvpPatchSchema = z.object({
  enabled: rsvpFields.enabled.optional(),
  deadline: rsvpFields.deadline.optional(),
  allowPlusOnes: rsvpFields.allowPlusOnes.optional(),
  maxPartySize: rsvpFields.maxPartySize.optional(),
  question: rsvpFields.question.optional(),
  askNote: rsvpFields.askNote.optional(),
  autoRemind: rsvpFields.autoRemind.optional(),
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

export const agendaItemSchema = z.object({
  id: z.string(),
  time: cleanText(30),
  title: cleanText(60),
  description: cleanText(200).optional(),
  emoji: cleanText(10).optional(),
});

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
    timeZone: timeZoneSchema,
    dressCode: cleanText(contentLimits.dressCodeMaxLength).default(''),
    rsvp: rsvpSettingsSchema.prefault({}),
    agenda: z.array(agendaItemSchema).max(20).optional(),
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
    location: location.optional(),
    timeZone: timeZone.optional(),
    dressCode: cleanText(contentLimits.dressCodeMaxLength).optional(),
    rsvp: rsvpPatchSchema.optional(),
    agenda: z.array(agendaItemSchema).max(20).optional(),
    whoCanPost: z.enum(['members', 'anyone']).optional(),
    allowedKinds: z.array(z.enum(POST_KINDS)).min(1).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update.');
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const extendEventSchema = z.object({ expiryPresetId: z.enum(presetIds) });

export const joinEventSchema = z.object({
  code: joinCodeSchema,
  displayName: cleanText(contentLimits.displayNameMaxLength).optional(),
  role: z.enum(['member', 'cohost']).optional(),
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
    const normalizedType = (v.mimeType.split(';')[0] ?? '').trim().toLowerCase();
    if (
      !rule.mimeTypes.includes(v.mimeType) &&
      !(normalizedType && rule.mimeTypes.includes(normalizedType))
    ) {
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

/**
 * Address lookup.
 *
 * The session token ties a run of keystrokes and the final details call into one billable
 * unit. Shape-checked rather than trusted: it goes straight to Google in a request we pay
 * for.
 */
const placeSessionToken = z.string().regex(/^[0-9a-f-]{16,64}$/, 'Bad search session.');

export const placeQuerySchema = z.object({
  query: z.string().trim().min(placesConfig.minQueryLength).max(200),
  sessionToken: placeSessionToken,
});

export const placeDetailsSchema = z.object({
  placeId: z.string().trim().min(1).max(256),
  sessionToken: placeSessionToken,
});

/** Coordinates arrive as query strings, so they are coerced and bounded to a real globe. */
export const mapCoordsSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/**
 * The planning list.
 *
 * `dueAt` reuses the event timestamp bounds — a plan whose deadlines can land in the year
 * 30000 sorts wrongly forever. `budget` is whole currency units: nobody budgets a party to
 * the cent, and an integer cannot accumulate a rounding error across a total.
 */
const milestoneBudget = z.number().int().min(0).max(planningLimits.maxBudget).nullable();

export const addMilestoneSchema = z.object({
  title: cleanText(planningLimits.titleMaxLength).pipe(z.string().min(1, 'Give it a name.')),
  note: cleanText(planningLimits.noteMaxLength).default(''),
  categoryId: z.enum(MILESTONE_CATEGORY_IDS).default('admin'),
  dueAt: eventTimestamp.default(null),
  budget: milestoneBudget.default(null),
});
export type AddMilestoneInput = z.infer<typeof addMilestoneSchema>;

/**
 * Every field optional, because this one endpoint serves a tick, a rename and a budget edit.
 *
 * **No `.default()` on anything here**, and that is load-bearing rather than stylistic. The
 * handler applies the patch by spreading it over the stored row, so a field that defaults
 * instead of staying absent is a field that silently overwrites. `budget` had `.default(null)`
 * shared with the add schema for about ten minutes, which meant a request carrying nothing but
 * `{ done: true }` parsed as `{ done: true, budget: null }` — and ticking a box wiped whatever
 * the host had budgeted for that row. The "nothing to change" refusal below is what caught it.
 *
 * `doneAt` is deliberately absent for the same family of reason: the server derives it from
 * `done`, so the two cannot disagree and a host cannot backdate their own progress.
 */
export const patchMilestoneSchema = z
  .object({
    title: cleanText(planningLimits.titleMaxLength).pipe(z.string().min(1)).optional(),
    note: cleanText(planningLimits.noteMaxLength).optional(),
    categoryId: z.enum(MILESTONE_CATEGORY_IDS).optional(),
    done: z.boolean().optional(),
    dueAt: eventTimestamp.optional(),
    budget: milestoneBudget.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'Nothing to change.');
export type PatchMilestoneInput = z.infer<typeof patchMilestoneSchema>;

/** Either an id we minted, or the `template:key` a rendered row carries before it is saved. */
export const milestoneIdSchema = z
  .string()
  .regex(/^(template:)?[A-Za-z0-9_-]{3,60}$/, 'That is not on the list.');

/**
 * A gift-list link.
 *
 * The URL is required here, unlike `externalUrl`, because a registry row with no destination
 * is a row that does nothing but take up space on somebody's invitation. `label` is optional:
 * left blank the client names it from the host, so pasting a URL and pressing add works.
 */
export const addRegistryLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, 'Paste a link first.')
    .max(500)
    .refine((value) => {
      try {
        return ['http:', 'https:'].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    }, 'That does not look like a web address.'),
  label: cleanText(registryLimits.labelMaxLength).default(''),
  note: cleanText(registryLimits.noteMaxLength).default(''),
});
export type AddRegistryLinkInput = z.infer<typeof addRegistryLinkSchema>;

/** Ids are minted by us, so this only has to reject anything that is not one of ours. */
export const registryLinkIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/);

export const registryClickSchema = z.object({ linkId: registryLinkIdSchema });

export const createFundSchema = z.object({
  title: cleanText(fundsConfig.titleMaxLength).pipe(z.string().min(1, 'Give the cash pot a name.')),
  description: cleanText(fundsConfig.descriptionMaxLength).default(''),
  category: z.enum(['honeymoon', 'travel', 'home', 'baby', 'celebration', 'charity', 'custom']),
  targetAmount: z
    .number()
    .int()
    .positive()
    .max(fundsConfig.maxTargetAmount)
    .nullable()
    .default(null),
  suggestedPresets: z.array(z.number().int().positive()).min(1).max(6).default([25, 50, 100, 200]),
});
export type CreateFundInput = z.infer<typeof createFundSchema>;

export const fundIdSchema = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/);

export const contributeToFundSchema = z.object({
  fundId: fundIdSchema,
  amount: z
    .number()
    .int()
    .min(fundsConfig.minContributionAmount)
    .max(fundsConfig.maxContributionAmount),
  contributorName: cleanText(contentLimits.displayNameMaxLength).default(''),
  message: cleanText(fundsConfig.descriptionMaxLength).default(''),
  isAnonymous: z.boolean().default(false),
  postToWall: z.boolean().default(true),
});
export type ContributeToFundInput = z.infer<typeof contributeToFundSchema>;

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

/** 16 random bytes as hex. Defined once here; the delete route used to carry its own copy. */
export const inviteeIdSchema = z.string().regex(/^[0-9a-f]{32}$/);

/**
 * Sending the invitation, to everybody or to named people.
 *
 * `inviteeIds` can only ever **narrow**. Absent means "everyone eligible", which is what the
 * bulk button has always done; present means "of those, only these". Every eligibility rule —
 * unsubscribed, already sent, already replied, still inside the reminder cooldown — is applied
 * server-side afterwards either way, so naming somebody cannot post them a second invitation
 * or reach someone who has opted out. The host chooses *who*, never *whether the rules apply*.
 *
 * Bounded by the same per-request cap as adding people, so one call cannot become a mail run
 * of arbitrary length.
 */
export const sendInvitesSchema = z.object({
  kind: z.enum(['invitation', 'reminder']).default('invitation'),
  inviteeIds: z.array(inviteeIdSchema).min(1).max(emailConfig.maxInviteesPerRequest).optional(),
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

/**
 * Suspending an account, or lifting a suspension.
 *
 * The reason is required in both directions and has a floor on its length, because the point
 * of writing it down is that somebody reading the audit log in six weeks can tell whether the
 * call was right. "x" satisfies a required field and answers nothing.
 *
 * No defaults on either key — see the `.partial()`/`.default()` trap in the dev skill. This
 * is a two-field body where both fields are the whole request, so an absent one has to fail
 * rather than quietly resolve to `false`, which would turn a mis-shaped suspend request into
 * a silent un-suspend.
 */
export const suspendUserSchema = z.object({
  suspended: z.boolean(),
  reason: cleanText(adminLimits.maxReasonLength).pipe(
    z
      .string()
      .min(adminLimits.minReasonLength, 'Say why, so this is reviewable later.')
      .max(adminLimits.maxReasonLength),
  ),
});
export type SuspendUserInput = z.infer<typeof suspendUserSchema>;

/**
 * A console search box.
 *
 * Bounded and stripped like every other free text that reaches a query. It is compared, never
 * interpolated — Firestore has no query language to inject into — but an unbounded string
 * still becomes an unbounded document id lookup.
 */
export const adminQuerySchema = cleanText(200);

export const sessionSchema = z.object({ idToken: z.string().min(20).max(8192) });

export const displayNameSchema = z.object({
  displayName: cleanText(contentLimits.displayNameMaxLength).pipe(z.string().min(1)),
});

export const assignRoleSchema = z.object({
  role: z.enum(hostAssignableEventRoles as unknown as [string, ...string[]]),
});
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

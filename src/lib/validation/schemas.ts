import { z } from 'zod';
import {
  POST_KINDS,
  contentLimits,
  eventThemes,
  expiryPresets,
  joinCodeConfig,
  mediaRules,
  type MediaKind,
} from '@/config';

/**
 * Request schemas. Every route handler parses its input through one of these — there is no
 * other way into the write path. Bounds come from config so client and server cannot drift.
 */

const themeIds = eventThemes.map((t) => t.id) as [string, ...string[]];
const presetIds = expiryPresets.map((p) => p.id) as [string, ...string[]];

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

export const createEventSchema = z.object({
  title: cleanText(contentLimits.eventTitleMaxLength).pipe(z.string().min(1, 'Give it a name.')),
  description: cleanText(contentLimits.eventDescriptionMaxLength).default(''),
  themeId: z.enum(themeIds).default(eventThemes[0].id),
  expiryPresetId: z.enum(presetIds),
  whoCanPost: z.enum(['members', 'anyone']).default('members'),
  allowedKinds: z
    .array(z.enum(POST_KINDS))
    .min(1)
    .default([...POST_KINDS]),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = z
  .object({
    title: cleanText(contentLimits.eventTitleMaxLength).pipe(z.string().min(1)).optional(),
    description: cleanText(contentLimits.eventDescriptionMaxLength).optional(),
    themeId: z.enum(themeIds).optional(),
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
        /** Optional client-rendered poster frame, as a data URL. */
        posterDataUrl: z
          .string()
          .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)
          .max(2_000_000)
          .nullable()
          .default(null),
      })
      .nullable()
      .default(null),
  })
  .refine((v) => v.body.length > 0 || v.upload !== null, 'Write something or add a file.');
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const sessionSchema = z.object({ idToken: z.string().min(20).max(8192) });

export const displayNameSchema = z.object({
  displayName: cleanText(contentLimits.displayNameMaxLength).pipe(z.string().min(1)),
});

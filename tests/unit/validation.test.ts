import { describe, expect, it } from 'vitest';
import { contentLimits, mediaRules } from '@/config';
import {
  createEventSchema,
  createPostSchema,
  joinCodeSchema,
  uploadTargetSchema,
} from '@/lib/validation/schemas';

const EVENT_ID = 'abcdefghij1234';

describe('joinCodeSchema', () => {
  it('accepts a code however it was typed', () => {
    expect(joinCodeSchema.parse('abcd-2345')).toBe('ABCD2345');
    expect(joinCodeSchema.parse(' ABCD 2345 ')).toBe('ABCD2345');
  });

  it('rejects codes containing excluded characters', () => {
    expect(joinCodeSchema.safeParse('ABCD2340').success).toBe(false);
  });

  it('rejects the wrong length', () => {
    expect(joinCodeSchema.safeParse('ABCD234').success).toBe(false);
  });
});

describe('createEventSchema', () => {
  it('requires a title with something in it', () => {
    expect(createEventSchema.safeParse({ title: '   ', expiryPresetId: '24h' }).success).toBe(
      false,
    );
  });

  it('trims and strips invisible characters from the title', () => {
    const parsed = createEventSchema.parse({
      title: '  Priya​​s party  ',
      expiryPresetId: '24h',
    });
    expect(parsed.title).toBe('Priyas party');
  });

  it('rejects an unknown expiry preset', () => {
    expect(createEventSchema.safeParse({ title: 'Party', expiryPresetId: '99y' }).success).toBe(
      false,
    );
  });

  it('rejects a title beyond the configured limit', () => {
    const title = 'x'.repeat(contentLimits.eventTitleMaxLength + 1);
    expect(createEventSchema.safeParse({ title, expiryPresetId: '24h' }).success).toBe(false);
  });

  it('defaults to allowing every post kind', () => {
    const parsed = createEventSchema.parse({ title: 'Party', expiryPresetId: '24h' });
    expect(parsed.allowedKinds).toContain('image');
    expect(parsed.allowedKinds).toContain('text');
  });

  it('rejects an empty allowedKinds list', () => {
    expect(
      createEventSchema.safeParse({ title: 'Party', expiryPresetId: '24h', allowedKinds: [] })
        .success,
    ).toBe(false);
  });
});

describe('uploadTargetSchema', () => {
  const base = { eventId: EVENT_ID, kind: 'image' as const, mimeType: 'image/jpeg', bytes: 1024 };

  it('accepts a valid request', () => {
    expect(uploadTargetSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a MIME type outside the rule for that kind', () => {
    expect(uploadTargetSchema.safeParse({ ...base, mimeType: 'image/tiff' }).success).toBe(false);
    // A video type on an image upload is still wrong, even though it is allowed elsewhere.
    expect(uploadTargetSchema.safeParse({ ...base, mimeType: 'video/mp4' }).success).toBe(false);
  });

  it('rejects a declared size over the limit', () => {
    expect(
      uploadTargetSchema.safeParse({ ...base, bytes: mediaRules.image.maxBytes + 1 }).success,
    ).toBe(false);
  });

  it('rejects zero and negative sizes', () => {
    expect(uploadTargetSchema.safeParse({ ...base, bytes: 0 }).success).toBe(false);
    expect(uploadTargetSchema.safeParse({ ...base, bytes: -5 }).success).toBe(false);
  });

  it('rejects over-long video', () => {
    const tooLong = mediaRules.video.maxDurationSeconds! + 1;
    expect(
      uploadTargetSchema.safeParse({
        eventId: EVENT_ID,
        kind: 'video',
        mimeType: 'video/mp4',
        bytes: 1024,
        durationSeconds: tooLong,
      }).success,
    ).toBe(false);
  });

  it('rejects a malformed event id', () => {
    expect(uploadTargetSchema.safeParse({ ...base, eventId: '../../etc' }).success).toBe(false);
  });
});

describe('createPostSchema', () => {
  it('rejects a post with neither text nor an attachment', () => {
    expect(createPostSchema.safeParse({ eventId: EVENT_ID, body: '   ' }).success).toBe(false);
  });

  it('accepts text alone', () => {
    expect(createPostSchema.safeParse({ eventId: EVENT_ID, body: 'Hello' }).success).toBe(true);
  });

  it('accepts an attachment with no text', () => {
    expect(
      createPostSchema.safeParse({
        eventId: EVENT_ID,
        body: '',
        upload: { uploadId: 'abcdefghij1234', kind: 'image' },
      }).success,
    ).toBe(true);
  });

  it('rejects a poster that is not an image data URL', () => {
    expect(
      createPostSchema.safeParse({
        eventId: EVENT_ID,
        body: '',
        upload: {
          uploadId: 'abcdefghij1234',
          kind: 'video',
          posterDataUrl: 'javascript:alert(1)',
        },
      }).success,
    ).toBe(false);
  });

  it('rejects a body beyond the configured limit', () => {
    expect(
      createPostSchema.safeParse({
        eventId: EVENT_ID,
        body: 'x'.repeat(contentLimits.postBodyMaxLength + 1),
      }).success,
    ).toBe(false);
  });
});

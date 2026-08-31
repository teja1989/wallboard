import { describe, expect, it } from 'vitest';
import { mediaRules, POST_KINDS } from '@/config';
import { uploadTargetSchema } from '@/lib/validation/schemas';

describe('Voice Toast & Audio Voicemail Engine', () => {
  it('supports audio as a first-class post kind in limits and media rules', () => {
    expect(POST_KINDS).toContain('audio');
    const rule = mediaRules.audio;
    expect(rule).toBeDefined();
    expect(rule.maxBytes).toBeGreaterThanOrEqual(10 * 1024 * 1024);
    expect(rule.maxDurationSeconds).toBe(300); // 5 minutes maximum
    expect(rule.mimeTypes).toContain('audio/webm');
    expect(rule.mimeTypes).toContain('audio/mp4');
    expect(rule.mimeTypes).toContain('audio/mpeg');
  });

  it('validates upload target requests for audio posts accurately', () => {
    const validAudioTarget = {
      eventId: 'ev_1234567890',
      kind: 'audio' as const,
      mimeType: 'audio/webm',
      bytes: 1024 * 500, // 500 KB
      durationSeconds: 45,
      variants: [],
    };

    const parsed = uploadTargetSchema.safeParse(validAudioTarget);
    expect(parsed.success).toBe(true);
  });

  it('rejects audio uploads exceeding max duration limits', () => {
    const overlongAudioTarget = {
      eventId: 'ev_1234567890',
      kind: 'audio' as const,
      mimeType: 'audio/webm',
      bytes: 1024 * 500,
      durationSeconds: 350, // Exceeds 300s
      variants: [],
    };

    const parsed = uploadTargetSchema.safeParse(overlongAudioTarget);
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toContain('longer than 300 seconds');
    }
  });

  it('rejects unsupported audio mime types', () => {
    const unsupportedTarget = {
      eventId: 'ev_1234567890',
      kind: 'audio' as const,
      mimeType: 'audio/x-unknown-format',
      bytes: 1024 * 100,
      durationSeconds: 15,
      variants: [],
    };

    const parsed = uploadTargetSchema.safeParse(unsupportedTarget);
    expect(parsed.success).toBe(false);
  });
});

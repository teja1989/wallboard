'use client';
import { mediaRules, type MediaKind } from '@/config';

/**
 * Client-side inspection of a chosen file: duration, dimensions, and a poster frame.
 *
 * All of it is a courtesy — the server re-checks size and type against what actually
 * landed in the bucket. The point here is to fail fast and legibly, before someone waits
 * out a 90 MB upload only to be told it was too long.
 */

export interface ProbedMedia {
  kind: MediaKind;
  file: File;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  posterDataUrl: string | null;
  previewUrl: string;
}

export function kindForFile(file: File): MediaKind | null {
  for (const [kind, rule] of Object.entries(mediaRules) as [
    MediaKind,
    (typeof mediaRules)[MediaKind],
  ][]) {
    if (rule.mimeTypes.includes(file.type)) return kind;
  }
  return null;
}

/** Human-readable reason a file is unusable, or null when it is fine. */
export function validationError(file: File, kind: MediaKind): string | null {
  const rule = mediaRules[kind];
  if (!rule.mimeTypes.includes(file.type))
    return `${file.type || 'That file type'} is not supported.`;
  if (file.size > rule.maxBytes) {
    return `That file is ${(file.size / (1024 * 1024)).toFixed(1)} MB — the limit is ${Math.round(rule.maxBytes / (1024 * 1024))} MB.`;
  }
  return null;
}

function loadImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Could not read that image.'));
    image.src = url;
  });
}

/** Seeks a little way in — frame zero is often black. */
function captureVideoPoster(url: string): Promise<{
  durationSeconds: number;
  width: number;
  height: number;
  posterDataUrl: string | null;
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const fail = () => reject(new Error('Could not read that video.'));

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, video.duration / 4);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      let posterDataUrl: string | null = null;
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        posterDataUrl = canvas.toDataURL('image/jpeg', 0.72);
      }
      resolve({
        durationSeconds: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        posterDataUrl,
      });
    };

    video.onerror = fail;
    video.src = url;
  });
}

function readAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(audio.duration);
    audio.onerror = () => reject(new Error('Could not read that audio.'));
    audio.src = url;
  });
}

export async function probeFile(file: File): Promise<ProbedMedia> {
  const kind = kindForFile(file);
  if (!kind) throw new Error(`${file.type || 'That file type'} is not supported.`);

  const invalid = validationError(file, kind);
  if (invalid) throw new Error(invalid);

  const previewUrl = URL.createObjectURL(file);
  const base = { kind, file, previewUrl } as const;

  if (kind === 'image') {
    const { width, height } = await loadImage(previewUrl);
    return { ...base, durationSeconds: null, width, height, posterDataUrl: null };
  }

  if (kind === 'video') {
    const probed = await captureVideoPoster(previewUrl);
    assertDuration(kind, probed.durationSeconds);
    return {
      ...base,
      durationSeconds: probed.durationSeconds,
      width: probed.width,
      height: probed.height,
      posterDataUrl: probed.posterDataUrl,
    };
  }

  const durationSeconds = await readAudioDuration(previewUrl);
  assertDuration(kind, durationSeconds);
  return { ...base, durationSeconds, width: null, height: null, posterDataUrl: null };
}

function assertDuration(kind: MediaKind, seconds: number): void {
  const max = mediaRules[kind].maxDurationSeconds;
  if (max !== null && Number.isFinite(seconds) && seconds > max) {
    throw new Error(
      `That ${kind} is ${Math.round(seconds)}s — the limit is ${max}s. Trim it and try again.`,
    );
  }
}

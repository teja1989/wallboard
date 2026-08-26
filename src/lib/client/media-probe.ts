'use client';
import { imageVariants, mediaRules, type ImageVariantId, type MediaKind } from '@/config';

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
  /**
   * Resized copies, generated here rather than on the server.
   *
   * Ingress is free, so uploading these alongside the original costs nothing, and it keeps
   * a native image library out of the request path — no CPU, no memory spikes, no added
   * latency on the post. The server validates each one before it is used.
   *
   * Empty when the browser could not produce them; the server then falls back to the
   * original, which is correct but expensive, and is logged as such.
   */
  variants: Partial<Record<ImageVariantId, Blob>>;
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

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not read that image.'));
    image.src = url;
  });
}

/**
 * Draws a source down to fit inside `maxEdge` and encodes it as WebP.
 *
 * Never upscales: a 400px photo resized "up" to 1800 is a bigger file that looks worse.
 * Returns null rather than throwing, because a browser that cannot encode WebP should cost
 * a host some egress, not cost a guest their photo.
 */
async function encodeVariant(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  variant: ImageVariantId,
): Promise<Blob | null> {
  const { maxEdge, quality, maxBytes } = imageVariants[variant];
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));

  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) return null;
    // Without this the browser uses a cheap nearest-neighbour path and the result looks
    // visibly worse than the original at the same size.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality),
    );

    if (!blob) return null;
    // A "smaller" copy that is larger than the cap is not worth uploading or serving.
    if (blob.size > maxBytes) return null;
    return blob;
  } catch {
    return null;
  }
}

/** Both derivatives from one decoded source. */
async function buildVariants(
  source: CanvasImageSource,
  width: number,
  height: number,
): Promise<Partial<Record<ImageVariantId, Blob>>> {
  const variants: Partial<Record<ImageVariantId, Blob>> = {};

  for (const id of ['preview', 'display'] as const) {
    const blob = await encodeVariant(source, width, height, id);
    if (blob) variants[id] = blob;
  }
  return variants;
}

/** Seeks a little way in — frame zero is often black. */
function captureVideoPoster(url: string): Promise<{
  durationSeconds: number;
  width: number;
  height: number;
  frame: HTMLVideoElement | null;
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
      // The element itself is a valid CanvasImageSource at this point, so the frame can be
      // resized straight from it without an intermediate full-size encode.
      resolve({
        durationSeconds: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        frame: video,
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
    const image = await loadImage(previewUrl);
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    return {
      ...base,
      durationSeconds: null,
      width,
      height,
      variants: await buildVariants(image, width, height),
    };
  }

  if (kind === 'video') {
    const probed = await captureVideoPoster(previewUrl);
    assertDuration(kind, probed.durationSeconds);
    return {
      ...base,
      durationSeconds: probed.durationSeconds,
      width: probed.width,
      height: probed.height,
      // A poster is the only thing the wall shows for a video until someone presses play,
      // so it goes through exactly the same resizing as a photo.
      variants: probed.frame ? await buildVariants(probed.frame, probed.width, probed.height) : {},
    };
  }

  const durationSeconds = await readAudioDuration(previewUrl);
  assertDuration(kind, durationSeconds);
  return { ...base, durationSeconds, width: null, height: null, variants: {} };
}

function assertDuration(kind: MediaKind, seconds: number): void {
  const max = mediaRules[kind].maxDurationSeconds;
  if (max !== null && Number.isFinite(seconds) && seconds > max) {
    throw new Error(
      `That ${kind} is ${Math.round(seconds)}s — the limit is ${max}s. Trim it and try again.`,
    );
  }
}

'use client';
import type { ImageVariantId } from '@/config';
import { api } from '@/lib/client/api-client';
import type { ProbedMedia } from '@/lib/client/media-probe';
import type { PostDoc } from '@/types/domain';

/**
 * The two-step upload, from the browser's side.
 *
 * Bytes go straight from the browser to the bucket using the target the server issues, so
 * a large video never passes through the app server. XHR rather than fetch, only because
 * fetch still has no upload progress event and a 100 MB upload with no progress bar feels
 * broken.
 */

interface UploadTarget {
  url: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
}

interface UploadTargetResponse {
  uploadId: string;
  original: UploadTarget;
  /** Present only for kinds that have derivatives. */
  variants: Partial<Record<ImageVariantId, UploadTarget>>;
  expiresAt: number;
}

function putBytes(
  target: UploadTarget,
  file: Blob,
  onProgress: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(target.method, target.url, true);
    for (const [key, value] of Object.entries(target.headers)) {
      request.setRequestHeader(key, value);
    }

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) resolve();
      else reject(new Error(`Upload failed (${request.status}).`));
    };
    request.onerror = () => reject(new Error('The upload was interrupted.'));
    request.onabort = () => reject(new Error('The upload was cancelled.'));

    request.send(file);
  });
}

export interface PostSubmission {
  eventId: string;
  body: string;
  media: ProbedMedia | null;
}

export async function submitPost(
  submission: PostSubmission,
  onProgress: (fraction: number) => void,
): Promise<PostDoc> {
  let upload: {
    uploadId: string;
    kind: ProbedMedia['kind'];
    durationSeconds: number | null;
    width: number | null;
    height: number | null;
    variants: ImageVariantId[];
  } | null = null;

  if (submission.media) {
    const { file, kind, durationSeconds, width, height, variants } = submission.media;

    const target = await api.post<UploadTargetResponse>('/api/posts/upload-target', {
      eventId: submission.eventId,
      kind,
      mimeType: file.type,
      bytes: file.size,
      durationSeconds,
      variants: Object.keys(variants),
    });

    // The original dominates the transfer, so it owns the progress bar; the derivatives
    // together are a percent or two of it and go up afterwards.
    await putBytes(target.original, file, onProgress);

    const uploaded: ImageVariantId[] = [];
    for (const id of Object.keys(variants) as ImageVariantId[]) {
      const blob = variants[id];
      const variantTarget = target.variants[id];
      if (!blob || !variantTarget) continue;

      try {
        await putBytes(variantTarget, blob, () => undefined);
        uploaded.push(id);
      } catch {
        // A derivative that fails to upload costs egress later, not the post now.
      }
    }

    upload = {
      uploadId: target.uploadId,
      kind,
      durationSeconds,
      width,
      height,
      variants: uploaded,
    };
  }

  // Finalize. The server verifies the object that actually landed before creating the post.
  const result = await api.post<{ post: PostDoc }>('/api/posts', {
    eventId: submission.eventId,
    body: submission.body,
    upload,
  });
  return result.post;
}

'use client';
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

interface UploadTargetResponse {
  uploadId: string;
  url: string;
  method: 'PUT' | 'POST';
  headers: Record<string, string>;
  expiresAt: number;
}

function putBytes(
  target: UploadTargetResponse,
  file: File,
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
    posterDataUrl: string | null;
  } | null = null;

  if (submission.media) {
    const { file, kind, durationSeconds, width, height, posterDataUrl } = submission.media;

    const target = await api.post<UploadTargetResponse>('/api/posts/upload-target', {
      eventId: submission.eventId,
      kind,
      mimeType: file.type,
      bytes: file.size,
      durationSeconds,
    });

    await putBytes(target, file, onProgress);
    upload = { uploadId: target.uploadId, kind, durationSeconds, width, height, posterDataUrl };
  }

  // Finalize. The server verifies the object that actually landed before creating the post.
  const result = await api.post<{ post: PostDoc }>('/api/posts', {
    eventId: submission.eventId,
    body: submission.body,
    upload,
  });
  return result.post;
}

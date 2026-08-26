'use client';

/**
 * Typed fetch wrapper for this app's own API.
 *
 * Every route answers with `{ ok, data }` or `{ ok, error }`, so unwrapping and error
 * shaping belong in one place rather than in every component. Errors carry the server's
 * code, which lets callers distinguish "sign in" from "rate limited" without string
 * matching on messages.
 */

export interface ApiFailure {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, failure: ApiFailure) {
    super(failure.message);
    this.name = 'ApiClientError';
    this.code = failure.code;
    this.status = status;
    this.details = failure.details;
  }
}

type Envelope<T> = { ok: true; data: T } | { ok: false; error: ApiFailure };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    // The session cookie is httpOnly; it rides along automatically same-origin.
    credentials: 'same-origin',
  });

  let payload: Envelope<T>;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiClientError(response.status, {
      code: 'server_error',
      message: 'The server sent something unexpected.',
    });
  }

  if (!payload.ok) throw new ApiClientError(response.status, payload.error);
  return payload.data;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Turns any thrown value into something safe to render. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

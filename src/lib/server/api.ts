import 'server-only';
import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import type { RateLimitName } from '@/config';
import { ForbiddenError } from '@/lib/authz/policy';
import { currentActor } from '@/lib/authz/session';
import { RateLimitError, enforceRateLimit } from '@/lib/ratelimit';
import { ipSubject } from '@/lib/server/request';
import { StorageSweepError } from '@/lib/storage/batch';
import type { Actor } from '@/types/domain';

/**
 * Route handler plumbing. Every API route funnels through here so that validation,
 * authentication, rate limiting and error shaping cannot be forgotten in one handler and
 * remembered in another.
 */

export type ApiErrorCode =
  | 'bad_request'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'gone'
  | 'rate_limited'
  | 'server_error'
  /** An upstream we depend on failed. Distinct from our own break: retrying may work. */
  | 'bad_gateway';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  gone: 410,
  rate_limited: 429,
  server_error: 500,
  bad_gateway: 502,
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: 200, ...init });
}

export function failure(
  code: ApiErrorCode,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code, message, details } },
    { status: STATUS_BY_CODE[code], headers },
  );
}

/**
 * Maps thrown errors onto responses. Unexpected errors are logged in full and reported to
 * the caller as a bare 500 — internal messages and stack traces stay on the server.
 */
export function toResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) return failure(error.code, error.message, error.details);

  if (error instanceof ZodError) {
    return failure(
      'bad_request',
      'Some of that did not look right.',
      error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }

  if (error instanceof StorageSweepError) {
    // Nothing else was touched, so the honest answer is "try again" rather than a 500. The
    // deletes that did land are no-ops on the retry.
    return failure(
      'bad_gateway',
      'Some files would not delete, so nothing was removed. Please try again in a moment.',
    );
  }

  if (error instanceof ForbiddenError) {
    return failure('forbidden', 'You do not have access to do that.');
  }

  if (error instanceof RateLimitError) {
    const retryAfter = Math.max(1, Math.ceil((error.result.resetAt - Date.now()) / 1000));
    return failure('rate_limited', 'That was a lot at once. Try again shortly.', undefined, {
      'Retry-After': String(retryAfter),
    });
  }

  /*
    An unmapped error is a bug, and the one thing the caller must not get is its message —
    stack traces and internal paths stay here. But a flat apology with nothing in it makes
    the report useless too: "delete is failing, server_error" is not something anyone can
    search a log for.

    So the response carries a short random id and the log line carries the same id. It gives
    away nothing, and it turns "somewhere in the last hour something failed" into one grep.
  */
  const incident = randomUUID().slice(0, 8);
  console.error(`[api] unhandled error (incident ${incident})`, error);
  return failure('server_error', 'Something went wrong on our end.', { incident });
}

/** Wraps a handler so no route can leak an unmapped exception. */
export function route<Args extends unknown[]>(
  handler: (request: NextRequest, ...args: Args) => Promise<NextResponse>,
) {
  return async (request: NextRequest, ...args: Args): Promise<NextResponse> => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      return toResponse(error);
    }
  };
}

/** Parses a JSON body against a schema. Rejects anything that is not valid JSON. */
export async function parseBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError('bad_request', 'Expected a JSON body.');
  }
  return schema.parse(raw);
}

/** Requires a signed-in caller of any kind, anonymous included. */
export async function requireActor(): Promise<Actor> {
  const actor = await currentActor();
  if (!actor) throw new ApiError('unauthenticated', 'Sign in to continue.');
  if (actor.suspended) {
    throw new ApiError('forbidden', 'This account has been suspended.');
  }
  return actor;
}

/** Requires a caller who has actually proven an identity. */
export async function requireIdentifiedActor(): Promise<Actor> {
  const actor = await requireActor();
  if (actor.isAnonymous) {
    throw new ApiError('forbidden', 'Sign in with an account to do that.');
  }
  return actor;
}

/** Applies a per-IP limit, for routes that must work before there is a session. */
export async function limitByIp(request: NextRequest, name: RateLimitName): Promise<void> {
  await enforceRateLimit(name, ipSubject(request));
}

export async function limitByUser(name: RateLimitName, uid: string): Promise<void> {
  await enforceRateLimit(name, uid);
}

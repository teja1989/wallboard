import 'server-only';
import type { NextRequest } from 'next/server';
import type { RequestContext } from '@/lib/audit';

/**
 * Client IP. On Cloud Run behind Google's front end, the caller's address is the first
 * entry in X-Forwarded-For; everything after it is proxy hops. Only trusted because the
 * platform rewrites the header — do not extend this to arbitrary proxies.
 */
export function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip') ?? null;
}

export function requestContext(request: NextRequest): RequestContext {
  return { ip: clientIp(request), userAgent: request.headers.get('user-agent') };
}

/** Rate-limit subject for unauthenticated callers. Falls back to a shared bucket. */
export function ipSubject(request: NextRequest): string {
  return clientIp(request) ?? 'unknown-ip';
}

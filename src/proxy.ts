import { NextResponse, type NextRequest } from 'next/server';
import { appConfig } from '@/config';

/**
 * Security headers, applied to every response.
 *
 * Lives in `proxy.ts` — Next 16's replacement for `middleware.ts`, same request-interception
 * point, current name.
 *
 * The CSP carries a per-request nonce rather than allowing 'unsafe-inline', so an injected
 * <script> cannot execute even if it makes it into the DOM. The nonce is passed to the
 * document through a request header, which Next reads in the root layout.
 *
 * Two independent switches, and conflating them was a bug:
 *
 *   - `isDev` (NODE_ENV) governs what the *dev server* needs — 'unsafe-eval' for React
 *     Refresh — and whether to send HSTS.
 *   - `useEmulators` governs whether the *browser* talks to Firebase on localhost.
 *
 * They are not the same question. CI runs a production build against the emulators, so
 * keying the localhost allowance on NODE_ENV silently blocked every emulator call in that
 * one configuration: sign-in failed, and the whole end-to-end suite with it. A real deploy
 * sets NEXT_PUBLIC_USE_EMULATORS=false, so nothing here loosens production.
 */

/** Origins the browser is allowed to reach. */
function connectSources(useEmulators: boolean): string[] {
  const sources = [
    "'self'",
    'https://*.googleapis.com',
    'https://*.google.com',
    'https://*.firebaseio.com',
    'https://*.cloudfunctions.net',
    'wss://*.firebaseio.com',
    'https://storage.googleapis.com',
  ];
  if (useEmulators) {
    sources.push('http://127.0.0.1:*', 'http://localhost:*', 'ws://127.0.0.1:*');
  }
  return sources;
}

function mediaSources(useEmulators: boolean): string[] {
  const sources = ["'self'", 'blob:', 'data:', 'https://storage.googleapis.com'];
  if (useEmulators) sources.push('http://127.0.0.1:*', 'http://localhost:*');
  return sources;
}

function contentSecurityPolicy(nonce: string, isDev: boolean, useEmulators: boolean): string {
  const media = mediaSources(useEmulators).join(' ');
  return [
    `default-src 'self'`,
    // strict-dynamic lets the nonced Next bootstrap load the chunks it needs without
    // every chunk URL having to be enumerated here.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: ${isDev ? "'unsafe-eval'" : ''}`,
    // Next injects its own <style> tags; there is no nonce hook for them yet.
    // fonts.googleapis.com is the one external stylesheet origin we allow: the invitation
    // display faces are a real part of the product, not decoration.
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src ${media} https://*.googleusercontent.com`,
    `media-src ${media}`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    `connect-src ${connectSources(useEmulators).join(' ')}`,
    // Firebase Auth popups render in an iframe on the auth domain.
    `frame-src 'self' https://*.firebaseapp.com https://accounts.google.com`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    // Upgrading breaks the plain-http emulator origins the line above just allowed, and
    // there is nothing to upgrade when everything is already local.
    useEmulators ? '' : `upgrade-insecure-requests`,
  ]
    .filter(Boolean)
    .join('; ');
}

export default function proxy(request: NextRequest): NextResponse {
  const isDev = process.env.NODE_ENV !== 'production';
  const useEmulators = appConfig.useEmulators;
  const nonce = crypto.randomUUID().replace(/-/g, '');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set(
    'Content-Security-Policy',
    contentSecurityPolicy(nonce, isDev, useEmulators),
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    // Camera and microphone stay available: capturing media is the point of the app.
    'accelerometer=(), autoplay=(self), camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()',
  );
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  response.headers.set('X-DNS-Prefetch-Control', 'off');

  if (!isDev) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets, which do not need a per-request nonce.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
};

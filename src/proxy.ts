import { NextResponse, type NextRequest } from 'next/server';

/**
 * Security headers, applied to every response.
 *
 * Lives in `proxy.ts` — Next 16's replacement for `middleware.ts`, same request-interception
 * point, current name.
 *
 * The CSP carries a per-request nonce rather than allowing 'unsafe-inline', so an injected
 * <script> cannot execute even if it makes it into the DOM. The nonce is passed to the
 * document through a request header, which Next reads in the root layout.
 */

/** Origins the browser is allowed to reach. Emulators are added only in development. */
function connectSources(isDev: boolean): string[] {
  const sources = [
    "'self'",
    'https://*.googleapis.com',
    'https://*.google.com',
    'https://*.firebaseio.com',
    'https://*.cloudfunctions.net',
    'wss://*.firebaseio.com',
    'https://storage.googleapis.com',
  ];
  if (isDev) sources.push('http://127.0.0.1:*', 'http://localhost:*', 'ws://127.0.0.1:*');
  return sources;
}

function mediaSources(isDev: boolean): string[] {
  const sources = ["'self'", 'blob:', 'data:', 'https://storage.googleapis.com'];
  if (isDev) sources.push('http://127.0.0.1:*', 'http://localhost:*');
  return sources;
}

function contentSecurityPolicy(nonce: string, isDev: boolean): string {
  const media = mediaSources(isDev).join(' ');
  return [
    `default-src 'self'`,
    // strict-dynamic lets the nonced Next bootstrap load the chunks it needs without
    // every chunk URL having to be enumerated here.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https: ${isDev ? "'unsafe-eval'" : ''}`,
    // Next injects its own <style> tags; there is no nonce hook for them yet.
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${media} https://*.googleusercontent.com`,
    `media-src ${media}`,
    `font-src 'self' data:`,
    `connect-src ${connectSources(isDev).join(' ')}`,
    // Firebase Auth popups render in an iframe on the auth domain.
    `frame-src 'self' https://*.firebaseapp.com https://accounts.google.com`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `upgrade-insecure-requests`,
  ]
    .filter(Boolean)
    .join('; ');
}

export default function proxy(request: NextRequest): NextResponse {
  const isDev = process.env.NODE_ENV !== 'production';
  const nonce = crypto.randomUUID().replace(/-/g, '');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set('Content-Security-Policy', contentSecurityPolicy(nonce, isDev));
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

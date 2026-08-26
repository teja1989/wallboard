import type { NextConfig } from 'next';

/**
 * Framework-level config only. Product tunables live in `src/config/*`.
 * Security headers are set in `middleware.ts` so the CSP can carry a per-request nonce.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // In development Next refuses /_next/* requests whose origin it does not recognise,
  // which otherwise breaks opening the app on 127.0.0.1 or from a phone on the LAN.
  // Development only — it has no effect on a production build.
  allowedDevOrigins: ['localhost', '127.0.0.1', '::1'],
  typescript: { ignoreBuildErrors: false },
  experimental: {
    // Keep server-only packages out of the client bundle.
    serverActions: { bodySizeLimit: '1mb' },
  },
  serverExternalPackages: ['firebase-admin', '@google-cloud/storage'],
};

export default nextConfig;

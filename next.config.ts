import type { NextConfig } from 'next';

/**
 * Framework-level config only. Product tunables live in `src/config/*`.
 * Security headers are set in `middleware.ts` so the CSP can carry a per-request nonce.
 */
const nextConfig: NextConfig = {
  // Emits a self-contained server bundle with only the node_modules it actually uses, so
  // the Cloud Run image is ~180 MB instead of ~1.2 GB. Smaller image, faster cold start,
  // and cold starts are most of what a scale-to-zero service costs.
  output: 'standalone',
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

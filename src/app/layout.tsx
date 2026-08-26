import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { brand } from '@/config';
import { AuthProvider } from '@/components/auth/auth-provider';
import { ToastProvider } from '@/components/ui/toast';
import './globals.css';

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.promise,
  applicationName: brand.name,
  // Ephemeral, code-gated content has no business in a search index.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fdf8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1a20' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // middleware.ts sets `x-nonce` on the request. Reading it here opts this layout into
  // dynamic rendering, which is what makes Next stamp the same nonce onto its own inline
  // bootstrap scripts — the reason the CSP can omit 'unsafe-inline' entirely.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" data-nonce={nonce} suppressHydrationWarning>
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

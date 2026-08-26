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
      <head>
        {/*
          The invitation display faces. Loaded as a plain stylesheet rather than through
          next/font because the face is chosen per invitation at runtime, so there is no
          build-time set to optimise — and every stack in TYPE_FACES ends in a real
          fallback, so an invitation still looks composed if this never arrives.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href={
            'https://fonts.googleapis.com/css2' +
            '?family=Cormorant+Garamond:wght@500;600;700' +
            '&family=Fraunces:opsz,wght@9..144,500;9..144,600' +
            '&family=Space+Grotesk:wght@500;600;700' +
            '&family=Inter:wght@400;500;600' +
            '&display=swap'
          }
        />
      </head>
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

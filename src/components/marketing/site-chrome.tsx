import Link from 'next/link';
import { brand } from '@/config';

/**
 * Shared header and footer for the pages that sell.
 *
 * Kept out of the app's own chrome deliberately: a marketing page and an invitation are
 * read in completely different frames of mind, and the app should never feel like it is
 * still trying to sell you something once you are inside it.
 */

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        {brand.name}
      </Link>

      <nav className="flex items-center gap-1 sm:gap-2">
        <Link
          href="/templates"
          className="rounded-[var(--radius-pill)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
        >
          Designs
        </Link>
        <Link
          href="/pricing"
          className="rounded-[var(--radius-pill)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
        >
          Pricing
        </Link>
        <Link
          href="/join"
          className="rounded-[var(--radius-pill)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
        >
          I have a code
        </Link>
        <Link
          href="/create"
          className="ml-1 inline-flex h-10 items-center rounded-[var(--radius-pill)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-contrast)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
        >
          Start free
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-6 border-t border-[var(--border-subtle)] pt-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold tracking-tight">{brand.name}</p>
          <p className="mt-1 max-w-sm text-sm text-[var(--text-secondary)]">{brand.tagline}</p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--text-secondary)]">
          <Link href="/templates" className="transition-colors hover:text-[var(--text-primary)]">
            Designs
          </Link>
          <Link href="/pricing" className="transition-colors hover:text-[var(--text-primary)]">
            Pricing
          </Link>
          <Link href="/create" className="transition-colors hover:text-[var(--text-primary)]">
            Create an invitation
          </Link>
          <Link href="/join" className="transition-colors hover:text-[var(--text-primary)]">
            Join with a code
          </Link>
          <a
            href={`mailto:${brand.supportEmail}`}
            className="transition-colors hover:text-[var(--text-primary)]"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}

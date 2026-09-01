import Link from 'next/link';
import { LayoutGrid, Plus } from 'lucide-react';
import { brand } from '@/config';
import { AccountMenu } from '@/components/auth/account-menu';

/**
 * Clean, modern header and structured multi-column footer.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-[var(--border-subtle)] bg-[var(--surface-page)]/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-black tracking-tight text-[var(--text-primary)]"
        >
          <span className="flex size-7 items-center justify-center rounded-xl bg-[var(--accent)] text-xs text-[var(--accent-contrast)] shadow-sm">
            ✨
          </span>
          <span className="text-xl font-black">{brand.name}</span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 md:flex lg:gap-2">
          <Link
            href="/templates"
            className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
          >
            <LayoutGrid className="size-3.5 text-[var(--accent)]" />
            <span>Templates</span>
          </Link>
          <Link
            href="/#how-it-works"
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
          >
            How It Works
          </Link>
          <Link
            href="/pricing"
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
          >
            Pricing
          </Link>
          <Link
            href="/join"
            className="rounded-full px-3.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
          >
            I Have a Code
          </Link>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-[var(--accent-contrast)] shadow-sm transition-all hover:scale-105 hover:bg-[var(--accent-hover)] active:scale-95"
          >
            <Plus className="size-3.5" />
            <span>Plan Party</span>
          </Link>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-sunken)]/40">
      <div className="mx-auto w-full max-w-6xl px-6 pt-14 pb-12">
        {/* Clean 4-Column Structured Layout */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-12 md:gap-10">
          {/* Column 1: Brand & Mission (Span 5) */}
          <div className="col-span-2 space-y-3 md:col-span-5">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-[var(--accent)] text-[0.65rem] text-[var(--accent-contrast)]">
                ✨
              </span>
              <span className="text-lg font-black tracking-tight text-[var(--text-primary)]">
                {brand.name}
              </span>
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-[var(--text-secondary)]">
              {brand.tagline} — Host, invite, and celebrate with live TV projection, audio
              guestbooks, and dream group cash pots with zero guest app downloads.
            </p>
            <div className="flex items-center gap-2 pt-2 text-[0.7rem] text-[var(--text-muted)]">
              <span className="size-1.5 rounded-full bg-emerald-500"></span>
              <span>100% Ad-Free · Private by Design</span>
            </div>
          </div>

          {/* Column 2: Product & Explore (Span 2) */}
          <div className="col-span-1 space-y-3 md:col-span-2">
            <p className="text-xs font-bold tracking-wider text-[var(--text-primary)] uppercase">
              Product
            </p>
            <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
              <li>
                <Link
                  href="/templates"
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  Templates Gallery
                </Link>
              </li>
              <li>
                <Link
                  href="/#how-it-works"
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  Pricing & Plans
                </Link>
              </li>
              <li>
                <Link href="/join" className="transition-colors hover:text-[var(--text-primary)]">
                  Enter Join Code
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Occasions (Span 3) */}
          <div className="col-span-1 space-y-3 md:col-span-3">
            <p className="text-xs font-bold tracking-wider text-[var(--text-primary)] uppercase">
              Celebrations
            </p>
            <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
              <li>
                <Link
                  href="/create?occasion=birthday"
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  🎂 Kid & Adult Birthdays
                </Link>
              </li>
              <li>
                <Link
                  href="/create?occasion=graduation"
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  🎓 Graduation Parties
                </Link>
              </li>
              <li>
                <Link
                  href="/create?occasion=wedding"
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  💍 Weddings & Honeymoon Pots
                </Link>
              </li>
              <li>
                <Link
                  href="/create?occasion=party"
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  🍻 Backyard & Dinners
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Legal & Support (Span 2) */}
          <div className="col-span-2 space-y-3 md:col-span-2">
            <p className="text-xs font-bold tracking-wider text-[var(--text-primary)] uppercase">
              Legal & Help
            </p>
            <ul className="space-y-2 text-xs text-[var(--text-secondary)]">
              <li>
                <Link
                  href="/privacy"
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-[var(--text-primary)]">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/account"
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  My Account
                </Link>
              </li>
              <li>
                <a
                  href={`mailto:${brand.supportEmail}`}
                  className="transition-colors hover:text-[var(--text-primary)]"
                >
                  Contact Support
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Sub-Footer Divider */}
        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-6 text-xs text-[var(--text-muted)] sm:flex-row">
          <p>
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>
          <p className="text-[0.7rem]">Designed for moments that matter.</p>
        </div>
      </div>
    </footer>
  );
}

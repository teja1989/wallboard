import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Lock, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';
import { adFreePromiseHolds, brand } from '@/config';
import { CreationStory } from '@/components/marketing/creation-story';
import { HeroCarousel } from '@/components/marketing/hero-carousel';
import { InteractiveFeatureDemo } from '@/components/marketing/interactive-feature-demo';
import { LifestyleShowcase } from '@/components/marketing/lifestyle-showcase';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: { absolute: `${brand.name} — ${brand.tagline}` },
  description: brand.promise,
  robots: { index: true, follow: true },
  openGraph: {
    title: brand.fullName,
    description: brand.shortPromise,
    type: 'website',
  },
};

/**
 * The Marquee Landing Page.
 *
 * Streamlined, high-converting flow:
 * 1. Hero Spotlight (Real Rooftop Photo & Live Status Tags)
 * 2. Interactive Feature Playground Simulator
 * 3. Real Celebrations Lifestyle Stories (TV Wall, Birthdays, Cash Pots)
 * 4. 3-Step Creation Story
 * 5. Unified Zero-Risk Guarantee (Privacy, Ad-Free, Zero App Downloads)
 * 6. Final Call-to-Action
 */
export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main className="relative overflow-hidden">
        {/* Ambient Gradient Glow Backdrop */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[650px] w-full max-w-7xl -translate-x-1/2 opacity-35 blur-3xl dark:opacity-25"
          style={{
            background:
              'radial-gradient(ellipse at center, var(--accent) 0%, #ec4899 35%, #8b5cf6 70%, transparent 100%)',
          }}
        />

        {/* --- 1. Hero Section -------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-12 pb-14 text-center sm:pt-20 sm:pb-16">
          <p className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--accent-soft)] bg-[var(--surface-raised)]/80 px-4 py-1.5 text-xs font-bold tracking-wide text-[var(--accent)] uppercase shadow-sm backdrop-blur-md sm:text-sm">
            <Sparkles className="size-3.5 text-[var(--accent)]" aria-hidden />
            Host. Invite. Share. All In One Place.
          </p>

          <h1 className="mx-auto max-w-4xl text-4xl leading-[1.08] font-black tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {brand.tagline}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-[var(--text-secondary)] sm:text-xl">
            {brand.promise}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/create"
              className="inline-flex h-13 items-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--accent)] px-8 text-base font-bold text-[var(--accent-contrast)] shadow-[var(--shadow-lift)] transition-all duration-200 hover:scale-105 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
            >
              Plan Your Party Now
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/join"
              className="inline-flex h-13 items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-8 text-base font-medium transition-colors hover:bg-[var(--accent-soft)]"
            >
              I have a code
            </Link>
          </div>

          {/* Quick Occasion Shortcuts */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/create?occasion=birthday"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-700 transition-all hover:scale-105 hover:bg-amber-500/20 dark:text-amber-300"
            >
              🎂 Kid & Adult Birthdays
            </Link>
            <Link
              href="/create?occasion=graduation"
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-bold text-blue-700 transition-all hover:scale-105 hover:bg-blue-500/20 dark:text-blue-300"
            >
              🎓 Graduations
            </Link>
            <Link
              href="/create?occasion=wedding"
              className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-3.5 py-1 text-xs font-bold text-rose-700 transition-all hover:scale-105 hover:bg-rose-500/20 dark:text-rose-300"
            >
              💍 Weddings
            </Link>
            <Link
              href="/create?occasion=baby"
              className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-bold text-purple-700 transition-all hover:scale-105 hover:bg-purple-500/20 dark:text-purple-300"
            >
              🍼 Baby Showers
            </Link>
          </div>

          {/* Dynamic Hero Auto-Slideshow & Interactive Showcase */}
          <HeroCarousel />

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-xs text-[var(--text-muted)] sm:text-sm">
            <span>✓ Free to start</span>
            <span>✓ 100% ad-free experience</span>
            <span>✓ No app or sign-up for guests</span>
          </div>
        </section>

        {/* --- 2. Interactive Feature Playground Simulator ----------------- */}
        <section className="mx-auto w-full max-w-5xl px-6 py-6">
          <div className="mb-6 text-center">
            <p className="text-xs font-bold tracking-wider text-[var(--accent)] uppercase">
              Interactive Live Preview
            </p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Test-drive what your guests experience on event night.
            </h2>
          </div>
          <InteractiveFeatureDemo />
        </section>

        {/* --- 3. Real Celebrations Lifestyle Showcase -------------------- */}
        <LifestyleShowcase />

        {/* --- 4. 3-Step Ease Story --------------------------------------- */}
        <CreationStory />

        {/* --- 5. Unified Zero-Risk Host Guarantee ----------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-8 shadow-xl sm:p-12">
            <div className="mx-auto mb-10 max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3.5 py-1 text-xs font-bold tracking-wider text-[var(--accent)] uppercase">
                <ShieldCheck className="size-4" />
                The Marquee Promise
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Built with respect for your moments and your guests.
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
                  <Lock className="size-5" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Private & Bank-Grade Secure
                </h3>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  Photos and video are stored privately and served through temporary expiring links.
                  Only invited guests with your private link or code can join.
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="size-5" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  100% Ad-Free Guarantee
                </h3>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  {brand.noAds.headline} — {brand.noAds.body} We never sell guest data, track
                  cookies, or show banner ads anywhere.
                </p>
              </div>

              <div className="space-y-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-6">
                <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <Smartphone className="size-5" />
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Zero Guest App Downloads
                </h3>
                <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                  Guests simply open the link in any mobile browser to RSVP, post photos, and record
                  audio toasts in seconds with zero friction.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* --- 6. Final Conversion Banner --------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-4 pb-20">
          <div className="card flex flex-col items-center gap-5 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-10 text-center shadow-2xl sm:p-14">
            <h2 className="max-w-xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Start free. Decide later.
            </h2>
            <p className="max-w-md text-sm text-pretty text-[var(--text-secondary)]">
              Make the invitation, see how it looks, and send it if you like it. No credit card
              required.
            </p>
            <Link
              href="/create"
              className="inline-flex h-13 items-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--accent)] px-8 text-base font-bold text-[var(--accent-contrast)] shadow-[var(--shadow-lift)] transition-all duration-200 hover:scale-105 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
            >
              Plan Your Party Now
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Sparkles } from 'lucide-react';
import { adFreePromiseHolds, anyActivePromo, brand, occasionById, promoCopy } from '@/config';
import { isPreviewPricing } from '@/lib/billing/entitlements';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { PricingCalculator } from '@/components/pricing/pricing-calculator';
import { PricingCards } from '@/components/pricing/pricing-cards';
import { CompetitorComparison } from '@/components/pricing/competitor-comparison';
import { PlanComparisonMatrix } from '@/components/pricing/plan-comparison-matrix';
import { PricingFaq } from '@/components/pricing/pricing-faq';

export const metadata: Metadata = {
  title: 'Pricing — Flat, Transparent Plans for Every Celebration',
  description: `${brand.name} has zero per-guest fees, zero banner ads, and flat transparent pricing. Full RSVP tools, all 15 designer templates, and live TV wallboard included.`,
  robots: { index: true, follow: true },
};

/**
 * Modern Interactive Pricing Studio.
 *
 * Combines dynamic headcount matching, side-by-side competitor breakdowns,
 * deep feature comparison matrices, and clear FAQs.
 */
export default function PricingPage() {
  const preview = isPreviewPricing();
  const promo = anyActivePromo();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        {/* Hero Section */}
        <section className="pt-12 pb-10 text-center sm:pt-18 sm:pb-14">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-semibold text-[var(--accent)] shadow-sm">
            <Sparkles className="size-3.5" />
            <span>Zero Per-Guest Fees</span>
          </div>

          <h1 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Simple, flat pricing for unforgettable gatherings.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-[var(--text-secondary)] sm:text-lg">
            No per-stamp coins, no charge for the live wallboard, and zero ads on any plan. Whether
            you are hosting 15 or 250 guests, what you see is what you pay.
          </p>

          {/* Ad-Free Promise & Promo Callouts */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {adFreePromiseHolds() && (
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-sm">
                <BadgeCheck className="size-4 text-[var(--accent)]" aria-hidden />
                {brand.noAds.badge}
              </span>
            )}
          </div>

          {promo && (
            <p className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-3.5 text-sm leading-relaxed">
              <strong className="font-semibold">{promoCopy.banner(promo)}</strong>{' '}
              {promoCopy.limitedTo(
                promo,
                (promo.occasions ?? []).map((id) => occasionById(id).label.toLowerCase()),
              )}
            </p>
          )}

          {preview && (
            <p className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--accent-soft)] px-5 py-3.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              <strong className="font-semibold text-[var(--text-primary)]">
                Free during preview:
              </strong>{' '}
              Every event gets access to all premium themes and live wallboard features. No card
              required.
            </p>
          )}
        </section>

        {/* Section 1: Interactive Guest Scale Calculator */}
        <div className="mb-16">
          <PricingCalculator />
        </div>

        {/* Section 2: Pricing Plan Cards with Cadence Toggle */}
        <section className="mb-20">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Choose the plan that fits your rhythm
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              One-off events or unlimited annual hosting.
            </p>
          </div>
          <PricingCards preview={preview} />
        </section>

        {/* Section 3: The Marquee Difference (Competitor Comparison) */}
        <div className="mb-20">
          <CompetitorComparison />
        </div>

        {/* Section 4: Expandable Feature Matrix */}
        <div className="mb-20">
          <PlanComparisonMatrix />
        </div>

        {/* Section 5: Interactive FAQ Accordion */}
        <div className="mb-16">
          <PricingFaq />
        </div>

        {/* Section 6: Bottom Conversion Callout */}
        <section>
          <div className="card relative flex flex-col items-center gap-5 overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-10 text-center shadow-[var(--shadow-lift)] sm:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-indigo-500/10 opacity-60 blur-3xl"
            />
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm">
              <Sparkles className="size-6" />
            </span>
            <h2 className="max-w-lg text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
              Start free. Upgrade anytime.
            </h2>
            <p className="max-w-md text-sm text-pretty text-[var(--text-secondary)] sm:text-base">
              Create your event invitation in 60 seconds, experience the live wallboard, and send it
              to your guests when ready.
            </p>
            <Link
              href="/create"
              className="inline-flex h-13 items-center gap-2.5 rounded-full bg-[var(--accent)] px-8 text-base font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-95"
            >
              Make an Invitation
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

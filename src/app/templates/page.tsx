import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Sparkles, Palette, Layers, Tv } from 'lucide-react';
import { brand, templates } from '@/config';
import { isPreviewPricing } from '@/lib/billing/entitlements';
import { TemplateGalleryClient } from '@/components/templates/template-gallery-client';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Invitation Design Studio & Wallboard Themes',
  description: `Explore ${templates.length} bespoke invitation designs across four layouts — for birthdays, weddings, dinners, celebrations, and live TV wallboards. Free to start with ${brand.name}.`,
  robots: { index: true, follow: true },
};

/**
 * The Design Gallery & Template Studio.
 *
 * Designed to showcase realistic typography, layout geometry, textured surfaces,
 * and live dual-mode Invitation + TV Wallboard simulations.
 */
export default function TemplatesPage() {
  const preview = isPreviewPricing();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        {/* Gallery Hero */}
        <section className="pt-12 pb-10 text-center sm:pt-18 sm:pb-14">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-semibold text-[var(--accent)] shadow-sm">
            <Sparkles className="size-3.5" />
            <span>Interactive Design Studio</span>
          </div>

          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {templates.length} signature designs. Four layouts. One unforgettable event.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-[var(--text-secondary)] sm:text-lg">
            Every design is an intentional pairing of display typography, bespoke color palettes,
            and animated surface glow. Pick one now, preview it in real-time, and change it anytime.
          </p>

          {/* Value Highlights */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--text-muted)] sm:text-sm">
            <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
              <Palette className="size-4 text-[var(--accent)]" />
              Tailored Color Palettes
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
              <Layers className="size-4 text-[var(--accent)]" />
              4 Architectural Layouts
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
              <Tv className="size-4 text-[var(--accent)]" />
              Matching Live TV Wallboards
            </span>
          </div>
        </section>

        {/* Dynamic Gallery Client with Filter Bar, Live Miniatures & Modal Simulator */}
        <TemplateGalleryClient preview={preview} />

        {/* Bottom CTA Banner */}
        <section className="mt-20">
          <div className="card relative overflow-hidden flex flex-col items-center gap-5 p-10 text-center sm:p-16 shadow-[var(--shadow-lift)] border border-[var(--border-subtle)] bg-[var(--surface-raised)]">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-indigo-500/10 blur-3xl opacity-60"
            />
            <span className="size-12 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shadow-sm">
              <Sparkles className="size-6" />
            </span>
            <h2 className="max-w-lg text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl">
              Ready to create your invitation?
            </h2>
            <p className="max-w-md text-pretty text-sm text-[var(--text-secondary)] sm:text-base">
              Choose any template, craft your details in 60 seconds, and share one magical link
              with your guests. No credit card required.
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

import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Layers, Palette, Sparkles, Users } from 'lucide-react';
import { brand, templates } from '@/config';
import { isPreviewPricing } from '@/lib/billing/entitlements';
import { TemplateGalleryClient } from '@/components/templates/template-gallery-client';
import { SiteHeader } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Designer Invitation Gallery & Event Themes',
  description: `Explore ${templates.length} bespoke invitation designs across four layouts — for birthdays, graduations, weddings, dinners, and group celebrations. Free to start with ${brand.name}.`,
  robots: { index: true, follow: true },
};

/**
 * The Design Gallery & Template Studio.
 *
 * Designed to showcase typography, layout geometry, textured surfaces,
 * and live interactive guest experiences.
 */
export default function TemplatesPage() {
  const preview = isPreviewPricing();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        {/* Back Navigation */}
        <div className="pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-bold text-[var(--text-primary)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
          >
            <ArrowLeft className="size-3.5" />
            Back to Home
          </Link>
        </div>

        {/* Gallery Hero */}
        <section className="pt-12 pb-10 text-center sm:pt-16 sm:pb-12">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-semibold text-[var(--accent)] shadow-sm">
            <Sparkles className="size-3.5" />
            <span>Interactive Design Studio</span>
          </div>

          <h1 className="mx-auto mt-4 max-w-3xl text-4xl leading-tight font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {templates.length} signature designs. Endless ways to celebrate.
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-[var(--text-secondary)] sm:text-lg">
            Every template pairs editorial typography, curated color palettes, and ambient surface
            textures. Pick your favorite, customize details in 60 seconds, and share with your
            guests.
          </p>

          {/* Value Highlights (Balanced, non-overloaded) */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-[var(--text-muted)] sm:text-sm">
            <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
              <Palette className="size-4 text-[var(--accent)]" />
              15 Custom Color Palettes
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
              <Layers className="size-4 text-[var(--accent)]" />4 Editorial Layouts
            </span>
            <span className="hidden sm:inline">·</span>
            <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
              <Users className="size-4 text-[var(--accent)]" />
              1-Click Guest Experience
            </span>
          </div>
        </section>

        {/* Dynamic Gallery Client with Filter Bar & Visual Cards */}
        <TemplateGalleryClient preview={preview} />

        {/* Bottom Call to Action */}
        <section className="mt-20">
          <div className="card relative flex flex-col items-center gap-5 overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-10 text-center shadow-[var(--shadow-lift)] sm:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-indigo-500/10 opacity-60 blur-3xl"
            />
            <span className="flex size-12 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm">
              <Sparkles className="size-6" />
            </span>
            <h2 className="max-w-lg text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
              Ready to host your celebration?
            </h2>
            <p className="max-w-md text-sm text-pretty text-[var(--text-secondary)] sm:text-base">
              Pick any design, enter your event info in 60 seconds, and share via WhatsApp or SMS.
              Free to start with no credit card required.
            </p>
            <Link
              href="/create"
              className="inline-flex h-12 items-center gap-2.5 rounded-full bg-[var(--accent)] px-8 text-sm font-bold text-[var(--accent-contrast)] shadow-md transition-all duration-200 hover:scale-105 hover:bg-[var(--accent-hover)] active:scale-95"
            >
              Make an Invitation
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}

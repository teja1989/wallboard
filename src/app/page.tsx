import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { adFreePromiseHolds, brand, templates } from '@/config';
import { CreationStory } from '@/components/marketing/creation-story';
import { InvitationShowcase } from '@/components/marketing/invitation-showcase';
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
 * The landing page.
 *
 * Designed with top-tier consumer tech standards: pristine hierarchy,
 * full-width occasion discovery, live interactive product rendering, and clear trust guarantees.
 */
export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main>
        {/* --- Hero Section -------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-12 pb-16 text-center sm:pt-20 sm:pb-20">
          <p className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-4 py-1.5 text-xs font-semibold tracking-wide text-[var(--accent)] uppercase sm:text-sm">
            <Sparkles className="size-3.5 text-[var(--accent)]" aria-hidden />
            Modern Invitations, RSVPs & Live Wall — One Link
          </p>

          <h1 className="mx-auto max-w-4xl text-4xl leading-[1.08] font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {brand.tagline}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-pretty text-[var(--text-secondary)] sm:text-xl">
            {brand.promise}
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href="/create"
              className="inline-flex h-13 items-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--accent)] px-8 text-base font-medium text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
            >
              Make an invitation
              <ArrowRight className="size-4" aria-hidden />
            </Link>
            <Link
              href="/join"
              className="inline-flex h-13 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-8 text-base font-medium transition-colors hover:bg-[var(--accent-soft)]"
            >
              I have a code
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 text-xs text-[var(--text-muted)] sm:text-sm">
            <span>✓ Free to start</span>
            <span>✓ 100% ad-free experience</span>
            <span>✓ No app or sign-up for guests</span>
          </div>
        </section>

        {/* --- Occasion Showcase Section ------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 py-12">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold tracking-wider text-[var(--accent)] uppercase sm:text-sm">
              Tailored For Every Event
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Crafted for life&apos;s real moments.
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-[var(--text-secondary)] sm:text-base">
              Explore live invitation designs across birthdays, school & college graduations,
              weddings, parties, and memorials.
            </p>
          </div>

          <InvitationShowcase />
        </section>

        {/* --- 3-Step Ease Story --------------------------------------- */}
        <CreationStory />

        {/* --- The Live Wall on Event Night ---------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="card overflow-hidden">
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-3 text-xs font-semibold tracking-wide text-[var(--accent)] uppercase sm:text-sm">
                  The Day-Of Experience
                </p>
                <h2 className="text-3xl leading-tight font-bold tracking-tight text-balance sm:text-4xl">
                  The invitation that brings your entire event to life.
                </h2>
                <p className="mt-5 leading-relaxed text-pretty text-[var(--text-secondary)]">
                  The same private link your guests opened to RSVP seamlessly becomes the
                  interactive live wall they celebrate with on the night — sharing photos, videos,
                  and heartfelt memories in real time. Everything captured in one beautiful place
                  that everyone already has open.
                </p>
                <p className="mt-4 leading-relaxed text-pretty text-[var(--text-secondary)]">
                  Plug a laptop into any TV or projector, tap <strong>Presentation Mode</strong>,
                  and watch your guests&apos; photos and moments illuminate the room in real time.
                </p>

                <div className="mt-8">
                  <Link
                    href="/create"
                    className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent)] px-6 text-sm font-medium text-[var(--accent-contrast)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
                  >
                    Create your first event
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </div>

              {/* Theme Swatches */}
              <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                {templates.slice(0, 10).map((theme) => (
                  <div key={theme.id} className="space-y-2">
                    <div
                      aria-hidden
                      className="aspect-[3/4] w-full rounded-2xl shadow-[var(--shadow-soft)] transition-transform duration-200 hover:scale-105"
                      style={{
                        background: `linear-gradient(150deg, ${theme.palette.from}, ${theme.palette.to})`,
                      }}
                    />
                    <p className="truncate text-center text-xs font-medium text-[var(--text-muted)]">
                      {theme.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --- Trust & Privacy ----------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="size-6" aria-hidden />
              </span>
              <h2 className="text-3xl font-bold tracking-tight text-balance">
                You are handing us photos of your friends.
              </h2>
              <p className="mt-4 leading-relaxed text-pretty text-[var(--text-secondary)]">
                So here is our strict, transparent commitment to your privacy and security.
              </p>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
              <Assurance term="Nothing is public, ever">
                Photos and video are stored privately and served through links that expire within
                minutes. A link pasted somewhere else stops working.
              </Assurance>
              <Assurance term="Deleted means deleted">
                When your wall closes, all uploaded files are permanently purged from cloud storage
                on a schedule.
              </Assurance>
              <Assurance term="Only your guests get in">
                Access requires your private join code or private link. Nothing is indexed by search
                engines.
              </Assurance>
              <Assurance term="You control everything">
                Remove any post, at any time, with host and co-host moderation controls.
              </Assurance>
            </dl>
          </div>
        </section>

        {/* --- Ad-Free Guarantee --------------------------------------- */}
        {adFreePromiseHolds() && (
          <section className="mx-auto w-full max-w-6xl px-6 py-12">
            <div className="card flex flex-col gap-6 p-10 sm:p-14 lg:flex-row lg:items-center lg:gap-12">
              <div className="lg:flex-1">
                <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <BadgeCheck className="size-6" aria-hidden />
                </span>
                <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                  {brand.noAds.headline}
                </h2>
              </div>
              <div className="lg:flex-1">
                <p className="leading-relaxed text-pretty text-[var(--text-secondary)]">
                  {brand.noAds.body}
                </p>
                <p className="mt-4 leading-relaxed text-pretty text-[var(--text-muted)]">
                  {brand.noAds.why}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* --- Final Conversion Banner --------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-6 pb-20">
          <div className="card flex flex-col items-center gap-5 p-10 text-center sm:p-14">
            <h2 className="max-w-xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Start free. Decide later.
            </h2>
            <p className="max-w-md text-pretty text-[var(--text-secondary)]">
              Make the invitation, see how it looks, and send it if you like it. No card required.
            </p>
            <Link
              href="/create"
              className="inline-flex h-13 items-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--accent)] px-8 text-base font-medium text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
            >
              Make an invitation
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

function Assurance({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="card p-6 sm:p-7">
      <dt className="font-semibold text-[var(--text-primary)]">{term}</dt>
      <dd className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</dd>
    </div>
  );
}

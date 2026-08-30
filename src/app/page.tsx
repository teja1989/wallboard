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
 * Showcases real live product invitations above the fold, tells the 3-step ease story,
 * and substantiates the commercial advantage: Flat $19 with zero per-guest fees.
 */
export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main>
        {/* --- hero ---------------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-12 pb-16 sm:pt-16">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Value Proposition Column */}
            <div className="lg:col-span-6">
              <p className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-3.5 py-1.5 text-sm font-medium text-[var(--text-secondary)]">
                <Sparkles className="size-3.5 text-[var(--accent)]" aria-hidden />
                Invitations, RSVPs and the live wall — one link
              </p>

              <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
                {brand.tagline}
              </h1>

              <p className="mt-6 text-lg leading-relaxed text-pretty text-[var(--text-secondary)]">
                {brand.promise}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/create"
                  className="inline-flex h-13 items-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--accent)] px-7 text-base font-medium text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
                >
                  Make an invitation
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/join"
                  className="inline-flex h-13 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-7 text-base font-medium transition-colors hover:bg-[var(--accent-soft)]"
                >
                  I have a code
                </Link>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-muted)]">
                <span>✓ Free to start</span>
                <span>✓ 100% ad-free experience</span>
                <span>✓ No app or sign-up for guests</span>
              </div>
            </div>

            {/* Live Interactive Invitation Preview Showcase */}
            <div className="lg:col-span-6">
              <InvitationShowcase />
            </div>
          </div>
        </section>

        {/* --- 3-step ease story --------------------------------------- */}
        <CreationStory />

        {/* --- the live wall differentiator ---------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="card overflow-hidden">
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-3 text-sm font-medium tracking-wide text-[var(--accent)] uppercase">
                  The day-of experience
                </p>
                <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
                  Most invitations die the moment everyone has replied.
                </h2>
                <p className="mt-5 leading-relaxed text-pretty text-[var(--text-secondary)]">
                  Yours does the opposite. The same link your guests opened to RSVP becomes the live
                  wall they post to on the night — photos, video, voice notes, the lot. No group
                  chat to scroll back through. No four hundred pictures scattered across nineteen
                  phones.
                </p>
                <p className="mt-4 leading-relaxed text-pretty text-[var(--text-secondary)]">
                  Plug in a laptop to any TV or projector, tap <strong>Presentation Mode</strong>,
                  and watch your guests&apos; photos cycle across the room in real time.
                </p>

                <Link
                  href="/create"
                  className="mt-8 inline-flex h-12 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent)] px-6 text-sm font-medium text-[var(--accent-contrast)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
                >
                  Create your first event
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>

              {/* Theme swatches */}
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

        {/* --- trust & privacy ----------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <span className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <h2 className="text-3xl font-semibold tracking-tight text-balance">
                You are handing us photos of your friends.
              </h2>
              <p className="mt-4 leading-relaxed text-pretty text-[var(--text-secondary)]">
                So here is our strict, transparent commitment to your privacy.
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

        {/* --- ad-free guarantee --------------------------------------- */}
        {adFreePromiseHolds() && (
          <section className="mx-auto w-full max-w-6xl px-6 py-16">
            <div className="card flex flex-col gap-6 p-10 sm:p-14 lg:flex-row lg:items-center lg:gap-12">
              <div className="lg:flex-1">
                <span className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                  <BadgeCheck className="size-5" aria-hidden />
                </span>
                <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
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
      </main>

      <SiteFooter />
    </>
  );
}

function Assurance({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <dt className="font-semibold text-[var(--text-primary)]">{term}</dt>
      <dd className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</dd>
    </div>
  );
}

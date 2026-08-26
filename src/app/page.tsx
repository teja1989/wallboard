import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  Images,
  MailOpen,
  MessageCircleHeart,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { brand, eventThemes, occasions, plans } from '@/config';
import { isPreviewPricing } from '@/lib/billing/entitlements';
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
 * Structured the way the decision is actually made: what is this, what does it replace,
 * what does it cost, and can I trust it with photos of my friends. The last question is
 * the one competitors in this space answer badly, so it gets a section of its own rather
 * than a line in the footer.
 */
export default function LandingPage() {
  const [invite, gather, remember] = brand.pillars;

  return (
    <>
      <SiteHeader />

      <main>
        {/* --- hero ---------------------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-12 pb-20 sm:pt-20">
          <p className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-3.5 py-1.5 text-sm font-medium text-[var(--text-secondary)]">
            <Sparkles className="size-3.5" aria-hidden />
            Invitations, RSVPs and the live wall — one link
          </p>

          <h1 className="max-w-4xl text-5xl leading-[1.03] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
            {brand.tagline}
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-[var(--text-secondary)] sm:text-xl">
            {brand.promise}
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/create"
              className="inline-flex h-13 items-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--accent)] px-7 text-base font-medium text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] transition-all duration-200 ease-[var(--ease-soft)] hover:bg-[var(--accent-hover)] active:scale-[0.97]"
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

          <p className="mt-4 text-sm text-[var(--text-muted)]">
            Free to start. Your guests never need an account, an app, or a download.
          </p>

          {/* Occasions, as proof this is not a one-use-case product. */}
          <ul className="mt-14 flex flex-wrap gap-2">
            {occasions
              .filter((occasion) => occasion.id !== 'other')
              .map((occasion) => (
                <li
                  key={occasion.id}
                  className="glass inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3.5 py-2 text-sm text-[var(--text-secondary)]"
                >
                  <span aria-hidden>{occasion.glyph}</span>
                  {occasion.label}
                </li>
              ))}
          </ul>
        </section>

        {/* --- the three pillars --------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Three things, one link, no chasing.
          </h2>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            <Pillar
              step="01"
              icon={<MailOpen className="size-5" aria-hidden />}
              headline={invite.headline}
              body={invite.body}
            />
            <Pillar
              step="02"
              icon={<CalendarCheck className="size-5" aria-hidden />}
              headline={gather.headline}
              body={gather.body}
            />
            <Pillar
              step="03"
              icon={<Images className="size-5" aria-hidden />}
              headline={remember.headline}
              body={remember.body}
            />
          </div>
        </section>

        {/* --- the differentiator -------------------------------------- */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="card overflow-hidden">
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-3 text-sm font-medium tracking-wide text-[var(--text-muted)] uppercase">
                  What makes it different
                </p>
                <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
                  Most invitations die the moment everyone has replied.
                </h2>
                <p className="mt-5 leading-relaxed text-pretty text-[var(--text-secondary)]">
                  Yours does the opposite. The same link your guests opened to RSVP becomes the wall
                  they post to on the night — photos, video, voice notes, the lot. No group chat to
                  scroll back through. No four hundred pictures scattered across nineteen phones.
                  One place, updating live, that everyone already has open.
                </p>
                <p className="mt-4 leading-relaxed text-pretty text-[var(--text-secondary)]">
                  Then it closes, on a date you choose, and the photos are deleted for real. That is
                  not a limitation we are apologising for. It is why people are willing to post in
                  the first place.
                </p>

                <Link
                  href="/create"
                  className="mt-8 inline-flex h-12 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent)] px-6 text-sm font-medium text-[var(--accent-contrast)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
                >
                  Try it on your next one
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>

              {/* Theme swatches, standing in for the invitation designs. */}
              <div className="grid grid-cols-5 gap-3">
                {eventThemes.map((theme) => (
                  <div key={theme.id} className="space-y-2">
                    <div
                      aria-hidden
                      className="aspect-[3/4] w-full rounded-2xl shadow-[var(--shadow-soft)]"
                      style={{
                        background: `linear-gradient(150deg, ${theme.from}, ${theme.to})`,
                      }}
                    />
                    <p className="truncate text-center text-xs text-[var(--text-muted)]">
                      {theme.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* --- trust ---------------------------------------------------- */}
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
                So here is exactly what happens to them.
              </p>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2 lg:col-span-2">
              <Assurance term="Nothing is public, ever">
                Photos and video are stored privately and served through links that expire within
                minutes. A link pasted somewhere else stops working.
              </Assurance>
              <Assurance term="Deleted means deleted">
                When your wall closes, the files are removed from storage on a schedule — not hidden
                behind a flag.
              </Assurance>
              <Assurance term="Only your guests get in">
                Access needs your code. Nothing is indexed by search engines, and every event is
                sealed off from every other.
              </Assurance>
              <Assurance term="You can remove anything">
                Any post, any time, without asking anyone. The person who posted it does not have to
                be around.
              </Assurance>
            </dl>
          </div>
        </section>

        {/* --- pricing teaser ------------------------------------------ */}
        <section className="mx-auto w-full max-w-6xl px-6 py-16">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                Free for a get-together. ${plans.event.price} for the one that matters.
              </h2>
              <p className="mt-3 max-w-xl text-pretty text-[var(--text-secondary)]">
                {isPreviewPricing()
                  ? 'Everything is free while we are in preview — including the paid features. No card, nothing to cancel.'
                  : 'One payment for one event, or a yearly plan if you host all the time. No per-guest fees, ever.'}
              </p>
            </div>
            <Link
              href="/pricing"
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-6 text-sm font-medium transition-colors hover:bg-[var(--accent-soft)]"
            >
              See what is included
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>

        {/* --- final CTA ------------------------------------------------ */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-8 pb-8">
          <div className="card flex flex-col items-center gap-6 p-10 text-center sm:p-16">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <MessageCircleHeart className="size-5" aria-hidden />
            </span>
            <h2 className="max-w-xl text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-4xl">
              What are you throwing?
            </h2>
            <p className="max-w-md text-pretty text-[var(--text-secondary)]">
              It takes about a minute to make the invitation, and your guests will not need to
              install anything to open it.
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

function Pillar({
  step,
  icon,
  headline,
  body,
}: {
  step: string;
  icon: React.ReactNode;
  headline: string;
  body: string;
}) {
  return (
    <div className="card p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </span>
        <span className="text-sm font-medium text-[var(--text-muted)] tabular-nums">{step}</span>
      </div>
      <h3 className="text-lg font-semibold tracking-tight">{headline}</h3>
      <p className="mt-2 leading-relaxed text-pretty text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}

function Assurance({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <dt className="font-semibold">{term}</dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</dd>
    </div>
  );
}

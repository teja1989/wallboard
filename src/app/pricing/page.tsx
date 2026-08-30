import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, Check } from 'lucide-react';
import {
  adFreePromiseHolds,
  anyActivePromo,
  brand,
  formatPrice,
  occasionById,
  planOrder,
  plans,
  promoCopy,
} from '@/config';
import { isPreviewPricing } from '@/lib/billing/entitlements';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Pricing — Transparent, Simple Plans',
  description: `${brand.name} is free to start. Simple flat pricing with zero per-guest fees, full RSVP tools, and live photo walls included.`,
  robots: { index: true, follow: true },
};

/**
 * Pricing.
 *
 * Simple, elegant, and transparent.
 */
export default function PricingPage() {
  const preview = isPreviewPricing();
  const promo = anyActivePromo();

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-6 pb-8">
        <section className="pt-10 pb-14 text-center sm:pt-16">
          <h1 className="mx-auto max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Simple, transparent pricing.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-pretty text-[var(--text-secondary)]">
            No per-guest fees, no charge for the live wall, and nothing your guests ever have to pay
            for or install.
          </p>

          {/* Above the table rather than buried in a bullet: for most people the last free
              invitation they used had a banner on it, and this is the answer to that. */}
          {adFreePromiseHolds() && (
            <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-5 py-2.5 text-sm font-medium">
              <BadgeCheck className="size-4 text-[var(--accent)]" aria-hidden />
              {brand.noAds.badge}
            </p>
          )}

          {/* Above the preview note, because a dated window is the more urgent of the two. */}
          {promo && (
            <p className="mx-auto mt-6 max-w-2xl rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-5 py-3.5 text-sm leading-relaxed">
              <strong className="font-semibold">{promoCopy.banner(promo)}</strong>{' '}
              {promoCopy.limitedTo(
                promo,
                (promo.occasions ?? []).map((id) => occasionById(id).label.toLowerCase()),
              )}
            </p>
          )}

          {/* The banner is a block, not an inline-flex: as a flex container the bold
              lead-in becomes its own column and the sentence breaks in half. */}
          {preview && (
            <p className="mx-auto mt-6 max-w-2xl rounded-2xl bg-[var(--accent-soft)] px-5 py-3.5 text-sm leading-relaxed text-[var(--text-secondary)]">
              <strong className="font-semibold text-[var(--text-primary)]">
                Free while we are in preview.
              </strong>{' '}
              Every event currently gets everything below, including the paid features. No card,
              nothing to cancel. This page is what pricing will look like when we turn it on.
            </p>
          )}
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {planOrder.map((planId) => {
            const plan = plans[planId];
            return (
              <div
                key={plan.id}
                className={cn(
                  'card relative flex flex-col p-7',
                  plan.featured && 'ring-2 ring-[var(--accent)]',
                )}
              >
                {plan.featured && (
                  <span className="absolute -top-3 left-7 rounded-[var(--radius-pill)] bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-contrast)]">
                    Most chosen
                  </span>
                )}

                <h2 className="text-lg font-semibold tracking-tight">{plan.label}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{plan.audience}</p>

                <p className="mt-6 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight">{formatPrice(plan)}</span>
                  {plan.cadence === 'per-event' && (
                    <span className="text-[var(--text-muted)]">per event</span>
                  )}
                  {plan.cadence === 'yearly' && (
                    <span className="text-[var(--text-muted)]">per year</span>
                  )}
                </p>
                <p className="mt-1.5 text-sm text-[var(--text-muted)]">{plan.priceNote}</p>

                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.highlights.map((highlight) => (
                    <li key={highlight} className="flex gap-2.5 text-sm leading-relaxed">
                      <Check className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" aria-hidden />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/create"
                  className={cn(
                    'mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-pill)] px-6 text-sm font-medium transition-all duration-200 active:scale-[0.97]',
                    plan.featured
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]'
                      : 'bg-[var(--surface-sunken)] hover:bg-[var(--accent-soft)]',
                  )}
                >
                  {preview ? 'Start free' : plan.id === 'free' ? 'Start free' : 'Start an event'}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            );
          })}
        </section>

        <section className="py-20">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            The questions people actually ask
          </h2>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <Faq q="Do my guests need an account?">
              No. They open the link or type the code and they are in. An account is only needed to
              post to the wall, so that every photo has a name attached to it and you can remove
              things if you need to.
            </Faq>
            <Faq q="What happens to the photos afterwards?">
              The wall closes on the date you chose, and the files are deleted from storage shortly
              after. On a paid event you can download the whole archive before it closes.
            </Faq>
            {adFreePromiseHolds() && (
              <Faq q="Is the free plan ad-supported?">
                No. There are no ads on any plan, and none are coming — an ad beside
                somebody&rsquo;s invitation earns us pennies and costs you the moment. The free plan
                is the whole product with smaller limits, not a worse one with something sold in the
                gaps.
              </Faq>
            )}
            <Faq q="Is it per guest?">
              Never. The plans differ in how many guests they allow, but you are never charged per
              head or per invitation sent.
            </Faq>
            <Faq q="Can I upgrade after I have sent it?">
              Yes. Upgrading applies to the event you already made — your guests keep the same link
              and the same code, and nothing they have already done is lost.
            </Faq>
            <Faq q="What if nobody replies?">
              You will see who has not, and you can nudge them with the same link. The guest list
              shows both who is coming and who you are still waiting on.
            </Faq>
            <Faq q="Can I use it for something sad?">
              Yes, and it will not put confetti on it. Choosing Memorial changes the wording
              throughout, and the wall becomes a place for memories rather than party photos.
            </Faq>
          </dl>
        </section>

        <section className="pb-12">
          <div className="card flex flex-col items-center gap-5 p-10 text-center sm:p-14">
            <h2 className="max-w-lg text-3xl leading-tight font-semibold tracking-tight text-balance">
              Start free. Decide later.
            </h2>
            <p className="max-w-md text-pretty text-[var(--text-secondary)]">
              Make the invitation, see how it looks, send it if you like it. Nothing asks for a
              card.
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

function Faq({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="card p-6">
      <dt className="font-semibold">{q}</dt>
      <dd className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{children}</dd>
    </div>
  );
}

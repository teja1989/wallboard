import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { brand, faceOf, occasions, plans, templates, type Template } from '@/config';
import { isPreviewPricing } from '@/lib/billing/entitlements';
import { TemplatePreview } from '@/components/event/template-picker';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

export const metadata: Metadata = {
  title: 'Invitation designs',
  description: `Fifteen invitation designs across four layouts — for birthdays, weddings, dinners, memorials and everything in between. Free to start with ${brand.name}.`,
  robots: { index: true, follow: true },
};

/**
 * The design gallery.
 *
 * A marketing page as much as a browsing one: "which of these do I want" is a much better
 * question for a visitor to be asking than "what is this product". Grouped by occasion,
 * because that is how someone arrives — they have a wedding, not a preference for serifs.
 */
export default function TemplatesPage() {
  const preview = isPreviewPricing();
  const paidCount = templates.filter((t) => t.premium).length;

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl px-6 pb-8">
        <section className="pt-10 pb-12 text-center sm:pt-16">
          <h1 className="mx-auto max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            {templates.length} designs. Four layouts. One of them is yours.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-pretty text-[var(--text-secondary)]">
            Every design is a different layout, type pairing and palette — not the same card in
            another colour. Pick one when you make the invitation, and change it whenever you like.
          </p>
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            {preview
              ? 'All of them are free while we are in preview.'
              : `${templates.length - paidCount} free, ${paidCount} with a paid plan from $${plans.event.price}.`}
          </p>
        </section>

        {occasions
          .filter((occasion) => occasion.id !== 'other')
          .map((occasion) => {
            const suited = templates.filter((t) => t.occasions?.includes(occasion.id));
            if (suited.length === 0) return null;

            return (
              <section key={occasion.id} className="pb-14">
                <h2 className="mb-4 flex items-center gap-2 text-xl font-semibold tracking-tight">
                  <span aria-hidden>{occasion.glyph}</span>
                  {occasion.label}
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {suited.map((template) => (
                    <TemplateCard key={template.id} template={template} preview={preview} />
                  ))}
                </div>
              </section>
            );
          })}

        <section className="pb-14">
          <h2 className="mb-1 text-xl font-semibold tracking-tight">Works for anything</h2>
          <p className="mb-4 text-sm text-[var(--text-secondary)]">
            The ones that never look out of place, whatever you are throwing.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {templates
              .filter((t) => t.occasions === null)
              .map((template) => (
                <TemplateCard key={template.id} template={template} preview={preview} />
              ))}
          </div>
        </section>

        <section className="pb-12">
          <div className="card flex flex-col items-center gap-5 p-10 text-center sm:p-14">
            <h2 className="max-w-lg text-3xl leading-tight font-semibold tracking-tight text-balance">
              Try one on your event.
            </h2>
            <p className="max-w-md text-pretty text-[var(--text-secondary)]">
              Make the invitation, switch designs until it looks right, and only send it when you
              are happy. Nothing asks for a card.
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

function TemplateCard({ template, preview }: { template: Template; preview: boolean }) {
  const face = faceOf(template);

  return (
    <article className="group">
      <Link
        href="/create"
        className="block overflow-hidden rounded-2xl ring-1 ring-[var(--border-subtle)] transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-soft)]"
      >
        <TemplatePreview template={template} />
      </Link>

      <div className="mt-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3
            className="truncate font-medium"
            style={{ fontFamily: face.stack, letterSpacing: face.tracking }}
          >
            {template.label}
          </h3>
          {template.premium && !preview && (
            <span className="shrink-0 text-xs text-[var(--text-muted)]">Paid</span>
          )}
        </div>
        <p className="mt-0.5 text-sm leading-snug text-pretty text-[var(--text-secondary)]">
          {template.blurb}
        </p>
        <p className="mt-1 text-xs text-[var(--text-muted)] capitalize">
          {template.layout} · {face.label}
        </p>
      </div>
    </article>
  );
}

import type { ReactNode } from 'react';
import { brand, legalConfig } from '@/config';
import { SiteFooter, SiteHeader } from '@/components/marketing/site-chrome';

/**
 * The shell both legal pages share.
 *
 * A narrow measure and generous leading, because these are the pages people actually read
 * when they are deciding whether to trust us with a wedding — and a wall of dense
 * small-print is a way of not being read.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-[var(--text-secondary)]">{intro}</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Effective {legalConfig.effectiveDate}. Questions go to{' '}
          <a
            href={`mailto:${brand.supportEmail}`}
            className="underline underline-offset-4 hover:text-[var(--text-primary)]"
          >
            {brand.supportEmail}
          </a>
          .
        </p>

        <div className="legal mt-10 space-y-8">{children}</div>
      </main>
      <SiteFooter />
    </div>
  );
}

/** One numbered section. Headings carry the question a reader actually has. */
export function Clause({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
      <div className="space-y-3 leading-relaxed text-[var(--text-secondary)]">{children}</div>
    </section>
  );
}

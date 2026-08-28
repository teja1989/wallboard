import type { Metadata } from 'next';
import { FunnelBoard } from '@/components/admin/funnel-board';

export const metadata: Metadata = {
  title: 'Funnel',
  // Not a marketing page. Everything else under /admin should stay out of an index too.
  robots: { index: false, follow: false },
};

/**
 * The numbers, for whoever is running this.
 *
 * Deliberately one page rather than the beginning of a console. `features.adminConsole` is
 * still off and this does not turn it on: it is a read of aggregate counters behind
 * `admin:accessConsole`, which is platform-only by construction, and it exists because seven
 * counters were being written with nothing reading them.
 *
 * The route is not linked from anywhere. Anyone without the claim gets a 403 from the API and
 * an honest message, which is the same answer they would get from a link.
 */
export default function AdminFunnelPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Funnel</h1>
      <p className="mt-2 max-w-2xl text-[var(--text-secondary)]">
        Sums across every event, with no identifiers in any of them. Each ratio is here because it
        settles a decision — the numbers are for choosing what to build next, not for watching.
      </p>

      <div className="mt-8">
        <FunnelBoard />
      </div>
    </main>
  );
}

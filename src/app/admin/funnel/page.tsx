import type { Metadata } from 'next';
import { FunnelBoard } from '@/components/admin/funnel-board';

export const metadata: Metadata = { title: 'Funnel' };

/**
 * The numbers, for whoever is running this.
 *
 * The first screen the console had, back when it was the only one: it exists because seven
 * counters were being written with nothing reading them. The chrome and the noindex now come
 * from the console's layout, which is also where the flag gate lives.
 */
export default function AdminFunnelPage() {
  return (
    <>
      <p className="max-w-2xl text-sm text-[var(--text-secondary)]">
        Sums across every event, with no identifiers in any of them. Each ratio is here because it
        settles a decision — the numbers are for choosing what to build next, not for watching.
      </p>

      <div className="mt-6">
        <FunnelBoard />
      </div>
    </>
  );
}

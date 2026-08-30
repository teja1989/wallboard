import { Check, X } from 'lucide-react';
import { brand } from '@/config';

export function ComparisonTable() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="text-center">
        <p className="text-sm font-semibold tracking-wide text-[var(--accent)] uppercase">
          Why hosts choose Marquee
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          The grown-up event platform with zero per-guest fees.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--text-secondary)] sm:text-lg">
          Paperless Post charges per guest. Partiful doesn&apos;t collect dietary or party details.
          Marquee gives you complete event control for a simple flat fee.
        </p>
      </div>

      <div className="mt-12 overflow-x-auto">
        <table className="card w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
              <th className="p-4 font-semibold text-[var(--text-primary)] sm:p-5">Feature</th>
              <th className="bg-[var(--accent-soft)]/40 p-4 font-bold text-[var(--accent)] sm:p-5">
                {brand.name}
              </th>
              <th className="p-4 font-medium text-[var(--text-secondary)] sm:p-5">
                Paperless Post
              </th>
              <th className="p-4 font-medium text-[var(--text-secondary)] sm:p-5">Partiful</th>
              <th className="p-4 font-medium text-[var(--text-secondary)] sm:p-5">Evite</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            <tr>
              <td className="p-4 font-medium sm:p-5">150-Guest Event Price</td>
              <td className="bg-[var(--accent-soft)]/20 p-4 font-bold text-[var(--accent)] sm:p-5">
                $19 flat fee
              </td>
              <td className="p-4 text-[var(--danger)] sm:p-5">$75 – $216 (coins)</td>
              <td className="p-4 text-[var(--text-muted)] sm:p-5">Free (casual only)</td>
              <td className="p-4 text-[var(--text-muted)] sm:p-5">$39.99+ or Ads</td>
            </tr>
            <tr>
              <td className="p-4 font-medium sm:p-5">Per-Guest Fees</td>
              <td className="bg-[var(--accent-soft)]/20 p-4 font-bold text-emerald-600 sm:p-5">
                None ($0/guest)
              </td>
              <td className="p-4 text-[var(--danger)] sm:p-5">$0.50 – $1.44 / head</td>
              <td className="p-4 text-emerald-600 sm:p-5">None</td>
              <td className="p-4 text-[var(--text-muted)] sm:p-5">Tier capped</td>
            </tr>
            <tr>
              <td className="p-4 font-medium sm:p-5">Dietary & Custom RSVP Questions</td>
              <td className="bg-[var(--accent-soft)]/20 p-4 font-bold text-emerald-600 sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> Full collection
                </span>
              </td>
              <td className="p-4 text-emerald-600 sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> Yes
                </span>
              </td>
              <td className="p-4 text-[var(--danger)] sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <X className="size-4 text-[var(--danger)]" /> Going/Maybe only
                </span>
              </td>
              <td className="p-4 text-emerald-600 sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> Yes
                </span>
              </td>
            </tr>
            <tr>
              <td className="p-4 font-medium sm:p-5">Live Photo Wall for TVs & Projectors</td>
              <td className="bg-[var(--accent-soft)]/20 p-4 font-bold text-emerald-600 sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> Included
                </span>
              </td>
              <td className="p-4 text-[var(--danger)] sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <X className="size-4 text-[var(--danger)]" /> No
                </span>
              </td>
              <td className="p-4 text-[var(--danger)] sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <X className="size-4 text-[var(--danger)]" /> No
                </span>
              </td>
              <td className="p-4 text-[var(--danger)] sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <X className="size-4 text-[var(--danger)]" /> No
                </span>
              </td>
            </tr>
            <tr>
              <td className="p-4 font-medium sm:p-5">Zero Advertisements</td>
              <td className="bg-[var(--accent-soft)]/20 p-4 font-bold text-emerald-600 sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> 100% Ad-free
                </span>
              </td>
              <td className="p-4 text-emerald-600 sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> Ad-free
                </span>
              </td>
              <td className="p-4 text-emerald-600 sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-600" /> Ad-free
                </span>
              </td>
              <td className="p-4 text-[var(--danger)] sm:p-5">
                <span className="inline-flex items-center gap-1.5">
                  <X className="size-4 text-[var(--danger)]" /> Heavy Ads on Free
                </span>
              </td>
            </tr>
            <tr>
              <td className="p-4 font-medium sm:p-5">Guest Account Requirement</td>
              <td className="bg-[var(--accent-soft)]/20 p-4 font-bold text-emerald-600 sm:p-5">
                No app, no sign-up
              </td>
              <td className="p-4 text-emerald-600 sm:p-5">No account required</td>
              <td className="p-4 text-[var(--danger)] sm:p-5">Phone required to RSVP</td>
              <td className="p-4 text-[var(--text-muted)] sm:p-5">Email required</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

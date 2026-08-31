import { Check, ShieldCheck, Sparkles, X } from 'lucide-react';
import { brand } from '@/config';

export function CompetitorComparison() {
  const comparisonRows = [
    {
      feature: 'Pricing Model',
      marquee: 'Flat, transparent pricing ($0 or $19)',
      legacy: 'Per-guest coins/tokens ($40–$120+)',
      highlight: true,
    },
    {
      feature: 'Advertisements',
      marquee: 'Zero ads on all plans (including Free)',
      legacy: 'Banner ads on free invitations',
      highlight: true,
    },
    {
      feature: 'Live TV Wallboard',
      marquee: 'Included on every event with QR code',
      legacy: 'Not available or costly add-on',
      highlight: true,
    },
    {
      feature: 'Voice Toasts & Audio',
      marquee: 'Live soundwave audio voicemail',
      legacy: 'Text comments only',
      highlight: false,
    },
    {
      feature: 'Guest App Installation',
      marquee: 'Never required (100% web-native)',
      legacy: 'Pushes mobile app downloads',
      highlight: false,
    },
    {
      feature: 'High-Res Media Archive',
      marquee: '1-click full ZIP archive download',
      legacy: 'Compressed photos or watermark downloads',
      highlight: false,
    },
  ];

  return (
    <section className="mx-auto w-full max-w-5xl">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-3.5 py-1 text-xs font-semibold text-[var(--accent)] shadow-sm">
          <ShieldCheck className="size-3.5" />
          <span>The {brand.name} Difference</span>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          Why hosts choose {brand.name} over legacy invitation sites
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          No hidden coins, no third-party banner ads, and no unexpected per-guest charges.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)]">
                <th className="py-4 pl-6 pr-4 font-semibold text-[var(--text-primary)]">
                  Feature & Experience
                </th>
                <th className="py-4 px-4 font-bold text-[var(--accent)]">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="size-4" />
                    <span>{brand.name}</span>
                  </div>
                </th>
                <th className="py-4 px-4 font-medium text-[var(--text-muted)]">
                  Legacy Platforms (Evite / Paperless Post)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {comparisonRows.map((row) => (
                <tr
                  key={row.feature}
                  className={row.highlight ? 'bg-[var(--surface-page)]/40' : undefined}
                >
                  <td className="py-4 pl-6 pr-4 font-medium text-[var(--text-primary)]">
                    {row.feature}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2 font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="size-4 shrink-0" />
                      <span>{row.marquee}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[var(--text-secondary)]">
                    <div className="flex items-center gap-2">
                      <X className="size-4 shrink-0 text-red-400" />
                      <span>{row.legacy}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

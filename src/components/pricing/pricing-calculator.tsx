'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, HardDrive, Sparkles, Tv, Users } from 'lucide-react';
import { formatPrice, plans, type PlanId } from '@/config';
import { cn } from '@/lib/utils';

export function PricingCalculator() {
  const [guestCount, setGuestCount] = useState<number>(75);

  // Determine recommended plan based on guest headcount
  const recommendedPlanId: PlanId =
    guestCount <= 25 ? 'free' : guestCount <= 250 ? 'event' : 'pro';

  const plan = plans[recommendedPlanId];

  // Competitor estimate (typically $0.35 - $0.50 per guest on token/coin-based platforms)
  const legacyCost = Math.round(guestCount * 0.4);

  return (
    <section className="mx-auto w-full max-w-4xl rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-sm sm:p-10">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-1 text-xs font-semibold text-[var(--accent)]">
          <Sparkles className="size-3.5" />
          <span>Interactive Plan Matcher</span>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
          How many guests are you expecting?
        </h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Drag the slider to find the plan tailored for your celebration headcount.
        </p>
      </div>

      {/* Guest Headcount Slider & Counter */}
      <div className="mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-muted)]">Intimate Gathering (10)</span>
          <div className="flex items-baseline gap-1.5 rounded-2xl bg-[var(--surface-page)] px-5 py-2 border border-[var(--border-subtle)] shadow-sm">
            <Users className="size-4 text-[var(--accent)]" />
            <span className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              {guestCount}
            </span>
            <span className="text-xs text-[var(--text-secondary)] font-medium">Guests</span>
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)]">Grand Celebration (500)</span>
        </div>

        <input
          type="range"
          min={10}
          max={500}
          step={5}
          value={guestCount}
          onChange={(e) => setGuestCount(Number(e.target.value))}
          className="h-2.5 w-full cursor-pointer appearance-none rounded-lg bg-[var(--surface-sunken)] accent-[var(--accent)] transition-all"
        />

        {/* Quick Click Preset Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {[20, 50, 100, 200, 350].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setGuestCount(preset)}
              className={cn(
                'rounded-full px-3 py-1 text-xs font-medium transition-colors',
                guestCount === preset
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] font-semibold'
                  : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--surface-page)] border border-[var(--border-subtle)]',
              )}
            >
              {preset} guests
            </button>
          ))}
        </div>
      </div>

      {/* Recommended Plan Match Card */}
      <div className="mt-8 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-page)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                Recommended Plan
              </span>
              <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent)]">
                Perfect Match
              </span>
            </div>
            <h3 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">
              {plan.label} Plan
            </h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {plan.audience}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <div className="flex items-baseline gap-1 sm:justify-end">
              <span className="text-3xl font-extrabold text-[var(--text-primary)]">
                {formatPrice(plan)}
              </span>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {plan.cadence === 'per-event'
                  ? 'flat one-time'
                  : plan.cadence === 'yearly'
                    ? '/ year'
                    : 'forever'}
              </span>
            </div>
            {recommendedPlanId !== 'free' && legacyCost > (plan.price ?? 0) && (
              <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Save ~${legacyCost - (plan.price ?? 0)} vs per-guest coin fees
              </p>
            )}
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-[var(--border-subtle)] pt-6 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[var(--accent)]">
              <Users className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                Up to {plan.entitlements.maxGuests} Guests
              </p>
              <p className="text-[0.7rem] text-[var(--text-muted)]">
                No extra charge per invitation
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[var(--accent)]">
              <Tv className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                {recommendedPlanId === 'free'
                  ? '7 Days Live Wallboard'
                  : recommendedPlanId === 'event'
                    ? '30 Days + Archive Download'
                    : '90 Days + Archive Download'}
              </p>
              <p className="text-[0.7rem] text-[var(--text-muted)]">
                Live photo stream & voice toasts
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-sunken)] text-[var(--accent)]">
              <HardDrive className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--text-primary)]">
                {recommendedPlanId === 'free'
                  ? '500 MB Storage'
                  : recommendedPlanId === 'event'
                    ? '5 GB Media Storage'
                    : '20 GB Media Storage'}
              </p>
              <p className="text-[0.7rem] text-[var(--text-muted)]">
                Full resolution photos & audio
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-6 sm:flex-row">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <Check className="size-4 text-emerald-500" />
            <span>100% Ad-Free on all events · Zero hidden fees</span>
          </div>
          <Link
            href="/create"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-7 text-sm font-semibold text-[var(--accent-contrast)] shadow-md transition-all hover:bg-[var(--accent-hover)] active:scale-95 sm:w-auto"
          >
            Start with {plan.label}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

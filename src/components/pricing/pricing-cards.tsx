'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { formatPrice, planOrder, plans, type PlanId } from '@/config';
import { cn } from '@/lib/utils';

interface PricingCardsProps {
  preview: boolean;
}

export function PricingCards({ preview }: PricingCardsProps) {
  const [cadenceFilter, setCadenceFilter] = useState<'all' | 'event' | 'yearly'>('all');

  return (
    <div className="space-y-8">
      {/* Cadence Switcher Tabs */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-full border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-1">
          <button
            type="button"
            onClick={() => setCadenceFilter('all')}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
              cadenceFilter === 'all'
                ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            )}
          >
            All Plans
          </button>
          <button
            type="button"
            onClick={() => setCadenceFilter('event')}
            className={cn(
              'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
              cadenceFilter === 'event'
                ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            )}
          >
            Single Event Pass ($19)
          </button>
          <button
            type="button"
            onClick={() => setCadenceFilter('yearly')}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
              cadenceFilter === 'yearly'
                ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            )}
          >
            <span>Annual Membership</span>
            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[0.65rem] font-bold text-emerald-600 dark:text-emerald-400">
              Save 65%
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {planOrder.map((planId: PlanId) => {
          const plan = plans[planId];
          const isDimmed =
            (cadenceFilter === 'event' && planId === 'pro') ||
            (cadenceFilter === 'yearly' && planId === 'event');

          return (
            <div
              key={plan.id}
              className={cn(
                'card relative flex flex-col justify-between overflow-hidden p-7 transition-all duration-300',
                plan.featured
                  ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/40 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.15)] scale-[1.02]'
                  : 'hover:border-[var(--border-focus)] hover:shadow-md',
                isDimmed && 'opacity-40 grayscale-[50%]',
              )}
            >
              {plan.featured && (
                <div className="absolute -top-px left-0 right-0 flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded-b-xl bg-[var(--accent)] px-4 py-1 text-xs font-bold text-[var(--accent-contrast)] shadow-sm">
                    <Sparkles className="size-3" />
                    MOST CHOSEN
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                    {plan.label}
                  </h3>
                  {plan.id === 'pro' && (
                    <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-semibold text-indigo-500">
                      Unlimited Events
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {plan.audience}
                </p>

                {/* Price Display */}
                <div className="mt-6 flex items-baseline gap-1.5 border-b border-[var(--border-subtle)] pb-6">
                  <span className="text-4xl font-black tracking-tight text-[var(--text-primary)]">
                    {formatPrice(plan)}
                  </span>
                  <span className="text-xs font-medium text-[var(--text-muted)]">
                    {plan.cadence === 'per-event'
                      ? 'one-time payment'
                      : plan.cadence === 'yearly'
                        ? 'per year'
                        : 'forever'}
                  </span>
                </div>

                {/* Highlights List */}
                <ul className="mt-6 space-y-3">
                  {plan.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                      <Check className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Conversion CTA Button */}
              <div className="mt-8 pt-4 border-t border-[var(--border-subtle)]">
                <Link
                  href="/create"
                  className={cn(
                    'inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold transition-all duration-200 active:scale-95 shadow-sm',
                    plan.featured
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] shadow-[var(--shadow-soft)]'
                      : 'bg-[var(--surface-sunken)] text-[var(--text-primary)] hover:bg-[var(--accent-soft)]',
                  )}
                >
                  {preview
                    ? 'Start Free in Preview'
                    : plan.id === 'free'
                      ? 'Start Free Event'
                      : `Get ${plan.label}`}
                  <ArrowRight className="size-4" />
                </Link>
                <p className="mt-2 text-center text-[0.7rem] text-[var(--text-muted)]">
                  {plan.priceNote}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

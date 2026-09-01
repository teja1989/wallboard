'use client';
import { useState } from 'react';
import { Gift, Heart, Loader2, Sparkles, X } from 'lucide-react';
import { calculateContributionFees } from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client/api-client';
import type { CashFundDoc } from '@/types/domain';
import { cn } from '@/lib/utils';

interface GiftPotSectionProps {
  eventId: string;
  funds: CashFundDoc[];
  onContributionSuccess?: () => void;
}

export function GiftPotSection({ eventId, funds, onContributionSuccess }: GiftPotSectionProps) {
  const { notify } = useToast();
  const [activeFundForModal, setActiveFundForModal] = useState<CashFundDoc | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(50);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [contributorName, setContributorName] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [postToWall, setPostToWall] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (funds.length === 0) return null;

  const currentAmountToPay = customAmount ? Number(customAmount) || 0 : selectedAmount;
  const fees = calculateContributionFees(Math.max(5, currentAmountToPay));

  async function handleContribute() {
    if (!activeFundForModal) return;
    const finalAmount = customAmount ? Number(customAmount) : selectedAmount;
    if (isNaN(finalAmount) || finalAmount < 5) {
      notify('Please enter a valid gift amount of at least $5.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<{ url: string; contributionId?: string }>(
        `/api/events/${eventId}/funds/${activeFundForModal.id}/checkout`,
        {
          amount: finalAmount,
          donorName: contributorName.trim() || 'A generous friend',
          message: message.trim() || undefined,
          isAnonymous: false,
          showOnWall: postToWall,
        },
      );

      if (res.url && !res.url.includes('gift=success')) {
        window.location.href = res.url;
        return;
      }

      notify(`Thank you for your generous $${finalAmount} gift!`, 'success');
      setActiveFundForModal(null);
      setCustomAmount('');
      setMessage('');
      if (onContributionSuccess) onContributionSuccess();
    } catch (err) {
      notify((err as Error).message || 'Failed to complete gift contribution.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <Gift className="size-4" />
        </div>
        <h3 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
          Collective Cash Pots & Dream Gifting
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {funds.map((fund) => {
          const progressPercent = fund.targetAmount
            ? Math.min(100, Math.round((fund.currentAmount / fund.targetAmount) * 100))
            : null;

          return (
            <div
              key={fund.id}
              className="card relative flex flex-col justify-between overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 shadow-sm transition-all hover:border-[var(--border-focus)]"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-[var(--text-primary)]">{fund.title}</h4>
                    {fund.description && (
                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                        {fund.description}
                      </p>
                    )}
                  </div>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-sunken)] text-base">
                    {fund.category === 'honeymoon'
                      ? '✈️'
                      : fund.category === 'home'
                        ? '🏡'
                        : fund.category === 'baby'
                          ? '🍼'
                          : fund.category === 'celebration'
                            ? '🥂'
                            : fund.category === 'travel'
                              ? '🎒'
                              : '🎁'}
                  </span>
                </div>

                {/* Progress Bar & Counter */}
                <div className="mt-4 space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-bold text-[var(--text-primary)]">
                      ${fund.currentAmount.toLocaleString()}
                      {fund.targetAmount && (
                        <span className="font-normal text-[var(--text-muted)]">
                          {' '}
                          of ${fund.targetAmount.toLocaleString()} goal
                        </span>
                      )}
                    </span>
                    <span className="text-[0.7rem] text-[var(--text-muted)]">
                      {fund.contributorCount} {fund.contributorCount === 1 ? 'gift' : 'gifts'}
                    </span>
                  </div>

                  {progressPercent !== null && (
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                        style={{ width: `${Math.max(5, progressPercent)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 border-t border-[var(--border-subtle)] pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFundForModal(fund);
                    setSelectedAmount(fund.suggestedPresets[1] || 50);
                  }}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-4 text-xs font-semibold text-[var(--accent-contrast)] shadow-sm transition-all hover:bg-[var(--accent-hover)] active:scale-95"
                >
                  <Heart className="size-3.5 fill-current" />
                  Contribute to Fund
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Contribution Checkout Modal */}
      {activeFundForModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm duration-200"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-page)] p-6 shadow-2xl sm:p-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <span className="text-xs font-semibold tracking-wider text-[var(--accent)] uppercase">
                  Gift Contribution
                </span>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  {activeFundForModal.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveFundForModal(null)}
                className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Select Amount Chips */}
            <div className="mt-5 space-y-2">
              <label className="text-xs font-semibold text-[var(--text-muted)]">
                Select Gift Amount
              </label>
              <div className="grid grid-cols-4 gap-2">
                {activeFundForModal.suggestedPresets.map((preset: number) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setSelectedAmount(preset);
                      setCustomAmount('');
                    }}
                    className={cn(
                      'flex h-11 items-center justify-center rounded-2xl border text-sm font-bold transition-all',
                      !customAmount && selectedAmount === preset
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm'
                        : 'border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--surface-sunken)]',
                    )}
                  >
                    ${preset}
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <input
                  type="number"
                  min={5}
                  max={5000}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Custom amount (USD)"
                  className="h-10 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            </div>

            {/* Contributor Name & Note */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Your Name (Optional)
                </label>
                <input
                  type="text"
                  value={contributorName}
                  onChange={(e) => setContributorName(e.target.value)}
                  placeholder="e.g. Sarah & Kevin"
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Celebration Wish or Note
                </label>
                <textarea
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Have the most magical time celebrating! 🥂"
                  className="mt-1 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              {/* Wallboard Tribute Toggle */}
              <label className="flex cursor-pointer items-center gap-2.5 pt-1">
                <input
                  type="checkbox"
                  checked={postToWall}
                  onChange={(e) => setPostToWall(e.target.checked)}
                  className="size-4 rounded accent-[var(--accent)]"
                />
                <span className="text-xs text-[var(--text-secondary)]">
                  Announce this gift on the Live Celebration Wallboard
                </span>
              </label>
            </div>

            {/* Summary & Checkout Action */}
            <div className="mt-6 border-t border-[var(--border-subtle)] pt-4">
              <div className="mb-3 flex items-center justify-between text-xs text-[var(--text-muted)]">
                <span>Gift to Host:</span>
                <span className="font-bold text-[var(--text-primary)]">
                  ${fees.giftAmount.toFixed(2)}
                </span>
              </div>

              <Button
                type="button"
                disabled={isSubmitting || currentAmountToPay < 5}
                onClick={handleContribute}
                className="h-12 w-full rounded-full font-bold shadow-md"
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="size-4" />
                    Pledge ${currentAmountToPay}
                  </span>
                )}
              </Button>

              {/*
                Says what the button does, not what we wish it did.

                This read "Secure 256-bit checkout · 100% of the gift goes directly to the
                host" above a flow that takes no card and moves no money — three untrue
                claims in one line, on the one screen where a guest is deciding to part with
                $200. The honest line stays until Stripe Connect is behind the button, at
                which point this becomes a real receipt and the `cashFunds` flag goes on.
              */}
              <p className="mt-2 text-center text-[0.65rem] text-[var(--text-muted)]">
                Payments are not live yet — this records your pledge and tells the host. Nothing is
                charged.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

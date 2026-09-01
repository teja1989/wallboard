'use client';
import { useEffect, useState } from 'react';
import { Building2, CheckCircle2, Gift, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { FUND_PRESETS, fundsConfig, type FundPreset } from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api } from '@/lib/client/api-client';
import type { CashFundDoc, FundCategory } from '@/types/domain';

interface GiftPotManagerProps {
  eventId: string;
  funds: CashFundDoc[];
  onFundsChanged: () => void;
}

interface ConnectStatus {
  connected: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}

export function GiftPotManager({ eventId, funds, onFundsChanged }: GiftPotManagerProps) {
  const { notify } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FundCategory>('honeymoon');
  const [targetAmount, setTargetAmount] = useState<string>('1500');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [connectLoading, setConnectLoading] = useState(true);
  const [onboardingBusy, setOnboardingBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkConnect() {
      try {
        const res = await api.get<ConnectStatus>(`/api/events/${eventId}/funds/connect/status`);
        if (!cancelled) {
          setConnectStatus(res);
          setConnectLoading(false);
        }
      } catch {
        if (!cancelled) setConnectLoading(false);
      }
    }
    void checkConnect();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  async function handleConnectStripe() {
    setOnboardingBusy(true);
    try {
      const res = await api.post<{ url: string }>(`/api/events/${eventId}/funds/connect/onboard`);
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err) {
      notify((err as Error).message || 'Could not start bank connection.', 'error');
    } finally {
      setOnboardingBusy(false);
    }
  }

  function handleSelectPreset(preset: FundPreset) {
    setCategory(preset.category);
    setTitle(preset.title);
    setDescription(preset.description);
    setTargetAmount(preset.defaultTarget ? String(preset.defaultTarget) : '');
    setIsModalOpen(true);
  }

  async function handleCreateFund(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      notify('Please provide a title for your cash pot.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/api/events/${eventId}/funds`, {
        title: title.trim(),
        description: description.trim(),
        category,
        targetAmount: targetAmount ? Number(targetAmount) : null,
        suggestedPresets: [25, 50, 100, 200],
      });

      notify('Collective cash pot created successfully!', 'success');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setTargetAmount('1500');
      onFundsChanged();
    } catch (err) {
      notify((err as Error).message || 'Failed to create cash pot.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteFund(fundId: string) {
    setDeletingId(fundId);
    try {
      await api.delete(`/api/events/${eventId}/funds/${fundId}`);
      notify('Cash pot removed.', 'success');
      onFundsChanged();
    } catch (err) {
      notify((err as Error).message || 'Failed to delete cash pot.', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold tracking-tight text-[var(--text-primary)]">
            Collective Cash Pots & Dream Funds
          </h3>
          <p className="text-xs text-[var(--text-secondary)]">
            Let guests chip in toward honeymoon travel, nursery funds, or group gifts. These appear
            directly at the bottom of your invitation page for guests.
          </p>
        </div>

        {funds.length < fundsConfig.maxFundsPerEvent && (
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setTitle('');
              setDescription('');
              setTargetAmount('1500');
              setCategory('custom');
              setIsModalOpen(true);
            }}
            className="shrink-0 rounded-full"
          >
            <Plus className="size-3.5" />
            Create Cash Pot
          </Button>
        )}
      </div>

      {/* Host Payout Account Connection Banner */}
      {!connectLoading && (
        <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex size-10 items-center justify-center rounded-xl ${
                connectStatus?.payoutsEnabled
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              {connectStatus?.payoutsEnabled ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <Building2 className="size-5" />
              )}
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)]">
                {connectStatus?.payoutsEnabled
                  ? 'Bank Payouts Active'
                  : 'Connect Bank Account for Payouts'}
              </h4>
              <p className="text-[0.7rem] text-[var(--text-secondary)]">
                {connectStatus?.payoutsEnabled
                  ? 'Guest gift contributions deposit directly to your connected bank account.'
                  : 'Link your bank or debit card via Stripe Connect Express to receive gift payouts.'}
              </p>
            </div>
          </div>

          {!connectStatus?.payoutsEnabled && (
            <Button
              type="button"
              variant="soft"
              size="sm"
              loading={onboardingBusy}
              onClick={handleConnectStripe}
              className="shrink-0 rounded-full text-xs"
            >
              Connect with Stripe
            </Button>
          )}
        </div>
      )}

      {/* Quick 1-Click Preset Starters */}
      {funds.length === 0 && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-5">
          <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
            <Sparkles className="size-3.5 text-[var(--accent)]" />
            <span>Popular Cash Pot Starters</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {FUND_PRESETS.slice(0, 4).map((preset) => (
              <button
                key={preset.category}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="group flex flex-col items-start rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 text-left shadow-sm transition-all hover:border-[var(--accent)] hover:shadow-md active:scale-95"
              >
                <span className="mb-1.5 text-2xl">{preset.glyph}</span>
                <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)]">
                  {preset.title.split(' ')[0]} Pot
                </span>
                <span className="line-clamp-1 text-[0.65rem] text-[var(--text-muted)]">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing Active Funds */}
      {funds.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {funds.map((fund) => {
            const percent = fund.targetAmount
              ? Math.min(100, Math.round((fund.currentAmount / fund.targetAmount) * 100))
              : null;
            return (
              <div
                key={fund.id}
                className="relative rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-bold tracking-wider text-[var(--accent)] uppercase">
                      {fund.category}
                    </span>
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">{fund.title}</h4>
                  </div>
                  <button
                    type="button"
                    disabled={deletingId === fund.id}
                    onClick={() => handleDeleteFund(fund.id)}
                    className="flex size-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
                  >
                    {deletingId === fund.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </button>
                </div>

                {fund.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">
                    {fund.description}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-3 text-xs">
                  <div>
                    <span className="font-bold text-[var(--text-primary)]">
                      ${fund.currentAmount.toLocaleString()}
                    </span>
                    {fund.targetAmount && (
                      <span className="text-[var(--text-muted)]">
                        {' '}
                        / ${fund.targetAmount.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <span className="text-[0.7rem] text-[var(--text-muted)]">
                    {fund.contributorCount}{' '}
                    {fund.contributorCount === 1 ? 'gift given' : 'gifts given'}
                  </span>
                </div>

                {percent !== null && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div
                      className="h-full rounded-full bg-[var(--accent)]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-page)] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <Gift className="size-5 text-[var(--accent)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">Create Cash Pot</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex size-7 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-sunken)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFund} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[var(--text-primary)]">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FundCategory)}
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 text-xs text-[var(--text-primary)]"
                >
                  <option value="honeymoon">✈️ Honeymoon Fund</option>
                  <option value="travel">🎒 Travel & Adventure</option>
                  <option value="home">🏡 New Home & Living</option>
                  <option value="baby">🍼 Nursery & Baby Essentials</option>
                  <option value="celebration">🥂 Celebration & Drinks</option>
                  <option value="charity">🕊️ Charity & Donation</option>
                  <option value="custom">🎁 Custom Dream Gift</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-primary)]">Pot Name</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={fundsConfig.titleMaxLength}
                  placeholder="e.g. Honeymoon in Amalfi Coast"
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 text-xs text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-primary)]">
                  Description / Story (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={fundsConfig.descriptionMaxLength}
                  rows={2}
                  placeholder="Tell guests what you are saving for and why it means so much..."
                  className="mt-1 w-full resize-none rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 text-xs text-[var(--text-primary)]"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[var(--text-primary)]">
                  Target Goal Amount ($USD, Optional)
                </label>
                <input
                  type="number"
                  min="5"
                  max={fundsConfig.maxTargetAmount}
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="e.g. 2500"
                  className="mt-1 h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 text-xs text-[var(--text-primary)]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={isSubmitting}>
                  Create Pot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

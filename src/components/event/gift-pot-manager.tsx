'use client';
import { useState } from 'react';
import { Gift, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
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

export function GiftPotManager({
  eventId,
  funds,
  onFundsChanged,
}: GiftPotManagerProps) {
  const { notify } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<FundCategory>('honeymoon');
  const [targetAmount, setTargetAmount] = useState<string>('1500');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
            Let guests contribute toward honeymoon travel, nursery funds, or group gifts.
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
            className="rounded-full shrink-0"
          >
            <Plus className="size-3.5" />
            Create Cash Pot
          </Button>
        )}
      </div>

      {/* Quick 1-Click Preset Starters */}
      {funds.length === 0 && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            <Sparkles className="size-3.5 text-[var(--accent)]" />
            <span>Popular Cash Pot Starters</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {FUND_PRESETS.slice(0, 4).map((preset) => (
              <button
                key={preset.category}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className="flex flex-col items-start gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-3 text-left transition-all hover:border-[var(--accent)] hover:shadow-sm"
              >
                <span className="text-xl">{preset.glyph}</span>
                <span className="text-xs font-bold text-[var(--text-primary)] leading-tight">
                  {preset.title.split(' ')[0]} {preset.title.split(' ')[1]}
                </span>
                <span className="text-[0.65rem] text-[var(--text-muted)]">
                  {preset.defaultTarget ? `$${preset.defaultTarget} goal` : 'Open-ended'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Existing Funds List */}
      {funds.length > 0 && (
        <div className="space-y-3">
          {funds.map((fund) => (
            <div
              key={fund.id}
              className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-xl bg-[var(--surface-sunken)] text-lg">
                  {fund.category === 'honeymoon'
                    ? '✈️'
                    : fund.category === 'home'
                      ? '🏡'
                      : fund.category === 'baby'
                        ? '🍼'
                        : fund.category === 'celebration'
                          ? '🥂'
                          : '🎁'}
                </span>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">
                    {fund.title}
                  </h4>
                  <p className="text-xs text-[var(--text-muted)]">
                    ${fund.currentAmount.toLocaleString()} raised
                    {fund.targetAmount && ` of $${fund.targetAmount.toLocaleString()} goal`} ·{' '}
                    {fund.contributorCount} contributors
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={deletingId === fund.id}
                onClick={() => handleDeleteFund(fund.id)}
                className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] transition-colors"
                title="Remove cash pot"
              >
                {deletingId === fund.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-page)] p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Gift className="size-4" />
                </span>
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Create Collective Cash Pot
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFund} className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Fund Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Honeymoon Flight Fund to Amalfi"
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FundCategory)}
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                >
                  <option value="honeymoon">✈️ Honeymoon & Travel</option>
                  <option value="home">🏡 New Home & Furniture</option>
                  <option value="baby">🍼 Baby Nursery & Essentials</option>
                  <option value="celebration">🥂 Celebration Bar Tab</option>
                  <option value="travel">🎒 Graduation Adventure</option>
                  <option value="charity">🕊️ Community Charity</option>
                  <option value="custom">🎁 Custom Dream Gift</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Target Goal (USD) · Optional
                </label>
                <input
                  type="number"
                  min={50}
                  max={50000}
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="e.g. 2500 (leave blank for open-ended)"
                  className="mt-1 h-10 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-4 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)]">
                  Short Description for Guests
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Help us celebrate this milestone with an unforgettable trip!"
                  className="mt-1 w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <Button
                  type="button"
                  variant="soft"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    'Save Cash Pot'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

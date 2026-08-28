'use client';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Eye, RefreshCw, Timer, X } from 'lucide-react';
import { DangerSection } from '@/components/event/danger-section';
import { UpgradeSection } from '@/components/event/upgrade-section';
import { expiryPresets, motion as motionTokens } from '@/config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { formatJoinCode } from '@/lib/codes-format';

interface HostPanelProps {
  eventId: string;
  /** Needed for the typed delete confirmation. */
  title: string;
  /** The plan the event currently runs on, so the panel knows whether to offer an upgrade. */
  plan: string;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Host controls — the settings, not the work.
 *
 * This used to hold the entire guest list as well: adding people, the relay panel, the send
 * buttons and every guest's delivery status, stacked in a 384px drawer between "add time"
 * and "delete everything". The thing a host touches most was buried in a scroll with the
 * thing they must never touch by accident, and there was no separating them by eye.
 *
 * Guests moved to their own tab. What is left is deliberately the occasional stuff — the
 * things you do once or twice for an event, in rough order of how reversible they are, with
 * the irreversible one last.
 *
 * The join code is not part of the event payload. It is fetched on demand here, which is
 * what makes each read auditable and keeps it out of any response a non-host could receive.
 */
export function HostPanel({ eventId, title, plan, open, onClose, onChanged }: HostPanelProps) {
  const { notify } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<'reveal' | 'rotate' | 'extend' | 'end' | null>(null);
  const [copied, setCopied] = useState(false);

  async function revealCode() {
    setBusy('reveal');
    try {
      const result = await api.get<{ code: string }>(`/api/events/${eventId}/code`);
      setCode(result.code);
    } catch (caught) {
      notify(errorMessage(caught, 'Could not read the code.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function rotateCode() {
    if (!window.confirm('Make a new code? The current one stops working immediately.')) return;
    setBusy('rotate');
    try {
      const result = await api.post<{ code: string }>(`/api/events/${eventId}/code`);
      setCode(result.code);
      notify('New code created. The old one no longer works.', 'success');
    } catch (caught) {
      notify(errorMessage(caught, 'Could not rotate the code.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function extend(presetId: string) {
    setBusy('extend');
    try {
      await api.post(`/api/events/${eventId}/extend`, { expiryPresetId: presetId });
      notify('Time added.', 'success');
      onChanged();
    } catch (caught) {
      notify(errorMessage(caught, 'Could not extend the event.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function endEvent() {
    if (!window.confirm('End this event now? The wall becomes read-only for everyone.')) return;
    setBusy('end');
    try {
      await api.post(`/api/events/${eventId}/end`);
      notify('Event ended.', 'success');
      onChanged();
      onClose();
    } catch (caught) {
      notify(errorMessage(caught, 'Could not end the event.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function copyCode() {
    if (!code) return;
    await navigator.clipboard.writeText(formatJoinCode(code));
    setCopied(true);
    notify('Code copied', 'success');
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionTokens.fast}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Host controls"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={motionTokens.spring}
            className="glass-strong fixed inset-x-4 bottom-4 z-50 max-h-[80dvh] overflow-y-auto rounded-[var(--radius-card)] p-6 shadow-[var(--shadow-lift)] sm:inset-x-auto sm:top-20 sm:right-6 sm:w-96"
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Host controls</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)]"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <section className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">Join code</h3>
              {code ? (
                <div className="rounded-2xl bg-[var(--surface-sunken)] p-4 text-center">
                  <p className="code-display text-2xl font-semibold">{formatJoinCode(code)}</p>
                  <div className="mt-3 flex justify-center gap-2">
                    <Button variant="soft" size="sm" onClick={copyCode}>
                      {copied ? (
                        <Check className="size-4" aria-hidden />
                      ) : (
                        <Copy className="size-4" aria-hidden />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={busy === 'rotate'}
                      onClick={rotateCode}
                    >
                      <RefreshCw className="size-4" aria-hidden />
                      New code
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="soft"
                  className="w-full"
                  loading={busy === 'reveal'}
                  onClick={revealCode}
                >
                  <Eye className="size-4" aria-hidden />
                  Show the code
                </Button>
              )}
            </section>

            <section className="mb-6">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                <Timer className="size-4" aria-hidden />
                Add time
              </h3>
              <div className="flex flex-wrap gap-2">
                {expiryPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => extend(preset.id)}
                    className="rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-3.5 py-1.5 text-sm transition-colors hover:bg-[var(--accent-soft)] disabled:opacity-50"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Counts from now, not from the current end time.
              </p>
            </section>

            <UpgradeSection eventId={eventId} plan={plan} />

            <section className="mb-6">
              <h3 className="mb-2 text-sm font-medium text-[var(--text-secondary)]">
                Finish early
              </h3>
              <Button
                variant="danger"
                className="w-full"
                loading={busy === 'end'}
                onClick={endEvent}
              >
                End the event now
              </Button>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                The wall goes read-only. Photos and video are deleted a few hours later, so this is
                reversible for a while by adding time.
              </p>
            </section>

            <DangerSection eventId={eventId} title={title} plan={plan} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

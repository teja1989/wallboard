'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Download, Eye, RefreshCw, Shield, Timer, X } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
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
  canDelete?: boolean;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

interface CoHostItem {
  uid: string;
  displayName: string;
  photoUrl: string | null;
  role: string;
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
export function HostPanel({
  eventId,
  title,
  plan,
  canDelete = true,
  open,
  onClose,
  onChanged,
}: HostPanelProps) {
  const { notify } = useToast();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState<'reveal' | 'rotate' | 'extend' | 'end' | 'cohostLink' | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [cohosts, setCohosts] = useState<CoHostItem[]>([]);
  const [copiedCohost, setCopiedCohost] = useState(false);
  const [removingCohostUid, setRemovingCohostUid] = useState<string | null>(null);

  /*
    Co-hosts only. **The join code is deliberately not fetched here.**

    It was, briefly, so the co-host invite link would have a code to embed — and that quietly
    broke two things. `code` being non-null is exactly what swaps "Show the code" for the
    revealed code, so opening the panel auto-revealed the credential nobody had asked to see;
    and `GET /code` writes an `event.codeViewed` audit entry, so every open of the settings
    drawer logged a code read that never happened. `docs/SECURITY.md` is explicit that the
    plaintext leaves `private/joinCode` only through a deliberate, audited call.

    It also raced the UI: the button was replaced mid-click as the fetch resolved, which is
    what the e2e failure ("element was detached from the DOM") was reporting.
  */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await api.get<{ guests: CoHostItem[] }>(`/api/events/${eventId}/guests`);
        if (!cancelled) {
          setCohosts(res.guests.filter((g) => g.role === 'cohost'));
        }
      } catch {
        // Non-critical: the panel's other controls all work without the co-host list.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  /**
   * The code, fetched on demand.
   *
   * Both the reveal button and the co-host link need it, and neither should get it before a
   * host has asked for something that requires it — one audited read per deliberate act.
   */
  async function fetchCode(): Promise<string | null> {
    if (code) return code;
    const result = await api.get<{ code: string }>(`/api/events/${eventId}/code`);
    setCode(result.code);
    return result.code;
  }

  async function copyCohostLink() {
    setBusy('cohostLink');
    try {
      // Reads the code only now, because the host has just asked for a link that contains it.
      // It used to silently do nothing when the panel had not pre-fetched one.
      const value = await fetchCode();
      if (!value) return;
      const url = `${window.location.origin}/i/${value}?role=cohost`;
      await navigator.clipboard.writeText(url);
      setCopiedCohost(true);
      notify('Co-host invite link copied to clipboard!', 'success');
      setTimeout(() => setCopiedCohost(false), 2200);
    } catch (caught) {
      notify(errorMessage(caught, 'Could not build the invite link.'), 'error');
    } finally {
      setBusy(null);
    }
  }

  async function removeCohost(targetUid: string) {
    setRemovingCohostUid(targetUid);
    try {
      await api.post(`/api/events/${eventId}/members/${targetUid}/role`, { role: 'member' });
      setCohosts((prev) => prev.filter((c) => c.uid !== targetUid));
      notify('Co-host removed.', 'success');
      onChanged();
    } catch (caught) {
      notify(errorMessage(caught, 'Could not remove co-host.'), 'error');
    } finally {
      setRemovingCohostUid(null);
    }
  }

  async function revealCode() {
    setBusy('reveal');
    try {
      await fetchCode();
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
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)]">
                  <Shield className="size-4 text-[var(--accent)]" aria-hidden />
                  Co-hosts
                </h3>
                {cohosts.length > 0 && (
                  <span className="text-xs text-[var(--text-muted)]">
                    {cohosts.length} {cohosts.length === 1 ? 'co-host' : 'co-hosts'}
                  </span>
                )}
              </div>

              <div className="rounded-2xl bg-[var(--surface-sunken)] p-4">
                {cohosts.length > 0 ? (
                  <ul className="mb-3 divide-y divide-[var(--border-subtle)]">
                    {cohosts.map((cohost) => (
                      <li key={cohost.uid} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2">
                          <Avatar name={cohost.displayName} photoUrl={cohost.photoUrl} size={28} />
                          <span className="text-sm font-medium">{cohost.displayName}</span>
                        </div>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-[var(--text-muted)] hover:text-[var(--danger)]"
                            loading={removingCohostUid === cohost.uid}
                            onClick={() => removeCohost(cohost.uid)}
                          >
                            Remove
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mb-3 text-xs text-[var(--text-muted)]">
                    No co-hosts yet. Share the co-host link below with an event partner.
                  </p>
                )}

                {/*
                  One button, not two.

                  It used to be a pair — "Get the link", which really revealed the join code
                  above, and then "Copy the link" once `code` was set. That existed only
                  because the code was pre-fetched, and it made getting a co-host link a
                  two-step act whose first step silently did something else. Copying fetches
                  what it needs.
                */}
                <Button
                  variant="soft"
                  size="sm"
                  className="w-full justify-center gap-2"
                  loading={busy === 'cohostLink'}
                  onClick={copyCohostLink}
                >
                  {copiedCohost ? (
                    <Check className="size-4 text-[var(--accent)]" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copiedCohost ? 'Co-host link copied!' : 'Copy co-host invite link'}
                </Button>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Co-hosts can manage invitations, edit details, and moderate posts, but cannot delete
                the event.
              </p>
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
                Memory Keepsake Album
              </h3>
              <p className="mb-3 text-xs text-[var(--text-muted)]">
                Download a complete ZIP bundle with all full-resolution photos, audio voice notes,
                guest list, and an offline interactive photo viewer.
              </p>
              <Button
                variant="soft"
                size="sm"
                className="w-full"
                onClick={() => window.open(`/api/events/${eventId}/archive`, '_blank')}
              >
                <Download className="size-4" aria-hidden />
                Download Keepsake Archive (ZIP)
              </Button>
            </section>

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

            {canDelete && <DangerSection eventId={eventId} title={title} plan={plan} />}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

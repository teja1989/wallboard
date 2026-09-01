'use client';
import { useState } from 'react';
import { Check, Copy, MessageCircle, Phone, Printer, Share2, Sparkles, X } from 'lucide-react';
import { QrCode as QrCodeDisplay } from '@/components/ui/qr-code';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import type { EventDoc } from '@/types/domain';

interface ShareInvitationModalProps {
  event: EventDoc;
  onClose: () => void;
}

export function ShareInvitationModal({ event, onClose }: ShareInvitationModalProps) {
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'digital' | 'print'>('digital');

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/event/${event.id}`
      : `https://marquee.party/event/${event.id}`;

  const shareText = `🎉 You're invited to ${event.title}! RSVP and see details here: ${inviteUrl}`;

  function handleCopy() {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    notify('Invitation link copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 3000);
  }

  function handleWhatsApp() {
    const encoded = encodeURIComponent(shareText);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  }

  function handleSms() {
    const encoded = encodeURIComponent(shareText);
    window.open(`sms:?&body=${encoded}`, '_self');
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm duration-200"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-page)] p-6 shadow-2xl sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Share2 className="size-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Share & Promote Invitation
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Send to parents via WhatsApp, SMS, or print table QR signs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="mt-5 flex rounded-2xl bg-[var(--surface-sunken)] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('digital')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === 'digital'
                ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            💬 Digital Share (WhatsApp & SMS)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('print')}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-all ${
              activeTab === 'print'
                ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            🖨️ Party Table Signs (Print QR)
          </button>
        </div>

        {/* Digital Share Tab */}
        {activeTab === 'digital' && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
              <label className="text-[0.7rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                Direct Invitation Link
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteUrl}
                  className="h-10 flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 text-xs text-[var(--text-primary)] focus:outline-none"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleCopy}
                  className="h-10 shrink-0 rounded-xl px-3 text-xs"
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Quick 1-Click Channels */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleWhatsApp}
                className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-400"
              >
                <MessageCircle className="size-4 fill-current" />
                Share on WhatsApp
              </button>

              <button
                type="button"
                onClick={handleSms}
                className="flex items-center justify-center gap-2 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3.5 text-xs font-bold text-blue-700 transition-all hover:bg-blue-500/20 active:scale-95 dark:text-blue-400"
              >
                <Phone className="size-4" />
                Send via iMessage / SMS
              </button>
            </div>
          </div>
        )}

        {/* Printable Table QR Signs Tab */}
        {activeTab === 'print' && (
          <div className="mt-5 space-y-4">
            <div className="print-sign-container flex flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 text-center shadow-sm">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider text-[var(--accent)] uppercase">
                <Sparkles className="size-3.5" />
                <span>Live Party Wallboard</span>
              </div>
              <h4 className="text-lg font-black text-[var(--text-primary)]">
                📸 Snap & Share Party Photos!
              </h4>
              <p className="mt-1 max-w-xs text-xs text-[var(--text-secondary)]">
                Scan with your phone camera to see your photos appear live on the big screen TV!
              </p>

              <div className="my-4 rounded-2xl bg-white p-4 shadow-md">
                <QrCodeDisplay value={inviteUrl} size={150} />
              </div>

              <span className="text-[0.7rem] font-bold text-[var(--text-muted)]">
                {event.title} · {event.hostedBy}
              </span>
            </div>

            <Button
              type="button"
              variant="primary"
              onClick={handlePrint}
              className="h-11 w-full rounded-full font-bold shadow-sm"
            >
              <Printer className="size-4" />
              Print Table QR Cards (4x6&quot; / 5x7&quot;)
            </Button>
          </div>
        )}

        <div className="mt-6 flex justify-end border-t border-[var(--border-subtle)] pt-4">
          <Button type="button" variant="soft" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

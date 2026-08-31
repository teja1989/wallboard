'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Laptop,
  QrCode,
  Smartphone,
  Tv,
  X,
} from 'lucide-react';
import {
  faceOf,
  occasions,
  sampleForTemplate,
  type OccasionId,
  type Template,
} from '@/config';
import { Invitation } from '@/components/event/invitation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { EventDoc } from '@/types/domain';

interface TemplatePreviewModalProps {
  template: Template | null;
  onClose: () => void;
}

const PREVIEW_TIMESTAMP = 1788500000000;

export function TemplatePreviewModal({ template, onClose }: TemplatePreviewModalProps) {
  const [selectedOccasion, setSelectedOccasion] = useState<OccasionId>('birthday');
  const [previewMode, setPreviewMode] = useState<'invite' | 'wallboard'>('invite');
  const [deviceFrame, setDeviceFrame] = useState<'mobile' | 'desktop'>('mobile');

  const face = template ? faceOf(template) : null;
  const sample = template ? sampleForTemplate(template.id) : null;
  const palette = template?.palette;
  const gradient = palette ? `linear-gradient(135deg, ${palette.from}, ${palette.to})` : '';

  // Generate a live mock EventDoc based on the selected occasion and template
  const mockEvent: EventDoc | null = useMemo(() => {
    if (!template || !sample) return null;

    return {
      id: `preview-${template.id}`,
      title:
        selectedOccasion === 'wedding'
          ? 'Elena & Marcus Wedding Celebration'
          : selectedOccasion === 'graduation'
            ? 'Class of 2026 Honors Gala'
            : selectedOccasion === 'dinner'
              ? 'Long Table Seasonal Harvest Feast'
              : selectedOccasion === 'party'
                ? 'Sasha’s 30th Noir & Neon Party'
                : sample.sampleTitle,
      description:
        'Drinks from seven, dinner at eight. Join us for a night of celebration, toasts, and live photos on the marquee wallboard.',
      occasion: selectedOccasion,
      hostUid: 'host-1',
      hostName: 'Maya & Friends',
      hostedBy: 'Maya & Friends',
      templateId: template.id,
      status: 'live',
      startsAt: PREVIEW_TIMESTAMP + 7 * 24 * 60 * 60 * 1000,
      endsAt: PREVIEW_TIMESTAMP + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000,
      timeZone: 'America/Los_Angeles',
      location: {
        name: 'The Rooftop Terrace',
        address: '14 Bridge Street, San Francisco, CA',
        url: 'https://maps.google.com',
      },
      dressCode: 'Cocktail Attire',
      rsvp: {
        enabled: true,
        deadline: PREVIEW_TIMESTAMP + 5 * 24 * 60 * 60 * 1000,
        allowPlusOnes: true,
        maxPartySize: 3,
        askNote: false,
        question: null,
        autoRemind: true,
      },
      settings: {
        whoCanPost: 'members',
        allowedKinds: ['text', 'image', 'video', 'audio'],
      },
      plan: template.premium ? 'pro' : 'free',
      createdAt: PREVIEW_TIMESTAMP - 2 * 24 * 60 * 60 * 1000,
      expiresAt: PREVIEW_TIMESTAMP + 8 * 24 * 60 * 60 * 1000,
      endedAt: null,
      storageBytes: 0,
      postCount: 12,
      memberCount: 28,
      rsvpTally: {
        yes: 24,
        maybe: 3,
        no: 1,
        attending: 32,
        pending: 4,
      },
      remindersSent: [],
    };
  }, [template, sample, selectedOccasion]);

  if (!template || !face || !palette || !sample || !mockEvent) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-md sm:p-6"
    >
      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-page)] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)]">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-raised)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="size-8 rounded-full border border-black/10 shadow-sm"
              style={{ background: gradient }}
            />
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="text-lg font-bold tracking-tight text-[var(--text-primary)]"
                  style={{ fontFamily: face.stack }}
                >
                  {template.label}
                </h3>
                {template.premium && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-bold text-amber-500">
                    PREMIUM
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">
                {template.layout} layout · {face.label} typeface · {template.blurb}
              </p>
            </div>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-full bg-[var(--surface-sunken)] p-1 border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setPreviewMode('invite')}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all',
                  previewMode === 'invite'
                    ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                <span>💌</span>
                Invitation
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('wallboard')}
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all',
                  previewMode === 'wallboard'
                    ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                )}
              >
                <Tv className="size-3.5" />
                Live Wallboard
              </button>
            </div>

            {/* Device Switcher */}
            {previewMode === 'invite' && (
              <div className="hidden sm:inline-flex rounded-full bg-[var(--surface-sunken)] p-1 border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setDeviceFrame('mobile')}
                  className={cn(
                    'p-1.5 rounded-full transition-colors',
                    deviceFrame === 'mobile'
                      ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                  )}
                  title="Mobile preview"
                >
                  <Smartphone className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeviceFrame('desktop')}
                  className={cn(
                    'p-1.5 rounded-full transition-colors',
                    deviceFrame === 'desktop'
                      ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                  )}
                  title="Desktop preview"
                >
                  <Laptop className="size-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex size-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
              aria-label="Close preview"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Occasion Sample Bar */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-6 py-2.5 text-xs">
          <span className="font-medium text-[var(--text-muted)] shrink-0">Try Occasion:</span>
          {(['birthday', 'wedding', 'graduation', 'dinner', 'party'] as OccasionId[]).map((occ) => {
            const occInfo = occasions.find((o) => o.id === occ);
            return (
              <button
                key={occ}
                type="button"
                onClick={() => setSelectedOccasion(occ)}
                className={cn(
                  'flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-all shrink-0',
                  selectedOccasion === occ
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm font-semibold'
                    : 'bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-page)] border border-[var(--border-subtle)]',
                )}
              >
                <span>{occInfo?.glyph}</span>
                <span>{occInfo?.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Stage Area */}
        <div className="flex-1 overflow-y-auto bg-neutral-950/20 p-4 sm:p-8">
          {previewMode === 'invite' ? (
            <div className="flex justify-center">
              <div
                className={cn(
                  'w-full transition-all duration-300',
                  deviceFrame === 'mobile'
                    ? 'max-w-[420px] rounded-[36px] border-[6px] border-neutral-900 bg-[var(--surface-page)] p-3 shadow-2xl ring-1 ring-white/10'
                    : 'max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-page)] p-6 shadow-xl',
                )}
              >
                <Invitation event={mockEvent} />
              </div>
            </div>
          ) : (
            /* Live TV Wallboard Mode Preview */
            <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border-4 border-neutral-800 bg-neutral-950 p-6 shadow-2xl ring-1 ring-white/10">
              {/* TV Wallboard Stage */}
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="size-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md"
                    style={{ background: gradient }}
                  >
                    🎉
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {mockEvent.title}
                    </h3>
                    <p className="text-xs text-neutral-400">
                      Live Guest Wallboard · 32 Attendees
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-neutral-300">
                    <QrCode className="size-4 text-[var(--accent)]" />
                    <span>Scan to post</span>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
                    LIVE FEED
                  </span>
                </div>
              </div>

              {/* Sample Live Feed Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-neutral-900/90 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-7 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center justify-center">
                      M
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Maya T.</p>
                      <p className="text-[0.65rem] text-neutral-400">Just now</p>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-200">
                    Happy birthday Priya! 🥂 The rooftop venue is breathtaking tonight!
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-neutral-900/90 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-7 rounded-full bg-pink-500/30 text-pink-300 text-xs font-bold flex items-center justify-center">
                      S
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Sam O.</p>
                      <p className="text-[0.65rem] text-neutral-400">2m ago</p>
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-between rounded-lg p-2.5 text-xs font-medium text-white mb-1.5"
                    style={{ background: gradient }}
                  >
                    <span>🎙️ Voice Toast (0:24)</span>
                    <span>▶</span>
                  </div>
                  <p className="text-[0.65rem] text-neutral-400">
                    &ldquo;Wishing you the most magical decade ahead!&rdquo;
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-neutral-900/90 p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-7 rounded-full bg-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-center">
                      D
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">David K.</p>
                      <p className="text-[0.65rem] text-neutral-400">5m ago</p>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-200">
                    The playlist is incredible! So excited to celebrate with everyone tonight! 🔥
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer / Conversion Action */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--surface-raised)] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Color Palette:</span>
            <span
              className="size-3.5 rounded-full border border-black/10"
              style={{ backgroundColor: palette.from }}
            />
            <span
              className="size-3.5 rounded-full border border-black/10"
              style={{ backgroundColor: palette.to }}
            />
            <span
              className="size-3.5 rounded-full border border-black/10"
              style={{ backgroundColor: palette.accent }}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="soft" size="sm" onClick={onClose}>
              Back to Gallery
            </Button>
            <Link
              href={`/create?template=${template.id}&occasion=${selectedOccasion}`}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] shadow-md transition-all hover:bg-[var(--accent-hover)] active:scale-95"
            >
              Use {template.label}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

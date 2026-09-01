'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Cake,
  CheckCircle2,
  Clock,
  Eye,
  Gift,
  MapPin,
  MessageSquare,
  QrCode,
  Send,
  Share2,
  Sparkles,
  Tv,
  Users,
} from 'lucide-react';
import { TemplateSurfaceField } from '@/components/event/template-surface';
import { templateById, type TemplateId } from '@/config';
import { cn } from '@/lib/utils';

const DEMO_THEMES: readonly TemplateId[] = ['sunset', 'meadow', 'midnight', 'linen'];

export function CreationStory() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [selectedThemeId, setSelectedThemeId] = useState<TemplateId>('sunset');
  const activeTemplate = templateById(selectedThemeId);

  return (
    <section id="how-it-works" className="mx-auto w-full max-w-6xl scroll-mt-20 px-6 py-20">
      {/* Header */}
      <div className="mx-auto max-w-3xl text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--accent-soft)] bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-bold tracking-wider text-[var(--accent)] uppercase shadow-sm">
          <Sparkles className="size-3.5" />
          The 3-Step Experience
        </span>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl">
          From blank page to live party in three easy steps.
        </h2>
        <p className="mt-4 text-base text-[var(--text-secondary)] sm:text-lg">
          No mandatory app downloads or account walls for your guests. Everything works seamlessly
          in any mobile browser.
        </p>
      </div>

      {/* Step Selector & Visual Stage Grid */}
      <div className="mt-14 grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left Column: Interactive Step Cards */}
        <div className="space-y-4 lg:col-span-5">
          {/* Step 1 Button */}
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={cn(
              'group w-full cursor-pointer rounded-2xl border p-5 text-left transition-all duration-300 sm:p-6',
              activeStep === 1
                ? 'border-[var(--accent)] bg-[var(--surface-raised)] shadow-xl ring-2 ring-[var(--accent)]/30'
                : 'border-[var(--border-subtle)] bg-[var(--surface-sunken)]/60 hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]',
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-colors',
                  activeStep === 1
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm'
                    : 'border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-muted)]',
                )}
              >
                01
              </span>
              <h3 className="text-base font-bold text-[var(--text-primary)] sm:text-lg">
                Design your invitation in 60s
              </h3>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
              Choose from 15 designer typography themes, set your event details, dress code, and
              optional gift registry or cash pot.
            </p>
          </button>

          {/* Step 2 Button */}
          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className={cn(
              'group w-full cursor-pointer rounded-2xl border p-5 text-left transition-all duration-300 sm:p-6',
              activeStep === 2
                ? 'border-[var(--accent)] bg-[var(--surface-raised)] shadow-xl ring-2 ring-[var(--accent)]/30'
                : 'border-[var(--border-subtle)] bg-[var(--surface-sunken)]/60 hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]',
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-colors',
                  activeStep === 2
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm'
                    : 'border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-muted)]',
                )}
              >
                02
              </span>
              <h3 className="text-base font-bold text-[var(--text-primary)] sm:text-lg">
                Share via WhatsApp, SMS, or QR
              </h3>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
              Send personalized 1-click links directly into group chats, print table QR cards, and
              see real-time delivery status when guests open it.
            </p>
          </button>

          {/* Step 3 Button */}
          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className={cn(
              'group w-full cursor-pointer rounded-2xl border p-5 text-left transition-all duration-300 sm:p-6',
              activeStep === 3
                ? 'border-[var(--accent)] bg-[var(--surface-raised)] shadow-xl ring-2 ring-[var(--accent)]/30'
                : 'border-[var(--border-subtle)] bg-[var(--surface-sunken)]/60 hover:border-[var(--border-strong)] hover:bg-[var(--surface-raised)]',
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-colors',
                  activeStep === 3
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm'
                    : 'border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-muted)]',
                )}
              >
                03
              </span>
              <h3 className="text-base font-bold text-[var(--text-primary)] sm:text-lg">
                Track RSVPs & Turn on the TV Wall
              </h3>
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
              Track adult vs kid headcounts and dietary restrictions. On party night, project the
              live photo wall with voice toast playback and instant confetti.
            </p>
          </button>
        </div>

        {/* Right Column: Dynamic Interactive Stage */}
        <div className="lg:col-span-7">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-2xl sm:p-8">
            <AnimatePresence mode="wait">
              {/* --- STEP 1 VISUAL: Interactive Designer Canvas --- */}
              {activeStep === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                    <span className="text-xs font-bold tracking-wider text-[var(--accent)] uppercase">
                      Step 1: Design & Details
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      Auto-saved
                    </span>
                  </div>

                  {/* Mock Form Header */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[0.7rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                        Event Title
                      </label>
                      <div className="mt-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-2 text-sm font-bold text-[var(--text-primary)]">
                        Alex & Maya&apos;s Celebration
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[0.7rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                          Date & Time
                        </label>
                        <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-xs font-medium">
                          <Clock className="size-3.5 text-[var(--text-muted)]" />
                          <span>Sat, Sep 5 · 4:00 PM</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-[0.7rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                          Venue
                        </label>
                        <div className="mt-1 flex items-center gap-2 truncate rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-xs font-medium">
                          <MapPin className="size-3.5 text-[var(--text-muted)]" />
                          <span className="truncate">The Grand Pavilion</span>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Theme Chooser */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="block text-[0.7rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                          Pick a Palette & Animated Surface
                        </label>
                        <span className="text-xs font-bold text-[var(--accent)]">
                          {activeTemplate.label} ({activeTemplate.surface})
                        </span>
                      </div>

                      <div className="mt-1.5 grid grid-cols-4 gap-2">
                        {DEMO_THEMES.map((themeId) => {
                          const t = templateById(themeId);
                          const isSelected = selectedThemeId === themeId;
                          return (
                            <button
                              key={themeId}
                              type="button"
                              onClick={() => setSelectedThemeId(themeId)}
                              className={cn(
                                'flex cursor-pointer flex-col items-center gap-1 rounded-xl p-1.5 transition-all duration-200',
                                isSelected
                                  ? 'bg-[var(--surface-sunken)] shadow-sm ring-2 ring-[var(--accent)]'
                                  : 'hover:bg-[var(--surface-sunken)]/60',
                              )}
                            >
                              <div
                                className="size-7 rounded-lg shadow-sm"
                                style={{
                                  background: `linear-gradient(135deg, ${t.palette.from}, ${t.palette.to})`,
                                }}
                              />
                              <span className="truncate text-[10px] font-semibold text-[var(--text-secondary)]">
                                {t.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Live Surface Glow Banner */}
                      <div
                        className="relative mt-3 h-20 overflow-hidden rounded-2xl p-3.5 shadow-inner transition-all duration-300"
                        style={{
                          background: `linear-gradient(135deg, ${activeTemplate.palette.from}, ${activeTemplate.palette.to})`,
                        }}
                      >
                        <TemplateSurfaceField
                          surface={activeTemplate.surface}
                          palette={activeTemplate.palette}
                          className="size-full"
                        />
                        <div className="relative z-10 flex h-full flex-col justify-center">
                          <span
                            className="font-serif text-base font-bold"
                            style={{ color: activeTemplate.palette.onGradient }}
                          >
                            {activeTemplate.label} Design Theme
                          </span>
                          <span
                            className="text-xs opacity-85"
                            style={{ color: activeTemplate.palette.onGradient }}
                          >
                            Live animated &ldquo;{activeTemplate.surface}&rdquo; surface texture
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- STEP 2 VISUAL: Smart Multi-Channel Share Suite --- */}
              {activeStep === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                    <span className="text-xs font-bold tracking-wider text-[var(--accent)] uppercase">
                      Step 2: Multi-Channel Share & Delivery
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                      Live Delivery Feed
                    </span>
                  </div>

                  {/* 1-Click WhatsApp & SMS Card */}
                  <div className="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        <Share2 className="size-3.5" />
                        1-Click WhatsApp & SMS Share
                      </span>
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[0.7rem] font-bold text-emerald-700 dark:text-emerald-300">
                        Zero Sign-up for Guests
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-[var(--text-secondary)] italic">
                      &ldquo;Hey! You&apos;re invited to Alex & Maya&apos;s Celebration on Sep 5.
                      Tap to RSVP, see directions & schedule: marqueersvp.com/e/PARTY2026&rdquo;
                    </p>
                  </div>

                  {/* Real-Time Live Delivery List */}
                  <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between bg-[var(--surface-sunken)]/50 p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-2 animate-pulse rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Jessica & Tom
                        </span>
                      </div>
                      <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        ✓ Confirmed (2 Adults, 1 Kid)
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-2 rounded-full bg-blue-500" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          David Rodriguez
                        </span>
                      </div>
                      <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                        👀 Viewed 3 mins ago
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2.5">
                        <div className="size-2 rounded-full bg-amber-500" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Aunt Sarah
                        </span>
                      </div>
                      <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        💌 WhatsApp Sent
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* --- STEP 3 VISUAL: Live Wall, RSVPs & Cash Pot --- */}
              {activeStep === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                    <span className="text-xs font-bold tracking-wider text-[var(--accent)] uppercase">
                      Step 3: Headcounts, Cash Pots & Live Wall
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                      <Tv className="size-3" />
                      4K TV Mode Ready
                    </span>
                  </div>

                  {/* Headcount Split Stats */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        36
                      </span>
                      <p className="mt-0.5 text-[10px] font-bold tracking-wider text-emerald-800 uppercase dark:text-emerald-300">
                        Attending
                      </p>
                    </div>
                    <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-3">
                      <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                        28 / 8
                      </span>
                      <p className="mt-0.5 text-[10px] font-bold tracking-wider text-blue-800 uppercase dark:text-blue-300">
                        Adults / Kids
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3">
                      <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                        $1,850
                      </span>
                      <p className="mt-0.5 text-[10px] font-bold tracking-wider text-amber-800 uppercase dark:text-amber-300">
                        Cash Pot
                      </p>
                    </div>
                  </div>

                  {/* Live TV Projector Banner */}
                  <div className="space-y-2 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="relative flex size-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex size-2.5 rounded-full bg-purple-500"></span>
                        </span>
                        <span className="text-xs font-bold text-purple-900 dark:text-purple-200">
                          Big-Screen TV Kiosk Active
                        </span>
                      </div>
                      <span className="rounded-md bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                        48 Photos Streamed
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-purple-800/80 dark:text-purple-200/80">
                      Guests take photos on their phones and they pop onto the big screen with voice
                      toasts and celebratory confetti!
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="mt-12 text-center">
        <Link
          href="/create"
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--accent)] hover:underline"
        >
          Try creating your invitation in 60 seconds <ArrowRight className="size-4" />
        </Link>
      </div>
    </section>
  );
}

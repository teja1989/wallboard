'use client';
import { useState } from 'react';
import { Clock, MapPin, MessageSquare, Sparkles } from 'lucide-react';
import { TemplateSurfaceField } from '@/components/event/template-surface';
import { templateById, type TemplateId } from '@/config';
import { cn } from '@/lib/utils';

const DEMO_THEMES: readonly TemplateId[] = ['sunset', 'meadow', 'midnight', 'linen'];

export function CreationStory() {
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [selectedThemeId, setSelectedThemeId] = useState<TemplateId>('sunset');
  const activeTemplate = templateById(selectedThemeId);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="text-center sm:text-left">
        <p className="text-sm font-semibold tracking-wide text-[var(--accent)] uppercase">
          How it works
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Three steps. One link. No chasing.
        </h2>
        <p className="mt-4 max-w-2xl text-base text-[var(--text-secondary)] sm:text-lg">
          No mandatory app downloads or account walls for your guests. From blank page to live
          RSVPs in under two minutes.
        </p>
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Step Selector Column */}
        <div className="space-y-4 lg:col-span-5">
          <button
            type="button"
            onClick={() => setActiveStep(1)}
            className={cn(
              'card w-full p-5 text-left transition-all duration-200 sm:p-6',
              activeStep === 1
                ? 'border-[var(--accent)] bg-[var(--surface-sunken)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--accent)]'
                : 'hover:bg-[var(--surface-sunken)]',
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  activeStep === 1
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]',
                )}
              >
                01
              </span>
              <h3 className="text-lg font-semibold">Type the details</h3>
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Enter your event name, date, and venue. Pick from 19 hand-crafted design palettes with
              rich animated surfaces.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(2)}
            className={cn(
              'card w-full p-5 text-left transition-all duration-200 sm:p-6',
              activeStep === 2
                ? 'border-[var(--accent)] bg-[var(--surface-sunken)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--accent)]'
                : 'hover:bg-[var(--surface-sunken)]',
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  activeStep === 2
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]',
                )}
              >
                02
              </span>
              <h3 className="text-lg font-semibold">Share your way</h3>
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Send via email or tap to text personalized invitation links via iMessage/SMS. Each
              guest gets a private link that tracks when they view it.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setActiveStep(3)}
            className={cn(
              'card w-full p-5 text-left transition-all duration-200 sm:p-6',
              activeStep === 3
                ? 'border-[var(--accent)] bg-[var(--surface-sunken)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--accent)]'
                : 'hover:bg-[var(--surface-sunken)]',
            )}
          >
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  activeStep === 3
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)]',
                )}
              >
                03
              </span>
              <h3 className="text-lg font-semibold">Collect replies & photos</h3>
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Collect guest headcounts, dietary restrictions, and private notes. On event day, the
              same link becomes a live photo wall for TVs and projectors.
            </p>
          </button>
        </div>

        {/* Step Preview Visual Column */}
        <div className="lg:col-span-7">
          <div className="card relative overflow-hidden p-5 sm:p-7">
            {/* Step 1 Visual: Drafting with live theme surface selector */}
            {activeStep === 1 && (
              <div className="animate-in fade-in space-y-4 duration-300">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <span className="text-xs font-semibold tracking-wider text-[var(--accent)] uppercase">
                    Step 1: Event Details & Theme
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)]">
                    <Sparkles className="size-3 text-amber-500" />
                    Auto-saved
                  </span>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-[var(--text-secondary)]">
                      Event Name
                    </label>
                    <div className="mt-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3.5 py-2 text-sm font-medium text-[var(--text-primary)]">
                      Maya&apos;s 40th Birthday Celebration
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)]">
                        Date & Time
                      </label>
                      <div className="mt-1 flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-xs sm:text-sm">
                        <Clock className="size-4 shrink-0 text-[var(--text-muted)]" />
                        <span>Saturday, 7:00 PM</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-[var(--text-secondary)]">
                        Location
                      </label>
                      <div className="mt-1 flex items-center gap-2 truncate rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] px-3 py-2 text-xs sm:text-sm">
                        <MapPin className="size-4 shrink-0 text-[var(--text-muted)]" />
                        <span className="truncate">The Skylight Loft, NYC</span>
                      </div>
                    </div>
                  </div>

                  {/* Interactive theme surface palette chooser */}
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-medium text-[var(--text-secondary)]">
                        Theme & Graphical Surface
                      </label>
                      <span className="text-xs font-medium text-[var(--accent)]">
                        {activeTemplate.label} ({activeTemplate.surface})
                      </span>
                    </div>

                    {/* Theme Swatch Buttons */}
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
                              'relative flex flex-col items-center gap-1 rounded-xl p-1.5 transition-all duration-200',
                              isSelected
                                ? 'bg-[var(--surface-sunken)] ring-2 ring-[var(--accent)] shadow-sm'
                                : 'hover:bg-[var(--surface-sunken)]/60',
                            )}
                          >
                            <div
                              className="size-7 rounded-lg shadow-sm sm:size-8"
                              style={{
                                background: `linear-gradient(135deg, ${t.palette.from}, ${t.palette.to})`,
                              }}
                            />
                            <span className="truncate text-[10px] font-medium text-[var(--text-secondary)] sm:text-xs">
                              {t.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Dynamic surface texture banner preview */}
                    <div
                      className="relative mt-2.5 h-16 overflow-hidden rounded-xl p-3 shadow-inner transition-all duration-300 sm:h-20"
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
                          className="font-serif text-sm font-semibold sm:text-base"
                          style={{ color: activeTemplate.palette.onGradient }}
                        >
                          {activeTemplate.label} Palette
                        </span>
                        <span
                          className="text-[11px] opacity-80"
                          style={{ color: activeTemplate.palette.onGradient }}
                        >
                          Animated &ldquo;{activeTemplate.surface}&rdquo; surface texture
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 Visual: Smart Distribution */}
            {activeStep === 2 && (
              <div className="animate-in fade-in space-y-4 duration-300">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <span className="text-xs font-semibold tracking-wider text-[var(--accent)] uppercase">
                    Step 2: Guest Relay & Tracking
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500">
                    Live Tracking
                  </span>
                </div>

                <div className="rounded-2xl bg-[var(--surface-sunken)] p-3.5 sm:p-4">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
                    Sample SMS Invitation Link
                  </p>
                  <p className="mt-1 text-xs font-medium text-[var(--text-primary)] sm:text-sm">
                    &ldquo;Maya invited you to Maya&apos;s 40th Birthday! Tap here to RSVP:
                    https://marqueersvp.com/i/PARTY30?g=alex&rdquo;
                  </p>
                </div>

                <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
                  <li className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium sm:text-sm">Alex Chen</span>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 sm:text-xs">
                      Seen 2m ago
                    </span>
                  </li>
                  <li className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-xs font-medium sm:text-sm">Sarah Jenkins</span>
                    </div>
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 sm:text-xs">
                      Replied (Attending)
                    </span>
                  </li>
                  <li className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-amber-500" />
                      <span className="text-xs font-medium sm:text-sm">David Ross</span>
                    </div>
                    <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 sm:text-xs">
                      Sent
                    </span>
                  </li>
                </ul>
              </div>
            )}

            {/* Step 3 Visual: Replies & Wall */}
            {activeStep === 3 && (
              <div className="animate-in fade-in space-y-4 duration-300">
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <span className="text-xs font-semibold tracking-wider text-[var(--accent)] uppercase">
                    Step 3: Headcounts & Live Wall
                  </span>
                  <span className="text-xs font-medium text-[var(--text-muted)]">48 Attending</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5 text-center sm:gap-3">
                  <div className="rounded-xl bg-emerald-500/10 p-2.5 sm:p-3">
                    <span className="text-xl font-bold text-emerald-600 sm:text-2xl">42</span>
                    <p className="text-[11px] font-medium text-emerald-700 sm:text-xs">Attending</p>
                  </div>
                  <div className="rounded-xl bg-zinc-500/10 p-2.5 sm:p-3">
                    <span className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">6</span>
                    <p className="text-[11px] font-medium text-[var(--text-muted)] sm:text-xs">
                      Can&apos;t Make It
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-500/10 p-2.5 sm:p-3">
                    <span className="text-xl font-bold text-amber-600 sm:text-2xl">4</span>
                    <p className="text-[11px] font-medium text-amber-700 sm:text-xs">Maybe</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-3.5 sm:p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                    <MessageSquare className="size-3.5 text-[var(--accent)]" />
                    Guest Notes & Dietary Split
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-[var(--text-secondary)]">
                    <p>
                      • <strong>Alex C.</strong>: &ldquo;Vegetarian · Can&apos;t wait!&rdquo;
                    </p>
                    <p>
                      • <strong>Marcus T.</strong>: &ldquo;Bringing my partner (2 total)&rdquo;
                    </p>
                    <p>
                      • <strong>Elena R.</strong>: &ldquo;Allergic to shellfish&rdquo;
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

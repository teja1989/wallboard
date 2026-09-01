'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Clock,
  Heart,
  ImageIcon,
  MapPin,
  Pause,
  Play,
  QrCode,
  Radio,
  Sparkles,
  Tv,
  Users,
} from 'lucide-react';
import { occasionById, showcaseItems, templateById, type ShowcasePost } from '@/config';
import { Invitation } from '@/components/event/invitation';
import { TemplateSurfaceField } from '@/components/event/template-surface';
import { cn, formatEventDate } from '@/lib/utils';

export function InvitationShowcase() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'invitation' | 'wallboard'>('invitation');
  const [activePostIndex, setActivePostIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [customPosts, setCustomPosts] = useState<Record<string, ShowcasePost[]>>({});
  const [simulatedCount, setSimulatedCount] = useState(0);

  const activeItem = showcaseItems[selectedIndex] ?? showcaseItems[0]!;
  const occasion = occasionById(activeItem.event.occasion);
  const template = templateById(activeItem.event.templateId);

  const currentPosts = [...(customPosts[activeItem.id] ?? []), ...activeItem.posts];
  const activePost = currentPosts[activePostIndex % currentPosts.length] ?? currentPosts[0];

  // Auto-cycle posts when in wallboard mode
  useEffect(() => {
    if (viewMode !== 'wallboard' || !isAutoPlaying || currentPosts.length <= 1) return;
    const timer = setInterval(() => {
      setActivePostIndex((prev) => (prev + 1) % currentPosts.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [viewMode, isAutoPlaying, currentPosts.length]);

  const handleSimulatePost = () => {
    const mockNames = ['Jordan P.', 'Taylor W.', 'Sam & Morgan', 'Elena R.', 'Chris L.'];
    const mockToasts = [
      'Having the best time! Cheers to everyone! 🥂✨',
      'Such an incredible venue and lovely night! 📸🎉',
      'The speeches had me tearing up! So happy to be here! ❤️',
      'Dancing all night! Incredible celebration! 🕺💃',
    ];
    const newPost: ShowcasePost = {
      id: `sim_${Date.now()}`,
      authorName: mockNames[simulatedCount % mockNames.length]!,
      caption: mockToasts[simulatedCount % mockToasts.length]!,
      kind: simulatedCount % 2 === 0 ? 'image' : 'text',
      accentColor: template.palette.accent,
      timeAgo: 'Just now',
    };

    setCustomPosts((prev) => ({
      ...prev,
      [activeItem.id]: [newPost, ...(prev[activeItem.id] ?? [])],
    }));
    setSimulatedCount((prev) => prev + 1);
    setActivePostIndex(0);
    setViewMode('wallboard');
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Full-Width Occasion Segmented Filter Bar */}
      <div className="flex flex-col items-center">
        <div
          role="tablist"
          aria-label="Event occasions"
          className="glass-strong flex w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl p-2 shadow-[var(--shadow-soft)] sm:gap-2 sm:rounded-[var(--radius-pill)] sm:p-2.5"
        >
          {showcaseItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const itemOccasion = occasionById(item.event.occasion);
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setSelectedIndex(idx);
                  setActivePostIndex(0);
                }}
                className={cn(
                  'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 sm:rounded-[var(--radius-pill)] sm:px-4 sm:py-2.5 sm:text-sm',
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-md ring-1 ring-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
                )}
              >
                <span className="text-sm sm:text-base" aria-hidden>
                  {itemOccasion.glyph}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-2.5 text-center text-xs font-medium text-[var(--text-secondary)] sm:text-sm">
          {activeItem.tagline}
        </p>
      </div>

      {/* 2. Interactive Phase Switcher: Invitation (Before) vs Live TV Wallboard (Night Of) */}
      <div className="flex justify-center">
        <div className="glass inline-flex items-center gap-1 rounded-[var(--radius-pill)] p-1.5 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setViewMode('invitation')}
            className={cn(
              'inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-5 py-2 text-xs font-bold transition-all duration-200 sm:text-sm',
              viewMode === 'invitation'
                ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            <span>💌</span>
            <span>1. The Invitation (Before Event)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('wallboard')}
            className={cn(
              'inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-5 py-2 text-xs font-bold transition-all duration-200 sm:text-sm',
              viewMode === 'wallboard'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
            )}
          >
            <span>📺</span>
            <span>2. Live TV Wallboard (On Event Night)</span>
          </button>
        </div>
      </div>

      {/* 3. Unified Full-Width Showcase Canvas */}
      <div className="card relative overflow-hidden p-6 sm:p-8 lg:p-10">
        {/* Dynamic ambient color backlight */}
        <div
          className="pointer-events-none absolute -top-24 -right-24 -z-10 size-96 rounded-full opacity-20 blur-3xl transition-all duration-700"
          style={{ background: template.palette.accent }}
          aria-hidden
        />

        <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
          {/* ============================================================ */}
          {/* LEFT COLUMN: Context & Interactive Triggers (5 cols)         */}
          {/* ============================================================ */}
          <div className="flex flex-col justify-between space-y-6 lg:col-span-5">
            {viewMode === 'invitation' ? (
              // --- Mode 1: Invitation Context ---
              <>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-3 py-1 text-xs font-semibold text-[var(--accent)] uppercase">
                    <span aria-hidden>{occasion.glyph}</span>
                    {occasion.label} Invitation
                  </div>

                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                    {activeItem.event.title}
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                    {activeItem.event.description}
                  </p>
                </div>

                {/* Structured Event Facts Grid */}
                <div className="grid grid-cols-2 gap-3 border-y border-[var(--border-subtle)] py-4 text-xs sm:text-sm">
                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      <Clock className="size-3.5 text-[var(--accent)]" /> When
                    </span>
                    <p className="font-medium text-[var(--text-primary)]">
                      {activeItem.event.startsAt
                        ? formatEventDate(activeItem.event.startsAt, activeItem.event.timeZone)
                        : 'Upcoming'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      <MapPin className="size-3.5 text-[var(--accent)]" /> Where
                    </span>
                    <p className="truncate font-medium text-[var(--text-primary)]">
                      {activeItem.event.location?.name ?? 'Private Venue'}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      <Users className="size-3.5 text-[var(--accent)]" /> Headcount
                    </span>
                    <p className="font-medium text-[var(--text-primary)]">
                      <strong>{activeItem.event.rsvpTally.attending}</strong> confirmed attending
                    </p>
                  </div>

                  <div className="space-y-1">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] uppercase">
                      <Sparkles className="size-3.5 text-[var(--accent)]" /> Design Theme
                    </span>
                    <p className="font-medium text-[var(--text-primary)]">
                      {template.label} ({template.surface})
                    </p>
                  </div>
                </div>

                {/* Feature Tags */}
                <div className="flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-sunken)] px-2.5 py-1">
                    <Radio className="size-3 text-emerald-500" /> Real-time RSVP Tracking
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-sunken)] px-2.5 py-1">
                    <Tv className="size-3 text-[var(--accent)]" /> TV Presentation Wall
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2.5 sm:flex-row">
                  <Link
                    href={`/create?occasion=${activeItem.event.occasion}&template=${activeItem.event.templateId}`}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                  >
                    Create this invitation
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setViewMode('wallboard')}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-5 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--accent-soft)]"
                  >
                    <Tv className="size-4 text-[var(--accent)]" />
                    Preview Live TV Wall
                  </button>
                </div>
              </>
            ) : (
              // --- Mode 2: Live TV Wallboard Context ---
              <>
                <div>
                  <div className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 uppercase">
                    <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
                    On Event Night: Presentation Mode
                  </div>

                  <h3 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
                    The same link becomes the room&apos;s live photo stream.
                  </h3>

                  <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)] sm:text-base">
                    Connect a laptop to any TV or projector at your venue. Guests scan the QR code
                    on screen to post photos, toasts, and memories instantly with{' '}
                    <strong>zero app download required</strong>.
                  </p>
                </div>

                {/* Interactive Simulator Trigger Box */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Interactive Live Simulator
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {currentPosts.length} posts cycling
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    Tap below to simulate a guest taking a photo at the party and watch it appear
                    live on the TV screen:
                  </p>

                  <button
                    type="button"
                    onClick={handleSimulatePost}
                    className="mt-3.5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-xs font-bold text-[var(--accent-contrast)] shadow-sm transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                  >
                    <Sparkles className="size-3.5" />⚡ Simulate Guest Photo Post
                  </button>
                </div>

                {/* TV Controls & Switch Back */}
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <button
                    type="button"
                    onClick={() => setViewMode('invitation')}
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    &larr; Back to Invitation Card view
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-sunken)] px-2.5 py-1 font-medium hover:bg-[var(--accent-soft)]"
                    >
                      {isAutoPlaying ? <Pause className="size-3" /> : <Play className="size-3" />}
                      {isAutoPlaying ? 'Pause Slideshow' : 'Play Slideshow'}
                    </button>
                  </div>
                </div>

                <div>
                  <Link
                    href={`/create?occasion=${activeItem.event.occasion}&template=${activeItem.event.templateId}`}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent)] px-6 text-sm font-semibold text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.98]"
                  >
                    Create your event wallboard
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* ============================================================ */}
          {/* RIGHT COLUMN: Interactive Stage (7 cols)                     */}
          {/* ============================================================ */}
          <div className="lg:col-span-7">
            {viewMode === 'invitation' ? (
              // --- Mode 1 Right: Framed Live Invitation Preview ---
              <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                <div className="scroll-soft max-h-[520px] overflow-y-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-page)] shadow-[var(--shadow-lift)] ring-1 ring-[var(--border-subtle)]/50 transition-all duration-300">
                  {/*
                    `h2` because this is a sample on a marketing page, not the page's subject.
                    Without it the landing page carries two level-1 headings — its own promise
                    and whatever the demo event happens to be called.
                  */}
                  <Invitation event={activeItem.event} titleAs="h2" />
                </div>
                <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
                  Scroll inside the card to preview the full invitation & RSVP details
                </p>
              </div>
            ) : (
              // --- Mode 2 Right: The Live TV Presentation Simulator ---
              <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
                {/* TV Hardware Bezel Frame */}
                <div className="overflow-hidden rounded-2xl border-4 border-zinc-800 bg-zinc-950 p-1 shadow-[var(--shadow-lift)] ring-2 ring-zinc-700/50">
                  <div
                    className="relative flex min-h-[460px] flex-col justify-between overflow-hidden rounded-xl p-5 text-white"
                    style={{
                      background: `linear-gradient(135deg, ${template.palette.from}33, ${template.palette.to}55), #09090b`,
                    }}
                  >
                    {/* Animated Ambient Texture Backdrop */}
                    <TemplateSurfaceField
                      surface={template.surface}
                      palette={template.palette}
                      className="pointer-events-none absolute inset-0 size-full opacity-40"
                    />

                    {/* TV Top Status Header Bar */}
                    <div className="relative z-10 flex items-center justify-between border-b border-white/10 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-2.5 animate-ping rounded-full bg-emerald-400" />
                        <span className="font-mono text-xs font-bold tracking-wider text-emerald-400 uppercase">
                          LIVE PRESENTATION MODE
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-300">
                        <span className="font-medium">{activeItem.event.title}</span>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 font-mono text-[11px]">
                          {activeItem.event.rsvpTally.attending} in the room
                        </span>
                      </div>
                    </div>

                    {/* Active Cycling Slide Content */}
                    <div className="relative z-10 my-auto py-6">
                      <div className="animate-in fade-in zoom-in-95 duration-500">
                        {activePost && (
                          <div className="card border-white/15 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur-xl">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className="flex size-10 items-center justify-center rounded-full font-bold text-white shadow-md"
                                  style={{ background: activePost.accentColor }}
                                >
                                  {activePost.authorName.charAt(0)}
                                </div>
                                <div>
                                  <p className="font-semibold text-white">
                                    {activePost.authorName}
                                  </p>
                                  <p className="text-xs text-zinc-400">{activePost.timeAgo}</p>
                                </div>
                              </div>

                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-medium text-rose-300">
                                <Heart className="size-3 fill-rose-400 text-rose-400" />
                                <span>Loved</span>
                              </span>
                            </div>

                            {/* Post Body */}
                            <div className="mt-4">
                              <p className="text-base leading-relaxed font-medium text-zinc-100 sm:text-lg">
                                &ldquo;{activePost.caption}&rdquo;
                              </p>
                            </div>

                            {/* Simulated Photo Thumbnail if image */}
                            {activePost.kind === 'image' && (
                              <div
                                className="relative mt-4 flex h-32 w-full items-center justify-center overflow-hidden rounded-xl shadow-inner"
                                style={{
                                  background: `linear-gradient(135deg, ${activePost.accentColor}44, #18181b)`,
                                }}
                              >
                                <div className="text-center text-zinc-300">
                                  <ImageIcon className="mx-auto size-7 opacity-80" />
                                  <span className="mt-1 block text-xs font-medium opacity-90">
                                    Live Guest Upload Photo
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* TV Bottom Bar: QR Code & Slide Progress */}
                    <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-white p-1 text-zinc-950 shadow">
                          <QrCode className="size-full" />
                        </div>
                        <div>
                          <p className="font-bold text-white">Scan to post photos</p>
                          <p className="text-[11px] text-zinc-400">
                            No app needed · marqueersvp.com/i/{activeItem.id.toUpperCase()}
                          </p>
                        </div>
                      </div>

                      {/* Slide dots */}
                      <div className="flex items-center gap-1.5">
                        {currentPosts.slice(0, 5).map((_, idx) => (
                          <span
                            key={idx}
                            className={cn(
                              'size-2 rounded-full transition-all duration-300',
                              idx === activePostIndex % currentPosts.length
                                ? 'w-5 bg-white'
                                : 'bg-white/30',
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
                  Live TV Presentation Preview · Auto-cycles posts every 4.5s
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

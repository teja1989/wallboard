'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Sparkles,
} from 'lucide-react';
import { occasionById, templateById } from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { Avatar } from '@/components/ui/avatar';
import { QrCode } from '@/components/ui/qr-code';
import { api, errorMessage } from '@/lib/client/api-client';
import { useWall, type WallPost } from '@/lib/client/use-wall';
import { formatJoinCode, invitationPath } from '@/lib/codes-format';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { EventDoc, EventRole } from '@/types/domain';

interface EventDetailResponse {
  event: EventDoc;
  role: EventRole | null;
  permissions: {
    canViewCode: boolean;
  };
}

const CYCLE_DURATION_MS = 7_000;

export function PresentationScreen({ eventId }: { eventId: string }) {
  const { actor, loading: authLoading, signInAsGuest } = useAuth();
  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [progress, setProgress] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load event details
  const loadEvent = useCallback(async () => {
    try {
      const result = await api.get<EventDetailResponse>(`/api/events/${eventId}`);
      setDetail(result);
      setLoadError(null);

      // If user has permission to read the join code, fetch it for the QR code
      if (result.permissions.canViewCode) {
        const codeRes = await api
          .get<{ code: string }>(`/api/events/${eventId}/code`)
          .catch(() => null);
        if (codeRes?.code) {
          setJoinCode(codeRes.code);
        }
      }
    } catch (caught) {
      setLoadError(errorMessage(caught, 'Could not load presentation.'));
    }
  }, [eventId]);

  useEffect(() => {
    if (authLoading) return;
    void (async () => {
      if (!actor) {
        await signInAsGuest();
        return;
      }
      await loadEvent();
    })();
  }, [authLoading, actor, signInAsGuest, loadEvent]);

  // Stream live wall posts
  const isMember = detail !== null && detail.role !== null;
  const { posts } = useWall(eventId, isMember);

  // Listen for fullscreen change
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Browser refused fullscreen request
    }
  }, []);

  // Post navigation
  const nextPost = useCallback(() => {
    if (posts.length === 0) return;
    setCurrentIndex((prev) => (prev + 1) % posts.length);
    setProgress(0);
  }, [posts.length]);

  const prevPost = useCallback(() => {
    if (posts.length === 0) return;
    setCurrentIndex((prev) => (prev - 1 + posts.length) % posts.length);
    setProgress(0);
  }, [posts.length]);

  // Keyboard shortcuts: Space (pause/play), Left/Right (nav), F (fullscreen)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPaused((p) => !p);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextPost();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevPost();
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        void toggleFullscreen();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextPost, prevPost, toggleFullscreen]);

  // Auto-cycle carousel
  useEffect(() => {
    if (isPaused || posts.length <= 1) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }

    const stepMs = 50;
    const totalSteps = CYCLE_DURATION_MS / stepMs;
    let currentStep = 0;

    progressIntervalRef.current = setInterval(() => {
      currentStep++;
      setProgress(Math.min(100, (currentStep / totalSteps) * 100));
      if (currentStep >= totalSteps) {
        currentStep = 0;
        nextPost();
      }
    }, stepMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPaused, posts.length, nextPost]);

  if (authLoading || (!detail && !loadError)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="size-8 animate-spin text-zinc-400" aria-label="Loading presentation" />
      </div>
    );
  }

  if (loadError || !detail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center text-white">
        <h1 className="text-2xl font-bold">Could not open Presentation Mode</h1>
        <p className="mt-2 text-zinc-400">{loadError}</p>
        <Link
          href={`/e/${eventId}`}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          <ArrowLeft className="size-4" /> Return to Event
        </Link>
      </div>
    );
  }

  const { event } = detail;
  const occasion = occasionById(event.occasion);
  const theme = templateById(event.templateId);
  const safeIndex = posts.length > 0 ? currentIndex % posts.length : 0;
  const activePost: WallPost | undefined = posts[safeIndex];
  const activeMedia = activePost?.resolvedMedia?.[0];
  const shareUrl = joinCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${invitationPath(joinCode)}`
    : null;

  return (
    <main className="relative flex h-screen w-screen flex-col overflow-hidden bg-zinc-950 font-sans text-white select-none">
      {/* Ambient background glow matching theme */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[600px] w-[800px] -translate-x-1/2 rounded-full opacity-20 blur-[140px]"
        style={{ background: theme.palette.accent }}
        aria-hidden
      />

      {/* Progress line */}
      {!isPaused && posts.length > 1 && (
        <div className="absolute top-0 left-0 z-30 h-1 w-full bg-zinc-900">
          <div
            className="h-full transition-all duration-75 ease-linear"
            style={{ width: `${progress}%`, backgroundColor: theme.palette.accent }}
          />
        </div>
      )}

      {/* Header bar */}
      <header className="relative z-20 flex h-20 shrink-0 items-center justify-between px-8 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <Link
            href={`/e/${eventId}`}
            className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            title="Exit Presentation Mode"
            aria-label="Exit Presentation Mode"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden>
                {occasion.glyph}
              </span>
              <h1 className="text-xl font-bold tracking-tight text-white">{event.title}</h1>
            </div>
            <p className="text-xs text-zinc-400">
              {event.hostedBy ? `Hosted by ${event.hostedBy} · ` : ''}
              {occasion.label}
            </p>
          </div>
        </div>

        {/* Live badge & counters */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 rounded-full bg-emerald-950/80 px-3.5 py-1.5 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/30">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live Guest Wall
          </div>

          <div className="text-sm font-medium text-zinc-400">
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
          </div>

          {/* Fullscreen & pause controls */}
          <div className="flex items-center gap-2">
            {posts.length > 1 && (
              <button
                type="button"
                onClick={() => setIsPaused((p) => !p)}
                className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                title={isPaused ? 'Resume auto-cycle (Space)' : 'Pause auto-cycle (Space)'}
                aria-label={isPaused ? 'Resume auto-cycle' : 'Pause auto-cycle'}
              >
                {isPaused ? <Play className="size-4 fill-white" /> : <Pause className="size-4" />}
              </button>
            )}
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="inline-flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
              title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
              aria-label={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Spotlight Area */}
      <div className="relative flex flex-1 items-center justify-center px-12 py-6">
        {posts.length === 0 ? (
          /* Empty state: Welcome + prominent QR Code */
          <div className="flex max-w-xl flex-col items-center text-center">
            <div className="mb-4 inline-flex size-16 items-center justify-center rounded-3xl bg-white/5 ring-1 ring-white/10">
              <Sparkles className="size-8 text-amber-300" />
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Welcome to the Wall!
            </h2>
            <p className="mt-3 text-base text-zinc-400">
              {occasion.wallPrompt || 'Share photos and messages for the big screen.'}
            </p>

            {shareUrl && (
              <div className="mt-8 flex flex-col items-center rounded-3xl bg-white p-6 text-zinc-950 shadow-2xl">
                <QrCode value={shareUrl} size={220} fgColor="#09090b" bgColor="#ffffff" />
                <p className="mt-4 text-sm font-semibold tracking-wide text-zinc-500 uppercase">
                  Scan to post
                </p>
                {joinCode && (
                  <p className="font-mono text-xs text-zinc-400">
                    Code: {formatJoinCode(joinCode)}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          /* Active post presentation */
          <div className="relative flex h-full w-full max-w-5xl items-center justify-center">
            <AnimatePresence mode="wait">
              {activePost && (
                <motion.div
                  key={activePost.id}
                  initial={{ opacity: 0, scale: 0.96, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.02, y: -12 }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="flex max-h-full w-full flex-col items-center justify-center"
                >
                  {/* Media Post vs Text Editorial Post */}
                  {activeMedia ? (
                    <div className="flex max-h-[72vh] w-full flex-col items-center justify-center">
                      <div className="relative max-h-[64vh] overflow-hidden rounded-3xl shadow-2xl ring-1 ring-white/10">
                        {activeMedia.kind === 'video' ? (
                          <video
                            src={activeMedia.url}
                            autoPlay
                            muted
                            loop
                            playsInline
                            className="max-h-[64vh] w-auto object-contain"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={activeMedia.url}
                            alt={activePost.body || 'Post image'}
                            className="max-h-[64vh] w-auto object-contain"
                          />
                        )}
                      </div>

                      {/* Author & Caption */}
                      <div className="mt-4 flex max-w-2xl items-center gap-3 rounded-full bg-black/60 px-5 py-2.5 ring-1 ring-white/10 backdrop-blur-md">
                        <Avatar
                          name={activePost.authorName}
                          photoUrl={activePost.authorPhotoUrl}
                          size={32}
                        />
                        <div className="min-w-0 text-left">
                          <p className="truncate text-sm font-semibold text-white">
                            {activePost.authorName}
                          </p>
                          {activePost.body && (
                            <p className="line-clamp-1 text-xs text-zinc-300">{activePost.body}</p>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-zinc-500">
                          {formatRelativeTime(activePost.createdAt)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    /* Text-Only Editorial Post */
                    <div className="flex max-w-2xl flex-col items-center rounded-3xl bg-white/5 p-10 text-center shadow-2xl ring-1 ring-white/10 backdrop-blur-xl">
                      <Avatar
                        name={activePost.authorName}
                        photoUrl={activePost.authorPhotoUrl}
                        size={56}
                      />
                      <p className="mt-4 text-base font-semibold text-white">
                        {activePost.authorName}
                      </p>
                      <blockquote className="mt-6 text-2xl leading-relaxed font-medium text-zinc-100 sm:text-3xl">
                        “{activePost.body}”
                      </blockquote>
                      <p className="mt-6 text-xs text-zinc-500">
                        {formatRelativeTime(activePost.createdAt)}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Left / Right Carousel Controls */}
            {posts.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prevPost}
                  className="absolute left-0 inline-flex size-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"
                  aria-label="Previous post"
                >
                  <ChevronLeft className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={nextPost}
                  className="absolute right-0 inline-flex size-12 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/25"
                  aria-label="Next post"
                >
                  <ChevronRight className="size-6" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Floating Corner QR Code (bottom-right) */}
      {shareUrl && posts.length > 0 && (
        <aside
          className="absolute right-8 bottom-8 z-30 flex items-center gap-3.5 rounded-2xl bg-white p-3.5 text-zinc-950 shadow-2xl ring-2 ring-white/20"
          aria-label="Scan to post"
        >
          <QrCode value={shareUrl} size={84} fgColor="#09090b" bgColor="#ffffff" />
          <div className="pr-1 text-left">
            <p className="text-xs font-extrabold tracking-wide text-zinc-800 uppercase">
              Scan to post
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Photos & wishes</p>
            {joinCode && (
              <p className="mt-1.5 font-mono text-[10px] font-semibold text-zinc-600">
                {formatJoinCode(joinCode)}
              </p>
            )}
          </div>
        </aside>
      )}

      {/* Carousel dots */}
      {posts.length > 1 && (
        <footer className="relative z-20 flex h-14 shrink-0 items-center justify-center gap-1.5 pb-4">
          {posts.slice(0, 16).map((post, idx) => (
            <button
              key={post.id}
              type="button"
              onClick={() => {
                setCurrentIndex(idx);
                setProgress(0);
              }}
              className={cn(
                'h-1.5 rounded-full transition-all duration-200',
                idx === safeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/20 hover:bg-white/40',
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
          {posts.length > 16 && (
            <span className="text-[10px] text-zinc-500">+{posts.length - 16} more</span>
          )}
        </footer>
      )}
    </main>
  );
}

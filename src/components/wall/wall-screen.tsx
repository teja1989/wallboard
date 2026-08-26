'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Clock, Loader2, Settings2, Sparkles, Users } from 'lucide-react';
import { themeById } from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { HostPanel } from '@/components/event/host-panel';
import { Composer } from '@/components/wall/composer';
import { Lightbox } from '@/components/wall/lightbox';
import { PostCard } from '@/components/wall/post-card';
import { api, errorMessage } from '@/lib/client/api-client';
import { useWall } from '@/lib/client/use-wall';
import { formatTimeRemaining } from '@/lib/utils';
import type { EventDoc, EventRole, ResolvedMedia } from '@/types/domain';

interface EventResponse {
  event: EventDoc;
  role: EventRole | null;
  permissions: {
    canPost: boolean;
    canModerate: boolean;
    canManage: boolean;
    canViewCode: boolean;
  };
}

export function WallScreen({ eventId }: { eventId: string }) {
  const { actor, loading: authLoading, isAnonymous, signInAsGuest } = useAuth();
  const [detail, setDetail] = useState<EventResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hostPanelOpen, setHostPanelOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<ResolvedMedia | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const loadEvent = useCallback(async () => {
    try {
      setDetail(await api.get<EventResponse>(`/api/events/${eventId}`));
      setLoadError(null);
    } catch (caught) {
      setLoadError(errorMessage(caught, 'This wall could not be opened.'));
    }
  }, [eventId]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    void (async () => {
      // A visitor arriving straight from a shared link has no identity yet; give them an
      // anonymous one so the wall's listeners have something to authorize.
      if (!actor) {
        await signInAsGuest();
        return;
      }
      if (!cancelled) await loadEvent();
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, actor, signInAsGuest, loadEvent]);

  // Drives the countdown chip. A minute is plenty — the chip is coarse by design.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const isMember = detail !== null && detail.role !== null;
  const { posts, loading: wallLoading, error: wallError } = useWall(eventId, isMember);

  if (authLoading || (!detail && !loadError)) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-5 animate-spin text-[var(--text-muted)]" aria-label="Loading" />
      </main>
    );
  }

  if (loadError || !detail) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold">We could not open that wall</h1>
        <p className="mt-2 text-[var(--text-secondary)]">{loadError}</p>
        <Link
          href="/join"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-[var(--radius-pill)] bg-[var(--accent)] px-6 text-sm font-medium text-[var(--accent-contrast)]"
        >
          Enter a code
        </Link>
      </main>
    );
  }

  const { event, permissions } = detail;
  const theme = themeById(event.themeId);
  const isLive = event.status === 'live';

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 opacity-45 blur-3xl"
        style={{ background: `linear-gradient(120deg, ${theme.from}, ${theme.to})` }}
      />

      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 sm:px-6">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-3xl font-semibold tracking-tight">{event.title}</h1>
              {event.description && (
                <p className="mt-1.5 text-[var(--text-secondary)]">{event.description}</p>
              )}
            </div>
            {permissions.canManage && (
              <button
                type="button"
                onClick={() => setHostPanelOpen(true)}
                aria-label="Host controls"
                className="glass inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105"
              >
                <Settings2 className="size-4" aria-hidden />
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Chip icon={<Users className="size-3.5" aria-hidden />}>
              {event.memberCount} {event.memberCount === 1 ? 'person' : 'people'}
            </Chip>
            <Chip icon={<Clock className="size-3.5" aria-hidden />}>
              {isLive
                ? formatTimeRemaining(event.expiresAt, now)
                : `This event has ${event.status}`}
            </Chip>
          </div>
        </header>

        {isLive && permissions.canPost && (
          <div className="mb-6">
            <Composer
              eventId={eventId}
              allowedKinds={event.settings.allowedKinds}
              onPosted={loadEvent}
            />
          </div>
        )}

        {isLive && !permissions.canPost && isAnonymous && (
          <div className="mb-6">
            <SignInPrompt
              compact
              title="Join in"
              body="You are watching as a guest. Sign in to add your own photos, video and messages — you keep everything you have already seen."
            />
          </div>
        )}

        {!isLive && (
          <div className="card mb-6 p-5 text-center">
            <p className="font-medium">This wall is closed</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Nothing new can be posted. The photos and video are removed shortly after.
            </p>
          </div>
        )}

        {wallError && (
          <p role="alert" className="mb-4 text-sm text-[var(--danger)]">
            The live feed dropped out. Refresh to reconnect.
          </p>
        )}

        {wallLoading ? (
          <div className="flex justify-center py-16">
            <Loader2
              className="size-5 animate-spin text-[var(--text-muted)]"
              aria-label="Loading posts"
            />
          </div>
        ) : posts.length === 0 ? (
          <EmptyWall canPost={isLive && permissions.canPost} />
        ) : (
          // CSS columns rather than a JS masonry library: it reflows natively and costs
          // nothing on the main thread while posts stream in.
          <div className="columns-1 gap-4 sm:columns-2">
            <AnimatePresence initial={false}>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  eventId={eventId}
                  canDelete={permissions.canModerate || post.authorUid === actor?.uid}
                  onOpenImage={setLightboxMedia}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <Lightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
      <HostPanel
        eventId={eventId}
        open={hostPanelOpen}
        onClose={() => setHostPanelOpen(false)}
        onChanged={loadEvent}
      />
    </>
  );
}

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="glass inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5">
      {icon}
      {children}
    </span>
  );
}

function EmptyWall({ canPost }: { canPost: boolean }) {
  return (
    <div className="flex flex-col items-center py-20 text-center">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <Sparkles className="size-6" aria-hidden />
      </span>
      <p className="font-medium">Nothing here yet</p>
      <p className="mt-1 max-w-xs text-sm text-[var(--text-secondary)]">
        {canPost ? 'Be the first to post something.' : 'Check back once people start posting.'}
      </p>
    </div>
  );
}

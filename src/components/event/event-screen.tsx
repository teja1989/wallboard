'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import { Clock, Loader2, Settings2, Sparkles, Tv, Users } from 'lucide-react';
import { brand, featureFlags, occasionById, templateById } from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { GiftList } from '@/components/event/gift-list';
import { GiftListPanel } from '@/components/event/gift-list-panel';
import { GuestList } from '@/components/event/guest-list';
import { HostPanel } from '@/components/event/host-panel';
import { InvitePanel } from '@/components/event/invite-panel';
import { Invitation } from '@/components/event/invitation';
import { PlanPanel } from '@/components/event/plan-panel';
import { RsvpCard } from '@/components/event/rsvp-card';
import { Composer } from '@/components/wall/composer';
import { Lightbox } from '@/components/wall/lightbox';
import { PostCard } from '@/components/wall/post-card';
import { api, errorMessage } from '@/lib/client/api-client';
import { useWall } from '@/lib/client/use-wall';
import { cn, formatTimeRemaining } from '@/lib/utils';
import type { EventDoc, EventRole, ResolvedMedia, RsvpStatus } from '@/types/domain';

interface EventResponse {
  event: EventDoc;
  role: EventRole | null;
  confirmedAttendees?: { displayName: string; photoUrl: string | null }[];
  rsvp: { status: RsvpStatus; partySize: number; adults: number; children: number };
  permissions: {
    canPost: boolean;
    canModerate: boolean;
    canManage: boolean;
    canViewCode: boolean;
    canExportGuests: boolean;
    canAssignRole?: boolean;
    canDelete?: boolean;
  };
}

type Section = 'invite' | 'wall' | 'guests' | 'plan';

/**
 * The tabs, in the order they matter to whoever is looking.
 *
 * `Plan` is host-only and last, because it is the one section a guest has no business seeing
 * and the one a host reaches for least often — the invitation and the replies are what they
 * open the page for.
 */
const SECTIONS: readonly { id: Section; label: string; hostOnly?: boolean }[] = [
  { id: 'invite', label: 'Invitation' },
  { id: 'wall', label: 'Wall' },
  { id: 'guests', label: 'Guests' },
  { id: 'plan', label: 'Plan', hostOnly: true },
];

/**
 * The event, in three parts.
 *
 * Invitation, wall and guest list are one page rather than three routes because they are
 * one thing to the person looking at them — and because a guest who arrives, replies and
 * then wants to see the photos should never have to navigate anywhere.
 *
 * The section that opens first follows the event, not the viewer: before the day, the
 * details are what anyone came for — the host included, who has just made the thing and
 * wants to see it. Once it has started, or once anyone has posted, the wall is the point.
 */
export function EventScreen({ eventId }: { eventId: string }) {
  const { actor, loading: authLoading, isAnonymous, signInAsGuest } = useAuth();

  const [detail, setDetail] = useState<EventResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [hostPanelOpen, setHostPanelOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<ResolvedMedia | null>(null);
  const [guestRefreshKey, setGuestRefreshKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const loadEvent = useCallback(async () => {
    try {
      const next = await api.get<EventResponse>(`/api/events/${eventId}`);
      setDetail(next);
      setLoadError(null);
      // Only chosen once; after that the visitor's own navigation wins.
      setSection((current) => current ?? requestedSection() ?? openingSection(next));
    } catch (caught) {
      setLoadError(errorMessage(caught, 'This invitation could not be opened.'));
    }
  }, [eventId]);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    void (async () => {
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const isMember = detail !== null && detail.role !== null;
  const { posts, loading: wallLoading, error: wallError } = useWall(eventId, isMember);

  const onAnswered = useCallback(() => {
    setGuestRefreshKey((key) => key + 1);
    void loadEvent();
  }, [loadEvent]);

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
        <h1 className="text-2xl font-semibold">We could not open that invitation</h1>
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

  const { event, permissions, rsvp } = detail;
  const theme = templateById(event.templateId);
  const occasion = occasionById(event.occasion);
  const isLive = event.status === 'live';
  const active = section ?? 'invite';

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-72 opacity-45 blur-3xl"
        style={{
          background: `linear-gradient(120deg, ${theme.palette.from}, ${theme.palette.to})`,
        }}
      />

      <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-24 sm:px-6">
        <header className="mb-5 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm font-semibold tracking-tight">
            {brand.name}
          </Link>
          <div className="flex items-center gap-2">
            <span className="glass inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-sm text-[var(--text-secondary)]">
              <Users className="size-3.5" aria-hidden />
              {event.rsvpTally.attending}
            </span>
            {permissions.canManage && (
              <button
                type="button"
                onClick={() => setHostPanelOpen(true)}
                aria-label="Host controls"
                className="glass inline-flex size-10 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105"
              >
                <Settings2 className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </header>

        <nav
          aria-label="Event sections"
          className="glass mb-6 flex gap-1 rounded-[var(--radius-pill)] p-1"
        >
          {SECTIONS.filter((tab) => !tab.hostOnly || permissions.canManage).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-current={active === tab.id ? 'page' : undefined}
              onClick={() => setSection(tab.id)}
              className={cn(
                'flex-1 rounded-[var(--radius-pill)] px-3 py-2 text-sm font-medium transition-all duration-200 sm:px-4',
                active === tab.id
                  ? 'bg-[var(--surface-raised)] text-[var(--text-primary)] shadow-[var(--shadow-soft)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {active === 'invite' && (
          <div className="space-y-5">
            <Invitation event={event} />
            <RsvpCard
              event={event}
              status={rsvp.status}
              adults={rsvp.adults}
              childGuests={rsvp.children}
              confirmedAttendees={detail.confirmedAttendees}
              onAnswered={onAnswered}
              // Somebody who has just replied — including somebody who cannot come — is one
              // tap from the wall rather than at the end of the road.
              onOpenWall={() => setSection('wall')}
            />
            {/*
              Under the reply rather than above it. Somebody who has not yet said whether they
              are coming is not thinking about presents, and putting a gift list between the
              invitation and the RSVP is how an invitation starts to read like an invoice.
            */}
            <GiftList eventId={eventId} />
            {isAnonymous && (
              <SignInPrompt
                compact
                title="Want to post photos too?"
                body="You can reply to the invitation as you are. Signing in lets you add photos, video and messages to the wall — and you keep everything you have already done."
              />
            )}
          </div>
        )}

        {active === 'wall' && (
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span className="glass inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5">
                <Clock className="size-3.5" aria-hidden />
                {isLive
                  ? `Wall closes ${formatTimeRemaining(event.expiresAt, now).replace(' left', '')} from now`
                  : `This event has ${event.status}`}
              </span>
              {featureFlags.presentationMode && (
                <Link
                  href={`/e/${eventId}/present`}
                  className="glass inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--accent-soft)]"
                  title="Open full-screen presentation mode for venue projectors"
                >
                  <Tv className="size-3.5" aria-hidden />
                  Projector view
                </Link>
              )}
            </div>

            {isLive && permissions.canPost && (
              <div className="mb-6">
                <Composer
                  eventId={eventId}
                  allowedKinds={event.settings.allowedKinds}
                  placeholder={occasion.wallPrompt}
                  onPosted={loadEvent}
                />
              </div>
            )}

            {isLive && !permissions.canPost && isAnonymous && (
              <div className="mb-6">
                <SignInPrompt
                  compact
                  title="Join in"
                  body="You are watching as a guest. Sign in to add your own photos, video and messages."
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
              // CSS columns rather than a JS masonry library: it reflows natively and
              // costs nothing on the main thread while posts stream in.
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
          </div>
        )}

        {active === 'guests' && (
          <div className="space-y-6">
            {/*
              Inviting people and seeing who replied are one job, and they used to live in
              two places: the guest list here, the list of who had been invited buried in a
              384px drawer between "add time" and "delete everything". A host chasing four
              non-repliers had to hold both in their head at once.

              Only the host sees the invite half — everyone else sees the replies, which is
              what this tab has always shown them.
            */}
            {permissions.canManage && (
              <>
                <InvitePanel
                  eventId={eventId}
                  eventTitle={event.title}
                  hostedBy={event.hostedBy || event.hostName}
                  tally={event.rsvpTally}
                  autoRemind={event.rsvp.autoRemind === true}
                  onEventChanged={loadEvent}
                />
                {/*
                  The gift list is managed beside the guest list rather than in the host drawer,
                  because it is a thing a host does *to* their guests and belongs where they are
                  already thinking about them. It renders nothing on occasions where gifts would
                  be a faux pas — a work offsite, a memorial.
                */}
                <GiftListPanel eventId={eventId} />
              </>
            )}
            <GuestList
              eventId={eventId}
              canExport={permissions.canExportGuests}
              canAssignRole={permissions.canAssignRole ?? false}
              onMemberRoleChanged={loadEvent}
              refreshKey={guestRefreshKey}
            />
          </div>
        )}

        {/* Guarded as well as hidden: the tab is not rendered for a guest, and the route
            behind it answers 404 to anyone who is not the host. */}
        {active === 'plan' && permissions.canManage && <PlanPanel event={event} />}
      </main>

      <Lightbox media={lightboxMedia} onClose={() => setLightboxMedia(null)} />
      <HostPanel
        eventId={eventId}
        title={event.title}
        plan={event.plan}
        canDelete={permissions.canDelete ?? false}
        open={hostPanelOpen}
        onClose={() => setHostPanelOpen(false)}
        onChanged={loadEvent}
      />
    </>
  );
}

/** Which section to show on first load. See the note on the component. */
/**
 * A section named in the URL, as `?tab=guests`.
 *
 * How the create flow hands a host straight to their guest list after publishing, rather
 * than dropping them on the invitation and hoping they find the tab. Read once, and only as
 * a starting point — every navigation after it is the visitor's.
 *
 * Read from `window` rather than `useSearchParams` deliberately: this runs inside a callback
 * after data loads, not during render, and the hook would opt the whole page into a
 * suspense boundary for a value that is wanted exactly once.
 */
function requestedSection(): Section | null {
  if (typeof window === 'undefined') return null;
  const tab = new URLSearchParams(window.location.search).get('tab');
  return SECTIONS.some((section) => section.id === tab) ? (tab as Section) : null;
}

function openingSection(detail: EventResponse): Section {
  const { event } = detail;

  // Once the event has started, the wall is what people came back for.
  if (event.startsAt !== null) {
    return event.startsAt <= Date.now() ? 'wall' : 'invite';
  }

  // With no date set, there is nothing to be "before", so let activity decide. Excited
  // messages arriving days early must not bury the details on a dated invitation, which is
  // why this only applies when there is no date at all.
  return event.postCount > 0 ? 'wall' : 'invite';
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

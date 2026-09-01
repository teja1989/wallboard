'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AddressField } from '@/components/create/address-field';
import Link from 'next/link';
import { ArrowLeft, Check, Copy, Lock, PartyPopper, Share2, Users } from 'lucide-react';
import {
  POST_KINDS,
  brand,
  contentLimits,
  defaultExpiryPresetId,
  defaultOccasionId,
  templates,
  expiryPresets,
  occasionById,
  occasions,
  createGate,
  partySizeChoices,
  activePromo,
  promoCopy,
  planById,
  type PostKind,
} from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { Button } from '@/components/ui/button';
import { InvitationPreview } from '@/components/create/invitation-preview';
import { TemplatePicker } from '@/components/event/template-picker';
import { TextAreaField, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import {
  canUseExpiryPreset,
  canUseTemplate,
  grantedPlanForNewEvent,
} from '@/lib/billing/entitlements';
import { api, errorMessage } from '@/lib/client/api-client';
import { clearDraft, loadDraft, saveDraft } from '@/lib/client/event-draft';
import { formatJoinCode, invitationPath } from '@/lib/codes-format';
import { cn, fromDateTimeLocalValue } from '@/lib/utils';
import type { EventPreview } from '@/types/domain';

const KIND_LABELS: Record<PostKind, string> = {
  text: 'Messages',
  image: 'Photos',
  video: 'Video',
  audio: 'Voice notes',
};

/**
 * Creating an invitation.
 *
 * Occasion comes first and does real work: it picks the theme, decides whether to offer a
 * dress-code field, and sets the words on the rest of the form. Everything after the title
 * is optional, so a host in a hurry can be done in fifteen seconds and a host planning a
 * wedding can fill in every field.
 *
 * Paid choices are shown, not hidden. A theme nobody can see is a theme nobody upgrades
 * for; a locked one they can see is the whole pitch.
 *
 * Anyone can build one; the account is asked for at publish. Hosting genuinely does need
 * a durable identity — the host alone can delete the event, read private replies and
 * rotate the code, and an anonymous session lives in browser storage that a cleared cookie
 * takes with it. But none of that is true of a form nobody has submitted, and demanding
 * identity before showing anything is a wall in front of an unseen product. Asked at
 * publish, the same question answers itself: sign in so that only you can change this.
 *
 * The uid survives the upgrade — `linkWithCredential` keeps it — so the draft stays the
 * same person's. The email-link path leaves the site for an inbox, which is why the draft
 * is persisted before the link is sent and resumed on the way back.
 */
/**
 * The zone the host's browser is in.
 *
 * Read at publish rather than kept in the draft on purpose: someone who starts an
 * invitation on a laptop in London and finishes it in New York means the zone they are in
 * when they press publish, not the one they were in when they started typing.
 */
function browserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

export default function CreateEventPage() {
  const router = useRouter();
  const { notify } = useToast();
  const { actor, loading, isAnonymous } = useAuth();

  const [occasionId, setOccasionId] = useState<string>(defaultOccasionId);
  const [title, setTitle] = useState('');
  const [hostedBy, setHostedBy] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [shownTimeZone, setShownTimeZone] = useState<string | null>(null);
  const [locationName, setLocationName] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [latLng, setLatLng] = useState<{ lat: number; lng: number } | null>(null);
  /**
   * The venue's own timezone, when a place was chosen.
   *
   * Beats the host's browser: someone in London booking a wedding in Goa means Goa, and
   * their laptop has no way to know that.
   */
  const [venueZone, setVenueZone] = useState<string | null>(null);
  const [dressCode, setDressCode] = useState('');
  const [templateId, setTemplateId] = useState<string>(
    occasionById(defaultOccasionId).defaultTemplateId,
  );
  const [templateTouched, setTemplateTouched] = useState(false);
  const [expiryPresetId, setExpiryPresetId] = useState<string>(defaultExpiryPresetId);
  const [allowedKinds, setAllowedKinds] = useState<PostKind[]>([...POST_KINDS]);
  // How many people a reply may cover in total, the guest included. A boolean here used to
  // mean "one extra" without ever saying so — a host who wanted couples with a child had
  // no way to express it, and the guest had no way to tell us.
  const [maxPartySize, setMaxPartySize] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ event: EventPreview; joinCode: string } | null>(null);
  /** Set when publish was pressed without an account: the form yields to the sign-in step. */
  const [needsAccount, setNeedsAccount] = useState(false);
  const [restored, setRestored] = useState(false);
  /** Whether they chose to look around before signing in. Session-scoped. */
  const [browsing, setBrowsing] = useState(false);
  const resumed = useRef(false);

  // Same reason as the effect below: the server runs in UTC and has no idea what zone the
  // host is in, so resolving it during render would hydrate to a different tree.
  useEffect(() => {
    // In an async callback, matching the effect below: `react-hooks/set-state-in-effect`
    // refuses a synchronous setState here, and it is right to.
    void (async () => {
      setShownTimeZone(browserTimeZone());
    })();
  }, []);

  // Read after mount, never during render: sessionStorage does not exist on the server, and
  // reading it in an initialiser would hydrate to a different tree than the server sent.
  useEffect(() => {
    // In an async callback, not the effect body: a synchronous setState during an effect
    // cascades renders, and the lint rule that says so has caught real bugs here already.
    void (async () => {
      try {
        if (window.sessionStorage.getItem(createGate.browseKey) === 'yes') setBrowsing(true);

        const urlParams = new URLSearchParams(window.location.search);
        const urlOccasion = urlParams.get('occasion');
        const urlTemplate = urlParams.get('template');
        if (urlOccasion && occasions.some((o) => o.id === urlOccasion)) {
          setOccasionId(urlOccasion);
        }
        if (urlTemplate && templates.some((t) => t.id === urlTemplate)) {
          setTemplateId(urlTemplate);
          setTemplateTouched(true);
        }
      } catch {
        // Storage denied. They are asked once more, which is the harmless direction.
      }
    })();
  }, []);

  const lookAround = useCallback(() => {
    setBrowsing(true);
    try {
      window.sessionStorage.setItem(createGate.browseKey, 'yes');
    } catch {
      // As above.
    }
  }, []);

  const occasion = useMemo(() => occasionById(occasionId), [occasionId]);

  // What a new event of this occasion would actually be created on — preview pricing while
  // billing is off, plus any promo running today. Asked rather than assumed, because a form
  // that greys out a theme the server would have accepted is worse than no lock at all.
  const planId = useMemo(() => grantedPlanForNewEvent(occasionId), [occasionId]);

  /*
    Why the plan is what it is. The grant was resolved silently and recorded in the audit log,
    so a host got a free upgrade and was never told — and a promo nobody notices attracts
    nobody, which is the only reason to run one.
  */
  const promo = useMemo(() => activePromo(occasionId), [occasionId]);

  /**
   * The same fields, shaped the way the real invitation component wants them, so the preview
   * is the actual card rather than a drawing of one. Rebuilt on every keystroke, which is
   * cheap: it is a plain object and the component below it is pure.
   */
  const previewDraft = useMemo(
    () => ({
      occasionId,
      title,
      hostedBy,
      description,
      startsAt: fromDateTimeLocalValue(startsAt),
      timeZone: venueZone ?? browserTimeZone(),
      locationName,
      locationAddress,
      placeId,
      lat: latLng?.lat ?? null,
      lng: latLng?.lng ?? null,
      dressCode,
      templateId,
      maxPartySize,
      allowedKinds,
      planId,
    }),
    [
      occasionId,
      title,
      hostedBy,
      description,
      startsAt,
      venueZone,
      locationName,
      locationAddress,
      placeId,
      latLng,
      dressCode,
      templateId,
      maxPartySize,
      allowedKinds,
      planId,
    ],
  );
  const lockedTemplateCount = templates.filter((t) => !canUseTemplate(planId, t.id)).length;

  function chooseOccasion(id: string) {
    setOccasionId(id);
    // Only follow the occasion's theme until the host expresses their own preference.
    if (!templateTouched) setTemplateId(occasionById(id).defaultTemplateId);
  }

  function toggleKind(kind: PostKind) {
    setAllowedKinds((current) =>
      current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind],
    );
  }

  /** The form, in the shape the draft store keeps it. */
  const draftFields = useMemo(
    () => ({
      occasionId,
      title,
      hostedBy,
      description,
      startsAt,
      locationName,
      locationAddress,
      dressCode,
      templateId,
      templateTouched,
      expiryPresetId,
      allowedKinds,
      maxPartySize,
    }),
    [
      occasionId,
      title,
      hostedBy,
      description,
      startsAt,
      locationName,
      locationAddress,
      dressCode,
      templateId,
      templateTouched,
      expiryPresetId,
      allowedKinds,
      maxPartySize,
    ],
  );

  const publish = useCallback(
    async (fields: typeof draftFields) => {
      setError(null);
      setSubmitting(true);
      try {
        const result = await api.post<{ event: EventPreview; joinCode: string }>(
          '/api/events/create',
          {
            title: fields.title,
            description: fields.description,
            occasion: fields.occasionId,
            hostedBy: fields.hostedBy,
            templateId: fields.templateId,
            startsAt: fromDateTimeLocalValue(fields.startsAt),
            endsAt: null,
            // The time the host typed is the time in the zone they typed it in. Recording
            // that is what stops a guest a state away being told the wrong hour — and what
            // stops the emailed invitation, rendered on a server running UTC, telling
            // everybody the wrong hour.
            // The venue's zone when we know it, the host's browser otherwise.
            timeZone: venueZone ?? browserTimeZone(),
            location:
              fields.locationName || fields.locationAddress
                ? {
                    name: fields.locationName,
                    address: fields.locationAddress,
                    url: null,
                    placeId,
                    lat: latLng?.lat ?? null,
                    lng: latLng?.lng ?? null,
                  }
                : null,
            dressCode: fields.dressCode,
            rsvp: {
              enabled: true,
              deadline: null,
              allowPlusOnes: fields.maxPartySize > 1,
              maxPartySize: fields.maxPartySize,
              askNote: false,
              question: null,
            },
            expiryPresetId: fields.expiryPresetId,
            allowedKinds: fields.allowedKinds,
          },
        );
        // Published: the draft has served its purpose and the event is the record now.
        clearDraft();
        setCreated(result);
      } catch (caught) {
        setError(errorMessage(caught, 'Could not create the invitation.'));
      } finally {
        setSubmitting(false);
      }
      // The chosen place is read from the closure, so it has to be a dependency: without
      // these, publishing after picking a venue would send the coordinates from whenever this
      // callback was last built, which is to say none.
    },
    [placeId, latLng, venueZone],
  );

  /**
   * The gate, at the only point it earns its place. An anonymous host keeps their work:
   * the draft is written before anything can navigate away, and picked up again below.
   */
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!actor || isAnonymous) {
      saveDraft({ ...draftFields, pendingPublish: true });
      setNeedsAccount(true);
      return;
    }
    void publish(draftFields);
  }

  /**
   * Keep the work, continuously.
   *
   * Not only for the sign-in trip: a closed tab, a refresh, or a phone that drops the page
   * to reclaim memory all cost a host everything they had typed. `pendingPublish` stays
   * false here — this is a draft someone is still writing, and coming back to it later
   * must never send it on its own.
   */
  useEffect(() => {
    if (created || needsAccount || !title.trim()) return;
    saveDraft({ ...draftFields, pendingPublish: false });
  }, [draftFields, created, needsAccount, title]);

  /**
   * Coming back from an email link, in a new tab, with the form empty.
   *
   * Restores what was typed and finishes the job they already asked for — they pressed
   * publish before being interrupted, so making them press it a second time is asking
   * twice for one decision. Runs once, and only when there is genuinely a session.
   */
  useEffect(() => {
    if (loading || resumed.current) return;
    if (!actor || isAnonymous) return;

    resumed.current = true;
    void (async () => {
      const draft = loadDraft();
      if (!draft) return;

      setOccasionId(draft.occasionId);
      setTitle(draft.title);
      setHostedBy(draft.hostedBy);
      setDescription(draft.description);
      setStartsAt(draft.startsAt);
      setLocationName(draft.locationName);
      setLocationAddress(draft.locationAddress);
      setDressCode(draft.dressCode);
      setTemplateId(draft.templateId);
      setTemplateTouched(draft.templateTouched);
      setExpiryPresetId(draft.expiryPresetId);
      setAllowedKinds(draft.allowedKinds);
      setMaxPartySize(draft.maxPartySize);
      setNeedsAccount(false);
      setRestored(true);

      // Only auto-publish what publish was already pressed on. A draft merely left behind
      // is restored and left alone, so nobody's half-written invitation goes out because
      // they signed in for some other reason.
      if (draft.pendingPublish && draft.title.trim() && draft.allowedKinds.length > 0) {
        await publish({
          occasionId: draft.occasionId,
          title: draft.title,
          hostedBy: draft.hostedBy,
          description: draft.description,
          startsAt: draft.startsAt,
          locationName: draft.locationName,
          locationAddress: draft.locationAddress,
          dressCode: draft.dressCode,
          templateId: draft.templateId,
          templateTouched: draft.templateTouched,
          expiryPresetId: draft.expiryPresetId,
          allowedKinds: draft.allowedKinds,
          maxPartySize: draft.maxPartySize,
        });
      }
    })();
  }, [actor, isAnonymous, loading, publish]);

  /**
   * The front door.
   *
   * An account asked for here is the one that comes back — the whole point of having one is
   * that a host finds their invitations again on another device, and that only works if the
   * account exists. With Google it is a single tap and the page never leaves, so the cost of
   * asking early is now small enough to be worth the retention.
   *
   * But a wall in front of an unseen product loses the merely curious, and the merely
   * curious are the same people. So there is a way past, stated plainly rather than hidden,
   * and the form behind it works exactly as it did — the account is simply asked for again
   * at publish, where it is no longer optional.
   */
  // Nothing decides until identity has: rendering the form first and replacing it with the
  // sign-in card a moment later shows someone the thing they wanted and then takes it away.
  if (loading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">One moment…</p>
      </main>
    );
  }

  const signedIn = actor && !isAnonymous;
  if (!signedIn && !browsing && !created) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 text-center">
        <Link
          href="/"
          className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-bold text-[var(--text-primary)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
        >
          <ArrowLeft className="size-3.5" />
          Back to Home
        </Link>
        <SignInPrompt
          title="Make an invitation"
          body="Sign in so your invitation is yours — to edit, to see replies on, and to find again on any device."
          returnTo="/create"
          onSignedIn={() => undefined}
        />
        <button
          type="button"
          onClick={lookAround}
          className="mx-auto mt-6 text-sm text-[var(--text-muted)] underline underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
        >
          Have a look around first
        </button>
      </main>
    );
  }

  /**
   * The ask, at the moment it stops being optional. The host has already built the thing;
   * what is being requested is a way to keep it theirs, which is a reason rather than a toll.
   */
  if (needsAccount) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 text-center">
        <button
          type="button"
          onClick={() => setNeedsAccount(false)}
          className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-bold text-[var(--text-primary)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
        >
          <ArrowLeft className="size-3.5" />
          Back to editing
        </button>
        <SignInPrompt
          title="Almost there"
          body={`Sign in and “${title.trim()}” goes out. It takes an account because you are the only one who should be able to change it, delete it, or read what your guests write to you privately.`}
          note="Your invitation is saved — signing in will not lose it."
          returnTo="/create"
          onSignedIn={() => {
            setNeedsAccount(false);
            void publish(draftFields);
          }}
        />
      </main>
    );
  }

  if (created) {
    return (
      <CreatedPanel
        title={created.event.title}
        code={created.joinCode}
        promoNote={promo ? promoCopy.granted(promo, planById(planId).label) : null}
        onCopied={() => notify('Copied', 'success')}
        onOpen={() => router.push(`/e/${created.event.id}`)}
        // Straight to the guest list, which is the next thing a host actually needs to do.
        onAddGuests={() => router.push(`/e/${created.event.id}?tab=guests`)}
      />
    );
  }

  return (
    // One column until there is room for two. The wider track is not a bigger form — it is
    // the form at the same width with the preview alongside it.
    <main className="mx-auto w-full max-w-lg px-6 py-10 lg:max-w-5xl">
      <div className="lg:grid lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:items-start lg:gap-12">
        <div className="flex min-h-dvh flex-col lg:min-h-0">
          <Link
            href="/"
            className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-bold text-[var(--text-primary)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
          >
            <ArrowLeft className="size-3.5" />
            Back to Home
          </Link>

          <h1 className="text-3xl font-semibold tracking-tight">Make an invitation</h1>
          <p className="mt-2 text-[var(--text-secondary)]">
            Only the first two are required. You can change everything later.
          </p>

          {/*
        The account is asked for at publish, which is the right moment — but it should not
        be a surprise when it arrives, and someone who already has one should be able to
        start signed in rather than build a draft as a stranger and be stopped at the end.
        Quiet, below the fold of attention, and gone entirely once they are signed in.
      */}
          {!loading && (!actor || isAnonymous) && (
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              {/* "when you send it" was the same untruth as the button: nothing is sent here,
                  and the account is asked for when the invitation is created. */}
              You will sign in when you create it — one tap with Google.{' '}
              <Link
                href="/signin?next=/create"
                className="underline underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
              >
                Sign in first
              </Link>
            </p>
          )}

          {/*
        Someone who left to fetch a sign-in link comes back to a tab that never held their
        work. Saying so is the difference between trusting the form and retyping into it.
      */}
          {restored && !submitting && (
            <p
              role="status"
              className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]"
            >
              Welcome back — we kept what you had written.
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-7" noValidate>
            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                What is the occasion?
              </legend>
              <div className="flex flex-wrap gap-2">
                {occasions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => chooseOccasion(option.id)}
                    aria-pressed={occasionId === option.id}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3.5 py-2 text-sm font-medium transition-all duration-200',
                      occasionId === option.id
                        ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                        : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]',
                    )}
                  >
                    <span aria-hidden>{option.glyph}</span>
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <TextField
              label="What are we calling it?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={occasion.titlePlaceholder}
              maxLength={contentLimits.eventTitleMaxLength}
              required
            />

            <TextField
              label="Hosted by"
              hint="Leave blank to use your name."
              value={hostedBy}
              onChange={(e) => setHostedBy(e.target.value)}
              placeholder="Priya & Sam"
              maxLength={contentLimits.hostedByMaxLength}
            />

            <TextAreaField
              label="A note for your guests"
              hint="Optional."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Drinks from seven, dinner at eight."
              maxLength={contentLimits.eventDescriptionMaxLength}
              rows={3}
            />

            <div>
              <label
                htmlFor="starts-at"
                className="mb-1.5 block text-sm font-medium text-[var(--text-secondary)]"
              >
                When is it?
              </label>
              <input
                id="starts-at"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-3 transition-colors focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
              />
              <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                Optional — you can send a save-the-date without one.
                {startsAt && shownTimeZone && (
                  // Named rather than assumed. Guests are shown this time in *your* zone, so a
                  // host setting up a party while travelling can catch a wrong zone here rather
                  // than after two hundred people have the wrong hour.
                  <>
                    {' '}
                    Times are in{' '}
                    <span className="text-[var(--text-secondary)]">{shownTimeZone}</span>.
                  </>
                )}
              </p>
            </div>

            <div className="space-y-4">
              <TextField
                label="Where?"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="The Rooftop, or just: ours"
                maxLength={contentLimits.locationNameMaxLength}
              />
              <AddressField
                address={locationAddress}
                onAddressChange={(value) => {
                  setLocationAddress(value);
                  // Typing over a chosen place makes the coordinates stale, and stale
                  // coordinates draw a map of the wrong building.
                  setPlaceId(null);
                  setLatLng(null);
                  setVenueZone(null);
                }}
                onPlaceChosen={(place) => {
                  setLocationAddress(place.address);
                  // Only fill the venue name if the host has not written their own; "ours" is
                  // a better name for a back garden than whatever Google calls the street.
                  if (!locationName && place.name) setLocationName(place.name);
                  setPlaceId(place.placeId);
                  setLatLng(
                    place.lat !== null && place.lng !== null
                      ? { lat: place.lat, lng: place.lng }
                      : null,
                  );
                  setVenueZone(place.timeZone);
                }}
              />
            </div>

            {occasion.asksDressCode && (
              <TextField
                label="Dress code"
                hint="Optional."
                value={dressCode}
                onChange={(e) => setDressCode(e.target.value)}
                placeholder="Whatever makes you happy"
                maxLength={contentLimits.dressCodeMaxLength}
              />
            )}

            <fieldset>
              <legend className="mb-3 block text-sm font-medium text-[var(--text-secondary)]">
                Pick a design
              </legend>
              <TemplatePicker
                occasionId={occasionId}
                value={templateId}
                planId={planId}
                canUse={(id) => canUseTemplate(planId, id)}
                onChange={(id) => {
                  setTemplateId(id);
                  setTemplateTouched(true);
                }}
              />
              <p className="mt-3 text-sm text-[var(--text-muted)]">
                {lockedTemplateCount > 0
                  ? `${lockedTemplateCount} more designs come with a paid plan. `
                  : 'Every design is available while we are in preview. '}
                <Link href="/templates" className="underline underline-offset-2">
                  Browse them all
                </Link>
                .
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                Can guests bring anyone?
              </legend>
              <div className="flex flex-wrap gap-2">
                {partySizeChoices.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMaxPartySize(value)}
                    aria-pressed={maxPartySize === value}
                    className={cn(
                      'rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-all duration-200',
                      maxPartySize === value
                        ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                        : 'bg-[var(--surface-sunken)] text-[var(--text-muted)] hover:bg-[var(--accent-soft)]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Guests say how many adults and children are coming, so you get a headcount you can
                actually cater for.
              </p>
            </fieldset>

            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                What can guests post to the wall?
              </legend>
              <div className="flex flex-wrap gap-2">
                {POST_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => toggleKind(kind)}
                    aria-pressed={allowedKinds.includes(kind)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-all duration-200',
                      allowedKinds.includes(kind)
                        ? 'bg-[var(--accent-soft)] text-[var(--text-primary)]'
                        : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
                    )}
                  >
                    {allowedKinds.includes(kind) && <Check className="size-3.5" aria-hidden />}
                    {KIND_LABELS[kind]}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="mb-2 block text-sm font-medium text-[var(--text-secondary)]">
                How long should the wall stay up afterwards?
              </legend>
              <div className="flex flex-wrap gap-2">
                {expiryPresets.map((preset) => {
                  const locked = !canUseExpiryPreset(planId, preset.id);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      disabled={locked}
                      onClick={() => setExpiryPresetId(preset.id)}
                      aria-pressed={expiryPresetId === preset.id}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-all duration-200',
                        expiryPresetId === preset.id
                          ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                          : 'bg-[var(--surface-sunken)] text-[var(--text-secondary)] hover:bg-[var(--accent-soft)]',
                        locked && 'cursor-not-allowed opacity-45 hover:bg-[var(--surface-sunken)]',
                      )}
                    >
                      {locked && <Lock className="size-3" aria-hidden />}
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/*
          The narrow placement. There is no room on a phone to show the card and the form at
          once, so it collapses — and it sits here, immediately above the button, because the
          moment before committing is when somebody actually wants to look at what they made.
          Hidden on wide screens, where the sticky column beside the form has it covered.
        */}
            <InvitationPreview draft={previewDraft} collapsible className="lg:hidden" />

            {error && (
              <p role="alert" className="text-sm text-[var(--danger)]">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              loading={submitting}
              disabled={!title.trim() || allowedKinds.length === 0}
            >
              {occasion.createVerb}
            </Button>

            {/*
              Said under the button rather than only in the copy after it, because the fear
              this answers is felt *before* pressing: a button that used to read "Send the
              invitation" made a host with a half-finished guest list hesitate, or worse,
              believe forty emails had just gone out.
            */}
            <p className="-mt-2 text-center text-xs text-[var(--text-muted)]">
              Nothing is sent yet. You add guests next, and choose when each one hears from you.
            </p>
          </form>
        </div>

        {/*
          The wide placement: beside the form and sticky, so it stays in view as the fields
          scroll past it. This is where the design picker stops being a guess.
        */}
        <InvitationPreview
          draft={previewDraft}
          className="hidden lg:sticky lg:top-10 lg:block lg:self-start"
        />
      </div>
    </main>
  );
}

interface CreatedPanelProps {
  title: string;
  code: string;
  /** Explains a granted upgrade. Null when the plan was not raised by a promo. */
  promoNote: string | null;
  onCopied: () => void;
  onOpen: () => void;
  /** The primary action: the guest list, which is where the tracked path starts. */
  onAddGuests: () => void;
}

/**
 * The code is shown once, here. Re-reading it later is a separate audited call from inside
 * the event, so it never turns up in a payload someone could stumble across.
 */
function CreatedPanel({
  title,
  code,
  promoNote,
  onCopied,
  onOpen,
  onAddGuests,
}: CreatedPanelProps) {
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  // The invitation link, not the event URL: `/e/{id}` turns away everyone who is not
  // already a member, which is every person this gets shared with.
  const link =
    typeof window === 'undefined' ? '' : `${window.location.origin}${invitationPath(code)}`;

  async function copy(what: 'code' | 'link') {
    await navigator.clipboard.writeText(what === 'code' ? formatJoinCode(code) : link);
    setCopied(what);
    onCopied();
    setTimeout(() => setCopied(null), 2000);
  }

  async function share() {
    if (!navigator.share) return copy('link');
    await navigator
      .share({ title, text: `You're invited to ${title}`, url: link })
      .catch(() => undefined);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 text-center">
      <span className="mx-auto mb-6 inline-flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
        <PartyPopper className="size-6" aria-hidden />
      </span>

      <h1 className="text-3xl font-semibold tracking-tight">Your invitation is ready</h1>
      <p className="mt-2 text-[var(--text-secondary)]">
        Add the people you are inviting and everyone gets their own link — so you can see who opened
        it and who has not.
      </p>

      {/* An upgrade nobody explained reads as a billing mistake rather than a gift. */}
      {promoNote && (
        <p className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]">
          {promoNote}
        </p>
      )}

      {/*
        The primary action is the guest list, and it was not.

        This screen used to offer a code and "Share the link" and never mention guests at all,
        so the product's own default path was: create, copy a code, paste it somewhere. Every
        host who followed it gave up per-guest links, delivery status, reminders and any way to
        answer "did Priya see this?" — which is to say the entire reason to use this rather
        than Evite. The tracked path was opt-in, two navigations deep, on a tab inside a page
        they had not opened.

        The code stays, because reading one out is genuinely the right move for a small party.
        It is just no longer the road most travelled.
      */}
      <Button size="lg" className="mt-8 w-full" onClick={onAddGuests}>
        <Users className="size-4" aria-hidden />
        Add your guests
      </Button>

      <button
        type="button"
        onClick={onOpen}
        className="mt-3 text-sm text-[var(--text-secondary)] underline underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
      >
        Or just look at it first
      </button>

      {/*
        The link, as text somebody can actually read.

        It was only ever reachable through `navigator.share` or a clipboard write, so on a
        desktop browser without the Web Share API the host's own invitation URL was never once
        displayed to them — "Share the link" silently became a copy, and a failed clipboard
        write left nothing at all. A host who wants to paste it into a message to one person,
        or simply see where their invitation lives, had no way to.

        `select-all` so a tap selects the whole thing, and `break-all` because an origin plus a
        code overflows a phone otherwise.
      */}
      <div className="mt-8 border-t border-[var(--border-subtle)] pt-6 text-left">
        <p className="text-sm font-medium">The link to your invitation</p>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Anyone with this can open it and reply. Send it to one person, or paste it into a group
          chat.
        </p>
        <p className="mt-3 rounded-2xl bg-[var(--surface-sunken)] px-4 py-3 font-mono text-xs break-all select-all">
          {link}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="soft" size="sm" onClick={() => copy('link')}>
            {copied === 'link' ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied === 'link' ? 'Copied' : 'Copy link'}
          </Button>
          <Button variant="ghost" size="sm" onClick={share}>
            <Share2 className="size-4" aria-hidden />
            Share
          </Button>
        </div>
      </div>

      <div className="mt-6 border-t border-[var(--border-subtle)] pt-6 text-left">
        <p className="text-sm text-[var(--text-secondary)]">
          In a hurry? Read this code out instead — anyone who has it can get in.
        </p>
        <p className="code-display mt-3 text-2xl font-semibold">{formatJoinCode(code)}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={() => copy('code')}>
            {copied === 'code' ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied === 'code' ? 'Copied' : 'Copy code'}
          </Button>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Neither a shared code nor a shared link has a name attached, so nothing sent that way can
          be tracked — that is what adding guests gives you. You can find both again in the host
          panel any time.
        </p>
      </div>
    </main>
  );
}

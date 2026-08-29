import { defaultOccasionId, defaultTemplateId, type PlanId } from '@/config';
import type { EventDoc, EventLocation, PostKind } from '@/types/domain';

/**
 * A draft, shaped like the real thing so the real component can draw it.
 *
 * The create form used to publish blind: a host typed a title, a date, a venue, picked a
 * design from a swatch, and pressed publish having never once seen the card they were about
 * to send to forty people. Their own invitation was something they first laid eyes on after
 * it existed.
 *
 * **This exists so that preview and reality cannot drift.** The tempting shortcut is a second
 * component that approximates the invitation — and the moment it exists it starts lying,
 * because the two are maintained by different edits on different days. Instead the preview is
 * the actual `Invitation` component, and this fills in the fields it needs that a half-typed
 * form does not have yet.
 *
 * Nothing here is written anywhere. The fabricated parts are the ones with no bearing on how
 * an invitation looks — an id, counters, an expiry — and every field a host can see is theirs.
 */

export interface InvitationDraft {
  occasionId: string;
  title: string;
  hostedBy: string;
  description: string;
  /** Epoch ms, or null while the date field is empty or half-typed. */
  startsAt: number | null;
  timeZone: string | null;
  locationName: string;
  locationAddress: string;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  dressCode: string;
  templateId: string;
  maxPartySize: number;
  allowedKinds: readonly PostKind[];
  /** Decides whether the preview carries the branding line, so what you see is what sends. */
  planId: PlanId;
}

/**
 * Placeholder title.
 *
 * An invitation with an empty headline previews as a blank card, which reads as broken rather
 * than as unfinished — so the empty state shows the shape it is going to take instead. Only
 * ever seen in the preview: the form refuses to publish without a real title.
 */
export const DRAFT_TITLE_PLACEHOLDER = 'Your invitation';

export function previewEventFromDraft(draft: InvitationDraft): EventDoc {
  const location: EventLocation | null =
    draft.locationName || draft.locationAddress
      ? {
          name: draft.locationName,
          address: draft.locationAddress,
          url: null,
          placeId: draft.placeId,
          lat: draft.lat,
          lng: draft.lng,
        }
      : null;

  const now = Date.now();

  return {
    // Never persisted, but named rather than left empty: an id of `''` would build a real URL
    // pointing at nothing if any child ever decided to link somewhere.
    id: 'preview',
    title: draft.title.trim() || DRAFT_TITLE_PLACEHOLDER,
    description: draft.description,
    occasion: (draft.occasionId || defaultOccasionId) as EventDoc['occasion'],
    hostUid: 'preview',
    hostName: draft.hostedBy,
    hostedBy: draft.hostedBy,
    templateId: (draft.templateId || defaultTemplateId) as EventDoc['templateId'],
    status: 'live',
    startsAt: draft.startsAt,
    endsAt: null,
    timeZone: draft.timeZone,
    location,
    dressCode: draft.dressCode,
    rsvp: {
      enabled: true,
      deadline: null,
      allowPlusOnes: draft.maxPartySize > 1,
      maxPartySize: draft.maxPartySize,
      askNote: false,
      question: null,
      autoRemind: true,
    },
    rsvpTally: { yes: 0, no: 0, maybe: 0, pending: 0, attending: 0 },
    settings: { whoCanPost: 'members', allowedKinds: draft.allowedKinds, moderated: false },
    // The plan the event would actually be created on, so a host on a plan that removes the
    // branding line sees it gone here too rather than being surprised in either direction.
    plan: draft.planId,
    createdAt: now,
    expiresAt: now,
    endedAt: null,
    remindersSent: [],
    memberCount: 0,
    postCount: 0,
    storageBytes: 0,
  };
}

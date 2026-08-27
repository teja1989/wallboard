import type { Metadata } from 'next';
import { brand, occasionById } from '@/config';
import { findEventByCode } from '@/lib/services/events';
import { formatEventDate } from '@/lib/utils';
import { joinCodeSchema } from '@/lib/validation/schemas';
import { InvitationRedeemer } from '@/components/event/invitation-redeemer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = {
  params: Promise<{ code: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The invitation link.
 *
 * This is what a host shares and what an emailed invitation points at, and it exists
 * because `/e/{id}` cannot do the job: the event turns away everyone who is not already a
 * member, which is every recipient of an invitation.
 *
 * Server-rendered purely so the link previews. A pasted URL that unfurls into the event's
 * name and date is the single most-seen impression this product makes — it is the whole
 * distribution loop — and a crawler carries no session, so nothing behind an identity
 * could ever appear in one.
 *
 * What it reveals is bounded to what the link already grants: anyone holding the code can
 * redeem it, so showing the title and date to someone holding the code gives away nothing
 * they could not get by following it. The guest list, the wall, and the private replies
 * are not here and must never be.
 */
async function eventForCode(raw: string) {
  const parsed = joinCodeSchema.safeParse(raw);
  if (!parsed.success) return null;
  const event = await findEventByCode(parsed.data);
  if (!event || event.status === 'ended') return null;
  return event;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { code } = await params;
  const event = await eventForCode(code);

  if (!event) {
    return { title: 'Invitation', robots: { index: false, follow: false } };
  }

  const occasion = occasionById(event.occasion);
  const when = event.startsAt ? formatEventDate(event.startsAt) : null;
  const title = `${event.title}${event.hostedBy ? ` · ${event.hostedBy}` : ''}`;
  const description = [when, occasion.rsvpPrompt].filter(Boolean).join(' — ');

  return {
    title,
    description,
    // Never indexed. A private invitation that turns up in a search result is a failure,
    // however good the card looks in a group chat.
    robots: { index: false, follow: false },
    openGraph: {
      type: 'website',
      siteName: brand.name,
      title,
      description,
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export default async function InvitationPage({ params, searchParams }: Params) {
  const { code } = await params;
  const query = await searchParams;
  const event = await eventForCode(code);

  // `?g=` names which guest is holding this link. It is handed to the client rather than
  // acted on here on purpose: the view it records has to come from a browser that ran the
  // page, not from whatever fetched the HTML. See the beacon route for why.
  const raw = query.g;
  const guestToken = typeof raw === 'string' ? raw : null;

  return (
    <InvitationRedeemer
      code={code}
      eventId={event?.id ?? null}
      guestToken={guestToken}
      title={event?.title ?? null}
      hostedBy={event?.hostedBy ?? null}
    />
  );
}

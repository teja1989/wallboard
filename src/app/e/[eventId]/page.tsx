import type { Metadata } from 'next';
import { brand } from '@/config';
import { EventScreen } from '@/components/event/event-screen';

export const metadata: Metadata = {
  title: 'Invitation',
  description: brand.shortPromise,
  robots: { index: false, follow: false },
};

/**
 * Fully client-rendered: every part of this page is driven by the visitor's own identity,
 * including a live Firestore listener, so there is nothing meaningful the server could
 * render that would not be replaced a moment later.
 */
export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <EventScreen eventId={eventId} />;
}

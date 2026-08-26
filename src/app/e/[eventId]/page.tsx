import type { Metadata } from 'next';
import { brand } from '@/config';
import { WallScreen } from '@/components/wall/wall-screen';

export const metadata: Metadata = {
  title: 'Wall',
  description: brand.description,
  robots: { index: false, follow: false },
};

/**
 * The wall is fully client-rendered: it is driven by a live Firestore listener under the
 * visitor's own identity, so there is nothing meaningful to render on the server that
 * would not immediately be replaced.
 */
export default async function EventPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <WallScreen eventId={eventId} />;
}

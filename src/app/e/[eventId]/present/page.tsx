import type { Metadata } from 'next';
import { brand } from '@/config';
import { PresentationScreen } from '@/components/event/presentation-screen';

export const metadata: Metadata = {
  title: 'Presentation Mode',
  description: brand.shortPromise,
  robots: { index: false, follow: false },
};

export default async function PresentationPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <PresentationScreen eventId={eventId} />;
}

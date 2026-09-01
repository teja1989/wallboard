import type { Metadata } from 'next';
import { EventsTable } from '@/components/admin/events-table';

export const metadata: Metadata = { title: 'Events' };

export default function AdminEventsPage() {
  return <EventsTable />;
}

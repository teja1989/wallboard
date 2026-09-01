import type { Metadata } from 'next';
import { AuditTable } from '@/components/admin/audit-table';

export const metadata: Metadata = { title: 'Audit' };

export default function AdminAuditPage() {
  return <AuditTable />;
}

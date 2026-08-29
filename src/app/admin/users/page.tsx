import type { Metadata } from 'next';
import { UsersTable } from '@/components/admin/users-table';

export const metadata: Metadata = { title: 'People' };

export default function AdminUsersPage() {
  return <UsersTable />;
}

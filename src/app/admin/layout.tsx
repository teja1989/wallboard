import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { adminCopy, isEnabled } from '@/config';
import { AdminNav } from '@/components/admin/admin-nav';

export const metadata: Metadata = {
  title: { default: adminCopy.title, template: `%s · ${adminCopy.title}` },
  // Never in an index, on any screen under here. `public/robots.txt` closes it at the crawl
  // as well; this is the same decision made at the page, which is where it survives a
  // robots file being rewritten.
  robots: { index: false, follow: false },
};

/**
 * The operator console.
 *
 * Every screen underneath is gated twice and neither gate is here: the API re-checks the
 * permission on every request, and Firestore rules deny direct client reads of the two
 * collections that matter. The layout only decides what to *offer* — a nav item is not an
 * authorization, and a page rendering behind it still gets a 403 from its API if the account
 * has no business seeing it.
 *
 * The flag is the one hard gate at this level, and it is a kill switch rather than a
 * permission: `FEATURE_ADMIN_CONSOLE=false` makes the whole console 404 without a deploy that
 * touches authorization.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isEnabled('adminConsole')) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{adminCopy.title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-[var(--text-secondary)]">{adminCopy.intro}</p>
      </header>

      <AdminNav />

      <div className="mt-8">{children}</div>
    </div>
  );
}

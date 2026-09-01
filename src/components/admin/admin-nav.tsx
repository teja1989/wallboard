'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { adminSections } from '@/config';
import { cn } from '@/lib/utils';

/**
 * The console's tabs.
 *
 * Every section is offered to everyone who can reach the console at all, rather than hidden
 * per permission. Hiding would need the actor's role on the client, and a nav that quietly
 * omits a tab teaches an operator that the page does not exist when the truth is that their
 * account cannot use it — which is a worse thing to learn during an incident than a clear
 * "you do not have access to this".
 */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Operations" className="mt-6 flex flex-wrap gap-2">
      {adminSections.map((section) => {
        const active = pathname === section.href;
        return (
          <Link
            key={section.id}
            href={section.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-colors duration-200',
              active
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                : 'bg-[var(--surface-sunken)] hover:bg-[var(--accent-soft)]',
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

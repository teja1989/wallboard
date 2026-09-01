import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { adminSections } from '@/config';

/**
 * The console's front door.
 *
 * It exists so `/admin` is not a 404 and so the sections are described in terms of the job
 * rather than the data — "open one to reach its wall, where a post can be taken down" is what
 * an operator needs at the moment they open this, and "events" is not.
 */
export default function AdminIndexPage() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {adminSections.map((section) => (
        <Link
          key={section.id}
          href={section.href}
          className="card group p-6 transition-colors duration-200 hover:bg-[var(--accent-soft)]"
        >
          <h2 className="flex items-center gap-2 font-semibold tracking-tight">
            {section.label}
            <ArrowRight
              className="size-4 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              aria-hidden
            />
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-secondary)]">
            {section.blurb}
          </p>
        </Link>
      ))}
    </div>
  );
}

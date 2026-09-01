'use client';
import { Clock } from 'lucide-react';
import type { AgendaItem } from '@/types/domain';

interface PartyAgendaProps {
  agenda: AgendaItem[];
  title?: string;
}

export function PartyAgenda({ agenda, title = 'Party Schedule & Highlights' }: PartyAgendaProps) {
  if (!agenda || agenda.length === 0) return null;

  return (
    <section className="mt-8 space-y-4" aria-labelledby="agenda-heading">
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
          <Clock className="size-4" />
        </div>
        <h3
          id="agenda-heading"
          className="text-base font-bold tracking-tight text-[var(--text-primary)]"
        >
          {title}
        </h3>
      </div>

      <div className="relative space-y-6 pl-6 before:absolute before:top-2 before:bottom-2 before:left-2.5 before:w-0.5 before:bg-[var(--border-subtle)]">
        {agenda.map((item, index) => (
          <div key={item.id || index} className="relative flex items-start gap-4">
            {/* Timeline Dot with Emoji or Clock */}
            <div className="absolute -left-6 flex size-5 items-center justify-center rounded-full border-2 border-[var(--surface-page)] bg-[var(--accent)] text-white shadow-sm ring-2 ring-[var(--accent-soft)]">
              <span className="text-[0.6rem]">{item.emoji || '✨'}</span>
            </div>

            <div className="flex-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-sm transition-all hover:border-[var(--accent-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--accent)]">
                  <Clock className="size-3" />
                  {item.time}
                </span>
              </div>
              <h4 className="mt-1.5 text-sm font-bold text-[var(--text-primary)]">{item.title}</h4>
              {item.description && (
                <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

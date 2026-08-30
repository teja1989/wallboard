'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import { occasionById, showcaseItems, templateById } from '@/config';
import { Invitation } from '@/components/event/invitation';
import { cn } from '@/lib/utils';

export function InvitationShowcase() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeItem = showcaseItems[selectedIndex] ?? showcaseItems[0]!;
  const template = templateById(activeItem.event.templateId);

  return (
    <section className="relative w-full">
      {/* Category selector chips */}
      <div className="flex flex-col items-center gap-3">
        <div
          role="tablist"
          aria-label="Event occasions"
          className="glass-strong inline-flex max-w-full items-center gap-1.5 overflow-x-auto rounded-[var(--radius-pill)] p-1.5 shadow-[var(--shadow-soft)]"
        >
          {showcaseItems.map((item, idx) => {
            const isSelected = idx === selectedIndex;
            const itemOccasion = occasionById(item.event.occasion);
            return (
              <button
                key={item.id}
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedIndex(idx)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium transition-all duration-200',
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
                )}
              >
                <span aria-hidden>{itemOccasion.glyph}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <p className="min-h-5 text-center text-xs font-medium text-[var(--text-muted)] transition-opacity duration-200">
          {activeItem.tagline}
        </p>
      </div>

      {/* Live invitation card */}
      <div className="relative mx-auto mt-6 max-w-lg">
        {/* Glow backdrop tailored to active template */}
        <div
          className="pointer-events-none absolute -inset-4 -z-10 rounded-[32px] opacity-25 blur-2xl transition-all duration-700"
          style={{ background: template.palette.accent }}
          aria-hidden
        />

        <div className="overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-lift)] ring-1 ring-[var(--border-subtle)] transition-transform duration-300">
          <Invitation event={activeItem.event} />
        </div>

        {/* Action bar below card */}
        <div className="mt-4 flex items-center justify-between px-2 text-xs text-[var(--text-muted)]">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-[var(--accent)]" aria-hidden />
            Theme:{' '}
            <strong className="font-semibold text-[var(--text-primary)]">
              {template.label}
            </strong>{' '}
            with {template.surface} surface
          </span>

          <Link
            href={`/create?occasion=${activeItem.event.occasion}&template=${activeItem.event.templateId}`}
            className="inline-flex items-center gap-1 font-medium text-[var(--accent)] transition-colors hover:underline"
          >
            Start with this design
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}

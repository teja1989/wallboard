'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MapPin, Sparkles, Users } from 'lucide-react';
import { occasionById, showcaseItems, templateById } from '@/config';
import { Invitation } from '@/components/event/invitation';
import { cn } from '@/lib/utils';

export function InvitationShowcase() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeItem = showcaseItems[selectedIndex] ?? showcaseItems[0]!;
  const occasion = occasionById(activeItem.event.occasion);
  const template = templateById(activeItem.event.templateId);

  return (
    <section className="relative w-full">
      {/* Full-width Top Filter Bar spanning the entire container */}
      <div className="flex flex-col items-center">
        <div className="w-full text-center">
          <p className="text-xs font-semibold tracking-wider text-[var(--accent)] uppercase">
            Explore Real Invitations
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Event occasions"
          className="glass-strong mt-3 flex w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl p-2 shadow-[var(--shadow-soft)] sm:gap-2 sm:rounded-[var(--radius-pill)] sm:p-2.5"
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
                  'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium transition-all duration-200 sm:rounded-[var(--radius-pill)] sm:px-4 sm:py-2.5 sm:text-sm',
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-md ring-1 ring-[var(--accent)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
                )}
              >
                <span className="text-sm sm:text-base" aria-hidden>
                  {itemOccasion.glyph}
                </span>
                <span className="font-semibold">{item.label}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-center text-xs font-medium text-[var(--text-secondary)] sm:text-sm">
          {activeItem.tagline}
        </p>
      </div>

      {/* Main Showcase Grid: Left Details Story + Right Live Invitation Card */}
      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left Column: Occasion Context & Fast Actions */}
        <div className="space-y-6 lg:col-span-5">
          <div className="card p-6 sm:p-7">
            <div className="flex items-center gap-2">
              <span className="text-2xl" aria-hidden>
                {occasion.glyph}
              </span>
              <div>
                <span className="text-xs font-semibold tracking-wider text-[var(--accent)] uppercase">
                  {occasion.label} Invitation
                </span>
                <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                  {activeItem.event.title}
                </h2>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              {activeItem.event.description}
            </p>

            <div className="mt-5 space-y-2.5 border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-[var(--accent)] shrink-0" />
                <span className="truncate">{activeItem.event.location?.name ?? 'Private Venue'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="size-4 text-[var(--accent)] shrink-0" />
                <span>
                  <strong>{activeItem.event.rsvpTally.attending}</strong> guests attending ·{' '}
                  <strong>{activeItem.event.postCount}</strong> live wall photos
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-[var(--accent)] shrink-0" />
                <span>
                  Design: <strong>{template.label}</strong> ({template.surface} surface)
                </span>
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href={`/create?occasion=${activeItem.event.occasion}&template=${activeItem.event.templateId}`}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.98]"
              >
                Create a {occasion.label.toLowerCase()} invitation
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Live Rendered Real Invitation */}
        <div className="lg:col-span-7">
          <div className="relative mx-auto max-w-lg">
            {/* Glow backdrop tailored to active template palette */}
            <div
              className="pointer-events-none absolute -inset-4 -z-10 rounded-[32px] opacity-25 blur-3xl transition-all duration-700"
              style={{ background: template.palette.accent }}
              aria-hidden
            />

            <div className="overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-lift)] ring-1 ring-[var(--border-subtle)] transition-all duration-300">
              <Invitation event={activeItem.event} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

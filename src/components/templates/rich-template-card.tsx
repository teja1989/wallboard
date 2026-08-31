'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Eye, Sparkles, Users } from 'lucide-react';
import { faceOf, sampleForTemplate, type Template } from '@/config';
import { cn } from '@/lib/utils';

interface RichTemplateCardProps {
  template: Template;
  preview: boolean;
  onQuickPreview: (template: Template) => void;
}

export function RichTemplateCard({
  template,
  preview: _preview,
  onQuickPreview,
}: RichTemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const face = faceOf(template);
  const sample = sampleForTemplate(template.id);
  const { palette, layout } = template;
  const gradient = `linear-gradient(145deg, ${palette.from}, ${palette.to})`;

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--border-focus)] hover:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.12)]"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Visual Miniature Canvas */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--surface-sunken)] p-3.5">
        {/* Ambient Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-20 blur-xl transition-opacity duration-300 group-hover:opacity-40"
          style={{ background: gradient }}
        />

        {/* Scaled Invitation Card Base */}
        <div
          className={cn(
            'relative flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border border-black/10 p-3.5 shadow-sm transition-transform duration-300',
            isHovered && 'scale-[1.02]',
          )}
          style={{
            background:
              layout === 'poster'
                ? gradient
                : layout === 'minimal'
                  ? 'var(--surface-page)'
                  : 'var(--surface-raised)',
            color: layout === 'poster' ? palette.onGradient : 'var(--text-primary)',
          }}
        >
          {/* Header Accent for Classic / Editorial */}
          {layout === 'classic' && (
            <div
              className="absolute inset-x-0 top-0 h-1/3 opacity-85"
              style={{ background: gradient }}
            />
          )}

          {/* Card Top Row: Date Pill & Status */}
          <div className="relative z-10 flex items-center justify-between">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider backdrop-blur-sm"
              style={{
                background: layout === 'poster' ? 'rgba(0,0,0,0.2)' : 'var(--surface-sunken)',
                color: layout === 'poster' ? palette.onGradient : palette.accent,
              }}
            >
              {sample.sampleDate.split('·')[0]?.trim() ?? 'SATURDAY'}
            </span>

            {template.premium && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-500 backdrop-blur-sm"
                style={{
                  background: layout === 'poster' ? 'rgba(0,0,0,0.3)' : 'rgba(245, 158, 11, 0.1)',
                }}
              >
                <Sparkles className="size-2.5" />
                PRO
              </span>
            )}
          </div>

          {/* Card Center: Dynamic Display Title */}
          <div className="relative z-10 my-auto py-2 text-center">
            <h4
              className="line-clamp-2 text-sm leading-snug font-bold tracking-tight"
              style={{
                fontFamily: face.stack,
                fontWeight: face.weight,
                letterSpacing: face.tracking,
                color: layout === 'poster' ? palette.onGradient : undefined,
              }}
            >
              {sample.sampleTitle}
            </h4>
            <p
              className="mt-1 line-clamp-1 text-[0.65rem] opacity-75"
              style={{
                color: layout === 'poster' ? palette.onGradient : 'var(--text-secondary)',
              }}
            >
              {sample.sampleSubtitle}
            </p>
          </div>

          {/* Card Bottom Row: Social Proof / Location */}
          <div
            className="relative z-10 flex items-center justify-between border-t pt-2 text-[0.65rem] opacity-80"
            style={{
              borderColor:
                layout === 'poster' ? 'rgba(255,255,255,0.15)' : 'var(--border-subtle)',
            }}
          >
            <span className="truncate max-w-[65%]">{sample.sampleLocation}</span>
            <span className="inline-flex items-center gap-1 font-medium">
              <Users className="size-2.5" />
              18+
            </span>
          </div>

          {/* Hover Action Overlay */}
          <div
            className={cn(
              'absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/60 p-4 backdrop-blur-[2px] transition-opacity duration-200',
              isHovered ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <button
              type="button"
              onClick={() => onQuickPreview(template)}
              className="inline-flex h-9 w-full max-w-[130px] items-center justify-center gap-1.5 rounded-full bg-white/95 text-xs font-semibold text-neutral-900 shadow-md transition-transform hover:scale-105 active:scale-95"
            >
              <Eye className="size-3.5" />
              Quick Preview
            </button>
            <Link
              href={`/create?template=${template.id}&occasion=${sample.sampleOccasion}`}
              className="inline-flex h-9 w-full max-w-[130px] items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] text-xs font-semibold text-[var(--accent-contrast)] shadow-md transition-transform hover:scale-105 active:scale-95"
            >
              Use Design
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Info & Spec Section Below Thumbnail */}
      <div className="flex flex-1 flex-col justify-between p-3.5 pt-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3
              className="truncate text-sm font-semibold tracking-tight"
              style={{ fontFamily: face.stack }}
            >
              {template.label}
            </h3>
            {/* Palette Dots */}
            <div className="flex items-center gap-1">
              <span
                className="size-2.5 rounded-full border border-black/10"
                style={{ backgroundColor: palette.from }}
                title={`From: ${palette.from}`}
              />
              <span
                className="size-2.5 rounded-full border border-black/10"
                style={{ backgroundColor: palette.to }}
                title={`To: ${palette.to}`}
              />
              <span
                className="size-2.5 rounded-full border border-black/10"
                style={{ backgroundColor: palette.accent }}
                title={`Accent: ${palette.accent}`}
              />
            </div>
          </div>
          <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">
            {template.blurb}
          </p>
        </div>

        {/* Feature Tags */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2 text-[0.65rem] text-[var(--text-muted)]">
          <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 font-medium capitalize">
            {template.layout}
          </span>
          <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5 font-medium">
            {face.label}
          </span>
          {sample.tags[0] && (
            <span className="rounded bg-[var(--surface-sunken)] px-1.5 py-0.5">
              {sample.tags[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

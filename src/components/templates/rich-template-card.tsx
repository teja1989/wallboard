'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, Sparkles } from 'lucide-react';
import { TemplateSurfaceField } from '@/components/event/template-surface';
import { faceOf, sampleForTemplate, type Template } from '@/config';
import { cn } from '@/lib/utils';

interface RichTemplateCardProps {
  template: Template;
  preview: boolean;
  onQuickPreview: (template: Template) => void;
}

const TEMPLATE_VIBES: Record<string, { badge: string; emoji: string }> = {
  sunset: { badge: 'Rooftops & Golden Hour', emoji: '🌆' },
  midnight: { badge: 'Nightlife & Cocktails', emoji: '🍸' },
  champagne: { badge: 'Formal & Weddings', emoji: '🥂' },
  botanical: { badge: 'Garden & Vineyard', emoji: '🌿' },
  confetti: { badge: 'Graduations & Milestones', emoji: '🎓' },
  rose: { badge: 'Baby & Romance', emoji: '🌸' },
  meadow: { badge: 'Outdoor Brunch & Pizza', emoji: '☀️' },
  ember: { badge: 'Intimate Dinners', emoji: '🔥' },
  linen: { badge: 'Modern Minimalist', emoji: '✨' },
  notepaper: { badge: 'Editorial & Clean', emoji: '📝' },
  neon: { badge: 'Electric Afterparty', emoji: '⚡' },
  terracotta: { badge: 'Warm Mediterranean', emoji: '🏺' },
  monochrome: { badge: 'Chic Studio', emoji: '🖤' },
  ocean: { badge: 'Coastal & Summer', emoji: '🌊' },
  lavender: { badge: 'Milestone Birthdays', emoji: '💜' },
};

export function RichTemplateCard({
  template,
  preview: _preview,
  onQuickPreview,
}: RichTemplateCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const face = faceOf(template);
  const sample = sampleForTemplate(template.id);
  const vibe = TEMPLATE_VIBES[template.id] ?? { badge: 'Celebration', emoji: '✨' };
  const { palette, layout, surface } = template;
  const gradient = `linear-gradient(145deg, ${palette.from}, ${palette.to})`;

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--accent)]/50 hover:shadow-2xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Visual Miniature Canvas */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--surface-sunken)] p-3.5 sm:p-4">
        {/* Ambient Glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-25 blur-2xl transition-opacity duration-300 group-hover:opacity-45"
          style={{ background: gradient }}
        />

        {/* Scaled Invitation Card Preview */}
        <div
          className={cn(
            'relative flex h-full w-full flex-col justify-between overflow-hidden rounded-2xl border border-black/10 p-4 shadow-sm transition-transform duration-300',
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
          {/* Animated Surface Background Texture */}
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <TemplateSurfaceField surface={surface} palette={palette} className="size-full" />
          </div>

          {/* Header Accent for Classic / Editorial */}
          {layout === 'classic' && (
            <div
              className="absolute inset-x-0 top-0 h-1/3 opacity-80"
              style={{ background: gradient }}
            />
          )}

          {/* Top Row: Occasion Badge & Pro Tag */}
          <div className="relative z-10 flex items-center justify-between">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.68rem] font-bold tracking-wider uppercase shadow-xs backdrop-blur-md"
              style={{
                background: layout === 'poster' ? 'rgba(0,0,0,0.3)' : 'var(--surface-sunken)',
                color: layout === 'poster' ? palette.onGradient : palette.accent,
              }}
            >
              <span>{vibe.emoji}</span>
              <span>{sample.sampleDate.split('·')[0]?.trim() ?? 'SATURDAY'}</span>
            </span>

            {template.premium && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[0.62rem] font-black text-amber-500 shadow-xs backdrop-blur-md"
                style={{
                  background: layout === 'poster' ? 'rgba(0,0,0,0.35)' : 'rgba(245, 158, 11, 0.15)',
                }}
              >
                <Sparkles className="size-2.5" />
                SIGNATURE
              </span>
            )}
          </div>

          {/* Center: Dynamic Display Title */}
          <div className="relative z-10 my-auto py-2 text-center">
            <h4
              className="line-clamp-2 text-base leading-snug font-black tracking-tight"
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
              className="mt-1 line-clamp-1 text-xs font-medium opacity-80"
              style={{
                color: layout === 'poster' ? palette.onGradient : 'var(--text-secondary)',
              }}
            >
              {sample.sampleSubtitle}
            </p>
          </div>

          {/* Bottom Row: Location & RSVP Readiness */}
          <div
            className="relative z-10 flex items-center justify-between border-t pt-2.5 text-[0.7rem] opacity-90"
            style={{
              borderColor: layout === 'poster' ? 'rgba(255,255,255,0.2)' : 'var(--border-subtle)',
            }}
          >
            <span className="max-w-[65%] truncate font-medium">{sample.sampleLocation}</span>
            <span className="inline-flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
              ✓ RSVP Ready
            </span>
          </div>

          {/* Interactive Hover Actions Overlay */}
          <div
            className={cn(
              'absolute inset-0 z-20 flex flex-col items-center justify-center gap-2.5 bg-black/65 p-4 backdrop-blur-[3px] transition-opacity duration-200',
              isHovered ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
          >
            <Link
              href={`/create?template=${template.id}&occasion=${sample.sampleOccasion}`}
              className="inline-flex h-10 w-full max-w-[150px] items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--accent-contrast)] shadow-lg transition-transform hover:scale-105 active:scale-95"
            >
              <span>Use Design</span>
              <ArrowRight className="size-3.5" />
            </Link>

            <button
              type="button"
              onClick={() => onQuickPreview(template)}
              className="inline-flex h-9 w-full max-w-[150px] cursor-pointer items-center justify-center gap-1.5 rounded-full bg-white/90 text-xs font-semibold text-[var(--text-primary)] shadow-md transition-transform hover:scale-105 active:scale-95 dark:bg-zinc-900/90"
            >
              <Eye className="size-3.5" />
              <span>Quick Preview</span>
            </button>
          </div>
        </div>
      </div>

      {/* Info & Spec Section Below Thumbnail */}
      <div className="flex flex-1 flex-col justify-between space-y-3 p-4 pt-3">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3
              className="truncate text-base font-bold tracking-tight text-[var(--text-primary)]"
              style={{ fontFamily: face.stack }}
            >
              {template.label}
            </h3>
            {/* Palette Dots */}
            <div className="flex items-center gap-1.5">
              <span
                className="size-3 rounded-full border border-black/10 shadow-xs"
                style={{ backgroundColor: palette.from }}
                title={`Palette From: ${palette.from}`}
              />
              <span
                className="size-3 rounded-full border border-black/10 shadow-xs"
                style={{ backgroundColor: palette.to }}
                title={`Palette To: ${palette.to}`}
              />
              <span
                className="size-3 rounded-full border border-black/10 shadow-xs"
                style={{ backgroundColor: palette.accent }}
                title={`Accent: ${palette.accent}`}
              />
            </div>
          </div>

          {/* Vibe Tag */}
          <p className="mt-1 text-xs font-medium text-[var(--accent)]">
            {vibe.emoji} {vibe.badge}
          </p>

          <p className="mt-1 line-clamp-1 text-xs text-[var(--text-secondary)]">{template.blurb}</p>
        </div>

        {/* Feature Tags */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)] pt-2.5 text-[0.7rem] text-[var(--text-muted)]">
          <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 font-bold capitalize">
            {template.layout} Layout
          </span>
          <span className="rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 font-medium">
            {face.label}
          </span>
        </div>
      </div>
    </div>
  );
}

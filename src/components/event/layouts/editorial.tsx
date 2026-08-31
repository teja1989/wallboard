import { faceOf } from '@/config';
import { TemplateMotifMark } from '@/components/event/template-motif';
import { TemplateSurfaceField } from '@/components/event/template-surface';
import type { InvitationLayoutProps } from './types';

/**
 * Editorial — left-aligned, rule-led, with the title set large against a narrow measure.
 *
 * Reads like a printed announcement rather than a card. Suits the occasions where the
 * wording carries the weight: weddings, memorials, anything formal.
 */
export function EditorialLayout({
  event,
  template,
  occasion,
  details,
  attribution,
  titleAs: Title = 'h1',
}: InvitationLayoutProps) {
  const face = faceOf(template);
  const { palette } = template;

  return (
    <article className="card relative overflow-hidden">
      <div
        aria-hidden
        className="h-1.5 w-full"
        style={{ background: `linear-gradient(90deg, ${palette.from}, ${palette.to})` }}
      />

      {/* Quiet: the hairline is the whole statement here, so the surface stays a whisper. */}
      <TemplateSurfaceField
        surface={template.surface}
        palette={palette}
        somber={occasion.somber}
        intensity="quiet"
        className="pointer-events-none absolute inset-0 size-full"
      />

      <div className="relative px-6 py-8 sm:px-10 sm:py-10">
        <div className="flex items-center gap-3">
          <span aria-hidden className="text-xl">
            {occasion.glyph}
          </span>
          <p className="text-xs font-medium tracking-[0.2em] text-[var(--text-muted)] uppercase">
            From {event.hostedBy}
          </p>
        </div>

        <hr className="my-5 border-t" style={{ borderColor: palette.accent, opacity: 0.35 }} />

        <Title
          className="max-w-[16ch] text-4xl leading-[1.02] text-balance sm:text-6xl"
          style={{
            fontFamily: face.stack,
            fontWeight: face.weight,
            letterSpacing: face.tracking,
          }}
        >
          {event.title}
        </Title>

        {event.description && (
          <p className="mt-6 max-w-prose text-lg leading-relaxed text-pretty text-[var(--text-secondary)]">
            {event.description}
          </p>
        )}

        <TemplateMotifMark
          motif={template.motif}
          color={palette.accent}
          className="mt-7 h-5 w-32"
        />

        <hr className="my-6 border-t border-[var(--border-subtle)]" />

        {details}
        {attribution}
      </div>
    </article>
  );
}

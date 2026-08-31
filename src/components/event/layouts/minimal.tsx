import { faceOf } from '@/config';
import { TemplateMotifMark } from '@/components/event/template-motif';
import { TemplateSurfaceField } from '@/components/event/template-surface';
import type { InvitationLayoutProps } from './types';

/**
 * Minimal — no gradient band, thin rules, small type, a great deal of air.
 *
 * The one to pick when the occasion does not want decoration: a quiet supper, a memorial.
 * Restraint here is the design, so resist the urge to add anything.
 */
export function MinimalLayout({
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
    <article
      className="card relative overflow-hidden"
      style={{ borderColor: palette.accent, borderWidth: 1, opacity: 1 }}
    >
      {/* Quiet, because restraint is what this layout is for — see `intensity`. */}
      <TemplateSurfaceField
        surface={template.surface}
        palette={palette}
        somber={occasion.somber}
        intensity="quiet"
        className="pointer-events-none absolute inset-0 size-full"
      />

      <div className="relative px-6 py-10 text-center sm:px-12 sm:py-14">
        <span aria-hidden className="text-lg opacity-70">
          {occasion.glyph}
        </span>

        <p className="mt-4 text-[0.7rem] font-medium tracking-[0.24em] text-[var(--text-muted)] uppercase">
          From {event.hostedBy}
        </p>

        <Title
          className="mx-auto mt-4 max-w-[18ch] text-3xl leading-[1.15] text-balance sm:text-4xl"
          style={{
            fontFamily: face.stack,
            fontWeight: face.weight,
            letterSpacing: face.tracking,
          }}
        >
          {event.title}
        </Title>

        <TemplateMotifMark
          motif={template.motif}
          color={palette.accent}
          className="mx-auto mt-6 h-5 w-32"
        />

        {event.description && (
          <p className="mx-auto mt-6 max-w-sm text-sm leading-relaxed text-pretty text-[var(--text-secondary)]">
            {event.description}
          </p>
        )}

        <hr
          className="mx-auto my-8 w-16 border-t"
          style={{ borderColor: palette.accent, opacity: 0.5 }}
        />

        <div className="text-left">{details}</div>
        {attribution}
      </div>
    </article>
  );
}

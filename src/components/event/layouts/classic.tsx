import { faceOf } from '@/config';
import { TemplateMotifMark } from '@/components/event/template-motif';
import { TemplateSurfaceField } from '@/components/event/template-surface';
import type { InvitationLayoutProps } from './types';

/**
 * Classic — centred, with a gradient band and the occasion glyph tucked under it.
 *
 * The default for a reason: it reads as an invitation instantly, at any width, and it
 * survives a host who fills in two fields as gracefully as one who fills in all of them.
 */
export function ClassicLayout({
  event,
  template,
  occasion,
  details,
  attribution,
}: InvitationLayoutProps) {
  const face = faceOf(template);
  const { palette } = template;

  return (
    <article className="card overflow-hidden">
      {/*
        The band, with a surface painted over the gradient rather than instead of it.

        `relative` + an absolutely-positioned SVG rather than a CSS background, because the
        surface has to stretch to the band's real size and a background-image cannot be given
        the palette's colours without re-encoding it per template.
      */}
      <div
        aria-hidden
        className="relative h-28 w-full overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
      >
        <TemplateSurfaceField
          surface={template.surface}
          palette={palette}
          somber={occasion.somber}
          className="absolute inset-0 size-full"
        />
      </div>

      <div className="px-6 pb-6 text-center sm:px-10">
        <span
          aria-hidden
          className="-mt-7 mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-[var(--surface-raised)] text-2xl shadow-[var(--shadow-soft)] ring-1 ring-[var(--border-subtle)]"
        >
          {occasion.glyph}
        </span>

        <p className="text-xs font-medium tracking-[0.18em] text-[var(--text-muted)] uppercase">
          From {event.hostedBy}
        </p>

        <h1
          className="mt-3 text-4xl leading-[1.08] text-balance sm:text-5xl"
          style={{
            fontFamily: face.stack,
            fontWeight: face.weight,
            letterSpacing: face.tracking,
          }}
        >
          {event.title}
        </h1>

        <TemplateMotifMark
          motif={template.motif}
          color={palette.accent}
          className="mx-auto mt-5 h-5 w-40"
        />

        {event.description && (
          <p className="mx-auto mt-5 max-w-md leading-relaxed text-pretty text-[var(--text-secondary)]">
            {event.description}
          </p>
        )}

        <div className="mt-7 text-left">{details}</div>
        {attribution}
      </div>
    </article>
  );
}

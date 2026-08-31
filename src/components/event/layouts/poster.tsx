import { faceOf } from '@/config';
import { TemplateMotifMark } from '@/components/event/template-motif';
import { TemplateSurfaceField } from '@/components/event/template-surface';
import type { InvitationLayoutProps } from './types';

/**
 * Poster — full-bleed gradient with the type reversed out of it.
 *
 * The only layout that leaves the app's own surface colours behind, which is why the
 * palette carries an explicit `onGradient` value: contrast here cannot be inherited from
 * the theme, it has to be chosen with the gradient and is checked against both endpoints.
 */
export function PosterLayout({
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
      className="relative overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-lift)]"
      style={{
        background: `linear-gradient(150deg, ${palette.from}, ${palette.to})`,
        color: palette.onGradient,
      }}
    >
      {/*
        Poster is the one layout where the gradient *is* the whole card, so the surface covers
        it edge to edge rather than sitting in a band. It stays behind the content — the text
        is positioned above it, and the surface's own opacity keeps `onGradient` legible.
      */}
      <TemplateSurfaceField
        surface={template.surface}
        palette={palette}
        somber={occasion.somber}
        className="pointer-events-none absolute inset-0 size-full"
      />

      <div className="relative px-6 py-12 text-center sm:px-12 sm:py-16">
        <span aria-hidden className="text-2xl">
          {occasion.glyph}
        </span>

        <p
          className="mt-5 text-xs font-medium tracking-[0.22em] uppercase"
          style={{ color: palette.onGradient, opacity: 0.75 }}
        >
          From {event.hostedBy}
        </p>

        <Title
          className="mx-auto mt-4 max-w-[14ch] text-5xl leading-[0.98] text-balance sm:text-7xl"
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
          color={palette.onGradient}
          className="mx-auto mt-7 h-5 w-40 opacity-80"
        />

        {event.description && (
          <p
            className="mx-auto mt-6 max-w-md leading-relaxed text-pretty"
            style={{ color: palette.onGradient, opacity: 0.85 }}
          >
            {event.description}
          </p>
        )}

        {/*
          Details sit on a translucent panel rather than directly on the gradient: the same
          text colour cannot be legible across both endpoints of every palette, and a panel
          is a smaller compromise than flattening the gradient.
        */}
        <div
          className="mt-9 rounded-2xl px-5 py-5 text-left backdrop-blur-sm"
          style={{ background: 'oklch(1 0 0 / 0.16)' }}
        >
          {details}
        </div>

        {attribution}
      </div>
    </article>
  );
}

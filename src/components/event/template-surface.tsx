import { STILL_SURFACES, type TemplatePalette, type TemplateSurface } from '@/config';

/**
 * Whether a surface may move on this particular invitation.
 *
 * **The occasion overrides the template, and that is the whole point.** Three templates carry
 * `occasions: null`, meaning they suit anything — including a memorial. So "does this design
 * animate" cannot be answered by the template row alone: `sunset` shimmering gently on a
 * fortieth is right, and the same card shimmering on a funeral notice is the worst thing this
 * product could do.
 *
 * Exported so the component and its test read the same rule rather than two copies of it.
 */
export function surfaceMoves(surface: TemplateSurface, somber: boolean): boolean {
  if (somber) return false;
  return !STILL_SURFACES.includes(surface);
}

/**
 * The decorative field behind an invitation's header.
 *
 * Every template used to be one flat two-stop gradient, so fifteen designs differed only in
 * four colours. This paints a texture underneath — depth, and where it suits the occasion,
 * slow movement.
 *
 * **Drawn inline, from the palette, at low opacity.** Inline because it costs no request and
 * inherits the template's own colours; low opacity because the `onGradient` text colour is
 * guaranteed 4.5:1 against the two gradient stops and a surface dark enough to change that
 * would break the guarantee for every template at once.
 *
 * **Nothing here is information.** The whole element is `aria-hidden`, and the invitation
 * reads identically with it removed — which is also what happens in email and in the OG
 * image, both of which draw their own thing and never import this.
 *
 * Motion lives on `.tmpl-surface-*` classes in `globals.css` rather than inline, so the
 * global `prefers-reduced-motion` rule can stop all of it at once. `STILL_SURFACES` is the
 * separate question of whether a surface should move *at all* — `linen` is the quiet one
 * because a memorial should be dignified rather than merely slower.
 */
export function TemplateSurfaceField({
  surface,
  palette,
  className,
  intensity = 'full',
  somber = false,
}: {
  surface: TemplateSurface;
  palette: TemplatePalette;
  className?: string;
  /**
   * `quiet` halves the whole field's opacity.
   *
   * `minimal` and `editorial` are the restrained layouts — one is a bordered card with no
   * gradient at all, the other a 1.5px hairline — and a surface at full strength would fight
   * the thing that makes them work. They still get one, because a `surface` value that some
   * layouts ignore is dead config, and this repo has been bitten enough times by settings
   * that are declared and reachable from nowhere.
   */
  intensity?: 'full' | 'quiet';
  /**
   * True for memorials and anything else `occasion.somber`. Stops all motion — see
   * `surfaceMoves`, which is where the occasion overrides the template.
   */
  somber?: boolean;
}) {
  if (surface === 'none') return null;
  if (intensity === 'quiet') {
    return (
      <div aria-hidden className={className} style={{ opacity: 0.5 }}>
        <TemplateSurfaceField
          surface={surface}
          palette={palette}
          somber={somber}
          className="size-full"
        />
      </div>
    );
  }

  const moves = surfaceMoves(surface, somber);
  const ink = palette.onGradient;
  const accent = palette.accent;

  // `preserveAspectRatio="none"` so a surface stretches to whatever band it is given rather
  // than letterboxing inside it. These are fields, not pictures — nothing has a correct shape.
  const frame = {
    className,
    'aria-hidden': true as const,
    viewBox: '0 0 400 120',
    preserveAspectRatio: 'none' as const,
  };

  switch (surface) {
    /* Soft overlapping glows. The warm, general-purpose one. */
    case 'bloom':
      return (
        <svg {...frame}>
          <defs>
            <radialGradient id="mq-bloom-a">
              <stop offset="0%" stopColor={ink} stopOpacity="0.16" />
              <stop offset="100%" stopColor={ink} stopOpacity="0" />
            </radialGradient>
            <radialGradient id="mq-bloom-b">
              <stop offset="0%" stopColor={accent} stopOpacity="0.2" />
              <stop offset="100%" stopColor={accent} stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle
            cx="90"
            cy="45"
            r="80"
            fill="url(#mq-bloom-a)"
            className={moves ? 'tmpl-surface-drift' : undefined}
          />
          <circle
            cx="300"
            cy="80"
            r="95"
            fill="url(#mq-bloom-b)"
            className={moves ? 'tmpl-surface-drift-slow' : undefined}
          />
          <circle
            cx="210"
            cy="20"
            r="60"
            fill="url(#mq-bloom-a)"
            className={moves ? 'tmpl-surface-drift-slow' : undefined}
          />
        </svg>
      );

    /* Concentric arcs. Formal, architectural — the one that suits a wedding. */
    case 'arcs':
      return (
        <svg {...frame} fill="none" stroke={ink} strokeOpacity="0.16" strokeWidth="1.5">
          <g className={moves ? 'tmpl-surface-sweep' : undefined}>
            {[40, 70, 100, 130, 160].map((r) => (
              <circle key={r} cx="200" cy="130" r={r} />
            ))}
          </g>
          <circle cx="200" cy="130" r="185" stroke={accent} strokeOpacity="0.22" />
        </svg>
      );

    /* Layered hills. Reads as landscape rather than decoration. */
    case 'dusk':
      return (
        <svg {...frame}>
          <path
            d="M0 78 C 70 52, 130 96, 200 74 S 330 50, 400 82 L400 120 L0 120Z"
            fill={ink}
            fillOpacity="0.1"
            className={moves ? 'tmpl-surface-sway' : undefined}
          />
          <path
            d="M0 96 C 90 74, 160 110, 240 92 S 350 76, 400 100 L400 120 L0 120Z"
            fill={accent}
            fillOpacity="0.14"
            className={moves ? 'tmpl-surface-sway-slow' : undefined}
          />
        </svg>
      );

    /* Slow twinkling points. Evening and celebration; never a memorial. */
    case 'sparkle':
      return (
        <svg {...frame}>
          {[
            [42, 30, 2.2],
            [118, 74, 1.6],
            [186, 26, 2.6],
            [248, 88, 1.8],
            [312, 42, 2.2],
            [364, 78, 1.5],
            [80, 98, 1.4],
            [280, 16, 1.7],
          ].map(([cx, cy, r], index) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={r}
              fill={index % 3 === 0 ? accent : ink}
              fillOpacity="0.34"
              className={moves ? 'tmpl-surface-twinkle' : undefined}
              // Staggered inline, because eight elements sharing one delay blink in unison
              // and read as a fault rather than as stars.
              style={{ animationDelay: `${(index * 0.7).toFixed(2)}s` }}
            />
          ))}
        </svg>
      );

    /* Small shapes drifting down. The most playful — birthdays and parties only. */
    case 'drift':
      return (
        <svg {...frame}>
          {[
            [30, 18, 0],
            [92, 62, 1.1],
            [150, 10, 2.3],
            [214, 70, 0.6],
            [268, 32, 1.7],
            [330, 84, 2.9],
            [376, 24, 1.4],
          ].map(([x, y, delay], index) => (
            <rect
              key={`${x}-${y}`}
              x={x}
              y={y}
              width="7"
              height="3"
              rx="1.5"
              fill={index % 2 === 0 ? accent : ink}
              fillOpacity="0.3"
              transform={`rotate(${index * 27} ${x} ${y})`}
              className={moves ? 'tmpl-surface-fall' : undefined}
              style={{ animationDelay: `${delay}s` }}
            />
          ))}
        </svg>
      );

    /* A fine weave. Deliberately still. */
    case 'linen':
      return (
        <svg {...frame}>
          <defs>
            <pattern id="mq-linen" width="8" height="8" patternUnits="userSpaceOnUse">
              <path d="M0 0h8M0 4h8" stroke={ink} strokeOpacity="0.07" strokeWidth="1" />
              <path d="M0 0v8M4 0v8" stroke={ink} strokeOpacity="0.05" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="400" height="120" fill="url(#mq-linen)" />
        </svg>
      );

    default:
      return null;
  }
}

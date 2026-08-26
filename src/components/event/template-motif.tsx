import type { TemplateMotif } from '@/config';

/**
 * Decorative marks, drawn inline so they inherit the template's accent colour and cost no
 * extra request. Every one is `aria-hidden` — a motif that announced itself to a screen
 * reader would be noise between the host's name and the date.
 *
 * Deliberately restrained. A motif is seasoning; an invitation covered in it looks like
 * clip art.
 */
export function TemplateMotifMark({
  motif,
  className,
  color,
}: {
  motif: TemplateMotif;
  className?: string;
  color: string;
}) {
  if (motif === 'none') return null;

  const common = {
    className,
    'aria-hidden': true as const,
    fill: 'none' as const,
    stroke: color,
    strokeWidth: 1.25,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (motif) {
    case 'botanical':
      return (
        <svg viewBox="0 0 120 24" {...common}>
          <path d="M6 12h108" opacity="0.35" />
          <path d="M52 12c0-5 3-8 8-8 0 5-3 8-8 8Z" />
          <path d="M68 12c0-5-3-8-8-8 0 5 3 8 8 8Z" />
          <path d="M52 12c0 5 3 8 8 8 0-5-3-8-8-8Z" />
          <path d="M68 12c0 5-3 8-8 8 0-5 3-8 8-8Z" />
        </svg>
      );

    case 'rings':
      return (
        <svg viewBox="0 0 120 24" {...common}>
          <path d="M6 12h40" opacity="0.35" />
          <circle cx="55" cy="12" r="7" />
          <circle cx="65" cy="12" r="7" />
          <path d="M74 12h40" opacity="0.35" />
        </svg>
      );

    case 'stars':
      return (
        <svg viewBox="0 0 120 24" {...common}>
          <path d="M60 4v16M52 12h16" />
          <path d="M32 9v6M29 12h6" opacity="0.6" />
          <path d="M88 9v6M85 12h6" opacity="0.6" />
          <path d="M16 11v2M15 12h2" opacity="0.4" />
          <path d="M104 11v2M103 12h2" opacity="0.4" />
        </svg>
      );

    case 'confetti':
      return (
        <svg viewBox="0 0 120 24" {...common}>
          <path d="M20 6l3 5" />
          <path d="M38 14l4-3" />
          <path d="M56 5l1 6" />
          <path d="M74 13l4 3" />
          <path d="M92 6l-3 5" />
          <circle cx="30" cy="17" r="1.5" fill={color} stroke="none" />
          <circle cx="66" cy="18" r="1.5" fill={color} stroke="none" />
          <circle cx="100" cy="15" r="1.5" fill={color} stroke="none" />
        </svg>
      );

    case 'arch':
      return (
        <svg viewBox="0 0 120 24" {...common}>
          <path d="M42 22V14a18 18 0 0 1 36 0v8" opacity="0.7" />
          <path d="M6 22h28M86 22h28" opacity="0.3" />
        </svg>
      );

    default:
      return null;
  }
}

'use client';
import { Lock } from 'lucide-react';
import { faceOf, templates, templatesForOccasion, type Template } from '@/config';
import { cn } from '@/lib/utils';

interface TemplatePickerProps {
  occasionId: string;
  value: string;
  planId: string;
  canUse: (templateId: string) => boolean;
  onChange: (templateId: string) => void;
}

/**
 * Choosing a design.
 *
 * Ordered by how well each template suits the chosen occasion, because a host picking for a
 * memorial should not have to scroll past Carnival to find Linen. Locked templates are
 * shown, not hidden: a design nobody can see is a design nobody upgrades for.
 *
 * Each swatch is a miniature of the real thing — palette, display face and layout shape —
 * rather than a colour chip, so what a host picks is what they get.
 */
export function TemplatePicker({ occasionId, value, canUse, onChange }: TemplatePickerProps) {
  const ordered = templatesForOccasion(occasionId);
  // Anything not suited to this occasion still belongs on the page, just later.
  const rest = templates.filter((t) => !ordered.some((o) => o.id === t.id));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[...ordered, ...rest].map((template) => (
        <TemplateSwatch
          key={template.id}
          template={template}
          selected={value === template.id}
          locked={!canUse(template.id)}
          onSelect={() => onChange(template.id)}
        />
      ))}
    </div>
  );
}

function TemplateSwatch({
  template,
  selected,
  locked,
  onSelect,
}: {
  template: Template;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  const face = faceOf(template);

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={locked ? `${template.label} — part of a paid plan` : template.label}
      title={locked ? `${template.label} — part of a paid plan` : template.blurb}
      className={cn(
        'group relative overflow-hidden rounded-2xl text-left transition-all duration-200',
        'ring-1 ring-[var(--border-subtle)]',
        selected && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface-page)]',
        locked
          ? 'cursor-not-allowed opacity-55'
          : 'hover:-translate-y-0.5 hover:shadow-[var(--shadow-soft)]',
      )}
    >
      <TemplatePreview template={template} />

      <span className="flex items-center justify-between gap-1 bg-[var(--surface-raised)] px-3 py-2">
        <span
          className="truncate text-sm font-medium"
          style={{ fontFamily: face.stack, letterSpacing: face.tracking }}
        >
          {template.label}
        </span>
        {locked && <Lock className="size-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden />}
      </span>

      {selected && (
        <span
          aria-hidden
          className="absolute top-2 right-2 rounded-[var(--radius-pill)] bg-[var(--accent)] px-2 py-0.5 text-[0.65rem] font-medium text-[var(--accent-contrast)]"
        >
          Chosen
        </span>
      )}
    </button>
  );
}

/**
 * A miniature of the invitation.
 *
 * Deliberately not a shrunken render of the real layout component: at 120px nothing legible
 * survives, and mounting four layouts per swatch for a dozen swatches would cost more than
 * it shows. This draws the *shape* of each layout instead — where the mass sits, how the
 * type is aligned — which is what someone is actually choosing between at this size.
 */
export function TemplatePreview({
  template,
  className,
}: {
  template: Template;
  className?: string;
}) {
  const face = faceOf(template);
  const { palette, layout } = template;
  const gradient = `linear-gradient(150deg, ${palette.from}, ${palette.to})`;

  if (layout === 'poster') {
    return (
      <span
        className={cn(
          'flex aspect-[4/5] flex-col items-center justify-center gap-1.5 p-3',
          className,
        )}
        style={{ background: gradient }}
      >
        <span
          className="text-center text-[0.65rem] leading-tight"
          style={{
            fontFamily: face.stack,
            fontWeight: face.weight,
            color: palette.onGradient,
          }}
        >
          The Title
        </span>
        <span className="h-px w-6" style={{ background: palette.onGradient, opacity: 0.5 }} />
        <span
          className="h-1 w-10 rounded-full"
          style={{ background: palette.onGradient, opacity: 0.28 }}
        />
      </span>
    );
  }

  if (layout === 'editorial') {
    return (
      <span
        className={cn('flex aspect-[4/5] flex-col justify-center gap-1.5 p-3', className)}
        style={{ background: 'var(--surface-raised)' }}
      >
        <span className="h-1 w-full rounded-full" style={{ background: gradient }} />
        <span
          className="mt-1 text-[0.65rem] leading-tight"
          style={{ fontFamily: face.stack, fontWeight: face.weight }}
        >
          The Title
        </span>
        <span className="h-px w-8" style={{ background: palette.accent, opacity: 0.6 }} />
        <span className="h-1 w-full rounded-full bg-[var(--surface-sunken)]" />
        <span className="h-1 w-2/3 rounded-full bg-[var(--surface-sunken)]" />
      </span>
    );
  }

  if (layout === 'minimal') {
    return (
      <span
        className={cn(
          'flex aspect-[4/5] flex-col items-center justify-center gap-2 p-3',
          className,
        )}
        style={{
          background: 'var(--surface-raised)',
          boxShadow: `inset 0 0 0 1px ${palette.accent}`,
        }}
      >
        <span
          className="text-[0.65rem] leading-tight"
          style={{ fontFamily: face.stack, fontWeight: face.weight }}
        >
          The Title
        </span>
        <span className="h-px w-5" style={{ background: palette.accent, opacity: 0.6 }} />
        <span className="h-1 w-8 rounded-full bg-[var(--surface-sunken)]" />
      </span>
    );
  }

  // classic
  return (
    <span
      className={cn('flex aspect-[4/5] flex-col', className)}
      style={{ background: 'var(--surface-raised)' }}
    >
      <span className="h-1/3 w-full" style={{ background: gradient }} />
      <span className="flex flex-1 flex-col items-center justify-center gap-1.5 p-2">
        <span
          className="text-center text-[0.65rem] leading-tight"
          style={{ fontFamily: face.stack, fontWeight: face.weight }}
        >
          The Title
        </span>
        <span className="h-px w-6" style={{ background: palette.accent, opacity: 0.6 }} />
        <span className="h-1 w-10 rounded-full bg-[var(--surface-sunken)]" />
      </span>
    </span>
  );
}

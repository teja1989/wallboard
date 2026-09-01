'use client';
import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const CONTROL = cn(
  'w-full rounded-2xl border bg-[var(--surface-raised)] px-4 py-3',
  'text-[var(--text-primary)] placeholder:text-[var(--text-muted)]',
  'border-[var(--border-subtle)] transition-colors duration-200',
  'focus:border-[var(--accent)] focus:outline-none focus:ring-4 focus:ring-[var(--accent-soft)]',
  'disabled:opacity-60',
);

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  controlId: string;
  children: React.ReactNode;
}

function FieldShell({ label, hint, error, controlId, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={controlId} className="block text-sm font-medium text-[var(--text-secondary)]">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${controlId}-error`} role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      ) : hint ? (
        <p id={`${controlId}-hint`} className="text-sm text-[var(--text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, hint, error, className, ...props },
  ref,
) {
  const id = useId();
  return (
    <FieldShell label={label} hint={hint} error={error} controlId={id}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(CONTROL, error && 'border-[var(--danger)]', className)}
        {...props}
      />
    </FieldShell>
  );
});

export interface TextAreaFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'id'
> {
  label: string;
  hint?: string;
  error?: string;
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(
  function TextAreaField({ label, hint, error, className, ...props }, ref) {
    const id = useId();
    return (
      <FieldShell label={label} hint={hint} error={error} controlId={id}>
        <textarea
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={cn(CONTROL, 'resize-none', error && 'border-[var(--danger)]', className)}
          {...props}
        />
      </FieldShell>
    );
  },
);

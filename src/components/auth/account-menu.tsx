'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CreditCard, LogOut, Settings, Sparkles } from 'lucide-react';
import { useAuth } from '@/components/auth/auth-provider';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const linkClass =
  'flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]';

/**
 * The account control in the header, and the primary call to action beside it.
 *
 * Both live in one client island because both depend on who is looking: a host who has
 * already signed in should not be told to "Start free", and until this existed the account
 * page had nothing anywhere in the product linking to it.
 *
 * Rendered on the server in its signed-out state, which is also what someone with no
 * JavaScript keeps — the marketing header still offers the thing it is there to offer.
 */
export function AccountMenu({ createLabel = 'Start free' }: { createLabel?: string }) {
  const { actor, isAnonymous, loading, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const signedIn = !loading && actor !== null && !isAnonymous;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <>
      {signedIn ? (
        <div ref={container} className="relative">
          <button
            type="button"
            onClick={() => setOpen((was) => !was)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Your account"
            className={cn(
              'flex items-center gap-2 rounded-[var(--radius-pill)] py-1 pr-3 pl-1 transition-colors',
              'hover:bg-[var(--surface-sunken)]',
              open && 'bg-[var(--surface-sunken)]',
            )}
          >
            <Avatar name={actor.displayName || 'You'} photoUrl={actor.photoUrl} size={32} />
            <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
              {firstNameOf(actor.displayName)}
            </span>
          </button>

          {open && (
            <div
              role="menu"
              className={cn(
                'absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl py-1.5',
                'border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-[var(--shadow-lift)]',
              )}
            >
              <div className="border-b border-[var(--border-subtle)] px-4 pt-1 pb-3">
                <p className="truncate text-sm font-medium">
                  {actor.displayName || 'Your account'}
                </p>
                {actor.email && (
                  <p className="truncate text-xs text-[var(--text-muted)]">{actor.email}</p>
                )}
              </div>

              <Link
                href="/account"
                role="menuitem"
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                <Sparkles className="size-4" aria-hidden />
                Your invitations
              </Link>
              <Link
                href="/account?tab=plan"
                role="menuitem"
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                <CreditCard className="size-4" aria-hidden />
                Plan &amp; payment
              </Link>
              <Link
                href="/account?tab=settings"
                role="menuitem"
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                <Settings className="size-4" aria-hidden />
                Settings
              </Link>

              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
                className={cn(linkClass, 'w-full border-t border-[var(--border-subtle)] text-left')}
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link
          href="/signin?next=/account"
          className="rounded-[var(--radius-pill)] px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
        >
          Sign in
        </Link>
      )}

      <Link
        href="/create"
        className="ml-1 inline-flex h-10 items-center rounded-[var(--radius-pill)] bg-[var(--accent)] px-4 text-sm font-medium text-[var(--accent-contrast)] transition-all duration-200 hover:bg-[var(--accent-hover)] active:scale-[0.97]"
      >
        {signedIn ? 'New invitation' : createLabel}
      </Link>
    </>
  );
}

function firstNameOf(displayName: string): string {
  return displayName.split(' ')[0] || 'You';
}

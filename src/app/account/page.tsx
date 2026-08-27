'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, LogOut, Plus, Users } from 'lucide-react';
import { brand, occasionById } from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/client/api-client';
import { formatEventDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface HostedEvent {
  id: string;
  title: string;
  occasion: string;
  startsAt: number | null;
  createdAt: number;
  status: string;
  postCount: number;
  rsvpTally: { yes: number; no: number; maybe: number; pending: number; attending: number };
}

/**
 * The account.
 *
 * The reason to have one, from the host's side. Everything else in the product asks them to
 * sign in; this is the page that repays it — every invitation they have made, on whatever
 * device they are holding, with the headcount they actually wanted to know.
 *
 * Without it "sign in" is a toll. With it, it is where their work lives.
 */
export default function AccountPage() {
  const router = useRouter();
  const { actor, isAnonymous, loading, signOut } = useAuth();
  const [events, setEvents] = useState<HostedEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signedIn = !loading && actor && !isAnonymous;

  const load = useCallback(async () => {
    try {
      const result = await api.get<{ events: HostedEvent[] }>('/api/events/mine');
      setEvents(result.events);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load your invitations.'));
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void (async () => {
      await load();
    })();
  }, [signedIn, load]);

  if (!loading && (!actor || isAnonymous)) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12 text-center">
        <SignInPrompt
          title="Your invitations"
          body="Sign in to see everything you have made."
          returnTo="/account"
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        ← {brand.name}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Your invitations</h1>
          {actor && (
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Signed in as {actor.email ?? actor.displayName}
            </p>
          )}
        </div>
        <Button variant="soft" size="sm" onClick={() => router.push('/create')}>
          <Plus className="size-4" aria-hidden />
          New invitation
        </Button>
      </header>

      {error && (
        <p role="alert" className="mt-6 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {events === null && !error && (
        <p className="mt-8 text-sm text-[var(--text-muted)]">Loading…</p>
      )}

      {events !== null && events.length === 0 && (
        <div className="mt-8 rounded-2xl bg-[var(--surface-sunken)] p-8 text-center">
          <p className="text-[var(--text-secondary)]">You have not made one yet.</p>
          <Button className="mt-4" onClick={() => router.push('/create')}>
            Make an invitation
          </Button>
        </div>
      )}

      <ul className="mt-8 space-y-3">
        {(events ?? []).map((event) => (
          <li key={event.id}>
            <Link
              href={`/e/${event.id}`}
              className="card block p-5 transition-colors hover:bg-[var(--accent-soft)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-medium">{event.title}</h2>
                  <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                    {occasionById(event.occasion).label}
                    {event.startsAt ? ` · ${formatEventDate(event.startsAt)}` : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-medium',
                    event.status === 'live'
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'bg-[var(--surface-sunken)] text-[var(--text-muted)]',
                  )}
                >
                  {event.status}
                </span>
              </div>

              {/* The two numbers a host actually opens this page to check. */}
              <div className="mt-3 flex gap-4 text-sm text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden />
                  {event.rsvpTally.attending} coming
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="size-4" aria-hidden />
                  {event.postCount} on the wall
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-10 border-t border-[var(--border-subtle)] pt-6">
        <button
          type="button"
          onClick={async () => {
            await signOut();
            router.push('/');
          }}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </div>
    </main>
  );
}

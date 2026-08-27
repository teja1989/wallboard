'use client';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Check, LogOut, Plus, Sparkles, Users } from 'lucide-react';
import { brand, formatPrice, occasionById, planById } from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import { cn, formatEventDate } from '@/lib/utils';

interface HostedEvent {
  id: string;
  title: string;
  occasion: string;
  startsAt: number | null;
  timeZone: string | null;
  createdAt: number;
  status: string;
  postCount: number;
  rsvpTally: { yes: number; no: number; maybe: number; pending: number; attending: number };
}

interface AccountSummary {
  profile: {
    uid: string;
    email: string | null;
    displayName: string;
    photoUrl: string | null;
    role: string;
  };
  billing: {
    plan: string;
    effectivePlan: string;
    live: boolean;
    currentPeriodEnd: number | null;
    hasCustomer: boolean;
  };
  stats: { events: number; live: number; attending: number };
}

const SECTIONS = ['invitations', 'plan', 'settings'] as const;
type Section = (typeof SECTIONS)[number];

function sectionFrom(value: string | null): Section {
  return (SECTIONS as readonly string[]).includes(value ?? '') ? (value as Section) : 'invitations';
}

/**
 * The account.
 *
 * Every other page in the product asks someone to sign in. This is the one that repays it:
 * what they have made, what they are on, and what they can change — the three questions an
 * account exists to answer, in the order people ask them.
 *
 * Sections rather than separate routes, because there is not enough here to justify making
 * someone navigate, and a single page is one place to come back to.
 */
export default function AccountPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { notify } = useToast();
  const { actor, isAnonymous, loading, signOut } = useAuth();

  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [events, setEvents] = useState<HostedEvent[] | null>(null);
  const [section, setSection] = useState<Section>(() => sectionFrom(params.get('tab')));
  const [error, setError] = useState<string | null>(null);

  const signedIn = !loading && actor && !isAnonymous;

  const load = useCallback(async () => {
    try {
      const [account, mine] = await Promise.all([
        api.get<AccountSummary>('/api/account'),
        api.get<{ events: HostedEvent[] }>('/api/events/mine'),
      ]);
      setSummary(account);
      setEvents(mine.events);
    } catch (caught) {
      setError(errorMessage(caught, 'Could not load your account.'));
    }
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    void (async () => {
      await load();
    })();
  }, [signedIn, load]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 text-center">
        <p className="text-sm text-[var(--text-muted)]">One moment…</p>
      </main>
    );
  }

  if (!signedIn) {
    return (
      <SignInPrompt
        title="Your account"
        body="Sign in to see your invitations, your plan, and your settings."
        returnTo="/account"
      />
    );
  }

  const firstName = (summary?.profile.displayName ?? actor?.displayName ?? '').split(' ')[0];

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
      >
        ← {brand.name}
      </Link>

      {/*
        A greeting that uses what we actually know. Their name, and the one number that
        makes the account feel like it holds something — people invited, not events made.
      */}
      <header className="flex items-center gap-4">
        <Avatar
          name={summary?.profile.displayName || actor?.displayName || 'You'}
          photoUrl={summary?.profile.photoUrl ?? actor?.photoUrl}
          size={56}
        />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">
            {firstName ? `Hello, ${firstName}` : 'Your account'}
          </h1>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {summary
              ? summary.stats.events === 0
                ? 'No invitations yet — the first one takes a minute.'
                : `${summary.stats.events} invitation${summary.stats.events === 1 ? '' : 's'}` +
                  (summary.stats.attending > 0
                    ? ` · ${summary.stats.attending} ${summary.stats.attending === 1 ? 'person' : 'people'} coming`
                    : '')
              : 'Loading…'}
          </p>
        </div>
      </header>

      <nav className="mt-8 flex gap-1 border-b border-[var(--border-subtle)]">
        {(
          [
            ['invitations', 'Invitations'],
            ['plan', 'Plan & payment'],
            ['settings', 'Settings'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSection(id);
              router.replace(id === 'invitations' ? '/account' : `/account?tab=${id}`, {
                scroll: false,
              });
            }}
            aria-current={section === id ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              section === id
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]',
            )}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <p role="alert" className="mt-6 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {section === 'invitations' && (
        <Invitations events={events} onCreate={() => router.push('/create')} />
      )}
      {section === 'plan' && summary && <PlanSection billing={summary.billing} notify={notify} />}
      {section === 'settings' && summary && (
        <SettingsSection
          summary={summary}
          onSaved={load}
          onSignOut={async () => {
            await signOut();
            router.push('/');
          }}
        />
      )}
    </main>
  );
}

function Invitations({ events, onCreate }: { events: HostedEvent[] | null; onCreate: () => void }) {
  if (events === null) return <p className="mt-8 text-sm text-[var(--text-muted)]">Loading…</p>;

  if (events.length === 0) {
    return (
      <div className="mt-8 rounded-2xl bg-[var(--surface-sunken)] p-8 text-center">
        <p className="text-[var(--text-secondary)]">You have not made one yet.</p>
        <Button className="mt-4" onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          Make an invitation
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-6 flex justify-end">
        <Button variant="soft" size="sm" onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          New invitation
        </Button>
      </div>
      <ul className="mt-3 space-y-3">
        {events.map((event) => (
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
                    {event.startsAt ? ` · ${formatEventDate(event.startsAt, event.timeZone)}` : ''}
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
              <div className="mt-3 flex gap-4 text-sm text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden />
                  {event.rsvpTally?.attending ?? 0} coming
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
    </>
  );
}

/**
 * Plan and payment.
 *
 * Honest about where billing actually stands. While it is in preview every event runs on
 * the top plan and nobody is charged — saying so plainly is better than a dormant upgrade
 * button, which would either take money we are not ready to take or do nothing when pressed.
 */
function PlanSection({
  billing,
  notify,
}: {
  billing: AccountSummary['billing'];
  notify: (message: string, tone?: 'success' | 'error') => void;
}) {
  const [busy, setBusy] = useState(false);
  const plan = planById(billing.effectivePlan);

  async function openPortal() {
    setBusy(true);
    try {
      const result = await api.post<{ url: string }>('/api/billing/portal');
      window.location.assign(result.url);
    } catch (caught) {
      notify(errorMessage(caught, 'Could not open billing.'), 'error');
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wider text-[var(--text-muted)] uppercase">
              Current plan
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{plan.label}</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatPrice(plan)}</p>
          </div>
          <Sparkles className="size-5 shrink-0 text-[var(--accent)]" aria-hidden />
        </div>

        <ul className="mt-5 space-y-2">
          {plan.highlights.map((line) => (
            <li key={line} className="flex gap-2.5 text-sm text-[var(--text-secondary)]">
              <Check className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" aria-hidden />
              {line}
            </li>
          ))}
        </ul>

        {billing.currentPeriodEnd && (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            Renews {formatEventDate(billing.currentPeriodEnd)}
          </p>
        )}
      </div>

      {billing.live ? (
        <div className="card p-6">
          <h3 className="text-sm font-medium">Payment</h3>
          {billing.hasCustomer ? (
            <>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Cards, invoices and cancellation are handled by our payment provider.
              </p>
              <Button variant="soft" className="mt-4" loading={busy} onClick={openPortal}>
                Manage billing
              </Button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Nothing on file. You are charged only when you upgrade an event or take a
                subscription.
              </p>
              <Link
                href="/pricing"
                className="mt-4 inline-flex h-11 items-center rounded-[var(--radius-pill)] bg-[var(--accent)] px-5 text-sm font-medium text-[var(--accent-contrast)]"
              >
                See the plans
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="card p-6">
          <h3 className="text-sm font-medium">Payment</h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
            Nothing is being charged. While {brand.name} is in preview every invitation runs on{' '}
            {plan.label} — every design, every limit — and no card is asked for. When that changes
            you will be told before it does, not after.
          </p>
          <Link
            href="/pricing"
            className="mt-3 inline-block text-sm underline underline-offset-4 hover:text-[var(--text-primary)]"
          >
            What the plans will cost
          </Link>
        </div>
      )}
    </section>
  );
}

function SettingsSection({
  summary,
  onSaved,
  onSignOut,
}: {
  summary: AccountSummary;
  onSaved: () => Promise<void>;
  onSignOut: () => Promise<void>;
}) {
  const { notify } = useToast();
  const [name, setName] = useState(summary.profile.displayName);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch('/api/account', { displayName: name });
      await onSaved();
      notify('Saved.', 'success');
    } catch (caught) {
      notify(errorMessage(caught, 'Could not save that.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <form onSubmit={save} className="card space-y-4 p-6">
        <TextField
          label="Your name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          hint="Shown on your invitations and beside anything you post."
          required
        />
        <div>
          <p className="text-sm font-medium text-[var(--text-secondary)]">Email</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {summary.profile.email ?? 'None on this account'}
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            This is how you sign in, so it cannot be changed here.
          </p>
        </div>
        <Button type="submit" loading={saving} disabled={!name.trim()}>
          Save
        </Button>
      </form>

      <div className="card p-6">
        <h3 className="text-sm font-medium">Session</h3>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Signing out here ends this session everywhere it is open.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-4 inline-flex items-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--danger)]"
        >
          <LogOut className="size-4" aria-hidden />
          Sign out
        </button>
      </div>
    </section>
  );
}

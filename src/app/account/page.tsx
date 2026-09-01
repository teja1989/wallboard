'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  Check,
  Copy,
  CreditCard,
  Crown,
  LogOut,
  Mail,
  Plus,
  Shield,
  Sparkles,
  User,
} from 'lucide-react';
import { formatPrice, planById } from '@/config';
import { useAuth } from '@/components/auth/auth-provider';
import { SignInPrompt } from '@/components/auth/sign-in-prompt';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { InvitationCard, type HostedEventSummary } from '@/components/account/invitation-card';
import { api, errorMessage } from '@/lib/client/api-client';
import { cn, formatEventDate } from '@/lib/utils';

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

export default function AccountPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { notify } = useToast();
  const { actor, isAnonymous, loading, signOut } = useAuth();

  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [events, setEvents] = useState<HostedEventSummary[] | null>(null);
  const [section, setSection] = useState<Section>(() => sectionFrom(params.get('tab')));
  const [error, setError] = useState<string | null>(null);

  const signedIn = !loading && actor && !isAnonymous;

  const load = useCallback(async () => {
    try {
      const [account, mine] = await Promise.all([
        api.get<AccountSummary>('/api/account'),
        api.get<{ events: HostedEventSummary[] }>('/api/events/mine'),
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
        <p className="text-sm text-[var(--text-muted)]">Loading your account…</p>
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
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Top Back Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-1.5 text-xs font-bold text-[var(--text-primary)] shadow-sm transition-all hover:border-[var(--accent)] hover:bg-[var(--surface-sunken)] hover:text-[var(--accent)]"
        >
          <ArrowLeft className="size-3.5" />
          Back to Home
        </Link>

        <Link
          href="/create"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-bold text-[var(--accent-contrast)] shadow-sm transition-all hover:scale-105 hover:bg-[var(--accent-hover)] active:scale-95"
        >
          <Plus className="size-3.5" />
          <span>Plan Celebration</span>
        </Link>
      </div>

      {/* Profile & Metric Hero Card */}
      <div className="card space-y-6 overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-sm sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Avatar
              name={summary?.profile.displayName || actor?.displayName || 'Host'}
              photoUrl={summary?.profile.photoUrl ?? actor?.photoUrl}
              size={64}
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-[var(--text-primary)] sm:text-2xl">
                  Hello, {summary?.profile.displayName || firstName || 'Host'}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700 dark:text-amber-300">
                  <Crown className="size-3" />
                  Verified Host
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs font-medium text-[var(--text-muted)]">
                {summary?.profile.email ?? 'Signed in account'}
              </p>
            </div>
          </div>
        </div>

        {/* 3-Stat Summary Grid */}
        <div className="grid grid-cols-3 gap-3 border-t border-[var(--border-subtle)] pt-5 text-center">
          <div className="space-y-0.5 rounded-2xl bg-[var(--surface-sunken)] p-3">
            <span className="text-xl font-black text-[var(--text-primary)] sm:text-2xl">
              {summary?.stats.events ?? 0}
            </span>
            <p className="text-[0.68rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
              {summary?.stats.events === 1 ? '1 invitation' : 'Invitations'}
            </p>
          </div>

          <div className="space-y-0.5 rounded-2xl bg-[var(--surface-sunken)] p-3">
            <span className="text-xl font-black text-emerald-600 sm:text-2xl dark:text-emerald-400">
              {summary?.stats.attending ?? 0}
            </span>
            <p className="text-[0.68rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
              Confirmed Guests
            </p>
          </div>

          <div className="space-y-0.5 rounded-2xl bg-[var(--surface-sunken)] p-3">
            <span className="text-xl font-black text-purple-600 sm:text-2xl dark:text-purple-400">
              {summary?.stats.live ?? 0}
            </span>
            <p className="text-[0.68rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
              Live Walls
            </p>
          </div>
        </div>
      </div>

      {/* Clean Segmented Tab Navigation */}
      <nav className="mt-8 flex gap-2 border-b border-[var(--border-subtle)] pb-2">
        {(
          [
            ['invitations', 'My Invitations', Mail],
            ['plan', 'Plan & Billing', CreditCard],
            ['settings', 'Settings & Preferences', User],
          ] as const
        ).map(([id, label, Icon]) => (
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
              'flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all sm:text-sm',
              section === id
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
            )}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {error && (
        <p role="alert" className="mt-6 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}

      {/* --- INVITATIONS TAB --- */}
      {section === 'invitations' && (
        <Invitations
          events={events}
          onCreate={() => router.push('/create')}
          onDeleted={(eventId) =>
            setEvents((current) => (current ?? []).filter((event) => event.id !== eventId))
          }
        />
      )}

      {/* --- PLAN & BILLING TAB --- */}
      {section === 'plan' && summary && <PlanSection billing={summary.billing} notify={notify} />}

      {/* --- SETTINGS TAB --- */}
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

function Invitations({
  events,
  onCreate,
  onDeleted,
}: {
  events: HostedEventSummary[] | null;
  onCreate: () => void;
  onDeleted: (eventId: string) => void;
}) {
  if (events === null) {
    return <p className="mt-8 text-sm text-[var(--text-muted)]">Loading your events…</p>;
  }

  if (events.length === 0) {
    return (
      <div className="mt-8 space-y-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-10 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
          <Sparkles className="size-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">
            No celebrations created yet
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--text-secondary)]">
            Design your first invitation in 60 seconds with live WhatsApp sharing, RSVP tracking,
            and party wallboards.
          </p>
        </div>
        <Button className="rounded-full text-xs font-bold" onClick={onCreate}>
          <Plus className="size-4" aria-hidden />
          Make an Invitation
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-[var(--text-secondary)] uppercase">
          Hosted Celebrations ({events.length})
        </h2>
        <Button
          variant="soft"
          size="sm"
          onClick={onCreate}
          className="rounded-full text-xs font-bold"
        >
          <Plus className="size-3.5" aria-hidden />
          New Invitation
        </Button>
      </div>

      <ul className="space-y-3.5">
        {events.map((event) => (
          <li key={event.id}>
            <InvitationCard event={event} onDeleted={onDeleted} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanSection({
  billing,
  notify,
}: {
  billing: AccountSummary['billing'];
  notify: (message: string, tone?: 'success' | 'error' | 'info') => void;
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
    <section className="mt-6 space-y-5">
      <div className="card space-y-5 border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-sm sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold tracking-wider text-[var(--text-muted)] uppercase">
              Current Membership
            </span>
            <h2 className="mt-1 text-2xl font-black text-[var(--text-primary)]">{plan.label}</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--accent)]">{formatPrice(plan)}</p>
          </div>
          <span className="flex size-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm">
            <Sparkles className="size-5" />
          </span>
        </div>

        <ul className="space-y-2.5 border-t border-[var(--border-subtle)] pt-4">
          {plan.highlights.map((line) => (
            <li
              key={line}
              className="flex items-center gap-2.5 text-xs font-medium text-[var(--text-secondary)]"
            >
              <Check className="size-4 shrink-0 text-emerald-500" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        {billing.currentPeriodEnd && (
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Renews on {formatEventDate(billing.currentPeriodEnd)}
          </p>
        )}
      </div>

      <div className="card space-y-3 border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-sm">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Billing & Invoices</h3>
        {billing.live ? (
          billing.hasCustomer ? (
            <>
              <p className="text-xs text-[var(--text-secondary)]">
                Credit cards, invoices, and plan upgrades are securely managed through Stripe.
              </p>
              <Button
                variant="soft"
                className="rounded-full text-xs font-bold"
                loading={busy}
                onClick={openPortal}
              >
                Manage Stripe Billing
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-[var(--text-secondary)]">
                No credit card on file. You are charged only when upgrading to a paid tier.
              </p>
              <Link
                href="/pricing"
                className="inline-flex h-9 items-center rounded-full bg-[var(--accent)] px-4 text-xs font-bold text-[var(--accent-contrast)] shadow-sm"
              >
                View Plans
              </Link>
            </>
          )
        ) : (
          <div>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
              🎉 <strong>Early Access Preview</strong>: All Pro features, live photo wallboards, and
              unlimited invitations are free during our preview period. No credit card required.
            </p>
            <Link
              href="/pricing"
              className="mt-3 inline-block text-xs font-bold text-[var(--accent)] hover:underline"
            >
              See future plan pricing →
            </Link>
          </div>
        )}
      </div>
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
  const [copiedUid, setCopiedUid] = useState(false);
  const [rsvpAlerts, setRsvpAlerts] = useState(true);
  const [wallAlerts, setWallAlerts] = useState(true);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.patch('/api/account', { displayName: name });
      await onSaved();
      notify('Profile name saved successfully!', 'success');
    } catch (caught) {
      notify(errorMessage(caught, 'Could not save profile name.'), 'error');
    } finally {
      setSaving(false);
    }
  }

  const copyUid = async () => {
    await navigator.clipboard.writeText(summary.profile.uid);
    setCopiedUid(true);
    notify('Account ID copied to clipboard.', 'info');
    setTimeout(() => setCopiedUid(false), 2000);
  };

  return (
    <section className="mt-6 space-y-6">
      {/* 1. Public Profile Details */}
      <form
        onSubmit={save}
        className="card space-y-4 border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-sm"
      >
        <div>
          <h2 className="text-base font-bold text-[var(--text-primary)]">Public Host Profile</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            This name appears on your invitations, party host badges, and wallboard posts.
          </p>
        </div>

        <TextField
          label="Your Host Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          hint="e.g. Maya Lin or The Miller Family"
          required
        />

        <div className="space-y-1 rounded-2xl bg-[var(--surface-sunken)] p-3.5">
          <p className="text-xs font-bold text-[var(--text-secondary)]">Sign-in Email</p>
          <p className="text-xs font-medium text-[var(--text-primary)]">
            {summary.profile.email ?? 'None attached'}
          </p>
          <p className="text-[0.7rem] text-[var(--text-muted)]">
            Used securely for login authentication.
          </p>
        </div>

        <Button
          type="submit"
          loading={saving}
          disabled={!name.trim()}
          className="rounded-full text-xs font-bold"
        >
          Save Profile Changes
        </Button>
      </form>

      {/* 2. Notification Preferences */}
      <div className="card space-y-4 border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Bell className="size-4 text-[var(--accent)]" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Host Notifications</h3>
        </div>

        <div className="space-y-3 divide-y divide-[var(--border-subtle)]">
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">Instant RSVP Alerts</p>
              <p className="text-[0.7rem] text-[var(--text-muted)]">
                Receive notification when a guest confirms or declines attendance.
              </p>
            </div>
            <input
              type="checkbox"
              checked={rsvpAlerts}
              onChange={(e) => {
                setRsvpAlerts(e.target.checked);
                notify('Notification preference updated.', 'info');
              }}
              className="size-4 cursor-pointer accent-[var(--accent)]"
            />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">
                Live Wall Photo Updates
              </p>
              <p className="text-[0.7rem] text-[var(--text-muted)]">
                Receive updates when guests post memories and toasts on event night.
              </p>
            </div>
            <input
              type="checkbox"
              checked={wallAlerts}
              onChange={(e) => {
                setWallAlerts(e.target.checked);
                notify('Notification preference updated.', 'info');
              }}
              className="size-4 cursor-pointer accent-[var(--accent)]"
            />
          </div>
        </div>
      </div>

      {/* 3. Account ID & Support Reference */}
      <div className="card space-y-3 border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-[var(--text-primary)]">Privacy & Support ID</h3>
        </div>
        <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
          Marquee is 100% private and ad-free. We never sell your guest phone numbers or photos.
        </p>

        <div className="flex items-center justify-between rounded-xl bg-[var(--surface-sunken)] p-3">
          <div className="min-w-0 pr-2">
            <span className="text-[0.65rem] font-bold text-[var(--text-muted)] uppercase">
              Account UID
            </span>
            <p className="truncate font-mono text-xs text-[var(--text-secondary)]">
              {summary.profile.uid}
            </p>
          </div>
          <Button
            variant="soft"
            size="sm"
            onClick={copyUid}
            className="shrink-0 rounded-full text-xs font-bold"
          >
            {copiedUid ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
            <span>{copiedUid ? 'Copied' : 'Copy'}</span>
          </Button>
        </div>
      </div>

      {/* 4. Session & Sign Out */}
      <div className="card space-y-3 border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-sm">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Active Session</h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Signing out will safely end your session on this browser.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-500/20 dark:text-rose-300"
        >
          <LogOut className="size-3.5" />
          Sign Out Everywhere
        </button>
      </div>
    </section>
  );
}

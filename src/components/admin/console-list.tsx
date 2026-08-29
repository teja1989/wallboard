'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { adminCopy } from '@/config';
import { Button } from '@/components/ui/button';
import { api, errorMessage } from '@/lib/client/api-client';

/**
 * The shell every console list shares: a search box, a fetch, and the three states.
 *
 * Written once because the interesting part of these screens is what the rows say, and three
 * copies of load-error-empty is three chances for one of them to answer a 403 with a spinner
 * that never stops.
 *
 * Search is submitted, not debounced-as-you-type. An operator pastes an id from a complaint
 * and presses enter; typing-ahead would fire a query per keystroke against a route that is
 * rate limited precisely because it reads other people's data.
 */
export function ConsoleList<T>({
  path,
  searchLabel,
  emptyLabel,
  note,
  extract,
  children,
  refreshToken,
}: {
  /** The API route, without a query string. */
  path: string;
  searchLabel: string;
  emptyLabel: string;
  /** A caveat printed under the search box — how far the search actually reaches. */
  note?: string;
  /** Pulls the rows out of the route's envelope. */
  extract: (payload: unknown) => T[];
  children: (rows: T[], reload: () => void) => React.ReactNode;
  /** Bump to force a re-fetch after a write elsewhere on the page. */
  refreshToken?: number;
}) {
  const [query, setQuery] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  /*
    One piece of state, written once per fetch, after the await.

    Three separate `useState`s meant clearing the error at the top of the effect, which is a
    synchronous setState in an effect body — the cascading-render rule the linter enforces.
    Folding them together also removes a flash: a re-search keeps the previous rows on screen
    until the new ones land, instead of blanking to a spinner between two nearly identical
    tables.
  */
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; rows: T[] } | { status: 'error'; message: string }
  >({ status: 'loading' });

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const payload = await api.get<unknown>(`${path}?q=${encodeURIComponent(query)}`);
        if (!cancelled) setState({ status: 'ready', rows: extract(payload) });
      } catch (caught) {
        if (!cancelled) {
          setState({ status: 'error', message: errorMessage(caught, adminCopy.denied) });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // `extract` is a literal at every call site; listing it would re-fetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, query, reloadToken, refreshToken]);

  return (
    <div className="space-y-4">
      {/*
        Uncontrolled, and read out of the form at submit rather than mirrored into state.

        A controlled input would put the search term in state that the submit handler closes
        over, which is one render behind by construction — the class of bug where a fast
        paste-and-click submits the previous value. Reading the field at the moment of submit
        cannot be stale, and a search box has no other reason to want the keystrokes.
      */}
      <form
        onSubmit={(submitEvent) => {
          submitEvent.preventDefault();
          const value = new FormData(submitEvent.currentTarget).get('q');
          setQuery(typeof value === 'string' ? value : '');
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor="console-search">
          {searchLabel}
        </label>
        <input
          id="console-search"
          name="q"
          defaultValue=""
          placeholder={searchLabel}
          className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] px-4 py-2.5 text-sm focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
        />
        <Button type="submit" size="sm" variant="soft">
          <Search className="size-4" aria-hidden />
          Search
        </Button>
      </form>

      {note && <p className="text-xs text-[var(--text-muted)]">{note}</p>}

      {state.status === 'error' && (
        <p role="alert" className="card p-5 text-sm text-[var(--text-secondary)]">
          {state.message}
        </p>
      )}

      {state.status === 'loading' && (
        <div className="card flex justify-center p-10">
          <Loader2 className="size-5 animate-spin text-[var(--text-muted)]" aria-label="Loading" />
        </div>
      )}

      {state.status === 'ready' && state.rows.length === 0 && (
        <p className="card p-5 text-sm text-[var(--text-secondary)]">{emptyLabel}</p>
      )}

      {state.status === 'ready' && state.rows.length > 0 && children(state.rows, reload)}
    </div>
  );
}

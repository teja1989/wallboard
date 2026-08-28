'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, X } from 'lucide-react';
import { placesConfig, placesCopy } from '@/config';
import { api } from '@/lib/client/api-client';
import { cn } from '@/lib/utils';

/** What the host chose, or typed. */
export interface ChosenPlace {
  name: string;
  address: string;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  /** The venue's own zone, when we know where it is. */
  timeZone: string | null;
}

interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

/**
 * Finding the venue.
 *
 * **It is a text box first and a search second.** Half of real events happen somewhere
 * Google has never heard of — a back garden, a village hall, a friend's roof — so whatever
 * the host types is kept whether or not anything is found. Choosing a suggestion adds
 * coordinates; ignoring the suggestions loses nothing.
 *
 * When no API key is configured this is exactly the plain input it has always been, with no
 * error and no dead affordance, because a feature that was never switched on should look
 * switched off rather than broken.
 *
 * The session token is why this is not expensive. Google bills autocomplete per *session* —
 * a run of keystrokes plus the details lookup that ends it — and without one every
 * keystroke is its own charge.
 */
export function AddressField({
  address,
  onAddressChange,
  onPlaceChosen,
}: {
  address: string;
  onAddressChange: (value: string) => void;
  onPlaceChosen: (place: ChosenPlace) => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  /**
   * Whether search is worth trying.
   *
   * Discovered rather than configured: the route answers 404 when no API key is set, and
   * one wasted request beats a `NEXT_PUBLIC_` flag baked into the bundle at build time and
   * silently disagreeing with the server that actually holds the key.
   */
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);

  const session = useRef<string>('');
  const container = useRef<HTMLDivElement>(null);
  // Guards against an older, slower response overwriting a newer one.
  const latest = useRef(0);

  /** A session lasts from the first keystroke to the choice that ends it. */
  const sessionToken = useCallback(() => {
    if (!session.current) session.current = crypto.randomUUID();
    return session.current;
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Long enough to be worth asking about. Derived rather than cleared in the effect below:
  // a synchronous setState there cascades renders, and the lint rule saying so is right.
  const worthSearching = searchEnabled && address.trim().length >= placesConfig.minQueryLength;

  useEffect(() => {
    if (!worthSearching) return;

    // Debounced, so a typed address is a handful of requests rather than one per letter.
    const timer = window.setTimeout(() => {
      const attempt = ++latest.current;
      setSearching(true);
      void (async () => {
        try {
          const result = await api.post<{ suggestions: Suggestion[] }>('/api/places/autocomplete', {
            query: address.trim(),
            sessionToken: sessionToken(),
          });
          if (attempt !== latest.current) return;
          setSuggestions(result.suggestions);
          setOpen(result.suggestions.length > 0);
          setSearched(true);
        } catch (error) {
          // Search being unavailable must never block typing an address by hand.
          if (attempt !== latest.current) return;
          setSuggestions([]);
          // 404 means the feature was never switched on. Stop asking rather than paying
          // the round trip on every keystroke for the rest of the session.
          if ((error as { status?: number }).status === 404) setSearchEnabled(false);
        } finally {
          if (attempt === latest.current) setSearching(false);
        }
      })();
    }, placesConfig.debounceMs);

    return () => window.clearTimeout(timer);
  }, [address, worthSearching, sessionToken]);

  async function choose(suggestion: Suggestion) {
    setOpen(false);
    setSuggestions([]);
    try {
      const result = await api.post<{ place: ChosenPlace }>('/api/places/details', {
        placeId: suggestion.placeId,
        sessionToken: sessionToken(),
      });
      // The session ends with the details call; the next keystroke starts a new one.
      session.current = '';
      onPlaceChosen(result.place);
    } catch {
      // Keep what they picked even if the lookup failed — the words are the useful part.
      onAddressChange([suggestion.primary, suggestion.secondary].filter(Boolean).join(', '));
    }
  }

  const visible = worthSearching ? suggestions : [];

  return (
    <div ref={container} className="relative">
      <label htmlFor="location-address" className="mb-1.5 block font-medium">
        {placesCopy.label}
      </label>

      <div className="relative">
        <MapPin
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-[var(--text-muted)]"
          aria-hidden
        />
        <input
          id="location-address"
          value={address}
          onChange={(event) => onAddressChange(event.target.value)}
          onFocus={() => setOpen(visible.length > 0)}
          autoComplete="off"
          placeholder={searchEnabled ? placesCopy.placeholder : 'Where is it?'}
          className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-3 pr-11 pl-11 transition-colors focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] focus:outline-none"
        />
        {searching && (
          <Loader2
            className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-[var(--text-muted)]"
            aria-label={placesCopy.searching}
          />
        )}
        {!searching && address.length > 0 && (
          <button
            type="button"
            onClick={() => onAddressChange('')}
            aria-label={placesCopy.cleared}
            className="absolute top-1/2 right-3 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {open && visible.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-1 shadow-[var(--shadow-lift)]"
        >
          {visible.map((suggestion) => (
            <li key={suggestion.placeId}>
              <button
                type="button"
                onClick={() => choose(suggestion)}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left transition-colors',
                  'hover:bg-[var(--accent-soft)]',
                )}
              >
                <span className="text-sm font-medium">{suggestion.primary}</span>
                {suggestion.secondary && (
                  <span className="text-xs text-[var(--text-muted)]">{suggestion.secondary}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1.5 text-sm text-[var(--text-muted)]">
        {worthSearching && searched && visible.length === 0 && !searching
          ? placesCopy.noResults
          : placesCopy.manualHint}
      </p>
    </div>
  );
}

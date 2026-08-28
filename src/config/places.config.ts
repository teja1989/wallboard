import { HOUR, MINUTE } from './limits.config';

/**
 * Address lookup.
 *
 * Two decisions shape this, and both are about the key.
 *
 * **Every call goes through our own server.** The obvious implementation loads Google's
 * JavaScript and talks to Places from the browser with a referrer-restricted key. A
 * referrer restriction is a request header, and a request header is a thing anyone can
 * type — so that key is public the moment it ships, and the bill is public with it.
 * Proxying keeps it in Secret Manager, lets us rate-limit per user, and means no CSP
 * change and no Google script in the page.
 *
 * **A session is one billable unit, not one per keystroke.** Google bills autocomplete by
 * *session*: every keystroke plus the final details lookup, tied together by a session
 * token. Without the token each keystroke is its own billable request, which is roughly a
 * tenfold difference on the same typing.
 *
 * The whole feature is optional. With no key configured the address field is the plain text
 * box it has always been, which is exactly what a deploy without one should get.
 */

export const placesConfig = {
  /** Google's Places API (New). The older one has a different shape and is being retired. */
  autocompleteUrl: 'https://places.googleapis.com/v1/places:autocomplete',
  detailsUrl: 'https://places.googleapis.com/v1/places',
  staticMapUrl: 'https://maps.googleapis.com/maps/api/staticmap',

  /**
   * Only what we store. Google charges by field mask, and asking for everything about a
   * place when we want its name, address and coordinates is how a free tier evaporates.
   */
  detailsFieldMask: 'id,displayName,formattedAddress,location',

  /** Enough to choose from without becoming a list to read. */
  maxSuggestions: 5,

  /** Below this there is nothing useful to suggest, and every keystroke is a request. */
  minQueryLength: 3,

  /** Typing pause before we ask. Long enough to skip most keystrokes, short enough to feel live. */
  debounceMs: 250,

  /**
   * How long a static map stays cached.
   *
   * A venue does not move, so this can be aggressive — it is the difference between paying
   * for one map render and paying for one per guest who opens the invitation.
   */
  mapCacheSeconds: 24 * (HOUR / 1000),

  /** Static map, at 2x for the screens people actually read invitations on. */
  map: { width: 640, height: 240, zoom: 15, scale: 2 },

  /** A session token older than this is stale; Google expires them around the same mark. */
  sessionMaxAgeMs: 3 * MINUTE,

  /**
   * Maps held in the process, not just in each guest's browser.
   *
   * `Cache-Control` alone only stops *one* browser fetching twice — a hundred guests are a
   * hundred browsers, so a shared invitation would have cost one Google render per guest.
   * That is the term that scales with the guest list rather than with events created, which
   * is exactly the wrong shape. An instance-local cache collapses it back to roughly one
   * render per venue.
   *
   * Bounded because the alternative is a process that grows with every event it has ever
   * drawn, and lost on a cold start, which is fine: the cost of a miss is one cheap call.
   */
  mapCache: { maxEntries: 200, ttlMs: 12 * (HOUR / 1000) * 1000 },
} as const;

/** Copy. Every string a host reads lives here. */
export const placesCopy = {
  label: 'Where is it?',
  placeholder: 'Search for a venue or address',
  manualHint: 'Or just type it — an address does not have to be findable to be right.',
  searching: 'Looking…',
  noResults: 'Nothing found. Typing it yourself works just as well.',
  cleared: 'Address cleared',
  /** Shown once a place is chosen and we know where it actually is. */
  resolvedZone: (zone: string) => `Times will be shown in ${zone}.`,
} as const;

/**
 * A one-tap route, without a key and without a map render.
 *
 * `query_place_id` is what makes it open the actual venue rather than a text search that
 * might land on a different branch of the same name.
 */
export function directionsUrl(address: string, placeId: string | null): string {
  const params = new URLSearchParams({ api: '1', query: address });
  if (placeId) params.set('query_place_id', placeId);
  return `https://www.google.com/maps/search/?${params.toString()}`;
}

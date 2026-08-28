import 'server-only';
import { placesConfig, serverConfig } from '@/config';
import { timeZoneAt } from '@/lib/geo';
import { ApiError } from '@/lib/server/api';

/**
 * Talking to Google Places, from the server only.
 *
 * The key never reaches a browser. A referrer-restricted browser key is public the moment
 * it ships — a referrer is a header, and a header is a thing anyone can type — so the only
 * version of this that keeps the bill ours is one where the request comes from here.
 */

export interface PlaceSuggestion {
  placeId: string;
  /** "The Fillmore" — what the host is looking for. */
  primary: string;
  /** "1805 Geary Blvd, San Francisco, CA" — what tells two of them apart. */
  secondary: string;
}

export interface PlaceDetails {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  /**
   * The venue's own timezone, resolved from its coordinates.
   *
   * Offline, from a bundled zone-boundary table, rather than Google's Time Zone API: it is
   * one fewer API to enable, one fewer key to hold, one fewer request to pay for, and it
   * cannot fail at the moment a host is trying to publish.
   *
   * This is strictly better than the host's browser zone, which is what we fall back to.
   * Someone in London booking a wedding in Goa means Goa, and their laptop does not know
   * that.
   */
  timeZone: string | null;
}

function apiKey(): string {
  const key = serverConfig().places.apiKey;
  if (!key) {
    // Reached only if a caller skips the enabled check; the routes return 404 instead.
    throw new ApiError('not_found', 'Address search is not configured.');
  }
  return key;
}

/** True when a key exists. The UI asks first and falls back to a plain text field. */
export function placesEnabled(): boolean {
  return serverConfig().places.enabled;
}

/**
 * Suggestions for what the host has typed so far.
 *
 * `sessionToken` ties every keystroke and the eventual details lookup into one billable
 * session. Dropping it turns each keystroke into its own charge.
 */
export async function suggestPlaces(
  input: string,
  sessionToken: string,
): Promise<PlaceSuggestion[]> {
  const response = await fetch(placesConfig.autocompleteUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey() },
    body: JSON.stringify({ input, sessionToken }),
  });

  if (!response.ok) {
    // Google's body can name the key. Log the status, tell the caller nothing useful.
    console.error('[places] autocomplete failed', response.status);
    throw new ApiError('bad_gateway', 'Address search is unavailable right now.');
  }

  const body = (await response.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        text?: { text?: string };
        structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
      };
    }[];
  };

  return (body.suggestions ?? [])
    .map((entry) => entry.placePrediction)
    .filter((prediction): prediction is NonNullable<typeof prediction> =>
      Boolean(prediction?.placeId),
    )
    .slice(0, placesConfig.maxSuggestions)
    .map((prediction) => ({
      placeId: prediction.placeId as string,
      primary: prediction.structuredFormat?.mainText?.text ?? prediction.text?.text ?? '',
      secondary: prediction.structuredFormat?.secondaryText?.text ?? '',
    }));
}

/** Everything we store about a chosen place, in one call. */
export async function placeDetails(
  placeId: string,
  sessionToken: string,
): Promise<PlaceDetails | null> {
  const url = new URL(`${placesConfig.detailsUrl}/${encodeURIComponent(placeId)}`);
  url.searchParams.set('sessionToken', sessionToken);

  const response = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': placesConfig.detailsFieldMask,
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    console.error('[places] details failed', response.status);
    throw new ApiError('bad_gateway', 'Could not look that place up.');
  }

  const body = (await response.json()) as {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
  };

  const lat = body.location?.latitude;
  const lng = body.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;

  return {
    placeId: body.id ?? placeId,
    name: body.displayName?.text ?? '',
    address: body.formattedAddress ?? '',
    lat,
    lng,
    timeZone: timeZoneAt(lat, lng),
  };
}

/**
 * Maps already drawn, keyed by coordinate.
 *
 * On `globalThis` for the same reason the Firestore handles are: module scope is reset by
 * hot reload, and a cache that empties on every edit is not a cache.
 */
const mapCache: Map<string, { bytes: ArrayBuffer; at: number }> =
  (globalThis as { __marqueeMapCache?: Map<string, { bytes: ArrayBuffer; at: number }> })
    .__marqueeMapCache ??
  ((
    globalThis as { __marqueeMapCache?: Map<string, { bytes: ArrayBuffer; at: number }> }
  ).__marqueeMapCache = new Map());

/**
 * A static map of the venue, fetched with our key and handed on as bytes.
 *
 * Proxied because a static map URL carries the key in plain sight, and cached *here* rather
 * than only in the response headers: `Cache-Control` stops one browser fetching twice, but
 * a hundred guests are a hundred browsers, and without this a shared invitation cost one
 * Google render per guest. Cached this side, it is one per venue.
 */
export async function staticMap(lat: number, lng: number): Promise<ArrayBuffer> {
  // Six decimal places is roughly a tenth of a metre — far finer than the map's own zoom,
  // so two guests looking at the same venue always share an entry.
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const hit = mapCache.get(key);
  if (hit && Date.now() - hit.at < placesConfig.mapCache.ttlMs) return hit.bytes;

  const { map } = placesConfig;
  const url = new URL(placesConfig.staticMapUrl);
  url.searchParams.set('center', `${lat},${lng}`);
  url.searchParams.set('zoom', String(map.zoom));
  url.searchParams.set('size', `${map.width}x${map.height}`);
  url.searchParams.set('scale', String(map.scale));
  url.searchParams.set('markers', `color:0xc5473c|${lat},${lng}`);
  url.searchParams.set('key', apiKey());

  const response = await fetch(url);
  if (!response.ok) {
    console.error('[places] static map failed', response.status);
    throw new ApiError('bad_gateway', 'Could not draw the map.');
  }

  const bytes = await response.arrayBuffer();

  // Oldest out first. A plain Map iterates in insertion order, so the first key is the
  // least recently added — enough for a cache whose miss costs one cheap request.
  if (mapCache.size >= placesConfig.mapCache.maxEntries) {
    const oldest = mapCache.keys().next().value;
    if (oldest !== undefined) mapCache.delete(oldest);
  }
  mapCache.set(key, { bytes, at: Date.now() });

  return bytes;
}

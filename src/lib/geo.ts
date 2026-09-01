import tzLookup from 'tz-lookup';

/**
 * Where a coordinate is, in time.
 *
 * Its own module with no `server-only` import so the fallback below can be tested: it is
 * the difference between a host publishing their invitation and a host staring at an error
 * because a venue sits somewhere the zone table does not recognise.
 */

/**
 * The IANA zone containing a coordinate, or null.
 *
 * Resolved offline from a bundled zone-boundary table rather than Google's Time Zone API —
 * one fewer API to enable, one fewer key to hold, one fewer request to pay for, and it
 * cannot fail at the exact moment somebody is trying to publish.
 *
 * **Never throws.** `tz-lookup` does, on coordinates it cannot place, and a thrown timezone
 * here would take down event creation. Null means "we do not know", and the caller keeps
 * whatever zone it already had.
 */
export function timeZoneAt(lat: number, lng: number): string | null {
  try {
    return tzLookup(lat, lng);
  } catch {
    return null;
  }
}

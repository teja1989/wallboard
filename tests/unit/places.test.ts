import { describe, expect, it } from 'vitest';
import { directionsUrl, placesConfig } from '@/config';
import { timeZoneAt } from '@/lib/geo';
import { isValidTimeZone } from '@/lib/utils';
import { mapCoordsSchema, placeDetailsSchema, placeQuerySchema } from '@/lib/validation/schemas';

const SESSION = '3f1a2b4c-5d6e-7f80-9a1b-2c3d4e5f6071';

describe('directionsUrl', () => {
  it('opens the exact venue when there is a place id', () => {
    // Without it, "The Fillmore" can open a different branch of the same name.
    const url = directionsUrl('The Fillmore, San Francisco', 'ChIJabc123');
    expect(url).toContain('query_place_id=ChIJabc123');
    expect(url).toContain('query=The+Fillmore');
  });

  it('falls back to a plain search for an address somebody typed', () => {
    const url = directionsUrl('14 Bridge Street', null);
    expect(url).not.toContain('query_place_id');
    expect(url).toContain('query=14+Bridge+Street');
  });

  it('escapes what it is given', () => {
    expect(directionsUrl('Bar & Grill, 1 A St', null)).toContain('Bar+%26+Grill');
  });
});

describe('placeQuerySchema', () => {
  it('takes a real query with its session', () => {
    expect(placeQuerySchema.safeParse({ query: 'The Fill', sessionToken: SESSION }).success).toBe(
      true,
    );
  });

  it('refuses a query too short to be worth a billable request', () => {
    const short = 'a'.repeat(placesConfig.minQueryLength - 1);
    expect(placeQuerySchema.safeParse({ query: short, sessionToken: SESSION }).success).toBe(false);
  });

  it('refuses a session token that is not one', () => {
    // It goes straight to Google in a request we pay for, so it is shape-checked first.
    expect(placeQuerySchema.safeParse({ query: 'venue', sessionToken: 'nope!' }).success).toBe(
      false,
    );
  });
});

describe('placeDetailsSchema', () => {
  it('needs both the place and the session it was found in', () => {
    expect(
      placeDetailsSchema.safeParse({ placeId: 'ChIJabc', sessionToken: SESSION }).success,
    ).toBe(true);
    expect(placeDetailsSchema.safeParse({ placeId: '', sessionToken: SESSION }).success).toBe(
      false,
    );
  });
});

describe('mapCoordsSchema', () => {
  it('coerces the strings a query string actually carries', () => {
    const parsed = mapCoordsSchema.safeParse({ lat: '37.7749', lng: '-122.4194' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.lat).toBeCloseTo(37.7749);
  });

  it('refuses coordinates that are not on Earth', () => {
    expect(mapCoordsSchema.safeParse({ lat: '91', lng: '0' }).success).toBe(false);
    expect(mapCoordsSchema.safeParse({ lat: '0', lng: '181' }).success).toBe(false);
    expect(mapCoordsSchema.safeParse({ lat: 'nope', lng: '0' }).success).toBe(false);
  });
});

describe('timeZoneAt', () => {
  it('places a venue in its own zone, which is the point', () => {
    // The host's browser cannot know this: someone in London booking a wedding in Goa
    // means Goa, and the invitation has to say so.
    expect(timeZoneAt(37.7749, -122.4194)).toBe('America/Los_Angeles');
    expect(timeZoneAt(19.076, 72.8777)).toBe('Asia/Kolkata');
    expect(timeZoneAt(51.5074, -0.1278)).toBe('Europe/London');
  });

  it('returns a zone the formatter will accept', () => {
    const zone = timeZoneAt(48.8566, 2.3522);
    expect(zone).not.toBeNull();
    expect(isValidTimeZone(zone as string)).toBe(true);
  });

  it('never throws, whatever it is handed', () => {
    // A thrown timezone here would stop a host publishing at all, which is a far worse
    // outcome than not knowing where the venue is.
    expect(() => timeZoneAt(999, 999)).not.toThrow();
    expect(() => timeZoneAt(Number.NaN, 0)).not.toThrow();
  });
});

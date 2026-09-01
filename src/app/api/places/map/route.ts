import { NextResponse } from 'next/server';
import { placesConfig } from '@/config';
import { placesEnabled, staticMap } from '@/lib/services/places';
import { mapCoordsSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';

/**
 * A picture of where the party is.
 *
 * Proxied rather than linked, because a static map URL carries the API key in plain sight
 * and an invitation is a public link. Cached hard on the way out: a venue does not move, so
 * the alternative is paying Google for one render per guest who opens the invitation.
 *
 * Not wrapped in `route()` — that helper returns JSON, and this returns a PNG. Errors are
 * handled by falling back to no image, because an invitation without a map is fine and an
 * invitation with a broken one is not.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = mapCoordsSchema.safeParse({
    lat: url.searchParams.get('lat'),
    lng: url.searchParams.get('lng'),
  });

  if (!placesEnabled() || !parsed.success) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const bytes = await staticMap(parsed.data.lat, parsed.data.lng);
    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': `public, max-age=${placesConfig.mapCacheSeconds}, immutable`,
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}

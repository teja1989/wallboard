import { placeDetails, placesEnabled } from '@/lib/services/places';
import { ApiError, limitByUser, ok, parseBody, requireActor, route } from '@/lib/server/api';
import { placeDetailsSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Everything we store about a chosen place, including the timezone its coordinates sit in.
 *
 * The session token must be the same one the suggestions used, or Google bills the typing
 * as individual requests rather than one session.
 */
export const POST = route(async (request) => {
  if (!placesEnabled()) throw new ApiError('not_found', 'Address search is not configured.');

  const actor = await requireActor();
  await limitByUser('placesSearchPerUser', actor.uid);

  const { placeId, sessionToken } = await parseBody(request, placeDetailsSchema);
  const place = await placeDetails(placeId, sessionToken);
  if (!place) throw new ApiError('not_found', 'That place could not be found.');

  return ok({ place });
});

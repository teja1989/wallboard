import { placesEnabled, suggestPlaces } from '@/lib/services/places';
import { ApiError, limitByUser, ok, parseBody, requireActor, route } from '@/lib/server/api';
import { placeQuerySchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Address suggestions, proxied.
 *
 * Any signed-in visitor including a guest, because the create form is reachable before
 * anyone has an account — but rate-limited per user, since this is the one route in the app
 * that costs money per call.
 *
 * 404 rather than 500 when no key is configured: the feature is genuinely not there, and
 * the client falls back to a plain text field rather than showing an error for something
 * that was never switched on.
 */
export const POST = route(async (request) => {
  if (!placesEnabled()) throw new ApiError('not_found', 'Address search is not configured.');

  const actor = await requireActor();
  await limitByUser('placesSearchPerUser', actor.uid);

  const { query, sessionToken } = await parseBody(request, placeQuerySchema);
  return ok({ suggestions: await suggestPlaces(query, sessionToken) });
});

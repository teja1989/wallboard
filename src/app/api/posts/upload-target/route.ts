import { can } from '@/lib/authz/policy';
import { eventAuthzContext } from '@/lib/authz/event-context';
import { eventRoleFor } from '@/lib/authz/session';
import { requireLiveEvent } from '@/lib/services/events';
import { prepareUpload } from '@/lib/services/posts';
import { ApiError, limitByUser, ok, parseBody, requireActor, route } from '@/lib/server/api';
import { uploadTargetSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Step one of the upload handshake: hands back a target the browser uploads to directly,
 * so media bytes never transit this server.
 *
 * Everything the client says about the file here is a hint used to pick a path and a
 * signature. The authoritative size and type check happens at finalize, against the object
 * that actually landed.
 */
export const POST = route(async (request) => {
  const actor = await requireActor();
  const input = await parseBody(request, uploadTargetSchema);
  const event = await requireLiveEvent(input.eventId);
  const eventRole = await eventRoleFor(event.id, actor.uid);

  if (!can('post:create', eventAuthzContext(actor, event, eventRole))) {
    throw new ApiError(
      'forbidden',
      actor.isAnonymous ? 'Sign in to add photos, video or audio.' : 'You cannot post here.',
    );
  }

  await limitByUser('uploadTargetPerUser', actor.uid);
  return ok(await prepareUpload(event, input));
});

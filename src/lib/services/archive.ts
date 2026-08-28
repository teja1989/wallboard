import 'server-only';
import { ZipArchive } from 'archiver';
import { Readable } from 'node:stream';
import { brand, collections, occasionById, templateById } from '@/config';
import { db } from '@/lib/firebase/admin';
import { storage } from '@/lib/storage';
import { eventRef } from '@/lib/services/events';
import { guestsToCsv, listGuests } from '@/lib/services/rsvp';
import { formatEventDate } from '@/lib/utils';
import type { EventDoc, PostDoc } from '@/types/domain';

/**
 * The archive.
 *
 * This is the answer to "what happens to my photos", which is the question that decides
 * whether anyone trusts us with their wedding. It is also the feature that makes the paid
 * plan defensible: ephemerality is only a promise you can make confidently if the host can
 * keep a copy first.
 *
 * Streamed rather than buffered. A wedding wall can hold several gigabytes, and holding
 * that in memory on a Cloud Run instance is how a container gets killed halfway through the
 * download a host was relying on.
 */

export interface ArchiveContents {
  stream: Readable;
  filename: string;
}

/** A filesystem-safe stem derived from the event's title. */
export function archiveFilename(event: EventDoc): string {
  const slug =
    event.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'marquee-event';
  return `${slug}-archive.zip`;
}

/**
 * Builds the archive.
 *
 * Contents are chosen for someone opening this in five years with no software but a
 * browser: an `index.html` they can double-click, the original files at full quality, and
 * machine-readable copies alongside for anyone who wants to do something else with them.
 *
 * Media failures do not abort the archive. A host downloading a keepsake wants the 399
 * photos that are fine, not an error because one object went missing.
 */
export async function buildArchive(event: EventDoc): Promise<ArchiveContents> {
  const posts = await loadPosts(event.id);
  const guests = await listGuests(event.id, true);

  // archiver 8 exports classes rather than a callable factory.
  const zip = new ZipArchive({ zlib: { level: 6 } });
  // Photos and video are already compressed; level 6 is a reasonable trade for the text.
  zip.on('warning', (error: unknown) => console.warn('[archive] warning', error));
  zip.on('error', (error: unknown) => console.error('[archive] error', error));

  zip.append(renderIndexHtml(event, posts), { name: 'index.html' });
  zip.append(JSON.stringify(toManifest(event, posts), null, 2), { name: 'posts.json' });
  zip.append(guestsToCsv(guests, event), { name: 'guests.csv' });
  zip.append(renderReadme(event, posts.length), { name: 'README.txt' });

  // Appended before finalize, streamed as the consumer pulls.
  void (async () => {
    for (const post of posts) {
      for (const [index, asset] of post.media.entries()) {
        try {
          const url = await storage().createReadUrl(asset.objectPath, 900);
          const response = await fetch(url);
          if (!response.ok || !response.body) continue;

          const extension = asset.objectPath.slice(asset.objectPath.lastIndexOf('.'));
          const name = `media/${mediaName(post, index)}${extension}`;
          zip.append(Readable.fromWeb(response.body as never), { name });
        } catch (error) {
          console.error(`[archive] skipped ${asset.objectPath}`, error);
        }
      }
    }
    await zip.finalize();
  })();

  return { stream: zip as unknown as Readable, filename: archiveFilename(event) };
}

/** Stable, sortable, and readable in a file listing. */
function mediaName(post: PostDoc, index: number): string {
  const stamp = new Date(post.createdAt).toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const author = post.authorName.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 24) || 'guest';
  return `${stamp}_${author}_${post.id.slice(0, 6)}${index > 0 ? `_${index + 1}` : ''}`;
}

async function loadPosts(eventId: string): Promise<PostDoc[]> {
  const snapshot = await eventRef(eventId)
    .collection(collections.posts)
    .where('state', '==', 'visible')
    .orderBy('createdAt', 'asc')
    .get();

  return snapshot.docs.map((doc) => ({ ...(doc.data() as Omit<PostDoc, 'id'>), id: doc.id }));
}

function toManifest(event: EventDoc, posts: PostDoc[]) {
  return {
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      occasion: event.occasion,
      hostedBy: event.hostedBy,
      startsAt: event.startsAt,
      location: event.location,
      createdAt: event.createdAt,
      rsvpTally: event.rsvpTally,
    },
    exportedAt: Date.now(),
    posts: posts.map((post) => ({
      id: post.id,
      author: post.authorName,
      body: post.body,
      createdAt: post.createdAt,
      kind: post.kind,
      media: post.media.map((asset, index) => ({
        file: `media/${mediaName(post, index)}${asset.objectPath.slice(asset.objectPath.lastIndexOf('.'))}`,
        kind: asset.kind,
        bytes: asset.bytes,
        durationSeconds: asset.durationSeconds,
      })),
    })),
  };
}

function readmeDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function renderReadme(event: EventDoc, postCount: number): string {
  return `${event.title}
${'='.repeat(event.title.length)}

An archive of everything posted to this wall, exported ${readmeDate()} from ${brand.name}.

  index.html   Open this first — every post, in order, with the photos and video.
  media/       The original files, at the quality they were uploaded.
  posts.json   The same content, for anything you want to build with it.
  guests.csv   Who was invited, who replied, and what they said.

${postCount} ${postCount === 1 ? 'post' : 'posts'}.

Nothing here needs an internet connection or an account. Keep the folder together and
index.html will keep working.
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A browsable copy of the wall.
 *
 * Entirely self-contained: one file, inline styles, relative paths to `media/`. No fonts,
 * no scripts, no CDN — because the whole point is that it still opens in a decade, on a
 * laptop with no network, long after this service exists or does not.
 */
function renderIndexHtml(event: EventDoc, posts: PostDoc[]): string {
  const template = templateById(event.templateId);
  const occasion = occasionById(event.occasion);
  const { palette } = template;

  const cards = posts
    .map((post) => {
      const media = post.media
        .map((asset, index) => {
          const file = `media/${mediaName(post, index)}${asset.objectPath.slice(asset.objectPath.lastIndexOf('.'))}`;
          if (asset.kind === 'image') {
            return `<img src="${escapeHtml(file)}" alt="" loading="lazy">`;
          }
          if (asset.kind === 'video') {
            return `<video src="${escapeHtml(file)}" controls preload="metadata"></video>`;
          }
          return `<audio src="${escapeHtml(file)}" controls preload="metadata"></audio>`;
        })
        .join('');

      const when = new Date(post.createdAt).toLocaleString();
      return `<article class="post">
  <header><strong>${escapeHtml(post.authorName)}</strong><time>${escapeHtml(when)}</time></header>
  ${post.body ? `<p>${escapeHtml(post.body).replace(/\n/g, '<br>')}</p>` : ''}
  ${media}
</article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(event.title)}</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 1rem 4rem;
    font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: #faf7f5; color: #2b2320;
  }
  .banner { margin: 0 -1rem 2rem; height: 140px;
    background: linear-gradient(135deg, ${palette.from}, ${palette.to}); }
  header.event { max-width: 52rem; margin: -4rem auto 3rem; padding: 0 0.5rem; }
  h1 { margin: 0.5rem 0 0; font-size: 2.25rem; line-height: 1.1; }
  .eyebrow { font-size: 0.75rem; letter-spacing: 0.16em; text-transform: uppercase; color: #8a7a72; }
  .meta { color: #5c4f49; }
  main { max-width: 52rem; margin: 0 auto; display: grid; gap: 1.25rem; }
  .post { background: #fff; border: 1px solid #eee6e1; border-radius: 16px; padding: 1.25rem; }
  .post header { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
  .post time { font-size: 0.8rem; color: #a1938c; }
  .post p { margin: 0.75rem 0 0; white-space: pre-wrap; }
  .post img, .post video { display: block; width: 100%; margin-top: 0.875rem; border-radius: 12px; }
  .post audio { width: 100%; margin-top: 0.875rem; }
  footer { max-width: 52rem; margin: 3rem auto 0; color: #a1938c; font-size: 0.85rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #1b1a20; color: #f0edf2; }
    .post { background: #26242c; border-color: #34313c; }
    .meta { color: #b8b1c0; }
  }
</style>
</head>
<body>
  <div class="banner"></div>

  <header class="event">
    <p class="eyebrow">${escapeHtml(occasion.label)} · from ${escapeHtml(event.hostedBy)}</p>
    <h1>${escapeHtml(event.title)}</h1>
    ${event.description ? `<p class="meta">${escapeHtml(event.description)}</p>` : ''}
    ${event.startsAt ? `<p class="meta">${escapeHtml(formatEventDate(event.startsAt, event.timeZone, 'always'))}</p>` : ''}
    ${
      event.location?.name || event.location?.address
        ? `<p class="meta">${escapeHtml([event.location.name, event.location.address].filter(Boolean).join(', '))}</p>`
        : ''
    }
    <p class="meta">${posts.length} ${posts.length === 1 ? 'post' : 'posts'}</p>
  </header>

  <main>
${cards || '<p class="meta">Nothing was posted to this wall.</p>'}
  </main>

  <footer>Exported ${readmeDate()} from ${escapeHtml(brand.name)}.</footer>
</body>
</html>`;
}

export interface DeletionSummary {
  objectsDeleted: number;
  postsDeleted: number;
  membersDeleted: number;
  inviteesDeleted: number;
}

/**
 * Deletes an event and everything under it, immediately and permanently.
 *
 * Order matters. Bytes go first: if the process dies halfway, a host is left with an event
 * whose media is gone rather than an event that still exists but whose photos are
 * unreachable — and the sweep will finish the job. Deleting the documents first would leave
 * orphaned objects nothing points at.
 *
 * The join code hash is removed too, so the code stops working the instant this returns
 * rather than leading to a 404 that looks like a bug.
 */
export async function deleteEventCompletely(event: EventDoc): Promise<DeletionSummary> {
  const summary: DeletionSummary = {
    objectsDeleted: 0,
    postsDeleted: 0,
    membersDeleted: 0,
    inviteesDeleted: 0,
  };

  /*
    Bytes first, records second, and the order is load-bearing.

    The Firestore documents are the only route anyone has to these objects — the bucket is
    private and nothing is listed anywhere else. So deleting the records first would turn any
    storage failure into bytes nobody can find and nothing will ever sweep, which is the one
    outcome this product must not produce.

    `deletePrefix` throws unless every object is gone, so a failure here leaves the event
    entirely intact and the host is told to try again. Deletion is idempotent, so the retry
    costs nothing but the objects already removed.
  */
  summary.objectsDeleted = await storage().deletePrefix(`events/${event.id}/`);

  const reference = eventRef(event.id);
  const codeSnapshot = await reference.collection(collections.private).doc('joinCode').get();
  const codeHash = codeSnapshot.exists ? String(codeSnapshot.get('codeHash') ?? '') : '';

  summary.postsDeleted = await deleteSubcollection(event.id, collections.posts);
  summary.membersDeleted = await deleteSubcollection(event.id, collections.members);

  // Invitees are swept recursively, not batch-deleted like the rest.
  //
  // Deleting a Firestore document does *not* delete its subcollections — they survive as
  // unreachable orphans. Each invitee carries a `deliveries` history, so a plain batch
  // delete would leave a record of who was sent what, and when they read it, alive forever
  // under a guest list that no longer exists. Counting first because recursiveDelete does
  // not report what it removed.
  summary.inviteesDeleted = (
    await reference.collection(collections.invitees).count().get()
  ).data().count;
  await db().recursiveDelete(reference.collection(collections.invitees));

  await deleteSubcollection(event.id, collections.rsvpNotes);
  await deleteSubcollection(event.id, collections.private);

  if (codeHash) {
    await db().collection(collections.joinCodes).doc(codeHash).delete();
  }
  await reference.delete();

  return summary;
}

/** Firestore caps a batch at 500 writes, so this walks in pages. */
async function deleteSubcollection(eventId: string, name: string): Promise<number> {
  let deleted = 0;

  for (;;) {
    const snapshot = await eventRef(eventId).collection(name).limit(400).get();
    if (snapshot.empty) return deleted;

    const batch = db().batch();
    for (const doc of snapshot.docs) batch.delete(doc.ref);
    await batch.commit();
    deleted += snapshot.size;
  }
}

import { storageSweep } from '@/config';

/**
 * Deleting many objects without knocking the bucket over.
 *
 * Both drivers used to do `Promise.all(files.map(f => f.delete()))`. That is fine for the
 * handful of files a development event holds and wrong for a real one: a 500-photo wedding
 * is around 1,500 objects once previews and display copies are counted, and firing 1,500
 * simultaneous requests at Cloud Storage earns rate limiting, socket exhaustion, or both.
 * The rejection then takes the whole delete down with it — which, because storage was
 * swept before Firestore, meant the host pressed "delete everything" and nothing at all
 * happened.
 *
 * So: a fixed number in flight, and a failure that is reported rather than thrown, so one
 * unlucky object cannot abort the other fourteen hundred.
 */

/**
 * Raised when objects would not delete after a retry.
 *
 * A class of its own rather than a bare `Error` so the API layer can turn it into an honest
 * message. A host who is told "deleted" while their guests' photos are still in a bucket has
 * been lied to about the one promise this product makes.
 */
export class StorageSweepError extends Error {
  constructor(readonly failedCount: number) {
    super(`Could not delete ${failedCount} stored file${failedCount === 1 ? '' : 's'}.`);
    this.name = 'StorageSweepError';
  }
}

export interface SweepResult {
  deleted: number;
  /** Objects that would not go. Empty is the only acceptable outcome for a host's delete. */
  failed: string[];
}

/**
 * Runs `task` over every path with at most `storageSweep.concurrency` outstanding.
 *
 * Workers pull from a shared cursor rather than the list being sliced into chunks: chunking
 * makes every worker wait for the slowest member of its chunk, and one large video among
 * five hundred thumbnails is exactly that case.
 */
export async function deleteAll(
  paths: readonly string[],
  task: (path: string) => Promise<void>,
): Promise<SweepResult> {
  const failed: string[] = [];
  let deleted = 0;
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next++;
      if (index >= paths.length) return;
      const path = paths[index] as string;
      try {
        await task(path);
        deleted += 1;
      } catch {
        // Kept rather than rethrown. The caller retries the failures and only then decides
        // whether the sweep counts as having succeeded.
        failed.push(path);
      }
    }
  }

  const workers = Array.from({ length: Math.min(storageSweep.concurrency, paths.length) }, () =>
    worker(),
  );
  await Promise.all(workers);

  return { deleted, failed };
}

/**
 * `deleteAll`, then one more pass over whatever failed.
 *
 * Nearly every failure here is transient — a 429, a reset connection — and a single retry
 * clears it. Anything that fails twice is a real problem and is reported as one, because
 * the alternative is telling a host their guests' photos are gone when they are not.
 */
export async function deleteAllWithRetry(
  paths: readonly string[],
  task: (path: string) => Promise<void>,
): Promise<SweepResult> {
  const first = await deleteAll(paths, task);
  if (first.failed.length === 0) return first;

  const second = await deleteAll(first.failed, task);
  return { deleted: first.deleted + second.deleted, failed: second.failed };
}

'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { collections, contentLimits } from '@/config';
import { clientDb } from '@/lib/firebase/client';
import { api } from '@/lib/client/api-client';
import type { PostDoc, ResolvedMedia } from '@/types/domain';

/**
 * The live wall.
 *
 * Posts stream straight from Firestore, which is what makes the wall update without
 * polling. The documents hold storage *paths*, not URLs, so playable URLs are fetched
 * separately per post and cached until shortly before they expire. That split is
 * deliberate: it keeps media access revocable and time-bound while leaving the real-time
 * path untouched.
 */

export interface WallPost extends PostDoc {
  resolvedMedia: ResolvedMedia[] | null;
}

/** Refetch a little before the URL actually lapses, so playback never breaks mid-scroll. */
const URL_REFRESH_MARGIN_MS = 60_000;

export function useWall(eventId: string, enabled: boolean) {
  const [posts, setPosts] = useState<PostDoc[]>([]);
  /** Keyed by object path rather than post, so a path shared across renders is fetched once. */
  const [urls, setUrls] = useState<Record<string, { url: string; expiresAt: number }>>({});
  const [settled, setSettled] = useState(false);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());
  /**
   * Paths the server declined to sign. Without this the effect would ask again the moment
   * the response landed, and keep asking — the response changes `urls`, which re-runs the
   * effect, which finds the path still missing. A refusal is a permanent answer.
   */
  const refused = useRef(new Set<string>());

  // Built during render rather than inside the effect so the effect body does nothing but
  // subscribe — all state changes then originate from listener callbacks.
  const wallQuery = useMemo(() => {
    if (!enabled) return null;
    return query(
      collection(clientDb(), collections.events, eventId, collections.posts),
      where('state', '==', 'visible'),
      orderBy('createdAt', 'desc'),
      limit(contentLimits.wallPageSize),
    );
  }, [eventId, enabled]);

  useEffect(() => {
    if (!wallQuery) return;

    // Safety timeout: ensure wall never spins indefinitely if emulator listener connection is settling
    const fallbackTimer = setTimeout(() => {
      setSettled(true);
    }, 1200);

    const unsubscribe: Unsubscribe = onSnapshot(
      wallQuery,
      (snapshot) => {
        clearTimeout(fallbackTimer);
        setPosts(
          snapshot.docs.map((doc) => ({ ...(doc.data() as Omit<PostDoc, 'id'>), id: doc.id })),
        );
        setListenerError(null);
        setSettled(true);
      },
      (_caught) => {
        clearTimeout(fallbackTimer);
        // Fallback to server REST route if direct client Firestore listener fails
        api
          .get<{ posts: PostDoc[] }>(`/api/events/${eventId}/posts`)
          .then((res) => {
            setPosts(res.posts);
            setListenerError(null);
          })
          .catch((err) => {
            setListenerError((err as Error).message);
          })
          .finally(() => {
            setSettled(true);
          });
      },
    );

    return () => {
      clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, [wallQuery, eventId]);

  /**
   * Mints URLs for everything on screen in one request.
   *
   * One call per wall rather than one per post. The earlier shape cost three Firestore
   * reads for every photo — ninety reads to open a wall of thirty — because each request
   * re-read the post it was already being told about.
   */
  useEffect(() => {
    const now = Date.now();
    const wanted = new Set<string>();

    for (const post of posts) {
      for (const asset of post.media) {
        for (const path of [asset.objectPath, asset.previewPath, asset.displayPath]) {
          if (!path) continue;
          const known = urls[path];
          if (known && known.expiresAt - now > URL_REFRESH_MARGIN_MS) continue;
          if (inFlight.current.has(path) || refused.current.has(path)) continue;
          wanted.add(path);
        }
      }
    }

    if (wanted.size === 0) return;
    const batch = [...wanted];
    for (const path of batch) inFlight.current.add(path);

    void (async () => {
      try {
        const result = await api.post<{ urls: Record<string, string>; expiresAt: number }>(
          `/api/media/${eventId}`,
          { paths: batch },
        );
        for (const path of batch) {
          if (!(path in result.urls)) refused.current.add(path);
        }

        setUrls((current) => {
          const entries = Object.entries(result.urls);
          if (entries.length === 0) return current;
          const next = { ...current };
          for (const [path, url] of entries) {
            next[path] = { url, expiresAt: result.expiresAt };
          }
          return next;
        });
      } catch {
        // Leaves the placeholders in place; the next snapshot retries.
      } finally {
        for (const path of batch) inFlight.current.delete(path);
      }
    })();
  }, [posts, urls, eventId]);

  const wallPosts = useMemo<WallPost[]>(
    () =>
      posts.map((post) => {
        if (post.media.length === 0) return { ...post, resolvedMedia: [] };

        // A post is renderable once its *original* has a URL; the derivatives fill in as
        // they arrive, and the img falls back to whatever exists.
        const resolved = post.media.map((asset) => {
          const original = urls[asset.objectPath];
          if (!original) return null;
          return {
            ...asset,
            url: original.url,
            previewUrl: asset.previewPath ? (urls[asset.previewPath]?.url ?? null) : null,
            displayUrl: asset.displayPath ? (urls[asset.displayPath]?.url ?? null) : null,
            urlExpiresAt: original.expiresAt,
          } satisfies ResolvedMedia;
        });

        return {
          ...post,
          resolvedMedia: resolved.every((asset) => asset !== null)
            ? (resolved as ResolvedMedia[])
            : null,
        };
      }),
    [posts, urls],
  );

  return { posts: wallPosts, loading: enabled && !settled, error: listenerError };
}

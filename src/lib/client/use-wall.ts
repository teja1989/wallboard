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
  const [mediaByPost, setMediaByPost] = useState<Record<string, ResolvedMedia[]>>({});
  const [settled, setSettled] = useState(false);
  const [listenerError, setListenerError] = useState<string | null>(null);
  const inFlight = useRef(new Set<string>());

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

    const unsubscribe: Unsubscribe = onSnapshot(
      wallQuery,
      (snapshot) => {
        setPosts(
          snapshot.docs.map((doc) => ({ ...(doc.data() as Omit<PostDoc, 'id'>), id: doc.id })),
        );
        setListenerError(null);
        setSettled(true);
      },
      (caught) => {
        // Almost always a rules rejection, which means membership lapsed.
        setListenerError(caught.message);
        setSettled(true);
      },
    );

    return unsubscribe;
  }, [wallQuery]);

  // Mint media URLs for any post that needs them, one request per post, never twice at once.
  useEffect(() => {
    const now = Date.now();
    const needing = posts.filter((post) => {
      if (post.media.length === 0) return false;
      if (inFlight.current.has(post.id)) return false;
      const existing = mediaByPost[post.id];
      if (!existing) return true;
      return (existing[0]?.urlExpiresAt ?? 0) - now < URL_REFRESH_MARGIN_MS;
    });

    for (const post of needing) {
      inFlight.current.add(post.id);
      api
        .get<{ media: ResolvedMedia[] }>(`/api/media/${eventId}?postId=${post.id}`)
        .then((result) => setMediaByPost((current) => ({ ...current, [post.id]: result.media })))
        .catch(() => undefined)
        .finally(() => inFlight.current.delete(post.id));
    }
  }, [posts, mediaByPost, eventId]);

  const wallPosts = useMemo<WallPost[]>(
    () =>
      posts.map((post) => ({
        ...post,
        resolvedMedia: post.media.length === 0 ? [] : (mediaByPost[post.id] ?? null),
      })),
    [posts, mediaByPost],
  );

  return { posts: wallPosts, loading: enabled && !settled, error: listenerError };
}

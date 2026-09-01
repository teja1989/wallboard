'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Play, Trash2 } from 'lucide-react';
import { imageVariants, motion as motionTokens } from '@/config';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import type { WallPost } from '@/lib/client/use-wall';
import { cn, formatDuration, formatRelativeTime } from '@/lib/utils';
import type { ResolvedMedia } from '@/types/domain';

import { AudioPlayer } from '@/components/wall/audio-player';

interface PostCardProps {
  post: WallPost;
  eventId: string;
  canDelete: boolean;
  onOpenImage: (media: ResolvedMedia) => void;
}

/**
 * One post on the wall. Media URLs arrive a moment after the document does, so the card
 * renders its text immediately and holds a shaped placeholder for the attachment rather
 * than reflowing the masonry column when the URL lands.
 */
export function PostCard({ post, eventId, canDelete, onOpenImage }: PostCardProps) {
  const { notify } = useToast();
  const [deleting, setDeleting] = useState(false);
  const media = post.resolvedMedia?.[0] ?? null;
  const pendingMedia = post.media.length > 0 && post.resolvedMedia === null;

  async function handleDelete() {
    if (!window.confirm('Remove this post? The photo or video is deleted for good.')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/posts/${eventId}/${post.id}`);
      notify('Removed', 'success');
    } catch (caught) {
      notify(errorMessage(caught, 'Could not remove that.'), 'error');
      setDeleting(false);
    }
  }

  // Reserves the right height before the URL resolves, using the dimensions the uploader
  // measured — no layout jump when the image appears.
  const aspectRatio =
    post.media[0]?.width && post.media[0]?.height
      ? `${post.media[0].width} / ${post.media[0].height}`
      : '4 / 3';

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: deleting ? 0.5 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={motionTokens.spring}
      className="card group mb-4 break-inside-avoid overflow-hidden"
    >
      <header className="flex items-center gap-2.5 px-4 pt-4">
        <Avatar name={post.authorName} photoUrl={post.authorPhotoUrl} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{post.authorName}</p>
          <time
            dateTime={new Date(post.createdAt).toISOString()}
            className="text-xs text-[var(--text-muted)]"
          >
            {formatRelativeTime(post.createdAt)}
          </time>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Remove this post"
            className={cn(
              'inline-flex size-8 shrink-0 items-center justify-center rounded-full',
              'text-[var(--text-muted)] transition-all hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]',
              // Always visible on touch, revealed on hover for pointer devices.
              'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100',
            )}
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Trash2 className="size-4" aria-hidden />
            )}
          </button>
        )}
      </header>

      {post.giftTribute && (
        <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-pink-500/10 to-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-700 shadow-sm dark:text-amber-300">
          <span className="text-base">🎁</span>
          <span>
            Gift Contribution: ${post.giftTribute.amount} toward {post.giftTribute.fundTitle}
          </span>
        </div>
      )}

      {post.body && (
        <p className="px-4 pt-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap">
          {post.body}
        </p>
      )}

      {post.media.length > 0 && (
        <div className="mt-3">
          {pendingMedia ? (
            <div
              style={{ aspectRatio }}
              className="w-full animate-pulse bg-[var(--surface-sunken)]"
              aria-label="Loading attachment"
            />
          ) : media ? (
            <MediaBlock media={media} authorName={post.authorName} onOpenImage={onOpenImage} />
          ) : null}
        </div>
      )}

      <div className="h-4" />
    </motion.article>
  );
}

function MediaBlock({
  media,
  authorName,
  onOpenImage,
}: {
  media: ResolvedMedia;
  authorName: string;
  onOpenImage: (media: ResolvedMedia) => void;
}) {
  if (media.kind === 'image') {
    return (
      <button
        type="button"
        onClick={() => onOpenImage(media)}
        className="block w-full cursor-zoom-in"
        aria-label="View full size"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.previewUrl ?? media.displayUrl ?? media.url}
          srcSet={srcSetFor(media)}
          sizes="(min-width: 640px) 45vw, 92vw"
          alt=""
          loading="lazy"
          decoding="async"
          width={media.width ?? undefined}
          height={media.height ?? undefined}
          className="w-full object-cover transition-transform duration-300 ease-[var(--ease-soft)] hover:scale-[1.015]"
        />
      </button>
    );
  }

  if (media.kind === 'video') return <VideoBlock media={media} />;

  return <AudioPlayer media={media} authorName={authorName} />;
}

/**
 * Candidates for the browser to choose between. Falls back to whatever exists — an older
 * post with no derivatives still renders, it just costs more to serve.
 */
function srcSetFor(media: ResolvedMedia): string | undefined {
  const candidates: string[] = [];
  if (media.previewUrl) candidates.push(`${media.previewUrl} ${imageVariants.preview.maxEdge}w`);
  if (media.displayUrl) candidates.push(`${media.displayUrl} ${imageVariants.display.maxEdge}w`);
  return candidates.length > 1 ? candidates.join(', ') : undefined;
}

/**
 * A video shows its poster until someone actually wants to watch it.
 *
 * The poster is a resized frame — tens of kilobytes — where the clip itself is tens of
 * megabytes. Mounting the <video> only on the first press means a guest scrolling past
 * fifteen clips downloads fifteen thumbnails rather than fifteen video headers.
 */
function VideoBlock({ media }: { media: ResolvedMedia }) {
  const [playing, setPlaying] = useState(false);
  const poster = media.previewUrl ?? media.displayUrl;

  if (playing || !poster) {
    return (
      <video
        src={media.url}
        poster={media.displayUrl ?? undefined}
        controls
        autoPlay={playing}
        preload="metadata"
        playsInline
        className="w-full bg-black"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="relative block w-full"
      aria-label="Play video"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={poster}
        alt=""
        loading="lazy"
        decoding="async"
        className="w-full bg-black object-cover"
      />
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
          <Play className="size-6 translate-x-0.5 text-white" />
        </span>
      </span>
      {media.durationSeconds !== null && (
        <span className="absolute right-2 bottom-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs text-white tabular-nums">
          {formatDuration(media.durationSeconds)}
        </span>
      )}
    </button>
  );
}

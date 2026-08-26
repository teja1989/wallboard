'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Trash2 } from 'lucide-react';
import { motion as motionTokens } from '@/config';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { api, errorMessage } from '@/lib/client/api-client';
import type { WallPost } from '@/lib/client/use-wall';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { ResolvedMedia } from '@/types/domain';

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
            <MediaBlock media={media} onOpenImage={onOpenImage} />
          ) : null}
        </div>
      )}

      <div className="h-4" />
    </motion.article>
  );
}

function MediaBlock({
  media,
  onOpenImage,
}: {
  media: ResolvedMedia;
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
        {/* Signed, short-lived URLs on an arbitrary host: next/image cannot optimise these. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={media.url}
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

  if (media.kind === 'video') {
    return (
      <video
        src={media.url}
        poster={media.posterUrl ?? undefined}
        controls
        preload="metadata"
        playsInline
        className="w-full bg-black"
      />
    );
  }

  return (
    <div className="px-4 pb-1">
      <audio src={media.url} controls preload="metadata" className="w-full" />
    </div>
  );
}

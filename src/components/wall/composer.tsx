'use client';
import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ImagePlus, Mic, Send, Video, X } from 'lucide-react';
import { contentLimits, mediaRules, motion as motionTokens, type PostKind } from '@/config';
import { AudioRecorderModal } from '@/components/wall/audio-recorder-modal';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/client/api-client';
import { probeFile, type ProbedMedia } from '@/lib/client/media-probe';
import { submitPost } from '@/lib/client/upload';
import { cn, formatBytes, formatDuration } from '@/lib/utils';

interface ComposerProps {
  eventId: string;
  allowedKinds: readonly PostKind[];
  /** Set from the occasion, so a memorial does not read like a birthday. */
  placeholder: string;
  onPosted: () => void;
}

/**
 * The post composer. Media is probed and previewed locally before anything is uploaded, so
 * an oversized or over-long file is refused instantly rather than after a long transfer.
 */
export function Composer({ eventId, allowedKinds, placeholder, onPosted }: ComposerProps) {
  const { notify } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<ProbedMedia | null>(null);
  const [progress, setProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);

  const acceptedTypes = allowedKinds
    .filter((kind): kind is Exclude<PostKind, 'text'> => kind !== 'text')
    .map((kind) => mediaRules[kind].mimeTypes.join(','))
    .join(',');

  const canAttach = acceptedTypes.length > 0;
  const canSubmit = (body.trim().length > 0 || media !== null) && !submitting;

  async function acceptFile(file: File | undefined) {
    if (!file) return;
    try {
      const probed = await probeFile(file);
      if (!allowedKinds.includes(probed.kind)) {
        notify(`The host has turned off ${probed.kind} for this event.`, 'error');
        return;
      }
      setMedia((current) => {
        if (current) URL.revokeObjectURL(current.previewUrl);
        return probed;
      });
    } catch (caught) {
      notify(errorMessage(caught, 'That file could not be used.'), 'error');
    }
  }

  function clearMedia() {
    setMedia((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setProgress(0);
    try {
      await submitPost({ eventId, body: body.trim(), media }, setProgress);
      setBody('');
      clearMedia();
      onPosted();
    } catch (caught) {
      notify(errorMessage(caught, 'That did not post.'), 'error');
    } finally {
      setSubmitting(false);
      setProgress(0);
    }
  }

  function handleDrop(event: DragEvent<HTMLFormElement>) {
    event.preventDefault();
    setDragging(false);
    if (canAttach) void acceptFile(event.dataTransfer.files[0]);
  }

  return (
    <form
      onSubmit={handleSubmit}
      onDragOver={(event) => {
        event.preventDefault();
        if (canAttach) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'glass-strong rounded-[var(--radius-card)] p-4 transition-all duration-200',
        dragging && 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--surface-page)]',
      )}
    >
      <label htmlFor="composer-body" className="sr-only">
        Write a message
      </label>
      <textarea
        id="composer-body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={dragging ? 'Drop it here…' : placeholder}
        maxLength={contentLimits.postBodyMaxLength}
        rows={media ? 2 : 3}
        className="w-full resize-none bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
      />

      <AnimatePresence>
        {media && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={motionTokens.base}
            className="overflow-hidden"
          >
            <div className="relative mt-2 overflow-hidden rounded-2xl bg-[var(--surface-sunken)]">
              <MediaPreview media={media} />
              <button
                type="button"
                onClick={clearMedia}
                aria-label="Remove attachment"
                className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-[var(--surface-glass-strong)] text-[var(--text-primary)] backdrop-blur transition-transform hover:scale-105"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <p className="mt-1.5 px-1 text-xs text-[var(--text-muted)]">
              {formatBytes(media.file.size)}
              {media.durationSeconds ? ` · ${formatDuration(media.durationSeconds)}` : ''}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {submitting && progress > 0 && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
          className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--surface-sunken)]"
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {canAttach && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  void acceptFile(event.target.files?.[0])
                }
                className="sr-only"
                id="composer-file"
              />
              {allowedKinds.includes('image') && (
                <AttachButton
                  label="Add a photo"
                  icon={<ImagePlus className="size-4" aria-hidden />}
                  onClick={() => fileInputRef.current?.click()}
                />
              )}
              {allowedKinds.includes('video') && (
                <AttachButton
                  label="Add a video"
                  icon={<Video className="size-4" aria-hidden />}
                  onClick={() => fileInputRef.current?.click()}
                />
              )}
              {allowedKinds.includes('audio') && (
                <AttachButton
                  label="Record a voice toast"
                  icon={<Mic className="size-4" aria-hidden />}
                  onClick={() => setIsAudioModalOpen(true)}
                />
              )}
            </>
          )}
        </div>

        <Button type="submit" size="sm" loading={submitting} disabled={!canSubmit}>
          <Send className="size-4" aria-hidden />
          Post
        </Button>
      </div>

      <AudioRecorderModal
        isOpen={isAudioModalOpen}
        onClose={() => setIsAudioModalOpen(false)}
        onAudioRecorded={(file) => void acceptFile(file)}
      />
    </form>
  );
}

function AttachButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex size-9 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
    >
      {icon}
    </button>
  );
}

function MediaPreview({ media }: { media: ProbedMedia }) {
  if (media.kind === 'image') {
    // Local blob preview: next/image would only add indirection for a URL that is revoked
    // as soon as the post is sent.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={media.previewUrl} alt="" className="max-h-64 w-full object-cover" />;
  }
  if (media.kind === 'video') {
    return <video src={media.previewUrl} controls playsInline className="max-h-64 w-full" />;
  }
  return <audio src={media.previewUrl} controls className="w-full p-3" />;
}

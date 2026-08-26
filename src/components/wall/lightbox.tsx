'use client';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { motion as motionTokens } from '@/config';
import type { ResolvedMedia } from '@/types/domain';

interface LightboxProps {
  media: ResolvedMedia | null;
  onClose: () => void;
}

/** Full-size image view. Escape closes it, and background scroll is locked while open. */
export function Lightbox({ media, onClose }: LightboxProps) {
  useEffect(() => {
    if (!media) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [media, onClose]);

  return (
    <AnimatePresence>
      {media && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Full size image"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={motionTokens.fast}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <motion.img
            initial={{ scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={motionTokens.spring}
            // The display copy, not the original: at 1800px on the longest edge it fills
            // any screen, and it is a fraction of the size.
            src={media.displayUrl ?? media.url}
            alt=""
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <X className="size-5" aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

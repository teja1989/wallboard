'use client';
import Image from 'next/image';
import { cn, initialsOf } from '@/lib/utils';

interface AvatarProps {
  name: string;
  photoUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * Falls back to initials on a hue derived from the name, so the same person keeps the same
 * colour across the wall without any avatar being stored.
 */
export function Avatar({ name, photoUrl, size = 36, className }: AvatarProps) {
  const hue = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % 360;

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        'ring-1 ring-[var(--border-subtle)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          width={size}
          height={size}
          className="size-full object-cover"
          unoptimized
        />
      ) : (
        <span
          aria-hidden
          className="flex size-full items-center justify-center font-semibold text-[var(--text-inverse)]"
          style={{
            fontSize: size * 0.36,
            background: `linear-gradient(135deg, oklch(0.75 0.11 ${hue}), oklch(0.68 0.12 ${(hue + 45) % 360}))`,
          }}
        >
          {initialsOf(name)}
        </span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}

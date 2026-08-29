'use client';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface SocialProofAttendee {
  displayName: string;
  photoUrl: string | null;
}

export interface SocialProofProps {
  attendees: readonly SocialProofAttendee[];
  totalAttending: number;
  className?: string;
  /**
   * Overrides the caption, keeping the facepile.
   *
   * The default names attendees, which is right on an invitation somebody has not answered
   * yet. It is wrong immediately after they reply: with one attendee it reads their own name
   * back at them ("Priya is attending" — yes, you, you just did that). The confirmation panel
   * passes `rsvpCopy.othersComing`, which counts *other* people and is phrased so it cannot
   * do that. See `rsvp.config.ts`.
   */
  caption?: string;
}

/**
 * Formats the social proof headline based on confirmed attendees and headcount.
 */
export function formatSocialProofCaption(
  attendees: readonly SocialProofAttendee[],
  totalAttending: number,
): string {
  const count = Math.max(attendees.length, totalAttending);
  if (count <= 0) return '';

  const names = attendees.map((a) => a.displayName.trim()).filter(Boolean);

  if (count === 1) {
    return `${names[0] || '1 person'} is attending`;
  }

  if (count === 2) {
    if (names.length >= 2) {
      return `${names[0]} and ${names[1]} are attending`;
    }
    if (names.length === 1) {
      return `${names[0]} and 1 other are attending`;
    }
    return '2 people are attending';
  }

  // 3 or more attending
  if (names.length >= 2) {
    const others = count - 2;
    return `${names[0]}, ${names[1]}, and ${others} ${others === 1 ? 'other' : 'others'} are attending`;
  }

  if (names.length === 1) {
    const others = count - 1;
    return `${names[0]} and ${others} ${others === 1 ? 'other' : 'others'} are attending`;
  }

  return `${count} people are attending`;
}

/**
 * The attendee facepile and social proof counter.
 *
 * Renders an avatar stack of confirmed guests plus a friendly caption.
 * Returns null if no attendees have confirmed yet.
 */
export function SocialProof({
  attendees,
  totalAttending,
  className,
  caption: captionOverride,
}: SocialProofProps) {
  const count = Math.max(attendees.length, totalAttending);
  if (count <= 0) return null;

  const caption = captionOverride ?? formatSocialProofCaption(attendees, totalAttending);
  const displayAvatars = attendees.slice(0, 4);

  return (
    <div
      className={cn('flex items-center gap-2.5 text-xs text-[var(--text-secondary)]', className)}
    >
      {displayAvatars.length > 0 && (
        <div className="flex -space-x-2 overflow-hidden py-0.5" aria-hidden>
          {displayAvatars.map((attendee, index) => (
            <div
              key={`${attendee.displayName}-${index}`}
              className="inline-block rounded-full ring-2 ring-[var(--surface-raised)]"
            >
              <Avatar name={attendee.displayName} photoUrl={attendee.photoUrl} size={24} />
            </div>
          ))}
        </div>
      )}
      <span className="truncate font-medium">{caption}</span>
    </div>
  );
}

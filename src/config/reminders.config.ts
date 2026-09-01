import { DAY, HOUR } from './limits.config';

/**
 * Reminding guests who have not replied, without the host having to remember.
 *
 * Chasing replies is the single most tedious part of hosting, and until now the product made
 * the host do it: the nudge went out only when somebody pressed a button on a tab inside a
 * page they had to think to open. Most never will. That is a reply rate lost for reasons that
 * have nothing to do with the invitation — which is exactly the kind of loss the funnel would
 * report as "guests do not reply" when the truth is "nobody asked them twice".
 *
 * Two rules shape everything below, and both exist because the failure mode here is not a
 * missing email — it is an unwanted one.
 *
 * 1. **A reminder that arrives twice costs more than one that never arrives.** A duplicate
 *    nudge burns a guest's goodwill and our sending reputation, and reputation is shared
 *    across every host on the platform. So the schedule is claimed before it is sent, never
 *    after, and `sendToInvitees` keeps its own per-guest cooldown underneath as a second net.
 * 2. **Never remind about something nobody was told about in time.** A slot only fires if it
 *    fell due *after* the invitation existed — otherwise creating an event three days out
 *    would immediately fire the week-before nudge at everyone, seconds after the invitation.
 */

export interface ReminderSlot {
  /** Stored on the event once fired. Stable — renaming one re-sends it to everybody. */
  id: string;
  /** How long before the event this nudge belongs. */
  beforeMs: number;
  /** For the host-facing explanation of what will be sent on their behalf. */
  label: string;
}

/**
 * Deliberately two, and deliberately not more.
 *
 * A week out is when somebody can still change their plans; two days out is when the people
 * who meant to reply and forgot actually do. A third would be the one that makes a guest
 * regret giving out their address.
 */
export const reminderSlots: readonly ReminderSlot[] = [
  { id: 'week', beforeMs: 7 * DAY, label: 'a week before' },
  { id: 'twoDays', beforeMs: 2 * DAY, label: 'two days before' },
];

export const remindersConfig = {
  /**
   * Events considered per run. Bounded like the sweep, so one busy hour cannot turn a cron
   * tick into an unbounded fan-out of sends.
   */
  maxEventsPerRun: 50,

  /**
   * How close to the event a reminder may still go out.
   *
   * A nudge to reply that lands two hours beforehand is noise: the guest either turns up or
   * does not, and the host's headcount is already whatever it is going to be.
   */
  minLeadMs: 12 * HOUR,
} as const;

/** The furthest-out slot, which bounds the query rather than being a policy in itself. */
export const furthestReminderMs = Math.max(...reminderSlots.map((slot) => slot.beforeMs));

export interface ReminderCandidate {
  startsAt: number | null;
  createdAt: number;
  /** Already-fired slot ids. */
  remindersSent: readonly string[];
  rsvpEnabled: boolean;
  autoRemind: boolean;
  rsvpDeadline: number | null;
}

/**
 * Which slot, if any, is due for this event right now.
 *
 * Pure and dependency-free so it can be reasoned about and tested without Firestore — this is
 * the function that decides whether somebody's guests get emailed, and it is worth being able
 * to enumerate its behaviour exhaustively.
 *
 * Returns the *closest* due slot rather than all of them, so an event that somehow missed the
 * week-before nudge gets the two-day one rather than both at once.
 */
export function dueReminderSlot(event: ReminderCandidate, now: number): ReminderSlot | null {
  if (event.startsAt === null) return null;
  if (!event.rsvpEnabled || !event.autoRemind) return null;

  // Nothing to chase once replies have closed, and nothing worth sending this near the day.
  if (event.rsvpDeadline !== null && now > event.rsvpDeadline) return null;
  if (now > event.startsAt - remindersConfig.minLeadMs) return null;

  // Nearest first: the later slot wins when both are somehow outstanding.
  const ordered = [...reminderSlots].sort((a, b) => a.beforeMs - b.beforeMs);

  for (const slot of ordered) {
    if (event.remindersSent.includes(slot.id)) continue;

    const dueAt = event.startsAt - slot.beforeMs;
    if (now < dueAt) continue;
    // The slot fell due before the invitation existed, so nobody was ever waiting on it.
    if (dueAt < event.createdAt) continue;

    return slot;
  }

  return null;
}

export const reminderCopy = {
  settingLabel: 'Remind guests who have not replied',
  settingHint: `We will email anyone who has not answered ${reminderSlots
    .map((slot) => slot.label)
    .join(' and ')}. Nobody is emailed twice, and anyone who has replied is left alone.`,
  settingOff: 'Off — you can still nudge people yourself from the guest list.',
} as const;

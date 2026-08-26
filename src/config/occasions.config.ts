import type { TemplateId } from './templates.config';

/**
 * Occasions.
 *
 * Picking an occasion is the first thing a host does, and it does real work: it sets a
 * sensible theme, decides whether the invitation asks for a dress code or a gift note, and
 * changes the words on the page so a memorial never reads like a birthday. That last part
 * is the whole reason this is a config table and not a free-text field.
 */

export interface Occasion {
  id: string;
  label: string;
  /** Emoji used as the invitation's mark. Kept small and warm rather than decorative. */
  glyph: string;
  defaultTemplateId: TemplateId;
  /** Placeholder in the title field — an example, not an instruction. */
  titlePlaceholder: string;
  /** Verb used on the host's primary button, e.g. "Send the invitation". */
  inviteVerb: string;
  /** What the RSVP question sounds like for this occasion. */
  rsvpPrompt: string;
  /** Wording on the wall's composer, so it fits the room. */
  wallPrompt: string;
  /** Whether the invitation offers a dress-code field. */
  asksDressCode: boolean;
  /** Whether plus-ones make sense by default. */
  plusOnesByDefault: boolean;
  /** Occasions where celebratory language would be wrong. */
  somber: boolean;
}

export const occasions: readonly Occasion[] = [
  {
    id: 'birthday',
    label: 'Birthday',
    glyph: '🎂',
    defaultTemplateId: 'sunset',
    titlePlaceholder: "Priya's 30th",
    inviteVerb: 'Send the invitation',
    rsvpPrompt: 'Can you make it?',
    wallPrompt: 'Say something…',
    asksDressCode: false,
    plusOnesByDefault: true,
    somber: false,
  },
  {
    id: 'wedding',
    label: 'Wedding',
    glyph: '💍',
    defaultTemplateId: 'champagne',
    titlePlaceholder: 'Priya & Sam',
    inviteVerb: 'Send the invitation',
    rsvpPrompt: 'Will you be joining us?',
    wallPrompt: 'Share a photo or a message for the couple…',
    asksDressCode: true,
    plusOnesByDefault: true,
    somber: false,
  },
  {
    id: 'party',
    label: 'Party',
    glyph: '🎉',
    defaultTemplateId: 'aurora',
    titlePlaceholder: 'Rooftop summer party',
    inviteVerb: 'Send the invitation',
    rsvpPrompt: 'Coming?',
    wallPrompt: 'Say something…',
    asksDressCode: true,
    plusOnesByDefault: true,
    somber: false,
  },
  {
    id: 'dinner',
    label: 'Dinner',
    glyph: '🍽️',
    defaultTemplateId: 'linen',
    titlePlaceholder: 'Supper at ours',
    inviteVerb: 'Send the invitation',
    rsvpPrompt: 'Can you join us?',
    wallPrompt: 'Say something…',
    asksDressCode: false,
    plusOnesByDefault: true,
    somber: false,
  },
  {
    id: 'baby',
    label: 'Baby shower',
    glyph: '🍼',
    defaultTemplateId: 'blossom',
    titlePlaceholder: 'A shower for Ada',
    inviteVerb: 'Send the invitation',
    rsvpPrompt: 'Can you make it?',
    wallPrompt: 'Leave a wish for the little one…',
    asksDressCode: false,
    plusOnesByDefault: false,
    somber: false,
  },
  {
    id: 'graduation',
    label: 'Graduation',
    glyph: '🎓',
    defaultTemplateId: 'lagoon',
    titlePlaceholder: 'Sam graduates',
    inviteVerb: 'Send the invitation',
    rsvpPrompt: 'Can you come?',
    wallPrompt: 'Say something…',
    asksDressCode: false,
    plusOnesByDefault: true,
    somber: false,
  },
  {
    id: 'reunion',
    label: 'Reunion',
    glyph: '🫂',
    defaultTemplateId: 'meadow',
    titlePlaceholder: 'The 2015 lot, ten years on',
    inviteVerb: 'Send the invitation',
    rsvpPrompt: 'Are you in?',
    wallPrompt: 'Post a photo from back then…',
    asksDressCode: false,
    plusOnesByDefault: true,
    somber: false,
  },
  {
    id: 'work',
    label: 'Work',
    glyph: '💼',
    defaultTemplateId: 'midnight',
    titlePlaceholder: 'Q4 offsite',
    inviteVerb: 'Send the invitation',
    rsvpPrompt: 'Will you attend?',
    wallPrompt: 'Share something from the day…',
    asksDressCode: true,
    plusOnesByDefault: false,
    somber: false,
  },
  {
    id: 'memorial',
    label: 'Memorial',
    glyph: '🕊️',
    defaultTemplateId: 'linen',
    titlePlaceholder: 'Remembering Ada',
    inviteVerb: 'Share the details',
    rsvpPrompt: 'Will you be attending?',
    wallPrompt: 'Share a memory…',
    asksDressCode: false,
    plusOnesByDefault: false,
    somber: true,
  },
  {
    id: 'other',
    label: 'Something else',
    glyph: '✨',
    defaultTemplateId: 'sunset',
    titlePlaceholder: 'What are we calling it?',
    inviteVerb: 'Send the invitation',
    rsvpPrompt: 'Can you make it?',
    wallPrompt: 'Say something…',
    asksDressCode: false,
    plusOnesByDefault: true,
    somber: false,
  },
] as const;

export type OccasionId = (typeof occasions)[number]['id'];
export const defaultOccasionId: OccasionId = 'party';

export function occasionById(id: string): Occasion {
  return occasions.find((o) => o.id === id) ?? occasions[occasions.length - 1]!;
}

/** RSVP answers a guest can give. `pending` means invited but not yet replied. */
export const RSVP_STATUSES = ['pending', 'yes', 'no', 'maybe'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const rsvpLabels: Record<RsvpStatus, string> = {
  pending: 'No reply yet',
  yes: 'Going',
  no: "Can't make it",
  maybe: 'Maybe',
};

/** The three a guest can actually choose. `pending` is a state, not an answer. */
export const rsvpChoices = RSVP_STATUSES.filter(
  (status): status is Exclude<RsvpStatus, 'pending'> => status !== 'pending',
);

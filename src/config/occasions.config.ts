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
  /**
   * The create form's submit button.
   *
   * It said "Send the invitation" on every occasion, and pressing it sends nothing: it
   * creates the event. The host then adds guests and chooses when anything goes out — so the
   * button was announcing an irreversible act, on a screen whose whole purpose is that
   * nothing is irreversible yet. A host who believed it had no reason to open the guest list,
   * which is where the entire tracked path begins.
   *
   * Named for what it does. If a value here ever contains "send", it is wrong.
   */
  createVerb: string;
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
  /**
   * Whether guests at this occasion would expect to bring something.
   *
   * What decides if the invitation offers a gift list at all. A fortieth and a baby shower
   * are occasions where somebody is already wondering what to buy; a work offsite is one
   * where asking would be a faux pas, and a memorial where it would be worse. So this is a
   * property of the occasion rather than a switch every host has to find and think about.
   */
  giftsExpected: boolean;
}

export const occasions: readonly Occasion[] = [
  {
    id: 'birthday',
    label: 'Birthday',
    glyph: '🎂',
    defaultTemplateId: 'sunset',
    titlePlaceholder: "Priya's 30th",
    createVerb: 'Create the invitation',
    rsvpPrompt: 'Can you make it?',
    wallPrompt: 'Say something…',
    asksDressCode: false,
    plusOnesByDefault: true,
    somber: false,
    giftsExpected: true,
  },
  {
    id: 'wedding',
    label: 'Wedding',
    glyph: '💍',
    defaultTemplateId: 'champagne',
    titlePlaceholder: 'Priya & Sam',
    createVerb: 'Create the invitation',
    rsvpPrompt: 'Will you be joining us?',
    wallPrompt: 'Share a photo or a message for the couple…',
    asksDressCode: true,
    plusOnesByDefault: true,
    somber: false,
    giftsExpected: true,
  },
  {
    id: 'party',
    label: 'Party',
    glyph: '🎉',
    defaultTemplateId: 'aurora',
    titlePlaceholder: 'Rooftop summer party',
    createVerb: 'Create the invitation',
    rsvpPrompt: 'Coming?',
    wallPrompt: 'Say something…',
    asksDressCode: true,
    plusOnesByDefault: true,
    somber: false,
    giftsExpected: false,
  },
  {
    id: 'dinner',
    label: 'Dinner',
    glyph: '🍽️',
    defaultTemplateId: 'linen',
    titlePlaceholder: 'Supper at ours',
    createVerb: 'Create the invitation',
    rsvpPrompt: 'Can you join us?',
    wallPrompt: 'Say something…',
    asksDressCode: false,
    plusOnesByDefault: true,
    somber: false,
    giftsExpected: false,
  },
  {
    id: 'baby',
    label: 'Baby shower',
    glyph: '🍼',
    defaultTemplateId: 'blossom',
    titlePlaceholder: 'A shower for Ada',
    createVerb: 'Create the invitation',
    rsvpPrompt: 'Can you make it?',
    wallPrompt: 'Leave a wish for the little one…',
    asksDressCode: false,
    plusOnesByDefault: false,
    somber: false,
    giftsExpected: true,
  },
  {
    id: 'graduation',
    label: 'Graduation',
    glyph: '🎓',
    defaultTemplateId: 'lagoon',
    titlePlaceholder: 'Sam graduates',
    createVerb: 'Create the invitation',
    rsvpPrompt: 'Can you come?',
    wallPrompt: 'Say something…',
    asksDressCode: false,
    plusOnesByDefault: true,
    somber: false,
    giftsExpected: true,
  },
  {
    id: 'reunion',
    label: 'Reunion',
    glyph: '🫂',
    defaultTemplateId: 'meadow',
    titlePlaceholder: 'The 2015 lot, ten years on',
    createVerb: 'Create the invitation',
    rsvpPrompt: 'Are you in?',
    wallPrompt: 'Post a photo from back then…',
    asksDressCode: false,
    plusOnesByDefault: true,
    somber: false,
    giftsExpected: false,
  },
  {
    id: 'work',
    label: 'Work',
    glyph: '💼',
    defaultTemplateId: 'midnight',
    titlePlaceholder: 'Q4 offsite',
    createVerb: 'Create the invitation',
    rsvpPrompt: 'Will you attend?',
    wallPrompt: 'Share something from the day…',
    asksDressCode: true,
    plusOnesByDefault: false,
    somber: false,
    giftsExpected: false,
  },
  {
    id: 'memorial',
    label: 'Memorial',
    glyph: '🕊️',
    defaultTemplateId: 'linen',
    titlePlaceholder: 'Remembering Ada',
    createVerb: 'Create the notice',
    rsvpPrompt: 'Will you be attending?',
    wallPrompt: 'Share a memory…',
    asksDressCode: false,
    plusOnesByDefault: false,
    somber: true,
    giftsExpected: false,
  },
  {
    id: 'other',
    label: 'Something else',
    glyph: '✨',
    defaultTemplateId: 'sunset',
    titlePlaceholder: 'What are we calling it?',
    createVerb: 'Create the invitation',
    rsvpPrompt: 'Can you make it?',
    wallPrompt: 'Say something…',
    asksDressCode: false,
    plusOnesByDefault: true,
    somber: false,
    giftsExpected: false,
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

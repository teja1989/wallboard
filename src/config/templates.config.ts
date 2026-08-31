import type { OccasionId } from './occasions.config';

/**
 * Invitation templates.
 *
 * A template is not a colour. It is a **layout**, a **type pairing**, a **palette** and a
 * **motif**, chosen together — which is why "Botanical" and "Midnight" look like different
 * products rather than the same card tinted differently. That difference is the single most
 * visible thing a host gets for paying, and it is where the incumbents in this category are
 * weakest.
 *
 * Free templates are deliberately good. Nobody upgrades to escape something ugly; they
 * upgrade to reach something better.
 */

/**
 * The four ways an invitation can be composed. Each is a genuinely different structure, not
 * a spacing variant — see `src/components/event/layouts/`.
 */
export const TEMPLATE_LAYOUTS = ['classic', 'editorial', 'minimal', 'poster'] as const;
export type TemplateLayout = (typeof TEMPLATE_LAYOUTS)[number];

/**
 * Display type. Body copy is always the UI sans, because an invitation people have to read
 * on a phone at a bus stop is not the place to be brave about legibility.
 *
 * Every stack ends in a real fallback so the invitation still looks composed before — or
 * without — the webfont.
 */
export const TYPE_FACES = {
  grotesk: {
    id: 'grotesk',
    label: 'Grotesk',
    stack: "'Space Grotesk', ui-sans-serif, system-ui, sans-serif",
    /** Display weight and tracking that suit this face at large sizes. */
    weight: 600,
    tracking: '-0.02em',
  },
  garamond: {
    id: 'garamond',
    label: 'Garamond',
    stack: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
    weight: 600,
    tracking: '0em',
  },
  fraunces: {
    id: 'fraunces',
    label: 'Fraunces',
    stack: "'Fraunces', Georgia, 'Times New Roman', serif",
    weight: 600,
    tracking: '-0.015em',
  },
  inter: {
    id: 'inter',
    label: 'Inter',
    stack: "'Inter', ui-sans-serif, system-ui, sans-serif",
    weight: 600,
    tracking: '-0.025em',
  },
} as const;

export type TypeFaceId = keyof typeof TYPE_FACES;

/**
 * Decorative marks, drawn as inline SVG in `template-motif.tsx`. Kept to a small set: a
 * motif is seasoning, and an invitation covered in it looks like clip art.
 */
export const TEMPLATE_MOTIFS = ['none', 'confetti', 'botanical', 'rings', 'stars', 'arch'] as const;
export type TemplateMotif = (typeof TEMPLATE_MOTIFS)[number];

/**
 * The decorative field behind the card's header, drawn as inline SVG in `template-surface.tsx`.
 *
 * Before this every template was one flat two-stop gradient plus a 120×24 line divider, so
 * fifteen designs differed only in four colours. A surface gives each one a texture of its
 * own — depth and, where it suits the occasion, slow movement.
 *
 * Three rules hold it together:
 *
 *  - **It never carries meaning.** Every surface is `aria-hidden` and nothing in it is
 *    information; the invitation reads identically with the surface removed.
 *  - **It never touches contrast.** Surfaces paint under the header band at low opacity, and
 *    the `onGradient` colour still clears 4.5:1 against both gradient endpoints — the
 *    surface cannot darken text it is not behind.
 *  - **Motion is a property of the surface, not a global setting.** `still` surfaces exist so
 *    `linen` can be dignified rather than merely slower. `prefers-reduced-motion` stops the
 *    rest — the global rule in `globals.css` covers every animation here for free.
 */
export const TEMPLATE_SURFACES = [
  'none',
  /** Soft overlapping radial glows that drift. The warm, general-purpose one. */
  'bloom',
  /** Concentric arcs sweeping across the band. Formal, architectural. */
  'arcs',
  /** Layered soft hills. Calm; reads as landscape rather than decoration. */
  'dusk',
  /** Slow twinkling points. For evening and celebration, never for a memorial. */
  'sparkle',
  /** Small shapes drifting down. The most playful; birthdays and parties only. */
  'drift',
  /** A fine woven weave. Deliberately **still** — the quiet one. */
  'linen',
] as const;
export type TemplateSurface = (typeof TEMPLATE_SURFACES)[number];

/** Surfaces that hold completely still, whatever the reader's motion preference. */
export const STILL_SURFACES: readonly TemplateSurface[] = ['none', 'linen'] as const;

export interface TemplatePalette {
  /** Gradient endpoints, used for the band, the poster ground and the page wash. */
  from: string;
  to: string;
  /** Text colour when placed on the gradient. Must clear 4.5:1 against both endpoints. */
  onGradient: string;
  /** A single accent for rules, glyph tiles and the motif. */
  accent: string;
}

export interface Template {
  id: string;
  label: string;
  /** One line in the gallery. Says how it feels, not what colour it is. */
  blurb: string;
  layout: TemplateLayout;
  face: TypeFaceId;
  motif: TemplateMotif;
  /** The decorative field behind the header. See `TEMPLATE_SURFACES`. */
  surface: TemplateSurface;
  palette: TemplatePalette;
  /** Occasions this suits. `null` means it works for anything. */
  occasions: readonly OccasionId[] | null;
  premium: boolean;
}

/**
 * The first ten ids match the original theme set, so invitations created before templates
 * existed keep the design their host picked.
 */
export const templates: readonly Template[] = [
  // --- free ----------------------------------------------------------------
  {
    id: 'sunset',
    label: 'Sunset',
    blurb: 'Warm and unfussy. The safe yes for almost anything.',
    layout: 'classic',
    face: 'inter',
    motif: 'none',
    surface: 'arcs',
    palette: {
      from: 'oklch(0.82 0.11 40)',
      to: 'oklch(0.78 0.1 330)',
      onGradient: 'oklch(0.22 0.03 30)',
      accent: 'oklch(0.62 0.16 22)',
    },
    occasions: null,
    premium: false,
  },
  {
    id: 'meadow',
    label: 'Meadow',
    blurb: 'Fresh and daytime. Good for anything outdoors.',
    layout: 'classic',
    face: 'inter',
    motif: 'botanical',
    surface: 'bloom',
    palette: {
      from: 'oklch(0.85 0.09 150)',
      to: 'oklch(0.82 0.09 200)',
      onGradient: 'oklch(0.24 0.04 160)',
      accent: 'oklch(0.52 0.12 155)',
    },
    occasions: null,
    premium: false,
  },
  {
    id: 'lagoon',
    label: 'Lagoon',
    blurb: 'Cool and calm, with room to breathe.',
    layout: 'minimal',
    face: 'inter',
    motif: 'none',
    surface: 'dusk',
    palette: {
      from: 'oklch(0.83 0.09 220)',
      to: 'oklch(0.8 0.1 275)',
      onGradient: 'oklch(0.24 0.04 250)',
      accent: 'oklch(0.55 0.13 250)',
    },
    occasions: null,
    premium: false,
  },
  {
    id: 'blossom',
    label: 'Blossom',
    blurb: 'Soft and sweet without tipping into twee.',
    layout: 'classic',
    face: 'fraunces',
    motif: 'confetti',
    surface: 'bloom',
    palette: {
      from: 'oklch(0.86 0.08 350)',
      to: 'oklch(0.83 0.08 300)',
      onGradient: 'oklch(0.25 0.04 340)',
      accent: 'oklch(0.58 0.14 340)',
    },
    occasions: ['baby', 'birthday', 'wedding'],
    premium: false,
  },
  {
    id: 'notepaper',
    label: 'Notepaper',
    blurb: 'Almost nothing. For when the words are the whole point.',
    layout: 'minimal',
    face: 'inter',
    motif: 'none',
    surface: 'linen',
    palette: {
      from: 'oklch(0.95 0.01 90)',
      to: 'oklch(0.91 0.015 70)',
      onGradient: 'oklch(0.28 0.02 60)',
      accent: 'oklch(0.45 0.03 60)',
    },
    occasions: null,
    premium: false,
  },

  // --- premium -------------------------------------------------------------
  {
    id: 'midnight',
    label: 'Midnight',
    blurb: 'Late, loud and a little glamorous.',
    layout: 'poster',
    face: 'grotesk',
    motif: 'stars',
    surface: 'sparkle',
    palette: {
      from: 'oklch(0.42 0.11 268)',
      to: 'oklch(0.28 0.09 300)',
      onGradient: 'oklch(0.97 0.01 280)',
      accent: 'oklch(0.78 0.13 300)',
    },
    occasions: ['party', 'birthday', 'work'],
    premium: true,
  },
  {
    id: 'champagne',
    label: 'Champagne',
    blurb: 'Black tie without shouting about it.',
    layout: 'classic',
    face: 'garamond',
    motif: 'rings',
    surface: 'arcs',
    palette: {
      from: 'oklch(0.9 0.055 88)',
      to: 'oklch(0.84 0.075 62)',
      onGradient: 'oklch(0.26 0.03 70)',
      accent: 'oklch(0.55 0.09 70)',
    },
    occasions: ['wedding', 'graduation', 'work'],
    premium: true,
  },
  {
    id: 'botanical',
    label: 'Botanical',
    blurb: 'Deep green and grown-up. Made for a garden.',
    layout: 'editorial',
    face: 'garamond',
    motif: 'botanical',
    surface: 'bloom',
    palette: {
      from: 'oklch(0.5 0.09 148)',
      to: 'oklch(0.62 0.08 118)',
      onGradient: 'oklch(0.98 0.01 140)',
      accent: 'oklch(0.45 0.1 150)',
    },
    occasions: ['wedding', 'dinner', 'reunion'],
    premium: true,
  },
  {
    id: 'ember',
    label: 'Ember',
    blurb: 'Hot colour, big type. Impossible to ignore.',
    layout: 'poster',
    face: 'grotesk',
    motif: 'none',
    surface: 'dusk',
    palette: {
      from: 'oklch(0.66 0.16 28)',
      to: 'oklch(0.55 0.15 12)',
      onGradient: 'oklch(0.98 0.01 30)',
      accent: 'oklch(0.72 0.15 40)',
    },
    occasions: ['party', 'birthday'],
    premium: true,
  },
  {
    id: 'linen',
    label: 'Linen',
    blurb: 'Quiet and textured. Right when the occasion is tender.',
    layout: 'minimal',
    face: 'garamond',
    motif: 'arch',
    surface: 'linen',
    palette: {
      from: 'oklch(0.93 0.018 75)',
      to: 'oklch(0.88 0.025 55)',
      onGradient: 'oklch(0.3 0.02 60)',
      accent: 'oklch(0.48 0.04 55)',
    },
    occasions: ['memorial', 'dinner', 'wedding'],
    premium: true,
  },
  {
    id: 'aurora',
    label: 'Aurora',
    blurb: 'Electric and modern, without being cold.',
    layout: 'poster',
    face: 'grotesk',
    motif: 'stars',
    surface: 'sparkle',
    palette: {
      from: 'oklch(0.7 0.14 190)',
      to: 'oklch(0.6 0.16 300)',
      onGradient: 'oklch(0.99 0.005 220)',
      accent: 'oklch(0.75 0.14 250)',
    },
    occasions: ['party', 'graduation', 'work'],
    premium: true,
  },
  {
    id: 'letterpress',
    label: 'Letterpress',
    blurb: 'Set like a printed card. Formal, and it knows it.',
    layout: 'editorial',
    face: 'garamond',
    motif: 'none',
    surface: 'linen',
    palette: {
      from: 'oklch(0.96 0.008 80)',
      to: 'oklch(0.92 0.012 60)',
      onGradient: 'oklch(0.24 0.02 60)',
      accent: 'oklch(0.35 0.05 25)',
    },
    occasions: ['wedding', 'dinner', 'graduation'],
    premium: true,
  },
  {
    id: 'carnival',
    label: 'Carnival',
    blurb: 'Unapologetically a party. Bring the cake.',
    layout: 'poster',
    face: 'fraunces',
    motif: 'confetti',
    surface: 'drift',
    palette: {
      from: 'oklch(0.78 0.14 350)',
      to: 'oklch(0.74 0.15 45)',
      onGradient: 'oklch(0.22 0.03 350)',
      accent: 'oklch(0.6 0.17 350)',
    },
    occasions: ['birthday', 'party', 'baby'],
    premium: true,
  },
  {
    id: 'broadsheet',
    label: 'Broadsheet',
    blurb: 'Type-led and confident. Reads like an announcement.',
    layout: 'editorial',
    face: 'fraunces',
    motif: 'none',
    surface: 'arcs',
    palette: {
      from: 'oklch(0.9 0.02 250)',
      to: 'oklch(0.84 0.03 230)',
      onGradient: 'oklch(0.24 0.03 250)',
      accent: 'oklch(0.42 0.08 250)',
    },
    occasions: ['reunion', 'work', 'graduation'],
    premium: true,
  },
  {
    id: 'harvest',
    label: 'Harvest',
    blurb: 'Long table, low light, everyone staying late.',
    layout: 'classic',
    face: 'fraunces',
    motif: 'botanical',
    surface: 'bloom',
    palette: {
      from: 'oklch(0.79 0.1 70)',
      to: 'oklch(0.68 0.11 40)',
      onGradient: 'oklch(0.24 0.03 55)',
      accent: 'oklch(0.5 0.12 55)',
    },
    occasions: ['dinner', 'reunion', 'wedding'],
    premium: true,
  },
] as const;

export type TemplateId = (typeof templates)[number]['id'];
export const defaultTemplateId = 'sunset';

export function templateById(id: string): Template {
  return templates.find((t) => t.id === id) ?? templates[0]!;
}

export function isPremiumTemplate(id: string): boolean {
  return templateById(id).premium;
}

export const freeTemplates = templates.filter((t) => !t.premium);
export const premiumTemplates = templates.filter((t) => t.premium);

/** Templates that suit an occasion, best-suited first. */
export function templatesForOccasion(occasionId: string): Template[] {
  const suited = templates.filter((t) => t.occasions?.includes(occasionId as OccasionId));
  const general = templates.filter((t) => t.occasions === null);
  return [...suited, ...general];
}

export function faceOf(template: Template) {
  return TYPE_FACES[template.face];
}

export interface TemplateSample {
  sampleTitle: string;
  sampleSubtitle: string;
  sampleDate: string;
  sampleLocation: string;
  sampleOccasion: OccasionId;
  tags: readonly string[];
}

export const TEMPLATE_SAMPLES: Record<string, TemplateSample> = {
  sunset: {
    sampleTitle: "Maya's Rooftop Summer Celebration",
    sampleSubtitle: 'Drinks from seven, sunset toasts at eight.',
    sampleDate: 'Saturday, July 18 · 7:00 PM',
    sampleLocation: 'The Skylight Terrace, SF',
    sampleOccasion: 'birthday',
    tags: ['Warm', 'Golden Hour', 'Classic Sans'],
  },
  meadow: {
    sampleTitle: "Chloe & Liam's Garden Engagement",
    sampleSubtitle: 'Celebrate under the orchard canopy with food & wine.',
    sampleDate: 'Sunday, June 14 · 2:00 PM',
    sampleLocation: 'Sycamore Valley Ranch',
    sampleOccasion: 'wedding',
    tags: ['Botanical', 'Outdoor', 'Fresh Green'],
  },
  lagoon: {
    sampleTitle: 'Class of 2026 Graduation Brunch',
    sampleSubtitle: 'Honoring our graduates with champagne & seaside views.',
    sampleDate: 'Saturday, May 30 · 11:30 AM',
    sampleLocation: 'Bayside Pavilion',
    sampleOccasion: 'graduation',
    tags: ['Cool Blue', 'Minimalist', 'Serene'],
  },
  blossom: {
    sampleTitle: 'Baby Shower for Little Oliver',
    sampleSubtitle: 'Join us for pastries, sweet tea, and warm wishes.',
    sampleDate: 'Saturday, August 8 · 1:00 PM',
    sampleLocation: 'The Rosewood Greenhouse',
    sampleOccasion: 'baby',
    tags: ['Soft Pink', 'Fraunces Serif', 'Gentle'],
  },
  notepaper: {
    sampleTitle: 'An Intimate Table for Twelve',
    sampleSubtitle: 'A five-course seasonal supper celebrating friendship.',
    sampleDate: 'Friday, September 25 · 7:30 PM',
    sampleLocation: 'Atelier Kitchen Studio',
    sampleOccasion: 'dinner',
    tags: ['Quiet Luxury', 'Linen Texture', 'Type-Led'],
  },
  midnight: {
    sampleTitle: "Sasha's 30th Noir & Neon",
    sampleSubtitle: 'Late-night cocktails, DJ sets, and celebration till 2 AM.',
    sampleDate: 'Friday, October 23 · 9:00 PM',
    sampleLocation: 'The Velvet Underground Lounge',
    sampleOccasion: 'party',
    tags: ['Dark Mode', 'Cyberpunk', 'Space Grotesk'],
  },
  champagne: {
    sampleTitle: "Elena & Marcus's Wedding Reception",
    sampleSubtitle: 'Dinner, dancing, and toasts under the ballroom chandeliers.',
    sampleDate: 'Saturday, September 19 · 5:30 PM',
    sampleLocation: 'Fairmont Grand Ballroom',
    sampleOccasion: 'wedding',
    tags: ['Black Tie', 'Cormorant Garamond', 'Opulent Gold'],
  },
  botanical: {
    sampleTitle: 'Harvest Vineyard Supper',
    sampleSubtitle: 'Farm-to-table dinner pairing local vintages.',
    sampleDate: 'Saturday, October 3 · 6:00 PM',
    sampleLocation: 'Napa Ridge Vineyards',
    sampleOccasion: 'dinner',
    tags: ['Deep Emerald', 'Editorial', 'Organic'],
  },
  ember: {
    sampleTitle: "Leo's Album Release Party",
    sampleSubtitle: 'First listen live performance and rooftop drinks.',
    sampleDate: 'Thursday, November 12 · 8:00 PM',
    sampleLocation: 'The Loft on 5th',
    sampleOccasion: 'party',
    tags: ['Fiery Red', 'Bold Poster', 'High Energy'],
  },
  linen: {
    sampleTitle: 'A Life Remembered: Thomas Bennett',
    sampleSubtitle: 'Gathering to share stories, music, and cherished memories.',
    sampleDate: 'Sunday, April 19 · 3:00 PM',
    sampleLocation: 'St. Jude Memorial Chapel',
    sampleOccasion: 'memorial',
    tags: ['Tender', 'Woven Linen', 'Solemn & Warm'],
  },
  aurora: {
    sampleTitle: 'Metropolis Tech Summit Afterparty',
    sampleSubtitle: 'Founders, creators, and investors under neon skies.',
    sampleDate: 'Wednesday, June 24 · 8:00 PM',
    sampleLocation: 'Skydeck Horizon Level',
    sampleOccasion: 'work',
    tags: ['Holographic', 'Futuristic', 'Aurora Glow'],
  },
  letterpress: {
    sampleTitle: 'The Harvard Alumni Gala',
    sampleSubtitle: 'An evening of distinction celebrating 25 years.',
    sampleDate: 'Saturday, November 7 · 6:30 PM',
    sampleLocation: 'The Metropolitan Club',
    sampleOccasion: 'reunion',
    tags: ['Architectural', 'Crisp Editorial', 'Prestigious'],
  },
  carnival: {
    sampleTitle: "Noah's 5th Circus Extravaganza",
    sampleSubtitle: 'Games, magicians, face painting, and birthday cake!',
    sampleDate: 'Saturday, May 16 · 2:00 PM',
    sampleLocation: 'Maple Grove Community Park',
    sampleOccasion: 'birthday',
    tags: ['Playful', 'Confetti Drift', 'Vibrant'],
  },
  broadsheet: {
    sampleTitle: 'Annual Design Leaders Colloquium',
    sampleSubtitle: 'Keynotes, panel discussions, and evening reception.',
    sampleDate: 'Tuesday, September 15 · 4:00 PM',
    sampleLocation: 'Museum of Modern Craft',
    sampleOccasion: 'work',
    tags: ['Type Announcement', 'Monochrome & Cobalt', 'Bold Sans'],
  },
  harvest: {
    sampleTitle: 'Friendsgiving Long Table Feast',
    sampleSubtitle: 'Roasted heritage turkey, autumn pies, and mulled cider.',
    sampleDate: 'Thursday, November 26 · 5:00 PM',
    sampleLocation: 'Oak Hill Barn Studio',
    sampleOccasion: 'dinner',
    tags: ['Warm Amber', 'Supper Club', 'Autumn Glow'],
  },
};

export function sampleForTemplate(templateId: string): TemplateSample {
  return (
    TEMPLATE_SAMPLES[templateId] ?? {
      sampleTitle: 'A Special Gathering',
      sampleSubtitle: 'Join us for drinks, dining, and good times.',
      sampleDate: 'Saturday Evening · 7:00 PM',
      sampleLocation: 'The Venue',
      sampleOccasion: 'party',
      tags: ['Modern', 'Versatile'],
    }
  );
}

/**
 * Design tokens. The Tailwind theme in src/app/globals.css mirrors these values as CSS
 * custom properties; this module is the source for anything JS needs (motion springs,
 * event theme swatches, share-card colours).
 */

export const brand = {
  name: 'Wallboard',
  tagline: 'A wall for the moment. Then it lets go.',
  description:
    'Create a group event, share one code, and everyone posts photos, video, audio and notes to a live wall that disappears when the moment does.',
} as const;

/** Motion. Springs rather than durations — softer, and interruptible. */
export const motion = {
  spring: { type: 'spring', stiffness: 320, damping: 30, mass: 0.9 },
  gentleSpring: { type: 'spring', stiffness: 180, damping: 24, mass: 1 },
  fast: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  base: { duration: 0.28, ease: [0.22, 1, 0.36, 1] },
  /** Stagger between cards appearing on the wall. */
  staggerSeconds: 0.045,
} as const;

/** Per-event accent themes a host can pick. Values are OKLCH for even perceptual steps. */
export const eventThemes = [
  { id: 'sunset', label: 'Sunset', from: 'oklch(0.82 0.11 40)', to: 'oklch(0.78 0.10 330)' },
  { id: 'meadow', label: 'Meadow', from: 'oklch(0.85 0.09 150)', to: 'oklch(0.82 0.09 200)' },
  { id: 'lagoon', label: 'Lagoon', from: 'oklch(0.83 0.09 220)', to: 'oklch(0.80 0.10 275)' },
  { id: 'blossom', label: 'Blossom', from: 'oklch(0.86 0.08 350)', to: 'oklch(0.83 0.08 300)' },
  { id: 'ember', label: 'Ember', from: 'oklch(0.80 0.12 25)', to: 'oklch(0.78 0.11 60)' },
  { id: 'dusk', label: 'Dusk', from: 'oklch(0.76 0.09 285)', to: 'oklch(0.74 0.08 240)' },
] as const;

export type EventThemeId = (typeof eventThemes)[number]['id'];
export const defaultEventThemeId: EventThemeId = 'sunset';

export function themeById(id: string) {
  return eventThemes.find((t) => t.id === id) ?? eventThemes[0];
}

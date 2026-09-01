/**
 * Curated Visual Dress Code Presets & Styling Guides.
 */

export interface DressCodePreset {
  id: string;
  label: string;
  emoji: string;
  shortHint: string;
  palette: readonly string[];
  suggestedOccasions?: readonly string[];
}

export const DRESS_CODE_PRESETS: readonly DressCodePreset[] = [
  {
    id: 'black-tie',
    label: 'Black Tie & Glamour',
    emoji: '🥂',
    shortHint: 'Tuxedos, dinner jackets, and floor-length evening gowns',
    palette: ['#0F172A', '#D97706', '#F8FAFC'],
    suggestedOccasions: ['wedding', 'gala', 'milestone'],
  },
  {
    id: 'cocktail',
    label: 'Cocktail Chic',
    emoji: '🌆',
    shortHint: 'Tailored blazers, midi dresses, and smart dress shoes',
    palette: ['#1E1B4B', '#4F46E5', '#E0E7FF'],
    suggestedOccasions: ['party', 'birthday', 'dinner'],
  },
  {
    id: 'garden-pastel',
    label: 'Summer Pastel & Garden',
    emoji: '☀️',
    shortHint: 'Linen shirts, floral prints, sundresses, and light tones',
    palette: ['#065F46', '#FDE68A', '#F0FDF4'],
    suggestedOccasions: ['dinner', 'baby', 'reunion'],
  },
  {
    id: 'smart-casual',
    label: 'Smart Casual',
    emoji: '✨',
    shortHint: 'Elevated denim, collared shirts, chic knitwear, and stylish flats',
    palette: ['#78350F', '#F59E0B', '#FEF3C7'],
    suggestedOccasions: ['party', 'dinner', 'work'],
  },
  {
    id: 'all-white',
    label: 'All-White Soirée',
    emoji: '🤍',
    shortHint: 'Crisp monochrome white, cream, and champagne attire',
    palette: ['#FFFFFF', '#E2E8F0', '#94A3B8'],
    suggestedOccasions: ['party', 'milestone'],
  },
  {
    id: 'themed-costume',
    label: 'Themed / Festive Costume',
    emoji: '⚡',
    shortHint: 'Dress to match the party theme or bring your best retro look',
    palette: ['#EC4899', '#8B5CF6', '#3B82F6'],
    suggestedOccasions: ['party', 'birthday'],
  },
] as const;

export function findDressCodePreset(text: string): DressCodePreset | null {
  const clean = text.toLowerCase().trim();
  if (!clean) return null;
  return (
    DRESS_CODE_PRESETS.find(
      (p) =>
        clean.includes(p.id) ||
        clean.includes(p.label.toLowerCase()) ||
        p.label.toLowerCase().includes(clean),
    ) ?? null
  );
}

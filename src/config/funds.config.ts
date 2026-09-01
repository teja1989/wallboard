import type { FundCategory } from '@/types/domain';

export const fundsConfig = {
  /** 2.5% platform take rate */
  platformFeeRate: 0.025,
  /** Standard estimated card processing fee */
  cardProcessingFeeRate: 0.029,
  cardProcessingFixedFee: 0.3,
  /** Maximum cash funds per event */
  maxFundsPerEvent: 5,
  titleMaxLength: 60,
  descriptionMaxLength: 280,
  maxTargetAmount: 50000,
  minContributionAmount: 5,
  maxContributionAmount: 5000,
  defaultPresets: [25, 50, 100, 200],
} as const;

export interface FundPreset {
  category: FundCategory;
  title: string;
  description: string;
  glyph: string;
  defaultTarget: number | null;
  suggestedPresets: number[];
}

export const FUND_PRESETS: readonly FundPreset[] = [
  {
    category: 'honeymoon',
    title: 'Honeymoon Adventure Fund',
    description: 'Help us make unforgettable memories on our dream trip!',
    glyph: '✈️',
    defaultTarget: 2500,
    suggestedPresets: [50, 100, 200, 500],
  },
  {
    category: 'home',
    title: 'New Home & Living Fund',
    description: 'Help us turn our new house into a warm home with furniture and decor.',
    glyph: '🏡',
    defaultTarget: 2000,
    suggestedPresets: [25, 50, 100, 250],
  },
  {
    category: 'baby',
    title: 'Nursery & Baby Essentials Pot',
    description: 'Helping us prepare for the little one with nursery setup and essentials.',
    glyph: '🍼',
    defaultTarget: 1500,
    suggestedPresets: [25, 50, 75, 150],
  },
  {
    category: 'celebration',
    title: 'Celebration Bar Tab & Toast Pot',
    description: 'Buy the host a celebratory drink and toast the milestone together!',
    glyph: '🥂',
    defaultTarget: 500,
    suggestedPresets: [15, 25, 50, 100],
  },
  {
    category: 'travel',
    title: 'Graduation Travel Fund',
    description: 'Help our graduate celebrate this milestone with a trip of a lifetime.',
    glyph: '🎒',
    defaultTarget: 1200,
    suggestedPresets: [25, 50, 100, 200],
  },
  {
    category: 'charity',
    title: 'Community Charity Gift',
    description: 'In lieu of gifts, contributions will be donated to our chosen cause.',
    glyph: '🕊️',
    defaultTarget: null,
    suggestedPresets: [20, 50, 100, 250],
  },
  {
    category: 'custom',
    title: 'Dream Group Gift Fund',
    description: 'Chip in toward our special group gift celebration!',
    glyph: '🎁',
    defaultTarget: 1000,
    suggestedPresets: [25, 50, 100, 200],
  },
];

/**
 * Calculates fee breakdown for a contribution.
 * Guest covers processing by default so host receives 100% of the gift amount.
 */
export function calculateContributionFees(amount: number) {
  const platformFee = Math.round(amount * fundsConfig.platformFeeRate * 100) / 100;
  const processingFee =
    Math.round(
      (amount * fundsConfig.cardProcessingFeeRate + fundsConfig.cardProcessingFixedFee) * 100,
    ) / 100;
  const totalCharged = Math.round((amount + platformFee + processingFee) * 100) / 100;

  return {
    giftAmount: amount,
    platformFee,
    processingFee,
    totalCharged,
    hostReceives: amount,
  };
}

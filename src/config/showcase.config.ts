import type { EventDoc } from '@/types/domain';

/**
 * Showcase fixture events.
 *
 * Real, complete EventDoc records used to render live `<Invitation />` components on the
 * marketing and landing pages. Because these are real components, the marketing showcase
 * cannot drift from the actual product UI.
 */
export interface ShowcaseItem {
  id: string;
  label: string;
  tagline: string;
  event: EventDoc;
}

const NOW = 1788000000000; // Static anchor timestamp for consistent SSR rendering

export const showcaseItems: readonly ShowcaseItem[] = [
  {
    id: 'birthday',
    label: '40th Birthday',
    tagline: 'Lively, memorable milestone parties with live guest photo streams',
    event: {
      id: 'showcase-birthday',
      title: "Maya's 40th Birthday Celebration",
      description: 'Join us for drinks, dinner, and late-night music under the city skyline.',
      occasion: 'birthday',
      hostUid: 'usr_showcase_1',
      hostName: 'Maya Lin',
      hostedBy: 'Maya & Sam',
      templateId: 'midnight',
      status: 'live',
      startsAt: NOW + 86400000 * 14 + 3600000 * 19, // 14 days out at 7:00 PM
      endsAt: NOW + 86400000 * 14 + 3600000 * 24,
      timeZone: 'America/New_York',
      location: {
        name: 'The Skylight Rooftop Loft',
        address: '420 West 14th St, New York, NY',
        url: 'https://maps.google.com',
        placeId: 'ChIJOwg_06VPwokRYv534QaPC8g',
      },
      dressCode: 'Festive cocktail attire',
      rsvp: {
        enabled: true,
        deadline: NOW + 86400000 * 7,
        allowPlusOnes: true,
        maxPartySize: 2,
        askNote: true,
        question: 'Any favorite songs or drink preferences?',
        autoRemind: true,
      },
      rsvpTally: {
        yes: 42,
        no: 6,
        maybe: 4,
        pending: 12,
        attending: 48,
      },
      settings: {
        whoCanPost: 'anyone',
        allowedKinds: ['text', 'image', 'video'],
      },
      plan: 'pro',
      createdAt: NOW - 86400000 * 3,
      expiresAt: NOW + 86400000 * 21,
      endedAt: null,
      remindersSent: [],
      memberCount: 52,
      postCount: 18,
      storageBytes: 10485760,
    },
  },
  {
    id: 'wedding',
    label: 'Wedding',
    tagline: 'Elegant ceremonies & receptions with no per-guest fees',
    event: {
      id: 'showcase-wedding',
      title: 'Sophie & Liam',
      description: 'We request the pleasure of your company as we celebrate our wedding weekend.',
      occasion: 'wedding',
      hostUid: 'usr_showcase_2',
      hostName: 'Sophie Vance',
      hostedBy: 'Sophie Vance & Liam Miller',
      templateId: 'champagne',
      status: 'live',
      startsAt: NOW + 86400000 * 45 + 3600000 * 16,
      endsAt: NOW + 86400000 * 45 + 3600000 * 23,
      timeZone: 'America/New_York',
      location: {
        name: 'The Glasshouse at Willow Creek',
        address: '88 Meadowbrook Lane, Hudson Valley, NY',
        url: 'https://maps.google.com',
        placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
      },
      dressCode: 'Black tie optional',
      rsvp: {
        enabled: true,
        deadline: NOW + 86400000 * 30,
        allowPlusOnes: true,
        maxPartySize: 2,
        askNote: true,
        question: 'Dietary requirements or allergies?',
        autoRemind: true,
      },
      rsvpTally: {
        yes: 118,
        no: 14,
        maybe: 8,
        pending: 22,
        attending: 142,
      },
      settings: {
        whoCanPost: 'members',
        allowedKinds: ['text', 'image', 'video'],
      },
      plan: 'pro',
      createdAt: NOW - 86400000 * 10,
      expiresAt: NOW + 86400000 * 60,
      endedAt: null,
      remindersSent: [],
      memberCount: 140,
      postCount: 64,
      storageBytes: 41943040,
    },
  },
  {
    id: 'retirement',
    label: 'Retirement Gala',
    tagline: 'Grown-up honors and tribute boards for distinguished milestones',
    event: {
      id: 'showcase-retirement',
      title: 'Dr. Harper’s Retirement Gala',
      description:
        'Honoring 35 years of clinical excellence, research, and mentorship in neurosurgery.',
      occasion: 'dinner',
      hostUid: 'usr_showcase_3',
      hostName: 'Dr. Elena Rostova',
      hostedBy: 'The Department of Neurological Surgery',
      templateId: 'botanical',
      status: 'live',
      startsAt: NOW + 86400000 * 20 + 3600000 * 18 + 3600000 * 0.5,
      endsAt: NOW + 86400000 * 20 + 3600000 * 22,
      timeZone: 'America/New_York',
      location: {
        name: 'The University Club Ballroom',
        address: '1 West 54th St, New York, NY',
        url: 'https://maps.google.com',
      },
      dressCode: 'Semi-formal / business attire',
      rsvp: {
        enabled: true,
        deadline: NOW + 86400000 * 10,
        allowPlusOnes: true,
        maxPartySize: 2,
        askNote: true,
        question: 'Will you be giving a brief tribute or toast?',
        autoRemind: true,
      },
      rsvpTally: {
        yes: 74,
        no: 12,
        maybe: 5,
        pending: 10,
        attending: 86,
      },
      settings: {
        whoCanPost: 'members',
        allowedKinds: ['text', 'image'],
      },
      plan: 'pro',
      createdAt: NOW - 86400000 * 5,
      expiresAt: NOW + 86400000 * 30,
      endedAt: null,
      remindersSent: [],
      memberCount: 88,
      postCount: 32,
      storageBytes: 15728640,
    },
  },
  {
    id: 'memorial',
    label: 'Memorial Gathering',
    tagline: 'Dignified, ad-free notices with gentle memory sharing',
    event: {
      id: 'showcase-memorial',
      title: 'Remembering Arthur Davies',
      description:
        'A celebration of Arthur’s life, stories, and the quiet joy he brought to all of us.',
      occasion: 'memorial',
      hostUid: 'usr_showcase_4',
      hostName: 'The Davies Family',
      hostedBy: 'The Davies Family',
      templateId: 'linen',
      status: 'live',
      startsAt: NOW + 86400000 * 7 + 3600000 * 11,
      endsAt: NOW + 86400000 * 7 + 3600000 * 14,
      timeZone: 'America/New_York',
      location: {
        name: 'St. Jude’s Memorial Chapel & Courtyard',
        address: '210 Elm Street, Greenwich, CT',
        url: 'https://maps.google.com',
      },
      dressCode: 'Respectful attire',
      rsvp: {
        enabled: true,
        deadline: null,
        allowPlusOnes: true,
        maxPartySize: 4,
        askNote: true,
        question: null,
        autoRemind: false,
      },
      rsvpTally: {
        yes: 58,
        no: 4,
        maybe: 2,
        pending: 8,
        attending: 64,
      },
      settings: {
        whoCanPost: 'anyone',
        allowedKinds: ['text', 'image'],
      },
      plan: 'free',
      createdAt: NOW - 86400000 * 2,
      expiresAt: NOW + 86400000 * 14,
      endedAt: null,
      remindersSent: [],
      memberCount: 65,
      postCount: 24,
      storageBytes: 8388608,
    },
  },
] as const;

export const defaultShowcaseEvent = showcaseItems[0]!.event;

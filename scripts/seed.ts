import './_bootstrap';

/**
 * Seeds the emulator with a demo event so `npm run dev` has something to look at.
 *
 * Writes through the same service layer the API uses, so the seeded data cannot drift from
 * what the app would actually produce. Emulator-only by design — it refuses to run against
 * a real project, because it creates fake users.
 *
 *   npm run seed
 */

const DEMO_POSTS = [
  'Made it! The rooftop is unreal 🌇',
  'Whoever brought the lemon cake — thank you.',
  'Speeches in ten minutes, everyone upstairs',
  'Best night in ages. Same time next year?',
];

const DAY_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const { appConfig } = await import('../src/config/app.config');

  if (!appConfig.useEmulators) {
    console.error('Refusing to seed: NEXT_PUBLIC_USE_EMULATORS is not true.');
    console.error('This script creates fake accounts and is only meant for the emulator.');
    process.exit(1);
  }

  const { auth } = await import('../src/lib/firebase/admin');
  const { createEvent, joinEvent } = await import('../src/lib/services/events');
  const { submitRsvp } = await import('../src/lib/services/rsvp');
  const { createPost } = await import('../src/lib/services/posts');
  const { formatJoinCode } = await import('../src/lib/codes-format');

  const host = await ensureUser('host@example.com', 'Priya Sharma');
  const guests = await Promise.all([
    ensureUser('sam@example.com', 'Sam Okonkwo'),
    ensureUser('lee@example.com', 'Lee Nakamura'),
  ]);

  const { event, joinCode } = await createEvent(host, {
    title: "Priya's 30th",
    description: 'Drinks from seven, dinner at eight. Come hungry.',
    occasion: 'birthday',
    hostedBy: 'Priya & Sam',
    templateId: 'sunset',
    startsAt: Date.now() + 5 * DAY_MS,
    endsAt: null,
    location: {
      name: 'The Rooftop',
      address: '14 Bridge Street',
      url: null,
    },
    dressCode: '',
    rsvp: {
      enabled: true,
      deadline: Date.now() + 3 * DAY_MS,
      allowPlusOnes: true,
      maxPartySize: 2,
      askNote: false,
      question: null,
    },
    expiryPresetId: '7d',
    whoCanPost: 'members',
    allowedKinds: ['text', 'image', 'video', 'audio'],
  });

  // A guest list with a mix of answers, so the tally has something to show.
  for (const guest of guests) await joinEvent(guest, event);
  const answers = ['yes', 'maybe'] as const;
  for (const [index, guest] of guests.entries()) {
    await submitRsvp(guest, event, {
      status: answers[index % answers.length]!,
      adults: index === 0 ? 2 : 1,
      children: index === 0 ? 1 : 0,
      note: '',
      answer: '',
    });
  }

  const authors = [host, ...guests];
  for (const [index, body] of DEMO_POSTS.entries()) {
    const author = authors[index % authors.length]!;
    await createPost(author, event, { eventId: event.id, body, upload: null });
  }

  console.log('Seeded a demo event.');
  console.log(`  invitation:  http://localhost:3000/e/${event.id}`);
  console.log(`  code:        ${formatJoinCode(joinCode)}`);
  console.log(`  host:        ${host.email}`);
  console.log('\nSign in as the host with the email-link option to get host controls.');

  /** Creates the account if it does not exist, and returns it shaped as an Actor. */
  async function ensureUser(email: string, displayName: string) {
    const existing = await auth()
      .getUserByEmail(email)
      .catch(() => null);

    const record =
      existing ?? (await auth().createUser({ email, displayName, emailVerified: true }));

    return {
      uid: record.uid,
      email,
      displayName,
      photoUrl: null,
      role: 'user' as const,
      isAnonymous: false,
      suspended: false,
    };
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

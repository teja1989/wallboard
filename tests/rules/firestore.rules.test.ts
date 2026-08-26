import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

/**
 * Firestore rules are the last line of defence: they bound what a browser holding a valid
 * ID token can reach if it bypasses the app entirely. Every one of these assertions
 * describes an attack someone could mount with nothing but the Firebase SDK and a session.
 *
 * Run via `npm run test:rules`, which starts the emulator around the suite.
 */

const PROJECT_ID = 'marquee-rules-test';
const EVENT_ID = 'event-alpha';
const OTHER_EVENT_ID = 'event-beta';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv?.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  // Seeded with rules disabled, exactly as the Admin SDK would write it in production.
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();

    await setDoc(doc(db, 'events', EVENT_ID), {
      title: 'Alpha party',
      hostUid: 'host-uid',
      status: 'live',
      expiresAt: Date.now() + 3_600_000,
    });
    await setDoc(doc(db, 'events', EVENT_ID, 'private', 'joinCode'), {
      code: 'ABCD2345',
      codeHash: 'deadbeef',
    });
    await setDoc(doc(db, 'events', EVENT_ID, 'members', 'member-uid'), {
      role: 'member',
      rsvp: { status: 'yes', partySize: 2, respondedAt: Date.now() },
    });
    await setDoc(doc(db, 'events', EVENT_ID, 'members', 'host-uid'), {
      role: 'host',
      rsvp: { status: 'yes', partySize: 1, respondedAt: Date.now() },
    });
    await setDoc(doc(db, 'events', EVENT_ID, 'rsvpNotes', 'member-uid'), {
      note: 'Allergic to shellfish',
      answer: '',
    });
    await setDoc(doc(db, 'events', EVENT_ID, 'posts', 'post-visible'), {
      state: 'visible',
      body: 'hello',
      authorUid: 'member-uid',
      createdAt: Date.now(),
    });
    await setDoc(doc(db, 'events', EVENT_ID, 'posts', 'post-removed'), {
      state: 'removed',
      body: '',
      authorUid: 'member-uid',
      createdAt: Date.now(),
    });

    await setDoc(doc(db, 'events', OTHER_EVENT_ID), { title: 'Beta party', status: 'live' });
    await setDoc(doc(db, 'events', OTHER_EVENT_ID, 'posts', 'secret'), {
      state: 'visible',
      body: 'not for you',
      createdAt: Date.now(),
    });

    await setDoc(doc(db, 'joinCodes', 'deadbeef'), { eventId: EVENT_ID });
    await setDoc(doc(db, 'users', 'member-uid'), { displayName: 'Member' });
    await setDoc(doc(db, 'users', 'other-uid'), { displayName: 'Other' });
    await setDoc(doc(db, 'auditLogs', 'log-1'), { action: 'event.create', actorUid: 'host-uid' });
    await setDoc(doc(db, 'rateLimits', 'bucket-1'), { count: 3 });
  });
});

/** A signed-in member of EVENT_ID. */
function member() {
  return testEnv.authenticatedContext('member-uid').firestore();
}

/** Signed in, but a member of nothing. */
function outsider() {
  return testEnv.authenticatedContext('outsider-uid').firestore();
}

function anonymous() {
  return testEnv.unauthenticatedContext().firestore();
}

function staff(role: 'support' | 'admin' | 'owner') {
  return testEnv.authenticatedContext(`${role}-uid`, { role }).firestore();
}

describe('events', () => {
  it('lets a member read the event', async () => {
    await assertSucceeds(getDoc(doc(member(), 'events', EVENT_ID)));
  });

  it('refuses a signed-in non-member', async () => {
    await assertFails(getDoc(doc(outsider(), 'events', EVENT_ID)));
  });

  it('refuses a signed-out visitor', async () => {
    await assertFails(getDoc(doc(anonymous(), 'events', EVENT_ID)));
  });

  it('lets staff read any event', async () => {
    await assertSucceeds(getDoc(doc(staff('support'), 'events', EVENT_ID)));
  });

  it('refuses writes from every client, including the host', async () => {
    const host = testEnv.authenticatedContext('host-uid').firestore();
    await assertFails(setDoc(doc(host, 'events', EVENT_ID), { title: 'Renamed' }));
    await assertFails(deleteDoc(doc(host, 'events', EVENT_ID)));
  });

  it('refuses writes from an owner', async () => {
    // Even the app owner mutates through the audited API, never directly.
    await assertFails(setDoc(doc(staff('owner'), 'events', EVENT_ID), { title: 'Renamed' }));
  });
});

describe('join codes', () => {
  it('are unreadable by the host', async () => {
    const host = testEnv.authenticatedContext('host-uid').firestore();
    await assertFails(getDoc(doc(host, 'events', EVENT_ID, 'private', 'joinCode')));
  });

  it('are unreadable by staff', async () => {
    await assertFails(getDoc(doc(staff('owner'), 'events', EVENT_ID, 'private', 'joinCode')));
  });

  it('cannot be looked up through the hash table', async () => {
    // Otherwise the collection would be an enumerable index of every live event.
    await assertFails(getDoc(doc(member(), 'joinCodes', 'deadbeef')));
    await assertFails(getDocs(collection(outsider(), 'joinCodes')));
  });
});

describe('posts', () => {
  it('are readable by members', async () => {
    await assertSucceeds(getDoc(doc(member(), 'events', EVENT_ID, 'posts', 'post-visible')));
  });

  it('hide removed posts from members', async () => {
    await assertFails(getDoc(doc(member(), 'events', EVENT_ID, 'posts', 'post-removed')));
  });

  it('are unreadable across events', async () => {
    // Membership in one event must not leak into another.
    await assertFails(getDoc(doc(member(), 'events', OTHER_EVENT_ID, 'posts', 'secret')));
  });

  it('are unreadable by non-members', async () => {
    await assertFails(getDoc(doc(outsider(), 'events', EVENT_ID, 'posts', 'post-visible')));
  });

  it('support the wall query for members', async () => {
    await assertSucceeds(
      getDocs(
        query(collection(member(), 'events', EVENT_ID, 'posts'), where('state', '==', 'visible')),
      ),
    );
  });

  it('reject a wall query that would include removed posts', async () => {
    await assertFails(getDocs(collection(member(), 'events', EVENT_ID, 'posts')));
  });

  it('cannot be written by their own author', async () => {
    await assertFails(
      setDoc(doc(member(), 'events', EVENT_ID, 'posts', 'forged'), {
        state: 'visible',
        body: 'straight to the database',
        authorUid: 'member-uid',
      }),
    );
  });

  it('cannot be edited to impersonate someone else', async () => {
    await assertFails(
      setDoc(doc(member(), 'events', EVENT_ID, 'posts', 'post-visible'), {
        authorUid: 'host-uid',
      }),
    );
  });
});

describe('members', () => {
  it('are visible to fellow members', async () => {
    await assertSucceeds(getDocs(collection(member(), 'events', EVENT_ID, 'members')));
  });

  it('are invisible to outsiders', async () => {
    await assertFails(getDocs(collection(outsider(), 'events', EVENT_ID, 'members')));
  });

  it('cannot be self-created, which would be a way to join without a code', async () => {
    await assertFails(
      setDoc(doc(outsider(), 'events', EVENT_ID, 'members', 'outsider-uid'), { role: 'member' }),
    );
  });

  it('cannot self-promote to host', async () => {
    await assertFails(
      setDoc(doc(member(), 'events', EVENT_ID, 'members', 'member-uid'), { role: 'host' }),
    );
  });
});

describe('RSVP notes', () => {
  it('are unreadable by other guests', async () => {
    // A note addressed to the host is not for the rest of the guest list.
    await assertFails(getDoc(doc(member(), 'events', EVENT_ID, 'rsvpNotes', 'member-uid')));
  });

  it('are unreadable even by the person who wrote them', async () => {
    // They read it back through the API, so the read is authorised and logged.
    const author = testEnv.authenticatedContext('member-uid').firestore();
    await assertFails(getDoc(doc(author, 'events', EVENT_ID, 'rsvpNotes', 'member-uid')));
  });

  it('are unreadable by the host', async () => {
    const host = testEnv.authenticatedContext('host-uid').firestore();
    await assertFails(getDoc(doc(host, 'events', EVENT_ID, 'rsvpNotes', 'member-uid')));
  });

  it('are unreadable by staff', async () => {
    await assertFails(getDoc(doc(staff('owner'), 'events', EVENT_ID, 'rsvpNotes', 'member-uid')));
  });

  it('cannot be enumerated', async () => {
    await assertFails(getDocs(collection(member(), 'events', EVENT_ID, 'rsvpNotes')));
  });

  it('cannot be written by anyone', async () => {
    await assertFails(
      setDoc(doc(member(), 'events', EVENT_ID, 'rsvpNotes', 'member-uid'), { note: 'edited' }),
    );
  });
});

describe('RSVP answers on the guest list', () => {
  it('are visible to fellow guests, because that is what a guest list is', async () => {
    await assertSucceeds(getDoc(doc(member(), 'events', EVENT_ID, 'members', 'host-uid')));
  });

  it('cannot be forged by answering on someone else’s behalf', async () => {
    await assertFails(
      setDoc(doc(member(), 'events', EVENT_ID, 'members', 'host-uid'), {
        rsvp: { status: 'no', partySize: 1 },
      }),
    );
  });

  it('cannot be self-written, even for yourself', async () => {
    // Otherwise a guest could inflate their party size past the host's limit and skip the
    // tally update the server maintains.
    await assertFails(
      setDoc(doc(member(), 'events', EVENT_ID, 'members', 'member-uid'), {
        rsvp: { status: 'yes', partySize: 99 },
      }),
    );
  });

  it('stay invisible to non-members', async () => {
    await assertFails(getDoc(doc(outsider(), 'events', EVENT_ID, 'members', 'member-uid')));
  });
});

describe('users', () => {
  it('let a person read their own profile', async () => {
    await assertSucceeds(getDoc(doc(member(), 'users', 'member-uid')));
  });

  it('refuse reads of someone else’s profile', async () => {
    await assertFails(getDoc(doc(member(), 'users', 'other-uid')));
  });

  it('let staff read any profile', async () => {
    await assertSucceeds(getDoc(doc(staff('admin'), 'users', 'member-uid')));
  });

  it('refuse self-service writes, so a role claim cannot be forged', async () => {
    await assertFails(setDoc(doc(member(), 'users', 'member-uid'), { role: 'owner' }));
  });
});

describe('server-only collections', () => {
  it('keep audit logs unreadable, even by an owner', async () => {
    await assertFails(getDoc(doc(member(), 'auditLogs', 'log-1')));
    await assertFails(getDoc(doc(staff('owner'), 'auditLogs', 'log-1')));
  });

  it('keep audit logs unwritable, so the trail cannot be tampered with', async () => {
    await assertFails(setDoc(doc(staff('owner'), 'auditLogs', 'forged'), { action: 'nope' }));
  });

  it('keep rate-limit buckets out of reach', async () => {
    // Readable buckets would tell an attacker exactly how much budget they have left.
    await assertFails(getDoc(doc(member(), 'rateLimits', 'bucket-1')));
    await assertFails(setDoc(doc(member(), 'rateLimits', 'bucket-1'), { count: 0 }));
  });
});

describe('unknown paths', () => {
  it('are denied by default', async () => {
    await assertFails(getDoc(doc(member(), 'somethingNew', 'doc-1')));
    await assertFails(setDoc(doc(staff('owner'), 'somethingNew', 'doc-1'), { a: 1 }));
  });
});

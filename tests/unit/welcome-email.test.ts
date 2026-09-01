import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { emailSubjects } from '@/config';
import { renderEmail } from '@/lib/email/render';
import type { EventDoc } from '@/types/domain';

function dummyEvent(overrides: Partial<EventDoc> = {}): EventDoc {
  return {
    id: 'evt_test123',
    title: "Maya's 30th Birthday",
    description: 'Celebrating 30 years',
    hostedBy: 'Maya & Sam',
    hostUid: 'usr_host1',
    hostName: 'Maya',
    occasion: 'birthday',
    templateId: 'amber-editorial',
    startsAt: Date.UTC(2026, 8, 15, 19, 0),
    endsAt: null,
    timeZone: 'America/New_York',
    location: {
      name: 'The Loft',
      address: '123 Main St, Brooklyn, NY',
      url: null,
    },
    dressCode: 'Casual chic',
    plan: 'free',
    status: 'live',
    createdAt: Date.now(),
    expiresAt: Date.now() + 86400000 * 7,
    endedAt: null,
    settings: {
      whoCanPost: 'anyone',
      allowedKinds: ['text', 'image'],
    },
    rsvp: {
      enabled: true,
      deadline: null,
      allowPlusOnes: true,
      maxPartySize: 2,
      askNote: true,
      question: null,
      autoRemind: false,
    },
    rsvpTally: {
      yes: 1,
      no: 0,
      maybe: 0,
      pending: 0,
      attending: 1,
    },
    remindersSent: [],
    memberCount: 1,
    postCount: 0,
    storageBytes: 0,
    ...overrides,
  };
}

describe('welcomeHost email template', () => {
  it('generates the correct subject line', () => {
    expect(emailSubjects.welcomeHost("Maya's 30th Birthday")).toBe(
      "Your event is ready — Maya's 30th Birthday",
    );
  });

  it('renders html and plain text containing event title and links', () => {
    const event = dummyEvent();
    const rendered = renderEmail('welcomeHost', {
      event,
      joinCode: 'PARTY30',
    });

    expect(rendered.subject).toContain("Maya's 30th Birthday");
    expect(rendered.html).toContain('30th Birthday');
    expect(rendered.html).toContain('Open Host Controls');
    expect(rendered.html).toContain('/e/evt_test123');
    expect(rendered.html).toContain('/i/PARTY30');
    expect(rendered.text).toContain('Manage your event, invite guests, and track RSVPs:');
    expect(rendered.text).toContain('/i/PARTY30');
  });
});

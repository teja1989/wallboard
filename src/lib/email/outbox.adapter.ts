import 'server-only';
import { collections } from '@/config';
import { db } from '@/lib/firebase/admin';
import type { EmailAdapter, OutgoingEmail, SendResult } from './types';

/**
 * Development driver.
 *
 * Writes every message to Firestore instead of sending it, so the whole invite flow can be
 * exercised with no provider account and no risk of mailing a real person from a test run.
 * Open the emulator UI at :4000 and read `mailOutbox` to see exactly what would have gone
 * out, HTML and all.
 *
 * A one-line summary also goes to the server console, because the most common question
 * while building this is "did it send?" and the answer should not require a browser.
 */
export const outboxAdapter: EmailAdapter = {
  driver: 'outbox',

  async send(message: OutgoingEmail): Promise<SendResult> {
    try {
      const reference = await db()
        .collection(collections.mailOutbox)
        .add({
          ...message,
          sentAt: Date.now(),
          // TTL: a dev outbox that grows forever is a dev outbox nobody reads.
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

      console.warn(`[mail:outbox] ${message.kind} → ${message.to} — "${message.subject}"`);
      return { to: message.to, ok: true, id: reference.id };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      console.error(`[mail:outbox] failed for ${message.to}: ${reason}`);
      return { to: message.to, ok: false, error: reason };
    }
  },
};

import type { EmailKind } from '@/config';

/**
 * Email abstraction.
 *
 * Same shape as the storage adapter, for the same reason: the whole app has to run with no
 * account and no keys, and swapping providers should be one file rather than a migration.
 */

export interface OutgoingEmail {
  to: string;
  /** Display name shown before the from address. */
  fromName: string;
  /** Where a reply goes — the host, not us. */
  replyTo?: string;
  subject: string;
  html: string;
  /** Always sent. A text part is what keeps mail out of spam folders. */
  text: string;
  /** One-click unsubscribe, honoured by every serious client. */
  unsubscribeUrl?: string;
  kind: EmailKind;
  /** Correlates a send with the event it belongs to, for the audit trail. */
  eventId: string;
}

export interface SendResult {
  to: string;
  ok: boolean;
  /** Provider message id, when the send succeeded. */
  id?: string;
  error?: string;
}

export interface EmailAdapter {
  readonly driver: 'outbox' | 'resend';
  /** Sends one message. Never throws — a failed address must not fail the batch. */
  send(message: OutgoingEmail): Promise<SendResult>;
}

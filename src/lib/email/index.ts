import 'server-only';
import { serverConfig } from '@/config';
import { outboxAdapter } from './outbox.adapter';
import { resendAdapter } from './resend.adapter';
import type { EmailAdapter } from './types';

export type * from './types';

const adapters: Record<EmailAdapter['driver'], EmailAdapter> = {
  outbox: outboxAdapter,
  resend: resendAdapter,
};

/**
 * Selected by EMAIL_DRIVER. Defaults to the outbox, so a misconfigured deploy writes mail
 * to a collection nobody reads rather than sending half-built invitations to real guests.
 */
export function mailer(): EmailAdapter {
  return adapters[serverConfig().email.driver];
}

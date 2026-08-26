import 'server-only';
import { emailConfig, serverConfig } from '@/config';
import type { EmailAdapter, OutgoingEmail, SendResult } from './types';

/**
 * Production driver.
 *
 * Spoken over Resend's REST API with plain fetch rather than their SDK — the surface used
 * here is one endpoint, and a dependency that ships a bundler-hostile client for the sake
 * of one POST is not worth it.
 *
 * Never throws. One bad address in a batch of two hundred must not stop the other
 * hundred and ninety-nine from arriving.
 */
const ENDPOINT = 'https://api.resend.com/emails';

export const resendAdapter: EmailAdapter = {
  driver: 'resend',

  async send(message: OutgoingEmail): Promise<SendResult> {
    const apiKey = serverConfig().resendApiKey;
    if (!apiKey) {
      return { to: message.to, ok: false, error: 'RESEND_API_KEY is not set.' };
    }

    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          // Resend deduplicates on this, so a double-clicked send does not double-send.
          'Idempotency-Key': `${message.eventId}:${message.kind}:${message.to}`,
        },
        body: JSON.stringify({
          from: `${message.fromName} <${emailConfig.fromAddress}>`,
          to: [message.to],
          reply_to: message.replyTo,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.unsubscribeUrl
            ? {
                'List-Unsubscribe': `<${message.unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              }
            : undefined,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        return {
          to: message.to,
          ok: false,
          error: `Resend ${response.status}: ${body.slice(0, 200)}`,
        };
      }

      const payload = (await response.json()) as { id?: string };
      return { to: message.to, ok: true, id: payload.id };
    } catch (error) {
      return {
        to: message.to,
        ok: false,
        error: error instanceof Error ? error.message : 'Send failed.',
      };
    }
  },
};

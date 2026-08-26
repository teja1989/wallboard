import 'server-only';
import { appConfig, brand, emailSubjects, faceOf, occasionById, templateById } from '@/config';
import { formatEventDate } from '@/lib/utils';
import type { EmailKind } from '@/config';
import type { EventDoc } from '@/types/domain';

/**
 * Email rendering.
 *
 * Hand-written tables and inline styles, because email clients are still living in 2005:
 * Outlook has no flexbox, Gmail strips `<style>` blocks, and nothing supports CSS custom
 * properties. So none of the app's design tokens can be used here — the invitation's
 * palette and display face are read from the template and inlined per message instead,
 * which is what makes the email look like the invitation rather than like a receipt.
 *
 * A text part is always produced. It is what stops the message being scored as spam, and
 * it is what someone on a watch actually reads.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** Escapes for HTML text nodes and attribute values alike. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function eventUrl(eventId: string): string {
  return `${appConfig.siteUrl}/e/${eventId}`;
}

interface Shell {
  event: EventDoc;
  /** Preheader — the grey line clients show after the subject. Worth writing properly. */
  preview: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
  unsubscribeUrl?: string;
}

/**
 * The message chrome: coloured header in the template's palette, white card, footer.
 *
 * Everything is a table. Everything is inline. `!important` is absent because Gmail strips
 * it. Widths are fixed at 600px because that is the last width every client agrees on.
 */
function shell({ event, preview, bodyHtml, ctaLabel, ctaUrl, unsubscribeUrl }: Shell): string {
  const template = templateById(event.templateId);
  const face = faceOf(template);
  const { palette } = template;

  // Email clients that do not understand oklch() would render nothing, so the header
  // carries a hex fallback underneath the gradient.
  const headerFallback = '#f0ded4';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(event.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f2ef;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f2ef;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(60,40,30,0.08);">

      <tr><td style="height:96px;background:${headerFallback};background-image:linear-gradient(135deg,${palette.from},${palette.to});">&nbsp;</td></tr>

      <tr><td style="padding:28px 32px 32px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2b2320;">
        ${bodyHtml}

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0 0;">
          <tr><td style="border-radius:999px;background:#c65f47;">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(ctaLabel)}</a>
          </td></tr>
        </table>

        <p style="margin:20px 0 0 0;font-size:13px;line-height:1.5;color:#8a7a72;">
          Or open this link:<br>
          <a href="${escapeHtml(ctaUrl)}" style="color:#8a7a72;">${escapeHtml(ctaUrl)}</a>
        </p>
      </td></tr>

      <tr><td style="padding:20px 32px 28px 32px;border-top:1px solid #eee6e1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#a1938c;">
        Sent with ${escapeHtml(brand.name)} on behalf of ${escapeHtml(event.hostedBy)}.
        ${unsubscribeUrl ? `<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#a1938c;">Stop receiving emails about this event</a>.` : ''}
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`.replace('__FACE__', face.stack);
}

/** The event's facts, as a block both the invitation and the reminder reuse. */
function detailsHtml(event: EventDoc): string {
  const rows: string[] = [];

  if (event.startsAt !== null) {
    rows.push(row('When', escapeHtml(formatEventDate(event.startsAt))));
  }
  if (event.location?.name || event.location?.address) {
    const place = [event.location.name, event.location.address].filter(Boolean).join(', ');
    const value = event.location.url
      ? `<a href="${escapeHtml(event.location.url)}" style="color:#c65f47;">${escapeHtml(place)}</a>`
      : escapeHtml(place);
    rows.push(row('Where', value));
  }
  if (event.dressCode) rows.push(row('Dress code', escapeHtml(event.dressCode)));

  if (rows.length === 0) return '';

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0 0;width:100%;">${rows.join('')}</table>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#a1938c;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;font-size:15px;line-height:1.5;color:#2b2320;">${value}</td>
  </tr>`;
}

function detailsText(event: EventDoc): string {
  const lines: string[] = [];
  if (event.startsAt !== null) lines.push(`When:  ${formatEventDate(event.startsAt)}`);
  if (event.location?.name || event.location?.address) {
    lines.push(
      `Where: ${[event.location.name, event.location.address].filter(Boolean).join(', ')}`,
    );
    if (event.location.url) lines.push(`       ${event.location.url}`);
  }
  if (event.dressCode) lines.push(`Dress: ${event.dressCode}`);
  return lines.length ? `\n${lines.join('\n')}\n` : '';
}

export interface RenderContext {
  event: EventDoc;
  /** Present on invitations and reminders; absent on a confirmation to the replier. */
  unsubscribeUrl?: string;
  /** The guest's name, when we know it. */
  guestName?: string;
}

export function renderEmail(kind: EmailKind, context: RenderContext): RenderedEmail {
  switch (kind) {
    case 'invitation':
      return renderInvitation(context);
    case 'reminder':
      return renderReminder(context);
    case 'rsvpConfirmation':
      return renderConfirmation(context);
  }
}

function renderInvitation({ event, unsubscribeUrl }: RenderContext): RenderedEmail {
  const occasion = occasionById(event.occasion);
  const template = templateById(event.templateId);
  const face = faceOf(template);
  const url = eventUrl(event.id);

  const bodyHtml = `
    <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#a1938c;">From ${escapeHtml(event.hostedBy)}</p>
    <h1 style="margin:10px 0 0 0;font-family:${face.stack};font-size:30px;line-height:1.15;font-weight:${face.weight};color:#2b2320;">${escapeHtml(event.title)}</h1>
    ${event.description ? `<p style="margin:16px 0 0 0;font-size:16px;line-height:1.6;color:#5c4f49;">${escapeHtml(event.description)}</p>` : ''}
    ${detailsHtml(event)}
    <p style="margin:24px 0 0 0;font-size:15px;line-height:1.6;color:#5c4f49;">${escapeHtml(occasion.rsvpPrompt)} It takes one tap — no account, no app.</p>`;

  const text = `${event.hostedBy} invited you to ${event.title}
${event.description ? `\n${event.description}\n` : ''}${detailsText(event)}
${occasion.rsvpPrompt} Reply here:
${url}
${unsubscribeUrl ? `\nStop receiving emails about this event: ${unsubscribeUrl}` : ''}`;

  return {
    subject: emailSubjects.invitation(event.title, event.hostedBy),
    html: shell({
      event,
      preview:
        `${occasion.rsvpPrompt} ${event.startsAt ? formatEventDate(event.startsAt) : ''}`.trim(),
      bodyHtml,
      ctaLabel: 'Open the invitation',
      ctaUrl: url,
      unsubscribeUrl,
    }),
    text: text.trim(),
  };
}

function renderReminder({ event, unsubscribeUrl, guestName }: RenderContext): RenderedEmail {
  const template = templateById(event.templateId);
  const face = faceOf(template);
  const url = eventUrl(event.id);
  const greeting = guestName ? `${escapeHtml(guestName)}, we` : 'We';

  const bodyHtml = `
    <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#a1938c;">A gentle nudge</p>
    <h1 style="margin:10px 0 0 0;font-family:${face.stack};font-size:28px;line-height:1.15;font-weight:${face.weight};color:#2b2320;">${escapeHtml(event.title)}</h1>
    <p style="margin:16px 0 0 0;font-size:16px;line-height:1.6;color:#5c4f49;">${greeting} have not heard from you yet, and ${escapeHtml(event.hostedBy)} is working out numbers. Even a no is genuinely useful.</p>
    ${detailsHtml(event)}`;

  const text = `${event.title} — a gentle nudge

${guestName ? `${guestName}, we` : 'We'} have not heard from you yet, and ${event.hostedBy} is working out numbers. Even a no is genuinely useful.
${detailsText(event)}
Reply here:
${url}
${unsubscribeUrl ? `\nStop receiving emails about this event: ${unsubscribeUrl}` : ''}`;

  return {
    subject: emailSubjects.reminder(event.title),
    html: shell({
      event,
      preview: 'Even a no is genuinely useful.',
      bodyHtml,
      ctaLabel: 'Reply now',
      ctaUrl: url,
      unsubscribeUrl,
    }),
    text: text.trim(),
  };
}

function renderConfirmation({ event, guestName }: RenderContext): RenderedEmail {
  const template = templateById(event.templateId);
  const face = faceOf(template);
  const url = eventUrl(event.id);

  const bodyHtml = `
    <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#a1938c;">You're on the list</p>
    <h1 style="margin:10px 0 0 0;font-family:${face.stack};font-size:28px;line-height:1.15;font-weight:${face.weight};color:#2b2320;">${escapeHtml(event.title)}</h1>
    <p style="margin:16px 0 0 0;font-size:16px;line-height:1.6;color:#5c4f49;">${guestName ? `Thanks, ${escapeHtml(guestName)}. ` : 'Thanks. '}${escapeHtml(event.hostedBy)} knows you are coming. Here are the details again, so they are in your inbox when you need them.</p>
    ${detailsHtml(event)}
    <p style="margin:24px 0 0 0;font-size:15px;line-height:1.6;color:#5c4f49;">On the day, the same link becomes the wall where everyone posts their photos.</p>`;

  const text = `You're on the list for ${event.title}

${guestName ? `Thanks, ${guestName}. ` : 'Thanks. '}${event.hostedBy} knows you are coming.
${detailsText(event)}
On the day, the same link becomes the wall where everyone posts their photos:
${url}`;

  return {
    subject: emailSubjects.rsvpConfirmation(event.title),
    html: shell({
      event,
      preview: 'The details, so they are in your inbox when you need them.',
      bodyHtml,
      ctaLabel: 'See the invitation',
      ctaUrl: url,
    }),
    text: text.trim(),
  };
}

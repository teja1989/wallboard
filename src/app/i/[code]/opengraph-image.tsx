import { ImageResponse } from 'next/og';
import { brand, occasionById, templateById } from '@/config';
import { oklchToHex } from '@/lib/color';
import { findEventByCode } from '@/lib/services/events';
import { formatEventDate } from '@/lib/utils';
import { joinCodeSchema } from '@/lib/validation/schemas';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Invitation';

/**
 * The card an invitation becomes when it is pasted into a group chat.
 *
 * This is the product's distribution loop rendered as an image: almost nobody arrives here
 * from a search result, they arrive because someone they know shared a link, and this is
 * the first thing they see of it. A naked URL converts a fraction of what a card showing
 * the event's own name, date and design does.
 *
 * Drawn in the event's chosen template palette, so the preview and the invitation behind
 * it are recognisably the same object.
 *
 * Deliberately absent: the guest list, the wall, the code itself. A preview is fetched by
 * an unauthenticated crawler and cached by servers nobody here controls, so it may only
 * ever carry what the link already grants its holder.
 */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const parsed = joinCodeSchema.safeParse(code);
  const event = parsed.success ? await findEventByCode(parsed.data) : null;

  const template = templateById(event?.templateId ?? '');
  const from = oklchToHex(template.palette.from, '#f6efe9');
  const to = oklchToHex(template.palette.to, '#e8dcd2');
  const ink = oklchToHex(template.palette.onGradient, '#2b2320');
  const accent = oklchToHex(template.palette.accent, '#8a7a72');

  const title = event?.title ?? 'You are invited';
  const host = event?.hostedBy ? `From ${event.hostedBy}` : brand.name;
  const when = event?.startsAt ? formatEventDate(event.startsAt, event.timeZone, 'always') : null;
  const prompt = event ? occasionById(event.occasion).rsvpPrompt : brand.shortPromise;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        backgroundImage: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
        color: ink,
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ display: 'flex', fontSize: 26, letterSpacing: 6, color: accent }}>
        {host.toUpperCase()}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 40 ? 72 : 96,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -2,
          }}
        >
          {title}
        </div>
        {when && (
          <div style={{ display: 'flex', marginTop: 28, fontSize: 38, opacity: 0.85 }}>{when}</div>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          fontSize: 26,
          color: accent,
        }}
      >
        <div style={{ display: 'flex' }}>{prompt}</div>
        <div style={{ display: 'flex', fontWeight: 600 }}>{brand.name}</div>
      </div>
    </div>,
    size,
  );
}

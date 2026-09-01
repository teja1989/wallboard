import { Coins, Download, Mic, Palette, Sparkles, Tv, Users } from 'lucide-react';

const ECOSYSTEM_FEATURES = [
  {
    icon: Palette,
    title: 'Luxe Designer Invitations',
    description:
      '19 signature animated palettes with fluid typography, responsive event agenda schedules, and custom dress codes.',
    badge: '19 Themes',
    gradient: 'from-amber-500/20 to-orange-500/20',
  },
  {
    icon: Users,
    title: 'Smart RSVP & Headcounts',
    description:
      'Track adult vs. child headcounts for seating and party favor bags, with instant dietary and allergy capture.',
    badge: 'Zero Apps Required',
    gradient: 'from-blue-500/20 to-indigo-500/20',
  },
  {
    icon: Tv,
    title: 'Live TV & Projector Wall',
    description:
      'Plug into any venue TV or cast via AirPlay. Guest photos and messages pop up live with ambient confetti showers.',
    badge: 'Kiosk TV Mode',
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
  {
    icon: Mic,
    title: 'Audio Voice Guestbook',
    description:
      'Guests tap to record heartfelt audio toasts and voice notes with crystal-clear Opus audio and animated waveforms.',
    badge: 'Audio Keepsake',
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    icon: Coins,
    title: 'Dream Gifting & Cash Pots',
    description:
      'Stripe-powered collective honeymoon, birthday, or toy funds with direct host payouts and zero account friction.',
    badge: '2.5% Platform Fee',
    gradient: 'from-yellow-500/20 to-amber-500/20',
  },
  {
    icon: Download,
    title: 'Keepsake Memory Archive',
    description:
      '1-click ZIP export containing every full-resolution photo, audio voice recording, and an offline interactive photo book.',
    badge: 'Permanent Keepsake',
    gradient: 'from-rose-500/20 to-red-500/20',
  },
];

export function FeatureEcosystem() {
  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      <div className="text-center">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3.5 py-1 text-xs font-bold tracking-wide text-[var(--accent)] uppercase">
          <Sparkles className="size-3.5" />
          The Complete Celebration Suite
        </p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
          Everything your celebration needs. In one private link.
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-base text-[var(--text-secondary)]">
          From first invitation to event-night projector presentation and lifelong keepsakes.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {ECOSYSTEM_FEATURES.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="card group relative flex flex-col justify-between overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--accent-soft)] hover:shadow-xl"
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm">
                    <Icon className="size-5" />
                  </span>
                  <span className="rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-[0.65rem] font-bold text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent)]">
                    {item.badge}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-bold text-[var(--text-primary)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[var(--text-secondary)]">
                  {item.description}
                </p>
              </div>

              {/* Decorative Subtle Gradient Aura on hover */}
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${item.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

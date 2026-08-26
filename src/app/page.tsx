import Link from 'next/link';
import { ArrowRight, Clock, KeyRound, ShieldCheck, Sparkles } from 'lucide-react';
import { brand, expiryPresets, mediaRules } from '@/config';

export default function LandingPage() {
  const maxVideoMb = Math.round(mediaRules.video.maxBytes / (1024 * 1024));
  const shortestExpiry = expiryPresets[0].label;
  const longestExpiry = expiryPresets.at(-1)?.label ?? shortestExpiry;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold tracking-tight">{brand.name}</span>
        <Link
          href="/join"
          className="rounded-[var(--radius-pill)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-sunken)]"
        >
          I have a code
        </Link>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <p className="mb-4 inline-flex w-fit items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--accent-soft)] px-3.5 py-1.5 text-sm font-medium text-[var(--text-secondary)]">
          <Sparkles className="size-3.5" aria-hidden />
          Share the moment, not forever
        </p>

        <h1 className="max-w-3xl text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
          {brand.tagline}
        </h1>

        <p className="mt-6 max-w-xl text-lg leading-relaxed text-pretty text-[var(--text-secondary)]">
          {brand.description}
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            href="/create"
            className="inline-flex h-13 items-center gap-2.5 rounded-[var(--radius-pill)] bg-[var(--accent)] px-7 text-base font-medium text-[var(--accent-contrast)] shadow-[var(--shadow-soft)] transition-all duration-200 ease-[var(--ease-soft)] hover:bg-[var(--accent-hover)] active:scale-[0.97]"
          >
            Start an event
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href="/join"
            className="inline-flex h-13 items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--surface-sunken)] px-7 text-base font-medium transition-colors hover:bg-[var(--accent-soft)]"
          >
            Join with a code
          </Link>
        </div>
      </section>

      <section className="grid gap-4 pb-12 sm:grid-cols-3">
        <Feature
          icon={<KeyRound className="size-5" aria-hidden />}
          title="One code, everyone in"
          body="Share an eight-character code. No invites, no app, no account needed to watch along."
        />
        <Feature
          icon={<Clock className="size-5" aria-hidden />}
          title="Gone when you say"
          body={`Pick anything from ${shortestExpiry} to ${longestExpiry}. When it lapses, the photos and video are deleted for real.`}
        />
        <Feature
          icon={<ShieldCheck className="size-5" aria-hidden />}
          title="Yours to moderate"
          body={`Photos, video up to ${maxVideoMb} MB, voice notes and messages — with the host able to remove anything, any time.`}
        />
      </section>
    </main>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card p-6">
      <span className="mb-4 inline-flex size-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
        {icon}
      </span>
      <h2 className="mb-1.5 font-semibold">{title}</h2>
      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{body}</p>
    </div>
  );
}

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Beer, Cake, GraduationCap, Sparkles, Users } from 'lucide-react';

export function LifestyleShowcase() {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-16 px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold tracking-wider text-[var(--accent)] uppercase sm:text-sm">
          Real Celebrations in Action
        </p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Everything your gathering needs, captured beautifully.
        </h2>
        <p className="mt-3 text-sm text-[var(--text-secondary)] sm:text-base">
          From college graduations and backyard dinner parties to kid birthdays and milestone
          celebrations, Marquee turns moments into unforgettable shared memories.
        </p>
      </div>

      {/* Showcase 1: High School & College Graduation */}
      <div className="grid grid-cols-1 items-center gap-8 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-lg sm:p-10 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
            <GraduationCap className="size-3.5" />
            <span>Graduation Celebrations</span>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Celebrate proud milestones with everyone who supported you.
          </h3>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Send sleek digital invitations with Google Maps directions, gift registry links, and a
            live photo feed where family and friends can post their congratulations from anywhere in
            the world.
          </p>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)] sm:text-sm">
            <li className="flex items-center gap-2">
              <Sparkles className="size-4 text-blue-500" />
              <span>Share invitation via 1-click WhatsApp, SMS, or private link</span>
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="size-4 text-blue-500" />
              <span>Digital guestbook: relatives leave heartfelt voice toast notes</span>
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="size-4 text-blue-500" />
              <span>Collective graduation cash fund & registry options built-in</span>
            </li>
          </ul>
          <div className="pt-2">
            <Link
              href="/create?occasion=graduation"
              className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline dark:text-blue-400"
            >
              Create Graduation Invitation <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl lg:col-span-6">
          <Image
            src="/images/showcase-graduation.jpg"
            alt="Joyous graduation party with proud graduates in caps and celebrating family"
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute right-4 bottom-4 left-4 flex items-center justify-between rounded-xl border border-white/20 bg-black/40 px-4 py-2.5 text-xs text-white backdrop-blur-md">
            <div className="flex items-center gap-2">
              <GraduationCap className="size-4 text-blue-400" />
              <span className="font-semibold">Class of 2024 Graduation Party</span>
            </div>
            <span className="rounded-md border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-[0.7rem] text-blue-300">
              36 Confirmed RSVPs
            </span>
          </div>
        </div>
      </div>

      {/* Showcase 2: Casual Backyard Get-Togethers & Dinners (Reversed) */}
      <div className="grid grid-cols-1 items-center gap-8 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-lg sm:p-10 lg:grid-cols-12">
        <div className="group relative order-2 aspect-video w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl lg:order-1 lg:col-span-6">
          <Image
            src="/images/showcase-friends-gathering.jpg"
            alt="Casual evening friends dinner gathering with pizza and drinks under bistro lights"
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute right-4 bottom-4 left-4 flex items-center justify-between rounded-xl border border-white/20 bg-black/40 px-4 py-2.5 text-xs text-white backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Beer className="size-4 text-amber-400" />
              <span className="font-semibold">Friday Backyard Pizza & Game Night</span>
            </div>
            <span className="rounded-md border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 text-[0.7rem] text-amber-300">
              14 Friends Attending
            </span>
          </div>
        </div>

        <div className="order-1 space-y-5 lg:order-2 lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300">
            <Beer className="size-3.5" />
            <span>Casual Get-Togethers</span>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Effortless dinners, game nights, and casual hangouts.
          </h3>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Planning a casual potluck, BBQ, or dinner party should take 30 seconds, not 15
            back-and-forth group texts. Guests reply with a single tap in their browser with zero
            sign-up friction.
          </p>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)] sm:text-sm">
            <li className="flex items-center gap-2">
              <Users className="size-4 text-amber-500" />
              <span>Real-time headcount tracking & dietary preferences</span>
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              <span>Shared photo wall to collect everyone’s snaps after the party</span>
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              <span>100% free forever for casual parties up to 25 guests</span>
            </li>
          </ul>
          <div className="pt-2">
            <Link
              href="/create?occasion=party"
              className="inline-flex items-center gap-2 text-sm font-bold text-amber-600 hover:underline dark:text-amber-400"
            >
              Plan a Get-Together <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Showcase 3: Kid & Adult Birthday Milestone */}
      <div className="grid grid-cols-1 items-center gap-8 overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-6 shadow-lg sm:p-10 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-500/30 bg-pink-500/10 px-3.5 py-1 text-xs font-bold text-pink-700 dark:text-pink-300">
            <Cake className="size-3.5" />
            <span>Kid & Family Birthdays</span>
          </div>
          <h3 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            Stress-free birthday planning with schedule timelines.
          </h3>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
            Keep parents in sync with a clear Party Agenda timeline (*Cake Cutting @ 4:15 PM*),
            adult vs kid headcount breakdowns for accurate catering, and a 1-click keepsake album
            ZIP export.
          </p>
          <ul className="space-y-2 text-xs text-[var(--text-secondary)] sm:text-sm">
            <li className="flex items-center gap-2">
              <Users className="size-4 text-pink-500" />
              <span>Adults vs. Kids breakdown on RSVP cards</span>
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="size-4 text-pink-500" />
              <span>Party Agenda timeline with schedule alerts for cake & games</span>
            </li>
            <li className="flex items-center gap-2">
              <Sparkles className="size-4 text-pink-500" />
              <span>1-Click High-Res Keepsake ZIP download of all memories</span>
            </li>
          </ul>
          <div className="pt-2">
            <Link
              href="/create?occasion=birthday"
              className="inline-flex items-center gap-2 text-sm font-bold text-pink-600 hover:underline dark:text-pink-400"
            >
              Make Birthday Invitation <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl lg:col-span-6">
          <Image
            src="/images/showcase-birthday.jpg"
            alt="Joyful children birthday party celebration with colorful balloons and cake"
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute right-4 bottom-4 left-4 flex items-center justify-between rounded-xl border border-white/20 bg-black/40 px-4 py-2.5 text-xs text-white backdrop-blur-md">
            <div className="flex items-center gap-2">
              <Cake className="size-4 text-pink-400" />
              <span className="font-semibold">Priya&apos;s 5th Birthday Party</span>
            </div>
            <span className="rounded-md border border-pink-500/30 bg-pink-500/20 px-2 py-0.5 text-[0.7rem] text-pink-300">
              Cake Cutting at 4:15 PM
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

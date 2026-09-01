'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Beer,
  Cake,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Heart,
  PartyPopper,
  Pause,
  Play,
  Sparkles,
  Volume2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SlideItem {
  id: string;
  category: string;
  tabLabel: string;
  icon: typeof Cake;
  image: string;
  alt: string;
  title: string;
  subtitle: string;
  liveBadge: string;
  floatingNotification: {
    icon: string;
    title: string;
    subtitle: string;
  };
}

const CELEBRATION_SLIDES: SlideItem[] = [
  {
    id: 'graduation',
    category: 'Graduation Parties',
    tabLabel: '🎓 Graduations',
    icon: GraduationCap,
    image: '/images/showcase-graduation.jpg',
    alt: 'Joyous college and high school graduation party with graduates in caps and celebrating family',
    title: 'High School & College Graduations',
    subtitle:
      'Celebrate proud achievements with family & friends — photo memories everyone can view on the live screen.',
    liveBadge: '🎓 Class of 2024 · 36 Guests Celebrating',
    floatingNotification: {
      icon: '🎓',
      title: 'Graduation Wall Active',
      subtitle: 'Marcus just shared a graduation photo!',
    },
  },
  {
    id: 'get-together',
    category: 'Casual Get-Togethers',
    tabLabel: '🍻 Friends Get-Togethers',
    icon: Beer,
    image: '/images/showcase-friends-gathering.jpg',
    alt: 'Casual backyard evening dinner get-together with friends laughing over pizza and drinks under bistro lights',
    title: 'Backyard Gatherings, Dinners & Game Nights',
    subtitle:
      'Zero app downloads for your guests. Send one WhatsApp link and everyone RSVPs in 5 seconds.',
    liveBadge: '🍕 Friday Backyard Pizza Night · 14 Attending',
    floatingNotification: {
      icon: '🍻',
      title: 'Casual Potluck RSVP',
      subtitle: 'Elena & Lucas: “Bringing dessert & cider!”',
    },
  },
  {
    id: 'birthday',
    category: 'Birthdays & Kids',
    tabLabel: '🎂 Kid & Adult Birthdays',
    icon: Cake,
    image: '/images/showcase-birthday.jpg',
    alt: 'Joyful kid birthday party with colorful balloon arch, birthday cake with candles and happy family',
    title: 'Kid & Adult Birthday Milestones',
    subtitle:
      'Schedule alerts so parents never miss cake cutting, adult vs kid counts, and 1-click keepsake album export.',
    liveBadge: '🎂 Priya’s 5th Birthday · Cake Cutting @ 4:15 PM',
    floatingNotification: {
      icon: '🎈',
      title: 'Party Schedule Alert',
      subtitle: 'Cake cutting and magic show in 10 minutes',
    },
  },
  {
    id: 'rooftop',
    category: 'Rooftop & Nightlife',
    tabLabel: '🌆 Rooftop Parties',
    icon: PartyPopper,
    image: '/images/hero-rooftop-celebration.jpg',
    alt: 'Rooftop celebration with city skyline, glowing marquee sign, and live party screen',
    title: 'Rooftop Celebrations & Nightlife',
    subtitle:
      'Turn any venue TV into an interactive live photo wall with instant QR code scanning and animated confetti.',
    liveBadge: '🔴 Live Wallboard Active · 48 Photos Shared',
    floatingNotification: {
      icon: '🎉',
      title: 'Live Confetti Burst',
      subtitle: 'Table 4 just toasted the host!',
    },
  },
  {
    id: 'wedding',
    category: 'Weddings & Dream Pots',
    tabLabel: '💍 Weddings & Milestones',
    icon: Heart,
    image: '/images/showcase-cash-pot.jpg',
    alt: 'Golden hour wedding toasts and group gift celebration in vineyard setting',
    title: 'Weddings & Collective Dream Pots',
    subtitle:
      'Group gifting with 100% direct bank payout on a 2-day rolling schedule and zero host fees.',
    liveBadge: '💍 Honeymoon Adventure Fund · $2,450 / $2,500 (98% Funded)',
    floatingNotification: {
      icon: '🎁',
      title: 'Group Gift Received',
      subtitle: 'Maya & Alex sent $100 for your trip',
    },
  },
];

export function HeroCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Reliable Auto-Advancing Timer (Every 4.5 seconds)
  useEffect(() => {
    if (!isPlaying) return;

    timerRef.current = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CELEBRATION_SLIDES.length);
    }, 4500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, activeIndex]);

  const activeSlide = CELEBRATION_SLIDES[activeIndex] ?? CELEBRATION_SLIDES[0]!;

  const goToPrev = () => {
    setActiveIndex((prev) => (prev - 1 + CELEBRATION_SLIDES.length) % CELEBRATION_SLIDES.length);
  };

  const goToNext = () => {
    setActiveIndex((prev) => (prev + 1) % CELEBRATION_SLIDES.length);
  };

  return (
    <div className="relative mx-auto mt-6 w-full max-w-5xl">
      {/* Interactive Occasion Tabs Filter (Quick-Jump) */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        {CELEBRATION_SLIDES.map((slide, idx) => {
          const isSelected = activeIndex === idx;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => {
                setActiveIndex(idx);
              }}
              className={cn(
                'inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all duration-200',
                isSelected
                  ? 'scale-105 bg-[var(--accent)] text-[var(--accent-contrast)] shadow-md'
                  : 'border border-[var(--border-subtle)] bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]',
              )}
            >
              <span>{slide.tabLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Main Slideshow Stage with Ambient Glow */}
      <div className="group relative aspect-[16/9] w-full overflow-hidden rounded-3xl border border-white/20 bg-black/60 shadow-2xl backdrop-blur-xl dark:border-white/10">
        {/* Layered Cross-Fading Images */}
        {CELEBRATION_SLIDES.map((slide, idx) => {
          const isActive = activeIndex === idx;
          return (
            <div
              key={slide.id}
              className={cn(
                'absolute inset-0 size-full transition-opacity duration-1000 ease-in-out',
                isActive ? 'z-10 opacity-100' : 'pointer-events-none z-0 opacity-0',
              )}
            >
              <Image
                src={slide.image}
                alt={slide.alt}
                fill
                priority={idx === 0 || idx === 1}
                className="object-cover"
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
              {/* Dynamic Gradient Shading for Text Legibility */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/25" />
            </div>
          );
        })}

        {/* Top Tag Pill */}
        <div className="absolute top-4 left-4 z-20 sm:top-6 sm:left-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-black/60 px-3.5 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md">
            <Sparkles className="size-3 text-amber-400" />
            <span>{activeSlide.category}</span>
          </span>
        </div>

        {/* Top-Right Floating Notification Card */}
        <div className="absolute top-4 right-4 z-20 hidden sm:top-6 sm:right-6 sm:block">
          <div className="flex items-center gap-3 rounded-2xl border border-white/25 bg-black/65 px-4 py-2.5 text-left shadow-2xl backdrop-blur-md transition-all duration-300">
            <span className="text-xl">{activeSlide.floatingNotification.icon}</span>
            <div>
              <p className="text-xs leading-none font-bold text-white">
                {activeSlide.floatingNotification.title}
              </p>
              <p className="mt-1 text-[0.72rem] leading-none text-white/80">
                {activeSlide.floatingNotification.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Status Glass Bar */}
        <div className="absolute right-4 bottom-4 left-4 z-20 sm:right-6 sm:bottom-6 sm:left-6">
          <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-white/25 bg-black/60 p-4 text-xs text-white shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white shadow-sm">
                <activeSlide.icon className="size-4.5 text-amber-300" />
              </div>
              <div>
                <p className="text-sm leading-tight font-extrabold tracking-tight text-white sm:text-base">
                  {activeSlide.liveBadge}
                </p>
                <p className="mt-0.5 max-w-xl text-[0.75rem] leading-normal text-white/80">
                  {activeSlide.subtitle}
                </p>
              </div>
            </div>

            {/* Micro Live Equalizer & Play/Pause Controls */}
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              <div className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-3 py-1.5">
                <Volume2 className="size-3 text-emerald-400" />
                <span className="text-[0.7rem] font-bold text-white/95">Live Kiosk</span>
                <span className="ml-1 flex h-2.5 items-end gap-0.5">
                  <span className="h-full w-0.5 animate-pulse rounded-full bg-emerald-400"></span>
                  <span className="h-2/3 w-0.5 animate-pulse rounded-full bg-emerald-400 delay-75"></span>
                  <span className="h-4/5 w-0.5 animate-pulse rounded-full bg-emerald-400 delay-150"></span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsPlaying(!isPlaying)}
                aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
                className="flex size-7 items-center justify-center rounded-full border border-white/20 bg-white/15 text-white transition-colors hover:bg-white/30"
                title={isPlaying ? 'Pause auto-advance' : 'Resume auto-advance'}
              >
                {isPlaying ? <Pause className="size-3" /> : <Play className="ml-0.5 size-3" />}
              </button>
            </div>
          </div>
        </div>

        {/* Nav Arrows */}
        <button
          type="button"
          onClick={goToPrev}
          aria-label="Previous celebration"
          className="absolute top-1/2 left-3 z-30 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-black/80"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={goToNext}
          aria-label="Next celebration"
          className="absolute top-1/2 right-3 z-30 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md transition-all hover:scale-110 hover:bg-black/80"
        >
          <ChevronRight className="size-5" />
        </button>

        {/* Dynamic Countdown Progress Bar */}
        {isPlaying && (
          <div className="absolute inset-x-0 top-0 z-30 h-1 overflow-hidden bg-white/15">
            <div
              key={activeIndex}
              className="h-full animate-[progress_4.5s_linear_infinite] bg-gradient-to-r from-amber-400 via-pink-500 to-emerald-400"
              style={{
                animation: 'slideProgress 4.5s linear forwards',
              }}
            />
          </div>
        )}
      </div>

      {/* Slide Navigation Dots */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        {CELEBRATION_SLIDES.map((slide, idx) => (
          <button
            key={slide.id}
            type="button"
            onClick={() => setActiveIndex(idx)}
            aria-label={`Go to slide ${idx + 1}: ${slide.category}`}
            className={cn(
              'h-2 cursor-pointer rounded-full transition-all duration-300',
              activeIndex === idx
                ? 'w-7 bg-[var(--accent)]'
                : 'w-2 bg-[var(--border-strong)] hover:bg-[var(--text-muted)]',
            )}
          />
        ))}
      </div>
    </div>
  );
}

'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Mic, Pause, Play, Printer, Sparkles, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QrCode as QrCodeDisplay } from '@/components/ui/qr-code';

type DemoTab = 'tv' | 'voice' | 'cashpot' | 'qrsign';

export function InteractiveFeatureDemo() {
  const [activeTab, setActiveTab] = useState<DemoTab>('tv');
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [potAmount, setPotAmount] = useState(1850);
  const [showConfetti, setShowConfetti] = useState(false);

  function triggerConfetti() {
    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 2500);
  }

  function handleContribute(amount: number) {
    setPotAmount((prev) => prev + amount);
    triggerConfetti();
  }

  return (
    <div className="card overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-raised)] shadow-2xl">
      {/* Interactive Tabs Header */}
      <div className="flex flex-wrap border-b border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-2">
        <button
          type="button"
          onClick={() => setActiveTab('tv')}
          className={`flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
            activeTab === 'tv'
              ? 'bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Tv className="size-4" />
          Live TV Wallboard
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('voice')}
          className={`flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
            activeTab === 'voice'
              ? 'bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Mic className="size-4" />
          Audio Voice Guestbook
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('cashpot')}
          className={`flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
            activeTab === 'cashpot'
              ? 'bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Coins className="size-4" />
          Dream Cash Pot
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('qrsign')}
          className={`flex min-w-[140px] flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-bold transition-all sm:text-sm ${
            activeTab === 'qrsign'
              ? 'bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Printer className="size-4" />
          Printable Table QR
        </button>
      </div>

      {/* Demo Sandbox Body */}
      <div className="relative flex min-h-[380px] items-center justify-center p-6 sm:p-10">
        <AnimatePresence mode="wait">
          {/* TAB 1: LIVE TV WALLBOARD */}
          {activeTab === 'tv' && (
            <motion.div
              key="tv"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-2xl"
            >
              {/* TV Bezel Container */}
              <div className="relative overflow-hidden rounded-3xl border-4 border-zinc-900 bg-zinc-950 p-4 text-white shadow-2xl">
                {/* TV Header Bar */}
                <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex size-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">
                      Live Projector Feed
                    </span>
                  </div>
                  <span className="text-xs font-bold text-zinc-400">
                    Leo&apos;s 5th Birthday Party 🎉
                  </span>
                </div>

                {/* Main Showcase Post in TV */}
                <div className="grid items-center gap-4 sm:grid-cols-12">
                  <div className="relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-rose-600 p-4 shadow-lg sm:col-span-7">
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="relative z-10">
                      <span className="rounded-full bg-black/60 px-2.5 py-1 text-[0.65rem] font-bold text-white backdrop-blur-md">
                        🎂 Cake Cutting Moment
                      </span>
                      <p className="mt-1 text-xs font-medium text-white/90">
                        &ldquo;Happy 5th birthday sweet Leo! We love you so much!&rdquo;
                      </p>
                    </div>
                  </div>

                  {/* Corner QR code */}
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 text-center sm:col-span-5">
                    <div className="rounded-xl bg-white p-2 shadow-md">
                      <QrCodeDisplay value="https://marquee.party/event/demo" size={80} />
                    </div>
                    <p className="mt-2 text-[0.7rem] font-bold text-zinc-200">
                      📱 Scan with phone camera
                    </p>
                    <p className="text-[0.65rem] text-zinc-400">Snap & see photos pop up live!</p>
                    <Button
                      type="button"
                      variant="soft"
                      size="sm"
                      onClick={triggerConfetti}
                      className="mt-3 h-7 rounded-full px-3 text-[0.7rem]"
                    >
                      <Sparkles className="size-3" /> Test Confetti Burst
                    </Button>
                  </div>
                </div>

                {/* Floating Live Confetti Effect */}
                {showConfetti && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
                    <span className="animate-bounce text-5xl">🎉✨🎈🥳🎊</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 2: AUDIO VOICE GUESTBOOK */}
          {activeTab === 'voice' && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-lg"
            >
              <div className="space-y-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-6 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-tr from-rose-500 to-amber-500 text-lg font-bold text-white shadow-md">
                    👵
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--text-primary)]">Grandma Rose</h4>
                    <p className="text-xs text-[var(--text-muted)]">
                      Recorded an audio voice toast · 34s
                    </p>
                  </div>
                </div>

                {/* Interactive Waveform Player Card */}
                <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4 shadow-sm">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setIsPlayingAudio(!isPlayingAudio)}
                      className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] shadow-md transition-transform hover:scale-105 active:scale-95"
                    >
                      {isPlayingAudio ? (
                        <Pause className="size-5 fill-current" />
                      ) : (
                        <Play className="ml-0.5 size-5 fill-current" />
                      )}
                    </button>

                    {/* Animated Soundwave */}
                    <div className="flex h-8 flex-1 items-center gap-1">
                      {[
                        40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 65, 85, 35, 75, 55, 90, 40, 60,
                      ].map((height, idx) => (
                        <div
                          key={idx}
                          className={`flex-1 rounded-full transition-all duration-300 ${
                            isPlayingAudio
                              ? 'animate-pulse bg-[var(--accent)]'
                              : 'bg-[var(--border-subtle)]'
                          }`}
                          style={{
                            height: isPlayingAudio ? `${height}%` : '20%',
                            animationDelay: `${idx * 50}ms`,
                          }}
                        />
                      ))}
                    </div>

                    <span className="shrink-0 font-mono text-xs font-bold text-[var(--text-muted)]">
                      {isPlayingAudio ? '0:14' : '0:34'}
                    </span>
                  </div>
                </div>

                <p className="text-center text-xs text-[var(--text-secondary)] italic">
                  &ldquo;Leo darling, we are so proud of you turning 5 today! Keep shining
                  bright!&rdquo;
                </p>
              </div>
            </motion.div>
          )}

          {/* TAB 3: DREAM CASH POT */}
          {activeTab === 'cashpot' && (
            <motion.div
              key="cashpot"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-lg"
            >
              <div className="space-y-4 rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-[var(--surface-raised)] p-6 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--text-primary)]">
                        Lego & STEM Robotics Fund
                      </h4>
                      <p className="text-xs text-[var(--text-muted)]">
                        Collective Group Gifting Pot
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-700 dark:text-amber-300">
                    2.5% Take-Rate
                  </span>
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between text-xs">
                    <span className="text-base font-extrabold text-[var(--text-primary)]">
                      ${potAmount.toLocaleString()}
                    </span>
                    <span className="font-semibold text-[var(--text-muted)]">Goal: $2,500</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--surface-sunken)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all duration-500"
                      style={{ width: `${Math.min(100, (potAmount / 2500) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* 1-Click Contribution Chips */}
                <div>
                  <label className="text-[0.7rem] font-bold tracking-wider text-[var(--text-muted)] uppercase">
                    Simulate a Guest Gift:
                  </label>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[25, 50, 100].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => handleContribute(amount)}
                        className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] py-2.5 text-xs font-bold text-[var(--text-primary)] shadow-sm transition-all hover:scale-105 hover:border-amber-500 active:scale-95"
                      >
                        <span>+${amount}</span>
                        <span className="text-[0.6rem] font-normal text-[var(--text-muted)]">
                          Gift with 1-tap
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 4: PRINTABLE TABLE QR SIGN */}
          {activeTab === 'qrsign' && (
            <motion.div
              key="qrsign"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="w-full max-w-sm"
            >
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-[var(--accent)] bg-[var(--surface-raised)] p-6 text-center shadow-xl">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider text-[var(--accent)] uppercase">
                  <Sparkles className="size-3.5" />
                  <span>Table Tent Party Sign</span>
                </div>
                <h4 className="text-base font-black text-[var(--text-primary)]">
                  📸 Snap & Share Party Photos!
                </h4>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Scan with your phone camera to post directly to the TV Wallboard!
                </p>

                <div className="my-4 rounded-2xl bg-white p-3 shadow-md">
                  <QrCodeDisplay value="https://marquee.party/event/demo" size={130} />
                </div>

                <span className="text-[0.7rem] font-bold text-[var(--text-muted)]">
                  Formatted for 4x6&quot; & 5x7&quot; Table Frames
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play } from 'lucide-react';
import { cn, formatDuration } from '@/lib/utils';
import type { ResolvedMedia } from '@/types/domain';

interface AudioPlayerProps {
  media: ResolvedMedia;
  authorName: string;
}

export function AudioPlayer({ media, authorName }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(media.durationSeconds ?? 0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Static representative waveform amplitudes
  const waveformBars = [
    0.3, 0.5, 0.8, 0.4, 0.9, 0.6, 0.3, 0.7, 0.9, 0.5, 0.8, 0.4, 0.6, 0.9, 0.7, 0.3, 0.5, 0.8, 0.4,
    0.6, 0.3, 0.7, 0.5, 0.2,
  ];

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(Math.round(audio.currentTime));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }

  function handleSeek(index: number) {
    const audio = audioRef.current;
    if (!audio || duration === 0) return;
    const targetTime = (index / waveformBars.length) * duration;
    audio.currentTime = targetTime;
    setCurrentTime(Math.round(targetTime));
  }

  const progressFraction = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="mx-4 my-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-sunken)] p-4 shadow-sm">
      <audio ref={audioRef} src={media.url} preload="none" className="sr-only" />

      <div className="flex items-center gap-3">
        {/* Play / Pause Pill */}
        <button
          type="button"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause voice toast' : 'Play voice toast'}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full shadow-md transition-all duration-200',
            isPlaying
              ? 'scale-105 bg-[var(--accent)] text-[var(--accent-contrast)]'
              : 'bg-[var(--surface-raised)] text-[var(--text-primary)] hover:bg-[var(--accent-soft)]',
          )}
        >
          {isPlaying ? (
            <Pause className="size-5 fill-current" />
          ) : (
            <Play className="ml-0.5 size-5 fill-current" />
          )}
        </button>

        {/* Waveform Scrubber & Readout */}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 font-semibold text-[var(--accent)]">
              <Mic className="size-3" /> Voice Toast from {authorName}
            </span>
            <span className="font-mono text-[var(--text-muted)]">
              {formatDuration(currentTime)} / {formatDuration(duration)}
            </span>
          </div>

          {/* Interactive Waveform Bars */}
          <div
            className="flex h-8 w-full cursor-pointer items-center gap-1 py-1"
            role="slider"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
            aria-label="Audio scrubber"
          >
            {waveformBars.map((amp, idx) => {
              const barFraction = (idx + 1) / waveformBars.length;
              const isPlayed = barFraction <= progressFraction;
              return (
                <div
                  key={idx}
                  onClick={() => handleSeek(idx)}
                  className={cn(
                    'flex-1 rounded-full transition-all duration-150',
                    isPlayed
                      ? 'bg-[var(--accent)] opacity-95'
                      : 'bg-[var(--border-strong)] opacity-40 hover:opacity-70',
                  )}
                  style={{
                    height: `${Math.max(20, amp * 100)}%`,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Mic, Pause, Play, RotateCcw, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { cn, formatDuration } from '@/lib/utils';

interface AudioRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAudioRecorded: (file: File) => void;
}

const MAX_RECORDING_SECONDS = 120; // 2 minutes max for a voice toast

export function AudioRecorderModal({ isOpen, onClose, onAudioRecorded }: AudioRecorderModalProps) {
  const { notify } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [_previewProgress, setPreviewProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [waveAmplitudes, setWaveAmplitudes] = useState<number[]>([
    0.2, 0.4, 0.6, 0.3, 0.8, 0.5, 0.9, 0.4, 0.6, 0.3, 0.5, 0.2,
  ]);

  // Clean up resources on unmount or close
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  if (!isOpen) return null;

  async function startRecording() {
    try {
      setAudioBlob(null);
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }
      setRecordingSeconds(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Web Audio API for live frequency analysis
      const audioCtx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      )();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateWave = () => {
        analyser.getByteFrequencyData(dataArray);
        const sampled: number[] = [];
        const step = Math.floor(dataArray.length / 16);
        for (let i = 0; i < 16; i++) {
          const val = (dataArray[i * step] ?? 0) / 255;
          sampled.push(Math.max(0.15, val));
        }
        setWaveAmplitudes(sampled);
        animationFrameRef.current = requestAnimationFrame(updateWave);
      };
      updateWave();

      // Check supported MIME type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        audioCtx.close().catch(() => {});
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      recorder.start(100);
      setIsRecording(true);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            stopRecording();
            return MAX_RECORDING_SECONDS;
          }
          return prev + 1;
        });
      }, 1000);
    } catch {
      notify('Could not access your microphone. Please check browser permissions.', 'error');
    }
  }

  function stopRecording() {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
  }

  function handlePlayPreview() {
    if (!previewAudioRef.current && audioUrl) {
      const audio = new Audio(audioUrl);
      previewAudioRef.current = audio;
      audio.onended = () => {
        setIsPlayingPreview(false);
        setPreviewProgress(0);
      };
      audio.ontimeupdate = () => {
        if (audio.duration) {
          setPreviewProgress(audio.currentTime / audio.duration);
        }
      };
    }

    if (previewAudioRef.current) {
      if (isPlayingPreview) {
        previewAudioRef.current.pause();
        setIsPlayingPreview(false);
      } else {
        previewAudioRef.current.play().catch(() => {});
        setIsPlayingPreview(true);
      }
    }
  }

  function handleAttach() {
    if (!audioBlob) return;
    const isMp4 = audioBlob.type.includes('mp4');
    const extension = isMp4 ? 'm4a' : 'webm';
    const mimeType = isMp4 ? 'audio/mp4' : 'audio/webm';
    const file = new File([audioBlob], `voice_toast_${Date.now()}.${extension}`, {
      type: mimeType,
    });
    onAudioRecorded(file);
    onClose();
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md duration-200">
      <div className="card w-full max-w-md overflow-hidden p-6 shadow-[var(--shadow-lift)] sm:p-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Mic className="size-4" />
            </span>
            <h3 className="font-bold text-[var(--text-primary)]">Record Voice Toast</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close recorder"
            className="rounded-full p-1.5 text-[var(--text-muted)] hover:bg-[var(--surface-sunken)] hover:text-[var(--text-primary)]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Center Stage / Visualizer */}
        <div className="my-8 flex flex-col items-center justify-center">
          {/* Animated Waveform Visualizer */}
          <div className="flex h-24 w-full items-center justify-center gap-1.5 rounded-2xl bg-[var(--surface-sunken)] px-6 py-4">
            {waveAmplitudes.map((amp, idx) => (
              <div
                key={idx}
                className={cn(
                  'w-2 rounded-full transition-all duration-75',
                  isRecording
                    ? 'bg-[var(--accent)]'
                    : audioBlob
                      ? 'bg-[var(--text-secondary)]'
                      : 'bg-[var(--border-subtle)]',
                )}
                style={{
                  height: `${Math.min(100, Math.max(15, amp * 90))}%`,
                  opacity: isRecording ? 0.9 : 0.4,
                }}
              />
            ))}
          </div>

          {/* Time Readout */}
          <div className="mt-4 flex items-center gap-2 font-mono text-sm font-semibold text-[var(--text-primary)]">
            {isRecording && <span className="size-2.5 animate-pulse rounded-full bg-rose-500" />}
            <span>{formatDuration(recordingSeconds)}</span>
            <span className="text-xs text-[var(--text-muted)]">
              / {formatDuration(MAX_RECORDING_SECONDS)}
            </span>
          </div>

          <p className="mt-2 text-center text-xs text-[var(--text-muted)]">
            {isRecording
              ? 'Speaking... tap stop when you are done.'
              : audioBlob
                ? 'Review your recording before attaching to the wall.'
                : 'Tap record to leave a voice message or audio toast.'}
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col gap-3">
          {!audioBlob && !isRecording && (
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full justify-center gap-2"
              onClick={startRecording}
            >
              <Mic className="size-4" />
              Start Recording
            </Button>
          )}

          {isRecording && (
            <button
              type="button"
              className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-[var(--radius-pill)] bg-rose-500 text-base font-semibold text-white shadow-md transition-all hover:bg-rose-600 active:scale-[0.98]"
              onClick={stopRecording}
            >
              <Square className="size-4 fill-white" />
              Stop Recording
            </button>
          )}

          {audioBlob && !isRecording && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="soft"
                  className="flex-1 justify-center gap-2"
                  onClick={handlePlayPreview}
                >
                  {isPlayingPreview ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {isPlayingPreview ? 'Pause' : 'Listen Back'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  className="justify-center gap-1.5 text-xs text-[var(--text-muted)]"
                  onClick={startRecording}
                >
                  <RotateCcw className="size-3.5" />
                  Re-record
                </Button>
              </div>

              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full justify-center gap-2"
                onClick={handleAttach}
              >
                <Check className="size-4" />
                Attach to Wall Post
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

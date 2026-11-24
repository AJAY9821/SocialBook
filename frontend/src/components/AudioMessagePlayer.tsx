import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Loader2, Pause, Play, Volume2 } from 'lucide-react';

interface AudioMessagePlayerProps {
  audioUrl: string;
  duration?: number; // total duration in seconds
  waveform?: number[]; // optional array of numbers (10..100)
  isMe: boolean;
}

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function AudioMessagePlayer({
  audioUrl,
  duration = 0,
  waveform,
  isMe,
}: AudioMessagePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);

  // Fallback waveform bars if none provided
  const bars =
    waveform && waveform.length >= 10
      ? waveform
      : [30, 45, 60, 85, 70, 40, 55, 90, 65, 40, 30, 50, 75, 60, 35, 25, 45, 65, 40, 20];

  useEffect(() => {
    if (duration > 0) {
      setTotalDuration(duration);
    }
  }, [duration]);

  // Handle Play / Pause
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setIsLoading(true);
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (err) {
        console.error('Audio playback error:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Toggle playback speed (1x -> 1.5x -> 2x -> 1x)
  const toggleSpeed = (e: MouseEvent) => {
    e.stopPropagation();
    const nextSpeed: 1 | 1.5 | 2 =
      playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  // Click on waveform to seek
  const handleWaveformClick = (e: MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressRatio = Math.max(0, Math.min(1, clickX / rect.width));

    const targetTime = progressRatio * (totalDuration || audio.duration || 1);
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className="flex flex-col gap-1.5 py-1 select-none min-w-[220px] max-w-[280px] sm:max-w-[320px]">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        preload="metadata"
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (audioRef.current && (!totalDuration || totalDuration === 0)) {
            setTotalDuration(audioRef.current.duration);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onError={() => {
          setIsPlaying(false);
          setIsLoading(false);
        }}
      />

      {/* Main Player Row */}
      <div className="flex items-center gap-3">
        {/* Play / Pause Circular Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition transform active:scale-95 cursor-pointer shadow-sm ${
            isMe
              ? 'bg-white text-blue-600 hover:bg-white/90'
              : 'bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500'
          }`}
          title={isPlaying ? 'Pause voice note' : 'Play voice note'}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current translate-x-0.5" />
          )}
        </button>

        {/* Waveform Visualization Bars */}
        <div
          onClick={handleWaveformClick}
          className="relative flex-1 flex items-center gap-[2.5px] h-8 cursor-pointer group py-1"
          title="Click to seek"
        >
          {bars.map((heightPercent, idx) => {
            const barProgress = (idx / bars.length) * 100;
            const isPlayed = barProgress <= progressPercent;

            return (
              <div
                key={idx}
                className="flex-1 flex items-center justify-center h-full"
              >
                <div
                  className={`w-full rounded-full transition-all duration-100 ${
                    isPlayed
                      ? isMe
                        ? 'bg-white'
                        : 'bg-blue-600 dark:bg-blue-400'
                      : isMe
                        ? 'bg-blue-300/40 group-hover:bg-blue-200/60'
                        : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400'
                  }`}
                  style={{ height: `${Math.max(15, heightPercent)}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Playback Speed Switcher (1x, 1.5x, 2x) */}
        <button
          type="button"
          onClick={toggleSpeed}
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight transition cursor-pointer shadow-2xs ${
            isMe
              ? 'bg-blue-700/60 text-white hover:bg-blue-700/80 border border-white/20'
              : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600'
          }`}
          title="Change playback speed"
        >
          {playbackSpeed}x
        </button>
      </div>

      {/* Time & Audio Badge Row */}
      <div
        className={`flex items-center justify-between text-[11px] px-1 font-medium ${
          isMe ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <div className="flex items-center gap-1">
          <Volume2 className="h-3 w-3 opacity-75" />
          <span>
            {formatAudioTime(currentTime)} / {formatAudioTime(totalDuration)}
          </span>
        </div>
        <span className="text-[10px] opacity-75 font-semibold">Voice Note</span>
      </div>
    </div>
  );
}

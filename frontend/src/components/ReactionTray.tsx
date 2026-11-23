import { useEffect, useRef } from 'react';
import type { ReactionType } from '../types';

export interface ReactionConfig {
  type: ReactionType;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  badgeBg: string;
}

export const REACTIONS_CONFIG: Record<ReactionType, ReactionConfig> = {
  like: {
    type: 'like',
    label: 'Like',
    emoji: '👍',
    color: 'text-blue-600',
    bg: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    badgeBg: 'bg-blue-600',
  },
  love: {
    type: 'love',
    label: 'Love',
    emoji: '❤️',
    color: 'text-rose-600',
    bg: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
    badgeBg: 'bg-rose-500',
  },
  haha: {
    type: 'haha',
    label: 'Haha',
    emoji: '😆',
    color: 'text-amber-500',
    bg: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    badgeBg: 'bg-amber-500',
  },
  wow: {
    type: 'wow',
    label: 'Wow',
    emoji: '😮',
    color: 'text-amber-500',
    bg: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
    badgeBg: 'bg-amber-500',
  },
  sad: {
    type: 'sad',
    label: 'Sad',
    emoji: '😢',
    color: 'text-blue-500',
    bg: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
    badgeBg: 'bg-blue-400',
  },
  angry: {
    type: 'angry',
    label: 'Angry',
    emoji: '😡',
    color: 'text-orange-600',
    bg: 'bg-orange-50 text-orange-600 hover:bg-orange-100',
    badgeBg: 'bg-orange-500',
  },
};

export const REACTIONS_LIST: ReactionConfig[] = [
  REACTIONS_CONFIG.like,
  REACTIONS_CONFIG.love,
  REACTIONS_CONFIG.haha,
  REACTIONS_CONFIG.wow,
  REACTIONS_CONFIG.sad,
  REACTIONS_CONFIG.angry,
];

interface ReactionTrayProps {
  isOpen: boolean;
  activeReaction?: ReactionType | null;
  onSelect: (reaction: ReactionType) => void;
  onClose: () => void;
}

export function ReactionTray({
  isOpen,
  activeReaction,
  onSelect,
  onClose,
}: ReactionTrayProps) {
  const trayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={trayRef}
      className="absolute -top-12 left-0 sm:left-1 z-40 flex items-center gap-1 sm:gap-1.5 rounded-full border border-slate-200/90 bg-white/95 px-2.5 py-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
      onMouseLeave={onClose}
    >
      {REACTIONS_LIST.map((item) => {
        const isCurrent = activeReaction === item.type;
        return (
          <button
            key={item.type}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(item.type);
            }}
            className={`group/emoji relative flex h-9 w-9 items-center justify-center rounded-full text-2xl transition-all duration-150 hover:scale-135 hover:-translate-y-1.5 active:scale-110 cursor-pointer ${
              isCurrent ? 'bg-slate-100 ring-2 ring-blue-500/40' : ''
            }`}
            title={item.label}
          >
            <span className="select-none leading-none">{item.emoji}</span>
            {/* Tooltip on hover */}
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/90 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover/emoji:opacity-100 whitespace-nowrap">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

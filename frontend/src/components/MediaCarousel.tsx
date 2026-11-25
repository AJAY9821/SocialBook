import { useState, useRef, useMemo, TouchEvent, MouseEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MediaItem } from '../types';

export interface MediaCarouselProps {
  media?: MediaItem[];
  imageUrl?: string;
  videoUrl?: string;
  videoDuration?: number;
  compact?: boolean;
  altText?: string;
}

export function MediaCarousel({
  media,
  imageUrl,
  videoUrl,
  videoDuration = 0,
  compact = false,
  altText = 'Post attachment',
}: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const videoRefs = useRef<{ [key: number]: HTMLVideoElement | null }>({});

  const resolvedMedia: MediaItem[] = useMemo(() => {
    if (media && media.length > 0) return media;
    const items: MediaItem[] = [];
    if (imageUrl) items.push({ type: 'image', url: imageUrl });
    if (videoUrl) items.push({ type: 'video', url: videoUrl, duration: videoDuration });
    return items;
  }, [media, imageUrl, videoUrl, videoDuration]);

  if (!resolvedMedia.length) {
    return null;
  }

  const goToSlide = (newIndex: number) => {
    if (newIndex === currentIndex) return;
    // Auto-pause the video on current slide when navigating away
    const currentVid = videoRefs.current[currentIndex];
    if (currentVid) {
      currentVid.pause();
    }
    setCurrentIndex(newIndex);
  };

  const handlePrev = (e?: MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex > 0) {
      goToSlide(currentIndex - 1);
    }
  };

  const handleNext = (e?: MouseEvent) => {
    e?.stopPropagation();
    if (currentIndex < resolvedMedia.length - 1) {
      goToSlide(currentIndex + 1);
    }
  };

  const handleTouchStart = (e: TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null || touchEndX === null) return;
    const distance = touchStartX - touchEndX;
    const isLeftSwipe = distance > 45;
    const isRightSwipe = distance < -45;

    if (isLeftSwipe && currentIndex < resolvedMedia.length - 1) {
      goToSlide(currentIndex + 1);
    } else if (isRightSwipe && currentIndex > 0) {
      goToSlide(currentIndex - 1);
    }

    setTouchStartX(null);
    setTouchEndX(null);
  };

  // Case 1: Single item - clean direct view
  if (resolvedMedia.length === 1) {
    const item = resolvedMedia[0];
    if (item.type === 'video') {
      return (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-black">
          <video
            src={item.url}
            controls
            playsInline
            preload="metadata"
            className={`${compact ? 'max-h-72' : 'max-h-[500px]'} w-full object-contain`}
          />
        </div>
      );
    }

    return (
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900/5 dark:bg-slate-900/40">
        <img
          src={item.url}
          alt={altText}
          className={`${compact ? 'max-h-72' : 'max-h-[500px]'} w-full object-cover`}
        />
      </div>
    );
  }

  // Case 2: Multi-item interactive Carousel
  return (
    <div
      className={`relative mt-3 select-none overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-black ${
        compact ? 'h-72' : 'h-80 sm:h-96 md:h-[460px]'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sliding Track */}
      <div
        className="flex h-full w-full transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {resolvedMedia.map((item, index) => (
          <div
            key={index}
            className="flex h-full w-full shrink-0 items-center justify-center bg-black overflow-hidden"
          >
            {item.type === 'video' ? (
              <video
                ref={(el) => {
                  videoRefs.current[index] = el;
                }}
                src={item.url}
                controls
                playsInline
                preload="metadata"
                className="max-h-full w-full object-contain"
              />
            ) : (
              <img
                src={item.url}
                alt={`${altText} ${index + 1}`}
                className="max-h-full w-full object-contain"
              />
            )}
          </div>
        ))}
      </div>

      {/* Top-Right Item Counter Badge */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-md shadow-sm">
        <span>{currentIndex + 1}</span>
        <span className="opacity-60">/</span>
        <span>{resolvedMedia.length}</span>
      </div>

      {/* Navigation Buttons: Previous */}
      {currentIndex > 0 && (
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70 text-white shadow-md backdrop-blur-sm transition hover:bg-slate-900 hover:scale-105 active:scale-95 cursor-pointer"
          aria-label="Previous media slide"
          title="Previous"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Navigation Buttons: Next */}
      {currentIndex < resolvedMedia.length - 1 && (
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70 text-white shadow-md backdrop-blur-sm transition hover:bg-slate-900 hover:scale-105 active:scale-95 cursor-pointer"
          aria-label="Next media slide"
          title="Next"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Bottom Pagination Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-slate-950/60 px-2.5 py-1 backdrop-blur-md">
        {resolvedMedia.map((_, idx) => (
          <button
            key={idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              goToSlide(idx);
            }}
            className={`rounded-full transition-all duration-200 cursor-pointer ${
              idx === currentIndex
                ? 'h-2 w-5 bg-white'
                : 'h-2 w-2 bg-white/40 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

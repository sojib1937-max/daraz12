// Reusable sliding carousel — shows a few items per view, slides through the
// rest (arrows on desktop, swipe on mobile, auto-advance, dots).
// "Collection slide hobe, sob ek jaygay na" — items slide instead of all
// being crammed in one place.
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface SlideCarouselProps {
  children: React.ReactNode;
  /** Auto-advance interval in ms (0 = off) */
  autoMs?: number;
  className?: string;
  /** Show dots indicator */
  showDots?: boolean;
}

export function SlideCarousel({ children, autoMs = 4000, className = '', showDots = true }: SlideCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const paused = useRef(false);

  const update = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    setPages(Math.max(1, Math.ceil(el.scrollWidth / Math.max(1, el.clientWidth))));
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => update();
    el.addEventListener('scroll', onScroll, { passive: true });
    update();
    window.addEventListener('resize', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const go = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
  };

  // Auto-advance (loops back to start at the end)
  useEffect(() => {
    if (!autoMs) return;
    const id = setInterval(() => {
      if (paused.current) return;
      const el = trackRef.current;
      if (!el) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 8) {
        el.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
      }
    }, autoMs);
    return () => clearInterval(id);
  }, [autoMs]);

  return (
    <div
      className="relative"
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <div
        ref={trackRef}
        className={`flex gap-2.5 md:gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth ${className}`}
      >
        {children}
      </div>

      {/* Arrows (desktop) */}
      {canPrev && (
        <button
          onClick={() => go(-1)}
          className="hidden md:flex absolute -start-3 top-[38%] z-10 h-9 w-9 items-center justify-center rounded-full bg-white shadow-lift border border-ink/8 text-ink/70 hover:text-brand-500 hover:scale-105 transition-all"
          aria-label="Previous"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {canNext && (
        <button
          onClick={() => go(1)}
          className="hidden md:flex absolute -end-3 top-[38%] z-10 h-9 w-9 items-center justify-center rounded-full bg-white shadow-lift border border-ink/8 text-ink/70 hover:text-brand-500 hover:scale-105 transition-all"
          aria-label="Next"
        >
          <ChevronRight size={18} />
        </button>
      )}

      {/* Dots */}
      {showDots && pages > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {Array.from({ length: pages }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === page ? 'w-4 bg-brand-500' : 'w-1.5 bg-ink/15'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Scroll-animation helpers for the landing page.
 *
 * Progress is written to a CSS variable (--p, 0..1) on the element instead of
 * React state, so scrolling never re-renders components - the CSS does the
 * animating. Pass onChange when a component genuinely needs the number.
 */
import { useEffect, useRef, useState } from 'react';

const clamp01 = (v) => Math.min(1, Math.max(0, v));

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Modes:
 *  - 'leave': 0 when the element's top is at the top of the screen, 1 once it
 *    has scrolled fully out the top (hero fade-out).
 *  - 'pin':   0..1 across a tall section whose inner content is sticky
 *    (scrollytelling / horizontal gallery).
 *  - 'through': 0 as the element enters the bottom of the screen, 1 when it
 *    reaches the middle (text reveal).
 */
export function useScrollProgress(ref, { mode = 'pin', onChange } = {}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      let p;
      if (mode === 'leave') p = -rect.top / rect.height;
      else if (mode === 'through') p = (vh - rect.top) / (vh * 0.6 + rect.height * 0.5);
      else p = -rect.top / Math.max(1, rect.height - vh);
      p = clamp01(p);
      el.style.setProperty('--p', p.toFixed(4));
      onChangeRef.current?.(p);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref, mode]);
}

/**
 * Adds the class "in" once the element scrolls into view (fade/slide-up reveals).
 */
export function useReveal(options = { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!('IntersectionObserver' in window)) {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShown(true);
        io.disconnect();
      }
    }, options);
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, shown];
}

/**
 * Which section id is currently in the middle of the screen (for nav highlighting).
 */
export function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(e.target.id);
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return active;
}

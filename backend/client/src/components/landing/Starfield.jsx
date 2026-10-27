import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/scroll.js';
import { isLowPower, onLowPower } from '../../lib/perf.js';

const STAR_COLORS = ['#ffffff', '#ffffff', '#ffffff', '#9fcaff', '#a8f0e1', '#c9b8ff'];

/**
 * Fixed, full-screen twinkling starfield. Three depth layers drift at
 * different speeds as you scroll (parallax).
 */
export default function Starfield() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const still = prefersReducedMotion();
    let stars = [];
    let width = 0;
    let height = 0;
    let frame = 0;

    // One pre-drawn soft dot per colour; stamping it with drawImage is much
    // cheaper than building an arc path for every star on every frame.
    const SPRITE = 32;
    const sprites = Object.fromEntries(
      [...new Set(STAR_COLORS)].map((color) => {
        const c = document.createElement('canvas');
        c.width = c.height = SPRITE;
        const g = c.getContext('2d');
        g.fillStyle = color;
        g.beginPath();
        g.arc(SPRITE / 2, SPRITE / 2, SPRITE / 2 - 1, 0, Math.PI * 2);
        g.fill();
        return [color, c];
      })
    );

    // Low-power devices draw at 1x resolution with half as many stars.
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, isLowPower() ? 1 : 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const build = () => {
      size();
      const count = Math.round((width * height) / (isLowPower() ? 10000 : 5000));
      stars = Array.from({ length: count }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.3 + depth * 1.1,
          depth, // 0 = far/slow, 1 = near/fast
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 1.5,
          sprite: sprites[STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)]],
        };
      });
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, width, height);
      const scroll = window.scrollY;
      for (const s of stars) {
        const y = (((s.y - scroll * (0.03 + s.depth * 0.12)) % height) + height) % height;
        const twinkle = still ? 0.8 : 0.55 + 0.45 * Math.sin(time * 0.001 * s.speed + s.phase);
        ctx.globalAlpha = twinkle * (0.35 + s.depth * 0.65);
        ctx.drawImage(s.sprite, s.x - s.r, y - s.r, s.r * 2, s.r * 2);
      }
      ctx.globalAlpha = 1;
    };

    const loop = (time) => {
      if (!document.hidden) draw(time);
      frame = requestAnimationFrame(loop);
    };

    const onResize = () => {
      build();
      if (still) draw(0);
    };
    const onScroll = () => still && draw(0);

    build();
    if (still) draw(0);
    else frame = requestAnimationFrame(loop);
    // Switching mid-visit: keep every other star so the sky doesn't reshuffle.
    const offLowPower = onLowPower(() => {
      size();
      stars = stars.filter((_, i) => i % 2 === 0);
      if (still) draw(0);
    });
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      offLowPower();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />;
}

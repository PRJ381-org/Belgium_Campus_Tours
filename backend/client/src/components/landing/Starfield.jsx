import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/scroll.js';

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

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((width * height) / 5000);
      stars = Array.from({ length: count }, () => {
        const depth = Math.random();
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r: 0.3 + depth * 1.1,
          depth, // 0 = far/slow, 1 = near/fast
          phase: Math.random() * Math.PI * 2,
          speed: 0.5 + Math.random() * 1.5,
          color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
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
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
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
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return <canvas ref={canvasRef} className="starfield" aria-hidden="true" />;
}

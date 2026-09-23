import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../../lib/scroll.js';

const DOTS = 12;

/**
 * Comet-trail cursor: a short tail of fading blue-to-purple dots that follows
 * the mouse. The real cursor stays visible. Only on devices with a mouse, and
 * off for reduced motion.
 */
export default function CursorTrail() {
  const layerRef = useRef(null);

  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!finePointer || prefersReducedMotion()) return undefined;

    const layer = layerRef.current;
    const dots = [...layer.children].map((el) => ({ el, x: -100, y: -100 }));
    const target = { x: -100, y: -100 };
    let frame = 0;

    const onMove = (e) => {
      if (target.x === -100) {
        // First move: start the whole tail at the cursor instead of flying in from the corner.
        dots.forEach((d) => {
          d.x = e.clientX;
          d.y = e.clientY;
        });
      }
      target.x = e.clientX;
      target.y = e.clientY;
      layer.classList.add('on');
    };
    const onLeave = () => layer.classList.remove('on');

    const loop = () => {
      // Each dot chases the one in front of it, which makes the tail curve.
      let x = target.x;
      let y = target.y;
      for (const d of dots) {
        d.x += (x - d.x) * 0.45;
        d.y += (y - d.y) * 0.45;
        d.el.style.transform = `translate3d(${d.x}px, ${d.y}px, 0)`;
        x = d.x;
        y = d.y;
      }
      frame = requestAnimationFrame(loop);
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return (
    <div ref={layerRef} className="cursor-trail" aria-hidden="true">
      {Array.from({ length: DOTS }, (_, i) => (
        <span key={i} style={{ '--i': i, '--n': DOTS }} />
      ))}
    </div>
  );
}

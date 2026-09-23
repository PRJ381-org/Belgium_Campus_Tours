import { useEffect, useRef, useState } from 'react';
import Reveal from './Reveal.jsx';
import { useReveal, useScrollProgress, prefersReducedMotion } from '../../lib/scroll.js';

const STATEMENT =
  'Choosing where to study is a big decision. Virtual Campus Open Day lets you walk the halls, peek into the labs and get a real feel for Belgium Campus — from anywhere in the world, on any device.';

const STATS = [
  { value: 3, suffix: '', label: 'Platforms supported' },
  { value: 360, suffix: '°', label: 'Free exploration' },
  { value: 11, suffix: '', label: 'Student developers' },
  { value: 24, suffix: '/7', label: 'Campus always open' },
];

function Counter({ value, suffix }) {
  const [ref, shown] = useReveal();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!shown) return undefined;
    if (prefersReducedMotion()) {
      setN(value);
      return undefined;
    }
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 1400);
      setN(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [shown, value]);

  return (
    <span ref={ref} className="stat-number">
      {n}
      {suffix}
    </span>
  );
}

/**
 * Big statement whose words light up one by one as you scroll, then stats.
 */
export default function About() {
  const textRef = useRef(null);
  useScrollProgress(textRef, { mode: 'through' });
  const words = STATEMENT.split(' ');

  return (
    <section id="about" className="section about">
      <Reveal className="section-label">
        <span>01</span> About the tour
      </Reveal>

      <p ref={textRef} className="scroll-text" style={{ '--n': words.length }}>
        {words.map((w, i) => (
          <span key={i} style={{ '--i': i }}>
            {w}{' '}
          </span>
        ))}
      </p>

      <div className="stats-row">
        {STATS.map((s, i) => (
          <Reveal key={s.label} className="stat" delay={i * 100}>
            <Counter value={s.value} suffix={s.suffix} />
            <span className="stat-label">{s.label}</span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

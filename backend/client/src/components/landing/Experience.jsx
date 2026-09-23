import { useRef, useState } from 'react';
import Reveal from './Reveal.jsx';
import { useScrollProgress } from '../../lib/scroll.js';

const STEPS = [
  {
    title: 'True-to-scale campus',
    text: 'High-fidelity architectural scans recreate every hall, lab and courtyard — processed to run smoothly on every device.',
    image: 'assets/image3.png',
    color: '#4099ff',
  },
  {
    title: 'Play your way',
    text: 'Teleport and hand-track on a standalone VR headset, or explore with WASD and mouse, or a touch joystick on your phone. No VR hardware required.',
    image: 'assets/image5.png',
    color: '#2ed8b6',
  },
  {
    title: 'Interactive hotspots',
    text: 'Walk up to points of interest to discover courses, facilities and student life, and meet guide characters along the way.',
    image: 'assets/image7.png',
    color: '#ffb64d',
  },
  {
    title: 'Optimised for mobile',
    text: 'Forward shading and pre-baked lighting keep framerates high on mobile VR chips and everyday smartphones.',
    image: 'assets/image9.png',
    color: '#7759de',
  },
];

/**
 * Scrollytelling: the section pins while you scroll through the steps; the
 * screenshot crossfades and the progress line fills. On small screens the
 * steps simply stack.
 */
export default function Experience() {
  const ref = useRef(null);
  const [active, setActive] = useState(0);
  useScrollProgress(ref, {
    mode: 'pin',
    onChange: (p) => setActive(Math.min(STEPS.length - 1, Math.floor(p * STEPS.length))),
  });

  return (
    <section id="experience" className="experience" ref={ref} style={{ '--steps': STEPS.length }}>
      <div className="experience-sticky">
        <div className="experience-copy">
          <Reveal className="section-label">
            <span>02</span> The experience
          </Reveal>
          <h2>
            A campus tour that <span className="text-gradient">moves with you</span>
          </h2>

          <ol className="steps">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`step${i === active ? ' active' : ''}${i < active ? ' done' : ''}`} style={{ '--c': s.color }}>
                <span className="step-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="experience-progress">
            <span />
          </div>
        </div>

        <div className="experience-visual">
          {STEPS.map((s, i) => (
            <figure key={s.image} className={`shot${i === active ? ' active' : ''}`} style={{ '--c': s.color }}>
              <img src={s.image} alt={s.title} loading="lazy" />
              <figcaption>
                <span className="shot-dot" />
                {s.title}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

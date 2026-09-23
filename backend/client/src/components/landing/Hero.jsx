import { useRef } from 'react';
import Icon from '../Icon.jsx';
import Orb from './Orb.jsx';
import { useScrollProgress } from '../../lib/scroll.js';

/**
 * Framed hero: headline, CTAs, 3D orb and floating glass stat cards.
 * As it scrolls away the frame shrinks and fades and the orb spins faster.
 */
export default function Hero() {
  const sectionRef = useRef(null);
  const progressRef = useRef(0);
  useScrollProgress(sectionRef, {
    mode: 'leave',
    onChange: (p) => {
      progressRef.current = p;
    },
  });

  return (
    <section id="top" className="hero" ref={sectionRef}>
      <div className="hero-frame">
        <div className="hero-glow" />
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="eyebrow-dot" /> Belgium Campus · Virtual Open Day
          </span>
          <h1>
            Explore the Campus
            <br />
            <span className="text-gradient">Before You Arrive</span>
          </h1>
          <p>
            An immersive, cross-platform 3D tour that brings Belgium Campus to you — in VR, on your PC or on your phone.
          </p>
          <div className="hero-ctas">
            <a href="#download" className="pill pill-white pill-lg">
              Download the Tour
              <Icon name="download" size={16} />
            </a>
            <a href="#experience" className="pill pill-ghost pill-lg">
              See how it works
            </a>
          </div>
        </div>

        <Orb scrollRef={progressRef} />

        <div className="glass-card float-card card-left">
          <div className="glass-card-top">
            <span>Platforms</span>
            <span className="glass-arrow"><Icon name="chevronRight" size={12} /></span>
          </div>
          <strong>VR · PC · Mobile</strong>
          <div className="platform-dots">
            <span style={{ background: '#4099ff' }} />
            <span style={{ background: '#2ed8b6' }} />
            <span style={{ background: '#7759de' }} />
          </div>
        </div>

        <div className="glass-card float-card card-right">
          <div className="glass-card-top">
            <span>Campus scale</span>
            <span className="glass-arrow"><Icon name="chevronRight" size={12} /></span>
          </div>
          <strong className="big">1 : 1</strong>
          <div className="glass-bar"><span /></div>
        </div>

        <a href="#about" className="scroll-cue" aria-label="Scroll to About">
          <span />
        </a>
      </div>
    </section>
  );
}

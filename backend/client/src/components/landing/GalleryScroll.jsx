import { useEffect, useRef } from 'react';
import Reveal from './Reveal.jsx';
import { useScrollProgress } from '../../lib/scroll.js';

const IMAGES = Array.from({ length: 12 }, (_, i) => ({
  src: `assets/image${i === 0 ? '' : i + 1}.png`,
  alt: `Virtual campus screenshot ${i + 1}`,
}));

/**
 * Horizontal gallery: while the section is pinned, scrolling down slides the
 * screenshots sideways. The section's height is set from the track width so
 * the sideways distance matches the vertical scroll. Phones get a normal
 * swipeable row instead (see CSS).
 */
export default function GalleryScroll() {
  const sectionRef = useRef(null);
  const trackRef = useRef(null);
  useScrollProgress(sectionRef, { mode: 'pin' });

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    const measure = () => {
      const distance = Math.max(0, track.scrollWidth - window.innerWidth);
      section.style.setProperty('--dist', `${distance}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <section id="gallery" className="gallery-scroll" ref={sectionRef}>
      <div className="gallery-sticky">
        <div className="gallery-head">
          <Reveal className="section-label">
            <span>03</span> Gallery
          </Reveal>
          <Reveal as="h2" delay={80}>
            Straight from the <span className="text-gradient">build</span>
          </Reveal>
        </div>
        <div className="gallery-track" ref={trackRef}>
          {IMAGES.map((img, i) => (
            <figure key={img.src} className="gallery-card">
              <img src={img.src} alt={img.alt} loading="lazy" />
              <span className="gallery-index">{String(i + 1).padStart(2, '0')}</span>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

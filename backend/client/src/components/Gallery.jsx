import { useEffect, useState } from 'react';

const AUTOPLAY_MS = 5000;

/**
 * Photo carousel. Auto-advances every 5s; using the arrows restarts the timer.
 */
export default function Gallery({ images }) {
  const [current, setCurrent] = useState(0);
  // Bumped by the arrows so the autoplay effect re-runs and the 5s restarts.
  const [autoplayKey, setAutoplayKey] = useState(0);

  const goTo = (index) => setCurrent((index + images.length) % images.length);

  useEffect(() => {
    if (images.length === 0) return undefined;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % images.length), AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [images.length, autoplayKey]);

  const step = (delta) => {
    goTo(current + delta);
    setAutoplayKey((k) => k + 1);
  };

  return (
    <div className="gallery">
      <div className="gallery-viewport">
        {images.map((img, i) => (
          <div key={img.src} className={`gallery-slide${i === current ? ' active' : ''}`}>
            <img src={img.src} alt={img.alt} loading={i === 0 ? 'eager' : 'lazy'} />
          </div>
        ))}
      </div>
      <div className="gallery-controls">
        <button className="gallery-arrow" aria-label="Previous photo" onClick={() => step(-1)}>
          ‹
        </button>
        <div className="gallery-dots">
          {images.map((img, i) => (
            <button
              key={img.src}
              className={`gallery-dot${i === current ? ' active' : ''}`}
              aria-label={`Go to photo ${i + 1}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <button className="gallery-arrow" aria-label="Next photo" onClick={() => step(1)}>
          ›
        </button>
      </div>
    </div>
  );
}

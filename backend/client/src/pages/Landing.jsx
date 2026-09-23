import { useState } from 'react';
import Gallery from '../components/Gallery.jsx';

const GALLERY_IMAGES = Array.from({ length: 12 }, (_, i) => ({
  src: `assets/image${i === 0 ? '' : i + 1}.png`,
  alt: `Development progress screenshot ${i + 1}`,
}));

const FEATURES = [
  {
    title: 'True-to-Scale 3D Environments',
    text: 'High-fidelity architectural scans, processed for smooth performance on every device.',
  },
  {
    title: 'Hybrid Cross-Platform Support',
    text: 'Native VR teleportation and hand-tracking on standalone headsets, or standard WASD/mouse and mobile joystick controls with no VR hardware required.',
  },
  {
    title: 'Optimized for Mobile',
    text: 'Forward shading and pre-baked lighting keep framerates high on mobile VR chips and standard smartphones.',
  },
];

const DOWNLOADS = [
  { title: 'VR Headset', text: 'Meta Quest and other standalone headsets', href: '/api/download/vr' },
  { title: 'PC / Desktop', text: 'Windows, keyboard & mouse', href: '/api/download/desktop' },
  { title: 'Mobile', text: 'Android & iOS, touch controls', href: '/api/download/mobile' },
];

const SECTIONS = [
  { id: 'home', label: 'Home' },
  { id: 'download', label: 'Download' },
];

export default function Landing() {
  const [section, setSection] = useState('home');

  return (
    <>
      <nav className="landing-nav">
        <div className="landing-brand">
          <img src="assets/logo.png" alt="Belgium Campus" className="landing-logo" />
          <span>Virtual Campus Open Day</span>
        </div>
        <div className="landing-nav-links">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              className={`landing-nav-link${section === s.id ? ' active' : ''}`}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <a href="login.html" className="btn-signin">Sign In</a>
      </nav>

      <main className="landing-main">
        {section === 'home' && (
          <section className="landing-section active">
            <div className="hero">
              <h1>Explore Belgium Campus — Before You Even Arrive</h1>
              <p className="hero-subtitle">
                An immersive, cross-platform 3D exploration experience that brings the campus
                directly to prospective students — in VR or on any screen.
              </p>
            </div>

            <Gallery images={GALLERY_IMAGES} />

            <section className="features">
              <h2>Key Features</h2>
              <div className="features-grid">
                {FEATURES.map((f) => (
                  <div key={f.title} className="feature-card">
                    <h3>{f.title}</h3>
                    <p>{f.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </section>
        )}

        {section === 'download' && (
          <section className="landing-section active">
            <div className="hero">
              <h1>Download the Experience</h1>
              <p className="hero-subtitle">Get the Virtual Campus Open Day tour on your device of choice.</p>
            </div>

            <div className="download-grid">
              {DOWNLOADS.map((d) => (
                <div key={d.title} className="download-card">
                  <h3>{d.title}</h3>
                  <p>{d.text}</p>
                  <a href={d.href}>
                    <button className="btn-download">Download</button>
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

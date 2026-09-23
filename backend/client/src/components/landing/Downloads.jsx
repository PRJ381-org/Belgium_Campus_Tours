import Reveal from './Reveal.jsx';
import Icon from '../Icon.jsx';

function HeadsetIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3.5l-2-2.5h-3l-2 2.5H5a2 2 0 0 1-2-2z" />
      <circle cx="8" cy="11.5" r="1.5" />
      <circle cx="16" cy="11.5" r="1.5" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2.5" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </svg>
  );
}

const PLATFORMS = [
  {
    title: 'VR Headset',
    text: 'Meta Quest and other standalone headsets. Teleport and hand tracking.',
    href: '/api/download/vr',
    icon: <HeadsetIcon />,
    gradient: 'linear-gradient(135deg, #4099ff, #73b4ff)',
    glow: 'rgba(64, 153, 255, 0.35)',
  },
  {
    title: 'PC / Desktop',
    text: 'Windows, keyboard and mouse. The full-detail experience.',
    href: '/api/download/desktop',
    icon: <Icon name="monitor" size={28} />,
    gradient: 'linear-gradient(135deg, #2ed8b6, #59e0c5)',
    glow: 'rgba(46, 216, 182, 0.35)',
  },
  {
    title: 'Mobile',
    text: 'Android phones and tablets, with touch-joystick controls.',
    href: '/api/download/mobile',
    icon: <PhoneIcon />,
    gradient: 'linear-gradient(135deg, #7759de, #a389f4)',
    glow: 'rgba(119, 89, 222, 0.35)',
  },
];

export default function Downloads() {
  return (
    <section id="download" className="section downloads">
      <div className="section-head center">
        <Reveal className="section-label">
          <span>05</span> Download
        </Reveal>
        <Reveal as="h2" delay={80}>
          Start your <span className="text-gradient">virtual visit</span>
        </Reveal>
        <Reveal as="p" delay={160} className="section-sub">
          Pick your device and step onto campus in minutes.
        </Reveal>
      </div>

      <div className="download-grid">
        {PLATFORMS.map((p, i) => (
          <Reveal key={p.title} className="download-card" delay={i * 120} style={{ '--glow': p.glow }}>
            <span className="download-icon" style={{ background: p.gradient }}>
              {p.icon}
            </span>
            <h3>{p.title}</h3>
            <p>{p.text}</p>
            <a href={p.href} className="pill pill-white">
              Download
              <Icon name="download" size={15} />
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

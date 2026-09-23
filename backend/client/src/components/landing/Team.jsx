import Reveal from './Reveal.jsx';
import team from '../../data/team.js';

const GRADIENTS = [
  'linear-gradient(135deg, #4099ff, #73b4ff)',
  'linear-gradient(135deg, #2ed8b6, #59e0c5)',
  'linear-gradient(135deg, #7759de, #a389f4)',
  'linear-gradient(135deg, #ff5370, #ff869a)',
  'linear-gradient(135deg, #ffb64d, #ffcb80)',
];

function Silhouette() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="38" r="17" fill="rgba(255,255,255,0.85)" />
      <path d="M18 92c2-19 16-30 32-30s30 11 32 30z" fill="rgba(255,255,255,0.85)" />
    </svg>
  );
}

/**
 * Team grid - edit src/data/team.js to add real names and photos.
 */
export default function Team() {
  return (
    <section id="team" className="section team">
      <div className="section-head">
        <Reveal className="section-label">
          <span>04</span> The team
        </Reveal>
        <Reveal as="h2" delay={80}>
          Meet the <span className="text-gradient">builders</span>
        </Reveal>
        <Reveal as="p" delay={160} className="section-sub">
          {team.length} Belgium Campus students designed, modelled and coded the Virtual Campus Open Day.
        </Reveal>
      </div>

      <div className="team-grid">
        {team.map((m, i) => (
          <Reveal key={`${m.name}-${i}`} className="member" delay={(i % 4) * 90}>
            <div className="member-photo" style={{ background: m.photo ? undefined : GRADIENTS[i % GRADIENTS.length] }}>
              {m.photo ? <img src={m.photo} alt={m.name} loading="lazy" /> : <Silhouette />}
            </div>
            <h3>{m.name}</h3>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

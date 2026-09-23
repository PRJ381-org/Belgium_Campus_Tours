const ITEMS = [
  'Virtual Reality',
  'PC & Desktop',
  'Mobile',
  'True-to-Scale Campus',
  'Interactive Hotspots',
  'Hand Tracking',
  'Real-time Analytics',
  'Belgium Campus',
];

/**
 * Endlessly scrolling strip of features. The list is rendered twice so the
 * loop is seamless.
 */
export default function Marquee() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[...ITEMS, ...ITEMS].map((item, i) => (
          <span key={i} className="marquee-item">
            <span className="marquee-star">✦</span>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

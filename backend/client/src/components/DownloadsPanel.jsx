import Icon from './Icon.jsx';

const PLATFORMS = [
  { key: 'windows', label: 'Windows', icon: 'monitor', color: 'green' },
  { key: 'android', label: 'Android', icon: 'smartphone', color: 'purple' },
];

/**
 * "Downloads" card: how many times the Windows and Android Download buttons on
 * the landing page were clicked in the selected time range.
 */
export default function DownloadsPanel({ counts }) {
  const show = (n) => (counts ? Number(n ?? 0).toLocaleString() : '—');

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Downloads</h2>
          <p>Download button clicks on the website</p>
        </div>
      </div>
      <div className="card-body download-counts">
        {PLATFORMS.map((p) => (
          <div key={p.key} className={`download-count ${p.color}`}>
            <span className="download-count-icon">
              <Icon name={p.icon} size={18} />
            </span>
            <b>{show(counts?.[p.key])}</b>
            <span>{p.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

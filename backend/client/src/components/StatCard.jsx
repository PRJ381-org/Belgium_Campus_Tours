import Icon from './Icon.jsx';

/**
 * Gradient KPI card (title, icon, big value, footer note).
 */
export default function StatCard({ title, value, footer, color, icon }) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-title">{title}</div>
      <div className="stat-row">
        <Icon name={icon} size={28} />
        <span className="stat-value">{value}</span>
      </div>
      <div className="stat-footer">{footer}</div>
    </div>
  );
}

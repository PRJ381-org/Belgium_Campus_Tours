/**
 * One KPI tile in the dashboard stats row.
 */
export default function StatCard({ label, value, subtext, color, icon }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="card-label">{label}</span>
        <div className={`card-icon card-icon-${color}`}>{icon}</div>
      </div>
      <span className="card-value">{value}</span>
      <span className="card-subtext">{subtext}</span>
    </div>
  );
}

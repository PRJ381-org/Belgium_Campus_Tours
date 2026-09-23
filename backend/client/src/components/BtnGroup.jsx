/**
 * Segmented chip buttons (time range, sort, filter). Highlights the selected option.
 */
export default function BtnGroup({ options, value, onChange }) {
  return (
    <div className="btn-group">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`btn-chip${opt.value === value ? ' active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

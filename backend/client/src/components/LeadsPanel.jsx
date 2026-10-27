import Icon from './Icon.jsx';
import { downloadLeadsCsv } from '../lib/export.js';

/**
 * "Leads" card: how many prospective students asked for more info in the
 * selected time range, plus (admin only) a quick CSV export.
 */
export default function LeadsPanel({ count, isAdmin }) {
  const loaded = count !== null && count !== undefined;

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Leads</h2>
          <p>Prospective students who asked for more info</p>
        </div>
        {isAdmin && (
          <div className="card-actions">
            <button className="btn btn-light btn-sm" title="Export leads to CSV" onClick={() => downloadLeadsCsv()}>
              <Icon name="download" size={13} />
              CSV
            </button>
          </div>
        )}
      </div>
      <div className="card-body leads-count">
        <b>{loaded ? Number(count).toLocaleString() : '—'}</b>
        <span>{count === 1 ? 'lead' : 'leads'} in this time range</span>
      </div>
    </section>
  );
}

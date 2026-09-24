import { useMemo, useState } from 'react';
import BtnGroup from './BtnGroup.jsx';
import Icon from './Icon.jsx';
import { downloadLeadsCsv } from '../lib/export.js';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'email', label: 'A-Z' },
];

const SORTERS = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  email: (a, b) => (a.email || '').localeCompare(b.email || ''),
};

/**
 * "Recent Leads" card with sorting and (admin only) a quick CSV export.
 */
export default function LeadsPanel({ leads, isAdmin }) {
  const [sort, setSort] = useState('newest');
  const sorted = useMemo(() => [...leads].sort(SORTERS[sort]), [leads, sort]);

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Recent Leads</h2>
          <p>Prospective students who asked for more info</p>
        </div>
        <div className="card-actions">
          <BtnGroup options={SORTS} value={sort} onChange={setSort} />
          {isAdmin && (
            <button className="btn btn-light btn-sm" title="Export leads to CSV" onClick={() => downloadLeadsCsv()}>
              <Icon name="download" size={13} />
              CSV
            </button>
          )}
        </div>
      </div>
      <div className="table-wrap scroll">
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={2} className="empty">No leads in this time range yet.</td>
              </tr>
            ) : (
              sorted.map((lead) => (
                <tr key={lead._id || `${lead.email}-${lead.createdAt}`}>
                  <td>{lead.email}</td>
                  <td className="cell-muted">{new Date(lead.createdAt).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

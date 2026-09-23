import { useMemo, useState } from 'react';
import BtnGroup from './BtnGroup.jsx';
import { downloadLeadsCsv } from '../lib/export.js';

const SORTS = [
  { value: 'newest', label: 'Newest ⬇' },
  { value: 'oldest', label: 'Oldest ⬆' },
  { value: 'email', label: 'A-Z' },
];

const SORTERS = {
  newest: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  oldest: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
  email: (a, b) => (a.email || '').localeCompare(b.email || ''),
};

/**
 * "Recent Leads" table with sorting and (admin only) a quick CSV export.
 */
export default function LeadsPanel({ leads, isAdmin }) {
  const [sort, setSort] = useState('newest');
  const sorted = useMemo(() => [...leads].sort(SORTERS[sort]), [leads, sort]);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Recent Leads</h2>
        <div className="quick-actions">
          <div className="action-group">
            <span className="action-label">Sort:</span>
            <BtnGroup options={SORTS} value={sort} onChange={setSort} />
          </div>
          {isAdmin && (
            <div className="action-group">
              <button className="btn-chip btn-chip-export" title="Export Leads to CSV" onClick={downloadLeadsCsv}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Export CSV
              </button>
            </div>
          )}
        </div>
      </div>
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
              <td colSpan={2}>No matching leads found.</td>
            </tr>
          ) : (
            sorted.map((lead) => (
              <tr key={lead._id || `${lead.email}-${lead.createdAt}`}>
                <td>{lead.email}</td>
                <td>{new Date(lead.createdAt).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

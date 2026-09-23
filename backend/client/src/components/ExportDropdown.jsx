import { useEffect, useRef, useState } from 'react';
import { downloadLeadsCsv, downloadSummaryCsv, downloadTelemetryCsv } from '../lib/export.js';

const EXPORTS = [
  { icon: '📩', title: 'Student Leads (.CSV)', text: 'All prospective student inquiries', run: downloadLeadsCsv },
  { icon: '📊', title: 'Executive Summary (.CSV)', text: 'KPIs, zone dwell times & hotspots', run: downloadSummaryCsv },
  { icon: '⚡', title: 'Raw Telemetry Logs (.CSV)', text: 'Detailed event logs for Power BI', run: downloadTelemetryCsv },
];

/**
 * Admin-only "Export Data" menu in the dashboard header.
 */
export default function ExportDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close when clicking anywhere outside the menu.
  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <div ref={ref} className={`export-dropdown${open ? ' open' : ''}`}>
      <button className="btn-refresh btn-export-main" title="Export Reports" onClick={() => setOpen((o) => !o)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Export Data</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="chevron-icon">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className="export-menu">
        <div className="export-menu-header">Admin Export Reports</div>
        {EXPORTS.map((item) => (
          <button
            key={item.title}
            className="export-menu-item"
            onClick={() => {
              setOpen(false);
              item.run();
            }}
          >
            <span className="export-item-icon">{item.icon}</span>
            <div className="export-item-text">
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

import { useCallback, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import useClickOutside from './useClickOutside.js';
import { downloadLeadsCsv, downloadSummaryCsv, downloadTelemetryCsv } from '../lib/export.js';

const EXPORTS = [
  { title: 'Student Leads (.CSV)', text: 'All prospective student inquiries', run: downloadLeadsCsv },
  { title: 'Executive Summary (.CSV)', text: 'KPIs, zone dwell times & hotspots', run: downloadSummaryCsv },
  { title: 'Raw Telemetry Logs (.CSV)', text: 'Detailed event logs for Power BI', run: downloadTelemetryCsv },
];

/**
 * Admin-only "Export" menu.
 */
export default function ExportDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useClickOutside(ref, useCallback(() => setOpen(false), []));

  return (
    <div className="dropdown" ref={ref}>
      <button className="btn btn-primary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Icon name="download" size={15} />
        Export
        <Icon name="chevronDown" size={13} />
      </button>
      {open && (
        <div className="dropdown-menu" style={{ minWidth: 270 }}>
          {EXPORTS.map((item) => (
            <button
              key={item.title}
              className="dropdown-item"
              onClick={() => {
                setOpen(false);
                item.run();
              }}
            >
              <Icon name="download" size={16} />
              <span>
                {item.title}
                <small>{item.text}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import BtnGroup from '../../components/BtnGroup.jsx';
import StatCard from '../../components/StatCard.jsx';
import ChartCanvas from '../../components/ChartCanvas.jsx';
import LeadsPanel from '../../components/LeadsPanel.jsx';
import ExportDropdown from '../../components/ExportDropdown.jsx';
import Icon from '../../components/Icon.jsx';
import { eventTypeChartConfig, areaChartConfig, hotspotChartConfig } from '../../lib/chartConfigs.js';

const TIMEFRAMES = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

function formatDuration(ms) {
  if (!ms || ms <= 0) return '0s';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  return `${min}m ${sec}s`;
}

/**
 * Main analytics page: KPIs, charts and recent leads.
 */
export default function Overview({ summary, leads, leadCount, timeframe, onTimeframe, isAdmin, theme, refreshing, onRefresh }) {
  const charts = useMemo(
    () =>
      summary && {
        events: eventTypeChartConfig(summary.eventsByType, theme),
        areas: areaChartConfig(summary.areas, theme),
        hotspots: hotspotChartConfig(summary.hotspots, theme),
      },
    [summary, theme]
  );

  const loaded = summary !== null;
  const sessions = summary?.uniqueSessions ?? 0;
  const conversion = sessions > 0 ? ((leadCount / sessions) * 100).toFixed(1) : '0.0';
  const show = (value) => (loaded ? value : '—');

  const stats = [
    { title: 'Unique Sessions', value: show(Number(sessions).toLocaleString()), footer: 'Distinct VR visitors', color: 'blue', icon: 'users' },
    { title: 'Analytics Events', value: show(Number(summary?.totalEvents ?? 0).toLocaleString()), footer: 'Total telemetry logs', color: 'green', icon: 'activity' },
    { title: 'Avg Visit Time', value: show(formatDuration(summary?.avgSessionDurationMs)), footer: 'Avg exploration time', color: 'yellow', icon: 'clock' },
    { title: 'Total Leads', value: show(Number(leadCount ?? 0).toLocaleString()), footer: 'Student inquiries', color: 'red', icon: 'mail' },
    { title: 'Conversion Rate', value: show(`${conversion}%`), footer: 'Leads per visitor', color: 'purple', icon: 'target' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="breadcrumb">Home / <b>Analytics</b></div>
        </div>
        <div className="toolbar">
          <BtnGroup options={TIMEFRAMES} value={timeframe} onChange={onTimeframe} />
          <button className="btn btn-light" onClick={onRefresh} disabled={refreshing}>
            <Icon name="refresh" size={15} className={refreshing ? 'spin' : ''} />
            Refresh
          </button>
          {isAdmin && <ExportDropdown />}
        </div>
      </div>

      <section className="stats">
        {stats.map((s) => (
          <StatCard key={s.title} {...s} />
        ))}
      </section>

      <section className="grid grid-2-1">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Campus Area Activity</h2>
              <p>Minutes visitors spent in each area</p>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-box">{charts && <ChartCanvas config={charts.areas} />}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <h2>VR Event Breakdown</h2>
              <p>What visitors did in the tour</p>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-box">{charts && <ChartCanvas config={charts.events} />}</div>
          </div>
        </div>
      </section>

      <section className="grid grid-1-1">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Top Visited Hotspots</h2>
              <p>Most viewed points of interest</p>
            </div>
          </div>
          <div className="card-body">
            <div className="chart-box">{charts && <ChartCanvas config={charts.hotspots} />}</div>
          </div>
        </div>
        <LeadsPanel leads={leads} isAdmin={isAdmin} />
      </section>
    </>
  );
}

/**
 * Chart.js configurations for the dashboard (Gradient Able palette).
 * Each builder takes the backend data plus the resolved theme ('light'|'dark')
 * and returns a config for <ChartCanvas>.
 */

const THEME = {
  light: { grid: '#eef1f5', ticks: '#8996a4', border: '#ffffff' },
  dark: { grid: '#2b3445', ticks: '#8f9bb0', border: '#1e2533' },
};

const FONT = { family: "'Poppins', system-ui, sans-serif", size: 11 };

// Sort by a fixed category order so the legend/slice order is stable too,
// not just the colors (MongoDB's $group aggregation doesn't guarantee key order).
const CATEGORY_ORDER = ['session_start', 'session_end', 'area_enter', 'area_exit', 'hotspot_view', 'info_request'];

// Fixed per-category colors so the same event type always gets the same color.
const EVENT_TYPE_COLORS = {
  session_start: '#4099ff',
  session_end: '#7759de',
  area_enter: '#2ed8b6',
  area_exit: '#ffb64d',
  hotspot_view: '#ff5370',
  info_request: '#00bcd4',
};
const FALLBACK_COLOR = '#b0bec5';

function axis(t, extra = {}) {
  return {
    grid: { color: t.grid, drawTicks: false },
    border: { display: false },
    ticks: { color: t.ticks, font: FONT, padding: 8 },
    ...extra,
  };
}

// Vertical gradient fill for bars, e.g. blue -> light blue.
function gradient(from, to, horizontal = false) {
  return (ctx) => {
    const { chart } = ctx;
    const { chartArea } = chart;
    if (!chartArea) return from; // first render, before layout
    const g = horizontal
      ? chart.ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0)
      : chart.ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    g.addColorStop(0, from);
    g.addColorStop(1, to);
    return g;
  };
}

const tooltip = {
  backgroundColor: '#263238',
  titleFont: { ...FONT, weight: '600' },
  bodyFont: FONT,
  padding: 10,
  cornerRadius: 6,
  displayColors: false,
};

/**
 * Doughnut chart showing the distribution of VR event types.
 */
export function eventTypeChartConfig(eventsByType = {}, theme = 'light') {
  const t = THEME[theme];
  const labels = Object.keys(eventsByType).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  );
  const data = labels.map((key) => eventsByType[key]);

  if (labels.length === 0) {
    labels.push('No data');
    data.push(1);
  }

  return {
    type: 'doughnut',
    data: {
      labels: labels.map((l) => l.replace(/_/g, ' ')),
      datasets: [
        {
          data,
          backgroundColor: labels.map((label) => EVENT_TYPE_COLORS[label] || FALLBACK_COLOR),
          borderColor: t.border,
          borderWidth: 3,
          hoverOffset: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        tooltip: { ...tooltip, displayColors: true },
        legend: {
          position: 'bottom',
          labels: { color: t.ticks, font: FONT, padding: 14, usePointStyle: true, pointStyle: 'circle', boxWidth: 8 },
        },
      },
    },
  };
}

/**
 * Bar chart showing time spent across campus areas.
 */
export function areaChartConfig(areaData = {}, theme = 'light') {
  const t = THEME[theme];
  const labels = Object.keys(areaData);
  // Backend reports seconds; show minutes on the chart instead (1 decimal place).
  const data = Object.values(areaData).map((seconds) => Math.round((seconds / 60) * 10) / 10);

  if (labels.length === 0) {
    labels.push('No area data');
    data.push(0);
  }

  return {
    type: 'bar',
    data: {
      labels: labels.map((l) => l.replace(/^(LVL_|BP_)/i, '').replace(/_/g, ' ')),
      datasets: [
        {
          label: 'Minutes',
          data,
          backgroundColor: gradient('#4099ff', '#73b4ff'),
          borderRadius: 6,
          maxBarThickness: 42,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltip, callbacks: { label: (c) => `${c.parsed.y} minutes` } },
      },
      scales: {
        x: axis(t, { grid: { display: false } }),
        y: axis(t, {
          beginAtZero: true,
          title: { display: true, text: 'Minutes', color: t.ticks, font: FONT },
        }),
      },
    },
  };
}

/**
 * Horizontal bar chart showing top interacted hotspots.
 */
export function hotspotChartConfig(hotspotData = {}, theme = 'light') {
  const t = THEME[theme];
  const labels = Object.keys(hotspotData);
  const data = Object.values(hotspotData);

  if (labels.length === 0) {
    labels.push('No hotspot data');
    data.push(0);
  }

  return {
    type: 'bar',
    data: {
      labels: labels.map((l) => l.replace(/^(BP_|hotspot_)/i, '').replace(/_/g, ' ')),
      datasets: [
        {
          label: 'Views',
          data,
          backgroundColor: gradient('#2ed8b6', '#59e0c5', true),
          borderRadius: 6,
          maxBarThickness: 26,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { ...tooltip, callbacks: { label: (c) => `${c.parsed.x} views` } },
      },
      scales: {
        x: axis(t, {
          beginAtZero: true,
          title: { display: true, text: 'Views', color: t.ticks, font: FONT },
        }),
        y: axis(t, { grid: { display: false } }),
      },
    },
  };
}

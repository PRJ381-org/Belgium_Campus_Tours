/**
 * Chart.js configurations for the dashboard, styled with Belgium Campus branding.
 * Each builder takes the backend data and returns a config for <ChartCanvas>.
 */

const darkGridOptions = {
  grid: { color: '#232936' },
  ticks: { color: '#8e95a2', font: { size: 11 } },
};

// Sort by a fixed category order so the legend/slice order is stable too,
// not just the colors (MongoDB's $group aggregation doesn't guarantee key order).
const CATEGORY_ORDER = ['session_start', 'session_end', 'area_enter', 'area_exit', 'hotspot_view', 'info_request'];

// Fixed per-category colors so the same event type always gets the same color.
const EVENT_TYPE_COLORS = {
  session_start: '#2ecc71', // Mint Green
  session_end: '#9b59b6', // Amethyst Purple
  area_enter: '#f5a623', // Belgium Campus Gold / Yellow
  area_exit: '#3b82f6', // Slate Blue
  hotspot_view: '#e0292b', // Belgium Campus Red
  info_request: '#e67e22', // Deep Orange
};
const FALLBACK_COLOR = '#8e95a2';

/**
 * Doughnut chart showing the distribution of VR event types.
 */
export function eventTypeChartConfig(eventsByType = {}) {
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
          borderColor: '#13171f',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#8e95a2', font: { size: 11 }, padding: 12 },
        },
      },
    },
  };
}

/**
 * Bar chart showing time spent across campus areas.
 */
export function areaChartConfig(areaData = {}) {
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
          backgroundColor: '#e0292b', // Brand Red
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: darkGridOptions,
        y: {
          ...darkGridOptions,
          beginAtZero: true,
          title: { display: true, text: 'Minutes', color: '#8e95a2', font: { size: 11 } },
        },
      },
    },
  };
}

/**
 * Horizontal bar chart showing top interacted hotspots.
 */
export function hotspotChartConfig(hotspotData = {}) {
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
          backgroundColor: '#f5a623', // Brand Gold / Yellow
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ...darkGridOptions,
          beginAtZero: true,
          title: { display: true, text: 'Views', color: '#8e95a2', font: { size: 11 } },
        },
        y: darkGridOptions,
      },
    },
  };
}

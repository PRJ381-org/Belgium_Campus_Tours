/**
 * Data Export Module.
 *
 * Authenticated CSV report downloads for Admins. Every export accepts an
 * optional timeframe: all | today | 24h | 7d | 30d.
 */
import { API_BASE_URL } from './api.js';

const today = () => new Date().toISOString().slice(0, 10);

function withParams(endpoint, params) {
  const query = new URLSearchParams(params).toString();
  return `${API_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}${query}`;
}

export function triggerCsvDownload(endpoint, defaultFilename, timeframe = 'all') {
  const token = sessionStorage.getItem('token');
  if (!token) {
    alert('Please sign in as an Admin to download export reports.');
    return;
  }
  // Download links can't send an Authorization header, so the token rides in
  // the query string (the backend accepts ?token= for exactly this).
  const link = document.createElement('a');
  link.href = withParams(endpoint, { timeframe, token });
  link.setAttribute('download', defaultFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Fetches an export as text (for the Reports page preview). */
export async function fetchCsvText(endpoint, timeframe = 'all') {
  const token = sessionStorage.getItem('token');
  const res = await fetch(withParams(endpoint, { timeframe }), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`${endpoint} returned status ${res.status}`);
  return res.text();
}

export function downloadLeadsCsv(timeframe) {
  triggerCsvDownload('/api/export/leads', `belgium_campus_leads_${today()}.csv`, timeframe);
}

export function downloadSummaryCsv(timeframe) {
  triggerCsvDownload('/api/export/summary', `belgium_campus_executive_summary_${today()}.csv`, timeframe);
}

export function downloadTelemetryCsv(timeframe) {
  triggerCsvDownload('/api/export/analytics', `belgium_campus_telemetry_${today()}.csv`, timeframe);
}

export function downloadFeedbackCsv(timeframe) {
  triggerCsvDownload('/api/export/feedback', `belgium_campus_feedback_${today()}.csv`, timeframe);
}

export function downloadTicketsCsv(timeframe) {
  triggerCsvDownload('/api/export/tickets', `belgium_campus_support_tickets_${today()}.csv`, timeframe);
}

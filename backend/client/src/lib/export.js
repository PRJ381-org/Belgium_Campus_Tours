/**
 * Data Export Module.
 *
 * Provides authenticated CSV report generation and downloads for Admins.
 */
import { API_BASE_URL } from './api.js';

export function triggerCsvDownload(endpoint, defaultFilename) {
  const token = sessionStorage.getItem('token');
  if (!token) {
    alert('Please sign in as an Admin to download export reports.');
    return;
  }
  const url = `${API_BASE_URL}${endpoint}${endpoint.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', defaultFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadLeadsCsv() {
  triggerCsvDownload('/api/export/leads', `belgium_campus_leads_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function downloadSummaryCsv() {
  triggerCsvDownload('/api/export/summary', `belgium_campus_executive_summary_${new Date().toISOString().slice(0, 10)}.csv`);
}

export function downloadTelemetryCsv() {
  triggerCsvDownload('/api/export/analytics', `belgium_campus_telemetry_${new Date().toISOString().slice(0, 10)}.csv`);
}

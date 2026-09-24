/**
 * Support tickets for the landing page widget.
 *
 * Visitors have no accounts: each ticket's private key is remembered in this
 * browser (localStorage), so the inbox finds them again on the next visit.
 * On another browser, "Find a ticket" (reference + email) gets a fresh key.
 */

const STORAGE_KEY = 'vcod-support-tickets';

// ---------- This browser's saved tickets: [{ ref, key, seen }] ----------

export function loadSaved() {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(list) ? list.filter((t) => t && t.ref && t.key) : [];
  } catch {
    return [];
  }
}

function writeSaved(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked (private mode) - the ticket still works for this visit.
  }
}

export function rememberTicket(ref, key) {
  const list = loadSaved().filter((t) => t.ref !== ref);
  writeSaved([{ ref, key, seen: Date.now() }, ...list].slice(0, 20));
}

/** Marks a ticket's replies as read up to now. */
export function markSeen(ref) {
  writeSaved(loadSaved().map((t) => (t.ref === ref ? { ...t, seen: Date.now() } : t)));
}

/** Staff replies newer than when this browser last opened the ticket. */
export function unreadCount(ticket, saved) {
  const entry = saved.find((t) => t.ref === ticket.ref);
  const seen = entry?.seen || 0;
  return ticket.messages.filter((m) => m.author === 'staff' && new Date(m.createdAt).getTime() > seen).length;
}

// ---------- API ----------

async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.errors?.[0]?.msg || data.message || 'Something went wrong. Please try again.');
  }
  return data;
}

export async function fetchMyTickets() {
  const saved = loadSaved();
  if (saved.length === 0) return [];
  const data = await post('/api/tickets/mine', { tickets: saved.map(({ ref, key }) => ({ ref, key })) });
  return data.tickets || [];
}

export async function createTicket(fields) {
  const data = await post('/api/tickets', fields);
  if (data.ref && data.key) rememberTicket(data.ref, data.key);
  return data;
}

export async function replyToTicket(ref, message) {
  const entry = loadSaved().find((t) => t.ref === ref);
  const data = await post(`/api/tickets/${encodeURIComponent(ref)}/messages`, { key: entry?.key, message });
  markSeen(ref);
  return data.ticket;
}

export async function findTicket(ref, email) {
  const data = await post('/api/tickets/lookup', { ref: ref.trim().toUpperCase(), email: email.trim() });
  rememberTicket(data.ref, data.key);
  return data.ticket;
}

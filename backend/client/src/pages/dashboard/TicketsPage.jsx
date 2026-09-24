import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BtnGroup from '../../components/BtnGroup.jsx';
import Icon from '../../components/Icon.jsx';
import { fetchJson } from '../../lib/api.js';
import useAutoRefresh from '../../lib/useAutoRefresh.js';
import { CATEGORY_LABELS, PLATFORM_LABELS, STATUS_LABELS } from '../../lib/ticketLabels.js';

// Refresh every 30s while on this page (also straight away when you return to the tab).
const POLL_MS = 30000;

const FILTERS = [
  { value: 'needs_reply', label: 'Needs reply' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
];

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

const needsReply = (t) => t.status !== 'resolved' && t.lastMessageBy === 'visitor';

function when(date) {
  const d = new Date(date);
  return d.toDateString() === new Date().toDateString()
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/**
 * Staff side of the landing page support widget: read tickets, reply, and
 * move them through Open -> In progress -> Resolved.
 */
export default function TicketsPage({ onChanged }) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('needs_reply');
  const [search, setSearch] = useState('');
  const [activeRef, setActiveRef] = useState(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const threadRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchJson('/api/tickets');
      setTickets(res.tickets || []);
      setError('');
    } catch (err) {
      setError(`Could not load tickets (${err.message}).`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // New tickets and replies appear without a manual refresh.
  useAutoRefresh(load, POLL_MS);

  const counts = useMemo(
    () => ({
      needs_reply: tickets.filter(needsReply).length,
      open: tickets.filter((t) => t.status === 'open').length,
      in_progress: tickets.filter((t) => t.status === 'in_progress').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
      all: tickets.length,
    }),
    [tickets]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter === 'needs_reply' && !needsReply(t)) return false;
      if (!['needs_reply', 'all'].includes(filter) && t.status !== filter) return false;
      if (!q) return true;
      return [t.ref, t.subject, t.name, t.email, ...t.messages.map((m) => m.body)].some((v) =>
        (v || '').toLowerCase().includes(q)
      );
    });
  }, [tickets, filter, search]);

  const active = tickets.find((t) => t.ref === activeRef);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [activeRef, active?.messages.length]);

  const replace = (ticket) => {
    setTickets((list) => list.map((t) => (t.ref === ticket.ref ? ticket : t)));
    onChanged?.();
  };

  const sendReply = async () => {
    if (!reply.trim() || !active) return;
    setBusy(true);
    try {
      const res = await fetchJson(`/api/tickets/${active.ref}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message: reply.trim() }),
      });
      replace(res.ticket);
      setReply('');
    } catch (err) {
      alert(`Could not send reply: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (status) => {
    if (!active || status === active.status) return;
    try {
      const res = await fetchJson(`/api/tickets/${active.ref}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      replace(res.ticket);
    } catch (err) {
      alert(`Could not update status: ${err.message}`);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Tickets</h1>
          <div className="breadcrumb">Home / <b>Support Tickets</b></div>
        </div>
        <div className="toolbar">
          <button className="btn btn-light" onClick={load}>
            <Icon name="refresh" size={15} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <Icon name="x" size={16} />
          {error}
        </div>
      )}

      <section className={`card tk-layout${active ? ' has-active' : ''}`}>
        <aside className="tk-list-pane">
          <div className="tk-list-tools">
            <label className="search-box">
              <Icon name="search" size={16} />
              <input type="search" placeholder="Search tickets…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
            <BtnGroup
              options={FILTERS.map((f) => ({ ...f, label: `${f.label} ${counts[f.value]}` }))}
              value={filter}
              onChange={setFilter}
            />
          </div>

          <div className="tk-list">
            {loading && tickets.length === 0 ? (
              <p className="empty-note">Loading…</p>
            ) : visible.length === 0 ? (
              <p className="empty-note">
                {tickets.length === 0
                  ? 'No tickets yet. Visitors can open one from the chat button on the landing page.'
                  : filter === 'needs_reply'
                    ? "You're all caught up."
                    : 'No tickets match.'}
              </p>
            ) : (
              visible.map((t) => {
                const last = t.messages[t.messages.length - 1];
                return (
                  <button
                    key={t.ref}
                    className={`tk-item${t.ref === activeRef ? ' active' : ''}`}
                    onClick={() => setActiveRef(t.ref)}
                  >
                    <div className="tk-item-top">
                      <strong>{t.subject}</strong>
                      <span className="cell-sub">{when(t.lastMessageAt)}</span>
                    </div>
                    <div className="tk-item-mid">
                      {t.name} · {CATEGORY_LABELS[t.category]}
                    </div>
                    <p>{last?.body}</p>
                    <div className="tk-item-bottom">
                      <span className={`tk-status tk-status-${t.status}`}>{STATUS_LABELS[t.status]}</span>
                      <span className="mono">{t.ref}</span>
                      {needsReply(t) && <span className="tk-needs">Needs reply</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="tk-convo">
          {!active ? (
            <div className="tk-empty">
              <Icon name="inbox" size={36} />
              <p>Select a ticket to read and reply.</p>
            </div>
          ) : (
            <>
              <div className="tk-convo-head">
                <button className="icon-btn tk-back" onClick={() => setActiveRef(null)} aria-label="Back to tickets">
                  <Icon name="chevronLeft" size={18} />
                </button>
                <div className="tk-convo-title">
                  <h2>{active.subject}</h2>
                  <div className="tk-convo-meta">
                    <span className="mono">{active.ref}</span>
                    <span>{CATEGORY_LABELS[active.category]}</span>
                    {active.platform && <span>{PLATFORM_LABELS[active.platform]}</span>}
                    <span>Opened {new Date(active.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="tk-convo-person">
                    <Icon name="user" size={13} />
                    {active.name}
                    <a href={`mailto:${active.email}?subject=${encodeURIComponent(`Re: ${active.subject} [${active.ref}]`)}`}>
                      {active.email}
                    </a>
                  </div>
                </div>
                <BtnGroup options={STATUS_OPTIONS} value={active.status} onChange={changeStatus} />
              </div>

              <div className="tk-thread" ref={threadRef}>
                {active.messages.map((m, i) => (
                  <div key={m._id || i} className={`tk-msg ${m.author}`}>
                    <span className="tk-msg-name">
                      {m.author === 'staff' ? `${m.staffName || 'Support'} (staff)` : active.name}
                    </span>
                    <div className="tk-bubble">{m.body}</div>
                    <span className="tk-msg-time">{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="tk-compose">
                <textarea
                  rows="3"
                  maxLength={2000}
                  placeholder={`Reply to ${active.name}… (Enter to send, Shift+Enter for a new line)`}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
                <div className="tk-compose-actions">
                  <span className="cell-sub">The visitor sees replies in the chat window on the website.</span>
                  <button className="btn btn-primary" onClick={sendReply} disabled={busy || !reply.trim()}>
                    <Icon name="send" size={14} />
                    {busy ? 'Sending…' : 'Send reply'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}

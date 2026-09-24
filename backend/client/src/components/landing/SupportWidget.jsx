import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '../Icon.jsx';
import useAutoRefresh, { useTitleCount } from '../../lib/useAutoRefresh.js';
import {
  loadSaved,
  markSeen,
  unreadCount,
  fetchMyTickets,
  createTicket,
  replyToTicket,
  findTicket,
} from '../../lib/tickets.js';
import { CATEGORY_LABELS, PLATFORM_LABELS, STATUS_LABELS } from '../../lib/ticketLabels.js';

const POLL_IDLE_MS = 60000; // badge refresh while browsing the page
const POLL_OPEN_MS = 8000; // while the visitor is reading a conversation

const EMPTY_FORM = { category: '', platform: '', subject: '', message: '', name: '', email: '', website: '' };

function timeLabel(date) {
  const d = new Date(date);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function StatusPill({ status }) {
  return <span className={`sw-status sw-status-${status}`}>{STATUS_LABELS[status]}</span>;
}

function Chips({ options, value, onChange }) {
  return (
    <div className="sw-chips">
      {Object.entries(options).map(([v, label]) => (
        <button
          key={v}
          type="button"
          className={`sw-chip${value === v ? ' selected' : ''}`}
          aria-pressed={value === v}
          onClick={() => onChange(value === v ? '' : v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function CopyRef({ value }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="sw-ref"
      title="Copy reference"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {value}
      <Icon name={copied ? 'check' : 'copy'} size={12} />
    </button>
  );
}

/**
 * Floating support inbox (bottom right of the landing page). Visitors open
 * tickets, see staff replies and reply back. Tickets are remembered in this
 * browser; "Find a ticket" recovers them elsewhere with reference + email.
 */
export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('list'); // list | new | find | created | ticket
  const [tickets, setTickets] = useState([]);
  const [saved, setSaved] = useState(loadSaved);
  const [activeRef, setActiveRef] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [find, setFind] = useState({ ref: '', email: '' });
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const threadRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      setTickets(await fetchMyTickets());
      setSaved(loadSaved());
    } catch {
      // Offline or server hiccup - keep showing what we have.
    }
  }, []);

  // Load on arrival and whenever the panel or screen changes...
  useEffect(() => {
    refresh();
  }, [open, view, refresh]);

  // ...then keep checking: every minute while just browsing the page, faster
  // while reading a conversation, and straight away on returning to the tab.
  // (fetchMyTickets makes no request when this browser has no tickets.)
  useAutoRefresh(refresh, open && view === 'ticket' ? POLL_OPEN_MS : POLL_IDLE_MS);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const active = tickets.find((t) => t.ref === activeRef);

  // Reading a conversation marks it read and keeps it scrolled to the newest message.
  useEffect(() => {
    if (open && view === 'ticket' && active) {
      markSeen(active.ref);
      setSaved(loadSaved());
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
    }
  }, [open, view, active?.messages.length, active?.ref]);

  const totalUnread = tickets.reduce((n, t) => n + unreadCount(t, saved), 0);
  // "(2) Virtual Campus Open Day" in the browser tab when replies are waiting.
  useTitleCount(totalUnread);

  const go = (next, ref = null) => {
    setError('');
    setView(next);
    if (ref) setActiveRef(ref);
  };

  // Always open on the Support home (list + New ticket / Find a ticket).
  const toggle = () => {
    if (!open) go('list');
    setOpen(!open);
  };

  const upsert = (ticket) => {
    setTickets((list) => [ticket, ...list.filter((t) => t.ref !== ticket.ref)]);
    setSaved(loadSaved());
  };

  const submitNew = async (e) => {
    e.preventDefault();
    if (!form.category) return setError('Please choose what your issue is about.');
    if (!form.subject.trim()) return setError('Please add a short subject.');
    if (!form.message.trim()) return setError('Please describe the issue.');
    if (!form.name.trim()) return setError('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError('Please enter a valid email address.');

    setBusy(true);
    setError('');
    try {
      const data = await createTicket(form);
      if (data.ticket) upsert(data.ticket);
      setActiveRef(data.ref || null);
      setForm(EMPTY_FORM);
      go('created');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitFind = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const ticket = await findTicket(find.ref, find.email);
      upsert(ticket);
      setFind({ ref: '', email: '' });
      go('ticket', ticket.ref);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async () => {
    if (!reply.trim() || !active) return;
    setBusy(true);
    setError('');
    try {
      upsert(await replyToTicket(active.ref, reply.trim()));
      setReply('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const setField = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const onField = (key) => (e) => setField(key)(e.target.value);

  return (
    <div className={`sw${open ? ' open' : ''}`}>
      {open && (
        <div className="sw-panel" role="dialog" aria-label="Support">
          <div className="sw-head">
            {view !== 'list' && view !== 'created' && (
              <button className="sw-icon-btn" onClick={() => go('list')} aria-label="Back to my tickets">
                <Icon name="chevronLeft" size={18} />
              </button>
            )}
            <div className="sw-head-text">
              <strong>
                {view === 'ticket' && active ? active.subject : view === 'new' ? 'New ticket' : view === 'find' ? 'Find a ticket' : 'Support'}
              </strong>
              <span>
                {view === 'ticket' && active
                  ? CATEGORY_LABELS[active.category]
                  : 'We usually reply within a day'}
              </span>
            </div>
            <button className="sw-icon-btn" onClick={() => setOpen(false)} aria-label="Close support">
              <Icon name="x" size={18} />
            </button>
          </div>

          {view === 'list' && (
            <div className="sw-body">
              <div className="sw-actions">
                <button className="sw-btn sw-btn-primary" onClick={() => go('new')}>
                  <Icon name="plus" size={15} /> New ticket
                </button>
                <button className="sw-btn" onClick={() => go('find')}>
                  <Icon name="search" size={15} /> Find a ticket
                </button>
              </div>
              {tickets.length === 0 ? (
                <div className="sw-empty">
                  <Icon name="inbox" size={30} />
                  <p>No tickets in this browser yet.</p>
                  <span>Opened one on another device? Use “Find a ticket”.</span>
                </div>
              ) : (
                <ul className="sw-list">
                  {tickets.map((t) => {
                    const unread = unreadCount(t, saved);
                    const last = t.messages[t.messages.length - 1];
                    return (
                      <li key={t.ref}>
                        <button className="sw-item" onClick={() => go('ticket', t.ref)}>
                          <div className="sw-item-top">
                            <strong>{t.subject}</strong>
                            <span className="sw-time">{timeLabel(t.lastMessageAt)}</span>
                          </div>
                          <p>
                            {last?.author === 'staff' ? 'Support: ' : 'You: '}
                            {last?.body}
                          </p>
                          <div className="sw-item-bottom">
                            <StatusPill status={t.status} />
                            <span className="sw-ref-plain">{t.ref}</span>
                            {unread > 0 && <span className="sw-unread">{unread} new</span>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {view === 'new' && (
            <form className="sw-body sw-form" onSubmit={submitNew} noValidate>
              <label className="sw-label">What is it about?</label>
              <Chips options={CATEGORY_LABELS} value={form.category} onChange={setField('category')} />
              <label className="sw-label">
                Platform <em>(optional)</em>
              </label>
              <Chips options={PLATFORM_LABELS} value={form.platform} onChange={setField('platform')} />
              <label className="sw-label" htmlFor="sw-subject">Subject</label>
              <input id="sw-subject" maxLength={120} value={form.subject} onChange={onField('subject')} placeholder="The app won't install" />
              <label className="sw-label" htmlFor="sw-message">Describe the issue</label>
              <textarea id="sw-message" rows="4" maxLength={2000} value={form.message} onChange={onField('message')} placeholder="What happened, and what were you trying to do?" />
              <div className="sw-row">
                <div>
                  <label className="sw-label" htmlFor="sw-name">Name</label>
                  <input id="sw-name" maxLength={100} autoComplete="name" value={form.name} onChange={onField('name')} />
                </div>
                <div>
                  <label className="sw-label" htmlFor="sw-email">Email</label>
                  <input id="sw-email" type="email" maxLength={200} autoComplete="email" value={form.email} onChange={onField('email')} />
                </div>
              </div>
              <input className="fb-honeypot" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={onField('website')} />
              {error && <p className="sw-error" role="alert">{error}</p>}
              <button type="submit" className="sw-btn sw-btn-primary sw-submit" disabled={busy}>
                {busy ? 'Sending…' : 'Send ticket'}
              </button>
            </form>
          )}

          {view === 'find' && (
            <form className="sw-body sw-form" onSubmit={submitFind} noValidate>
              <p className="sw-hint">
                Opened a ticket on another device or browser? Enter its reference and the email you used.
              </p>
              <label className="sw-label" htmlFor="sw-find-ref">Ticket reference</label>
              <input
                id="sw-find-ref"
                placeholder="VC-7K3P9Q"
                value={find.ref}
                onChange={(e) => setFind((f) => ({ ...f, ref: e.target.value.toUpperCase() }))}
              />
              <label className="sw-label" htmlFor="sw-find-email">Email</label>
              <input
                id="sw-find-email"
                type="email"
                autoComplete="email"
                value={find.email}
                onChange={(e) => setFind((f) => ({ ...f, email: e.target.value }))}
              />
              {error && <p className="sw-error" role="alert">{error}</p>}
              <button type="submit" className="sw-btn sw-btn-primary sw-submit" disabled={busy || !find.ref || !find.email}>
                {busy ? 'Searching…' : 'Find my ticket'}
              </button>
            </form>
          )}

          {view === 'created' && (
            <div className="sw-body sw-created">
              <span className="sw-created-check">
                <Icon name="check" size={28} />
              </span>
              <strong>Ticket sent!</strong>
              <p>Your reference number is</p>
              <CopyRef value={activeRef || ''} />
              <p className="sw-hint">
                We'll reply right here — this inbox remembers your ticket in this browser. On another device, use
                “Find a ticket” with this reference and your email.
              </p>
              <button className="sw-btn sw-btn-primary" onClick={() => go('ticket', activeRef)}>
                View ticket
              </button>
            </div>
          )}

          {view === 'ticket' && active && (
            <>
              <div className="sw-ticket-meta">
                <StatusPill status={active.status} />
                <CopyRef value={active.ref} />
              </div>
              <div className="sw-thread" ref={threadRef}>
                {active.messages.map((m, i) => (
                  <div key={i} className={`sw-msg ${m.author}`}>
                    {m.author === 'staff' && <span className="sw-msg-name">{m.staffName || 'Support'} · Belgium Campus</span>}
                    <div className="sw-bubble">{m.body}</div>
                    <span className="sw-msg-time">{timeLabel(m.createdAt)}</span>
                  </div>
                ))}
                {active.lastMessageBy === 'visitor' && active.status !== 'resolved' && (
                  <p className="sw-waiting">We've got your message — the team will reply here soon.</p>
                )}
              </div>
              {active.status === 'resolved' && (
                <p className="sw-resolved-note">This ticket is resolved. Replying will reopen it.</p>
              )}
              {error && <p className="sw-error sw-error-inline" role="alert">{error}</p>}
              <div className="sw-compose">
                <textarea
                  rows="1"
                  maxLength={2000}
                  placeholder="Write a reply…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendReply();
                    }
                  }}
                />
                <button className="sw-send" onClick={sendReply} disabled={busy || !reply.trim()} aria-label="Send reply">
                  <Icon name="send" size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button className="sw-launcher" onClick={toggle} aria-label={open ? 'Close support' : 'Open support'} aria-expanded={open}>
        <Icon name={open ? 'x' : 'message'} size={22} />
        {!open && totalUnread > 0 && <span className="sw-badge">{totalUnread}</span>}
      </button>
    </div>
  );
}

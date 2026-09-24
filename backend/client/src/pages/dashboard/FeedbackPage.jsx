import { useCallback, useEffect, useMemo, useState } from 'react';
import BtnGroup from '../../components/BtnGroup.jsx';
import StatCard from '../../components/StatCard.jsx';
import Icon from '../../components/Icon.jsx';
import { fetchJson } from '../../lib/api.js';
import useAutoRefresh from '../../lib/useAutoRefresh.js';
import { downloadFeedbackCsv } from '../../lib/export.js';

const VISITOR_LABELS = { prospective_student: 'Prospective student', parent: 'Parent / guardian', other: 'Other' };
const PLATFORM_LABELS = { vr: 'VR headset', pc: 'PC', android: 'Android', none: "Hasn't tried it" };

const RATING_FILTERS = [
  { value: 'all', label: 'All' },
  { value: '5', label: '5★' },
  { value: '4', label: '4★' },
  { value: '3', label: '3★' },
  { value: '2', label: '2★' },
  { value: '1', label: '1★' },
];

const BAR_COLORS = { 5: '#2ed8b6', 4: '#4099ff', 3: '#ffb64d', 2: '#ff869a', 1: '#ff5370' };

function Stars({ rating }) {
  return (
    <span className="fb-stars-row" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? 'on' : ''}>
          <Icon name="star" size={15} />
        </span>
      ))}
    </span>
  );
}

/**
 * Admin page for the landing page's Open Day feedback form.
 */
export default function FeedbackPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');

  // quiet = background refresh: no spinner, and a failed refresh keeps showing the last data.
  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetchJson('/api/feedback');
      setItems(res.feedback || []);
      setError('');
    } catch (err) {
      if (!quiet) setError(`Could not load feedback (${err.message}).`);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load({ quiet: true }), 60000);

  const stats = useMemo(() => {
    const count = items.length;
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let total = 0;
    items.forEach((f) => {
      dist[f.rating] = (dist[f.rating] || 0) + 1;
      total += f.rating;
    });
    return {
      count,
      dist,
      avg: count ? total / count : 0,
      happy: count ? Math.round(((dist[5] + dist[4]) / count) * 100) : 0,
      students: items.filter((f) => f.visitorType === 'prospective_student').length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((f) => {
      if (ratingFilter !== 'all' && String(f.rating) !== ratingFilter) return false;
      if (!q) return true;
      return [f.liked, f.improve, f.name, f.email, VISITOR_LABELS[f.visitorType], PLATFORM_LABELS[f.platform]]
        .some((v) => v && v.toLowerCase().includes(q));
    });
  }, [items, search, ratingFilter]);

  const cards = [
    { title: 'Responses', value: stats.count.toLocaleString(), footer: 'Feedback forms submitted', color: 'blue', icon: 'message' },
    { title: 'Average Rating', value: stats.count ? `${stats.avg.toFixed(1)} / 5` : '—', footer: 'Across all responses', color: 'yellow', icon: 'star' },
    { title: 'Happy Visitors', value: stats.count ? `${stats.happy}%` : '—', footer: 'Rated 4 or 5 stars', color: 'green', icon: 'smile' },
    { title: 'Prospective Students', value: stats.students.toLocaleString(), footer: 'Responses from future students', color: 'purple', icon: 'graduation' },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Feedback</h1>
          <div className="breadcrumb">Home / <b>Feedback</b></div>
        </div>
        <div className="toolbar">
          <button className="btn btn-light" onClick={() => load()} disabled={loading}>
            <Icon name="refresh" size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={() => downloadFeedbackCsv()}>
            <Icon name="download" size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger">
          <Icon name="x" size={16} />
          {error}
        </div>
      )}

      <section className="stats stats-4">
        {cards.map((c) => (
          <StatCard key={c.title} {...c} />
        ))}
      </section>

      <section className="grid fb-layout">
        <div className="card">
          <div className="card-header">
            <div>
              <h2>Ratings</h2>
              <p>How visitors rated the Open Day</p>
            </div>
          </div>
          <div className="card-body fb-bars">
            {[5, 4, 3, 2, 1].map((n) => {
              const pct = stats.count ? (stats.dist[n] / stats.count) * 100 : 0;
              return (
                <button
                  key={n}
                  className={`fb-bar-row${ratingFilter === String(n) ? ' active' : ''}`}
                  onClick={() => setRatingFilter(ratingFilter === String(n) ? 'all' : String(n))}
                  title={`Show ${n}-star responses`}
                >
                  <span className="fb-bar-label">{n}★</span>
                  <span className="fb-bar-track">
                    <span style={{ width: `${pct}%`, background: BAR_COLORS[n] }} />
                  </span>
                  <span className="fb-bar-count">{stats.dist[n]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header logs-filters">
            <label className="search-box">
              <Icon name="search" size={16} />
              <input
                type="search"
                placeholder="Search comments, names, emails…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <BtnGroup options={RATING_FILTERS} value={ratingFilter} onChange={setRatingFilter} />
          </div>

          <div className="fb-list">
            {loading && items.length === 0 ? (
              <p className="empty-note">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="empty-note">
                {items.length === 0
                  ? 'No feedback yet. Responses from the landing page form will appear here.'
                  : 'No responses match.'}
              </p>
            ) : (
              filtered.map((f) => (
                <article key={f._id} className="fb-item">
                  <div className="fb-item-head">
                    <Stars rating={f.rating} />
                    <span className="cell-sub" title={new Date(f.createdAt).toLocaleString()}>
                      {new Date(f.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {(f.visitorType || f.platform || f.source === 'google_form') && (
                    <div className="fb-tags">
                      {f.source === 'google_form' && <span className="fb-tag fb-tag-source">Google Form</span>}
                      {f.visitorType && <span className="fb-tag">{VISITOR_LABELS[f.visitorType]}</span>}
                      {f.platform && <span className="fb-tag">{PLATFORM_LABELS[f.platform]}</span>}
                    </div>
                  )}
                  {f.liked && (
                    <p className="fb-quote">
                      <b>Liked:</b> {f.liked}
                    </p>
                  )}
                  {f.improve && (
                    <p className="fb-quote">
                      <b>Could improve:</b> {f.improve}
                    </p>
                  )}
                  {!f.liked && !f.improve && <p className="fb-quote cell-muted">No comments left.</p>}
                  {(f.name || f.email) && (
                    <div className="fb-contact">
                      <Icon name="user" size={13} />
                      {f.name}
                      {f.email && (
                        <a href={`mailto:${f.email}`} className="fb-mail">
                          {f.email}
                        </a>
                      )}
                    </div>
                  )}
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </>
  );
}

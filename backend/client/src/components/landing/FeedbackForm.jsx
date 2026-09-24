import { useState } from 'react';
import Reveal from './Reveal.jsx';
import Icon from '../Icon.jsx';

const RATING_WORDS = ['', 'Not great', 'Could be better', 'Good', 'Really good', 'Loved it!'];

const VISITOR_TYPES = [
  { value: 'prospective_student', label: 'Prospective student' },
  { value: 'parent', label: 'Parent or guardian' },
  { value: 'other', label: 'Other' },
];

const PLATFORMS = [
  { value: 'vr', label: 'VR headset' },
  { value: 'pc', label: 'PC' },
  { value: 'android', label: 'Android' },
  { value: 'none', label: "Haven't tried it yet" },
];

const EMPTY = { rating: 0, visitorType: '', platform: '', liked: '', improve: '', name: '', email: '', website: '' };

function Star({ filled }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.8l2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 17.13 6.38 20.1l1.07-6.27L2.9 9.4l6.3-.9z"
        fill={filled ? 'url(#starGrad)' : 'none'}
        stroke={filled ? 'none' : 'currentColor'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChoiceGroup({ label, options, value, onChange }) {
  return (
    <fieldset className="fb-field">
      <legend>{label}</legend>
      <div className="fb-chips">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`fb-chip${value === o.value ? ' selected' : ''}`}
            aria-pressed={value === o.value}
            onClick={() => onChange(value === o.value ? '' : o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Public Open Day feedback form. Posts to /api/feedback (stored in MongoDB).
 * The star rating, name and email are required; the other questions are optional.
 */
export default function FeedbackForm() {
  const [form, setForm] = useState(EMPTY);
  const [hover, setHover] = useState(0);
  const [status, setStatus] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));
  const onText = (key) => (e) => set(key)(e.target.value);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.rating) {
      setError('Please choose a star rating first.');
      return;
    }
    if (!form.name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setStatus('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const firstError = data.errors?.[0]?.msg;
        throw new Error(firstError || data.message || 'Something went wrong. Please try again.');
      }
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  const shown = hover || form.rating;

  return (
    <section id="feedback" className="section feedback">
      <div className="section-head center">
        <Reveal className="section-label">
          <span>06</span> Feedback
        </Reveal>
        <Reveal as="h2" delay={80}>
          How was your <span className="text-gradient">visit?</span>
        </Reveal>
        <Reveal as="p" delay={160} className="section-sub">
          Tell us what you thought of the Virtual Open Day. It takes less than a minute.
        </Reveal>
      </div>

      <Reveal className="fb-card" delay={120}>
        {/* Gradient used by the filled stars */}
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs>
            <linearGradient id="starGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#ffcb80" />
              <stop offset="100%" stopColor="#ffb64d" />
            </linearGradient>
          </defs>
        </svg>

        {status === 'sent' ? (
          <div className="fb-thanks" role="status">
            <span className="fb-check">
              <Icon name="check" size={34} />
            </span>
            <h3>Thanks for your feedback!</h3>
            <p>It helps us make the next Open Day even better.</p>
            <button
              type="button"
              className="pill pill-ghost"
              onClick={() => {
                setForm(EMPTY);
                setStatus('idle');
              }}
            >
              Send another response
            </button>
          </div>
        ) : (
          <form className="fb-form" onSubmit={submit} noValidate>
            <fieldset className="fb-field fb-rating-field">
              <legend>How would you rate the Virtual Open Day?</legend>
              <div className="fb-stars" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={form.rating === n}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    className={`fb-star${n <= shown ? ' on' : ''}`}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => {
                      set('rating')(n);
                      setError('');
                    }}
                  >
                    <Star filled={n <= shown} />
                  </button>
                ))}
              </div>
              <span className="fb-rating-word">{RATING_WORDS[shown] || 'Tap a star'}</span>
            </fieldset>

            <div className="fb-grid">
              <ChoiceGroup label="I am a…" options={VISITOR_TYPES} value={form.visitorType} onChange={set('visitorType')} />
              <ChoiceGroup label="I explored on…" options={PLATFORMS} value={form.platform} onChange={set('platform')} />
            </div>

            <div className="fb-grid">
              <label className="fb-field">
                <span>What did you like?</span>
                <textarea rows="4" maxLength={1000} value={form.liked} onChange={onText('liked')} placeholder="The labs looked amazing…" />
              </label>
              <label className="fb-field">
                <span>What could be better?</span>
                <textarea rows="4" maxLength={1000} value={form.improve} onChange={onText('improve')} placeholder="I'd love to see…" />
              </label>
            </div>

            <div className="fb-grid">
              <label className="fb-field">
                <span>Name</span>
                <input type="text" required maxLength={100} autoComplete="name" value={form.name} onChange={onText('name')} />
              </label>
              <label className="fb-field">
                <span>Email</span>
                <input type="email" required maxLength={200} autoComplete="email" value={form.email} onChange={onText('email')} />
              </label>
            </div>

            {/* Honeypot - hidden from people, filled in by bots */}
            <input
              className="fb-honeypot"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={form.website}
              onChange={onText('website')}
            />

            <p className="fb-privacy">
              We only use your name and email to follow up on your feedback, and never share them.
            </p>

            {error && (
              <p className="fb-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="pill pill-white pill-lg fb-submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send feedback'}
              {status !== 'sending' && <Icon name="chevronRight" size={16} />}
            </button>
          </form>
        )}
      </Reveal>
    </section>
  );
}

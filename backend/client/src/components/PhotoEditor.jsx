import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { exportCrop } from '../lib/avatar.js';

const VIEW = 280; // editor viewport size in px (square, shown with a round mask)
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const PREVIEWS = [72, 40];
const START = { zoom: 1, x: 0, y: 0 };

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/**
 * Modal for positioning and zooming a profile photo before saving.
 * Drag to move, slider / mouse wheel / pinch to zoom, arrow keys to nudge.
 */
export default function PhotoEditor({ image, onCancel, onSave, saving, error }) {
  // Zoom 1 = the photo just covers the circle. x/y = offset of the photo's
  // centre from the viewport's centre, in px.
  const [view, setView] = useState(START);
  const viewRef = useRef(null);
  const pointers = useRef(new Map());
  const pinch = useRef(null);

  const base = VIEW / Math.min(image.naturalWidth, image.naturalHeight);
  const sizeAt = (zoom) => ({ w: image.naturalWidth * base * zoom, h: image.naturalHeight * base * zoom });

  // Keep the photo covering the whole circle - no empty edges.
  const fit = (v) => {
    const zoom = clamp(v.zoom, MIN_ZOOM, MAX_ZOOM);
    const { w, h } = sizeAt(zoom);
    const maxX = (w - VIEW) / 2;
    const maxY = (h - VIEW) / 2;
    return { zoom, x: clamp(v.x, -maxX, maxX), y: clamp(v.y, -maxY, maxY) };
  };

  // Zoom while keeping the point (px, py) - relative to the centre - still.
  const zoomAround = (v, nextZoom, px = 0, py = 0) => {
    const z2 = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const k = z2 / v.zoom;
    return fit({ zoom: z2, x: px - (px - v.x) * k, y: py - (py - v.y) * k });
  };

  const update = (fn) => setView((v) => fit(fn(v)));

  const relative = (clientX, clientY) => {
    const rect = viewRef.current.getBoundingClientRect();
    return { x: clientX - rect.left - VIEW / 2, y: clientY - rect.top - VIEW / 2 };
  };

  const onPointerDown = (e) => {
    viewRef.current.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom };
    }
  };

  const onPointerMove = (e) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist;
      const mid = relative((a.x + b.x) / 2, (a.y + b.y) / 2);
      const target = pinch.current.zoom * ratio;
      setView((v) => zoomAround(v, target, mid.x, mid.y));
    } else if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      update((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };

  const onPointerUp = (e) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // Wheel zoom needs a non-passive listener so the page doesn't scroll.
  const wheelRef = useRef(null);
  wheelRef.current = (e) => {
    e.preventDefault();
    const p = relative(e.clientX, e.clientY);
    setView((v) => zoomAround(v, v.zoom * Math.exp(-e.deltaY * 0.0015), p.x, p.y));
  };
  useEffect(() => {
    const el = viewRef.current;
    const onWheel = (e) => wheelRef.current(e);
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, saving]);

  const onViewKey = (e) => {
    const step = e.shiftKey ? 20 : 5;
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key];
      update((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (e.key === '+' || e.key === '=') {
      setView((v) => zoomAround(v, v.zoom * 1.1));
    } else if (e.key === '-') {
      setView((v) => zoomAround(v, v.zoom / 1.1));
    }
  };

  const { w, h } = sizeAt(view.zoom);
  const crop = { viewSize: VIEW, x: VIEW / 2 + view.x - w / 2, y: VIEW / 2 + view.y - h / 2, width: w, height: h };

  const imgStyle = (scale) => ({
    width: crop.width * scale,
    height: crop.height * scale,
    left: crop.x * scale,
    top: crop.y * scale,
  });

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !saving && onCancel()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="photo-editor-title">
        <div className="card-header">
          <div>
            <h2 id="photo-editor-title">Adjust profile photo</h2>
            <p>Drag to move · scroll or pinch to zoom</p>
          </div>
          <button className="icon-btn modal-close" onClick={onCancel} disabled={saving} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="modal-body photo-editor">
          {error && (
            <div className="alert alert-danger" style={{ width: '100%', marginBottom: 0 }}>
              <Icon name="x" size={16} />
              {error}
            </div>
          )}
          <div
            ref={viewRef}
            className="crop-view"
            style={{ width: VIEW, height: VIEW }}
            tabIndex={0}
            aria-label="Photo position. Use arrow keys to move, plus and minus to zoom."
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={onViewKey}
          >
            <img src={image.src} alt="" draggable={false} style={imgStyle(1)} />
            <div className="crop-mask" />
          </div>

          <div className="zoom-row">
            <button className="icon-btn" onClick={() => setView((v) => zoomAround(v, v.zoom / 1.2))} aria-label="Zoom out">
              <Icon name="zoomOut" size={18} />
            </button>
            <input
              type="range"
              min={MIN_ZOOM}
              max={MAX_ZOOM}
              step={0.01}
              value={view.zoom}
              onChange={(e) => {
                const z = Number(e.target.value);
                setView((v) => zoomAround(v, z));
              }}
              aria-label="Zoom"
            />
            <button className="icon-btn" onClick={() => setView((v) => zoomAround(v, v.zoom * 1.2))} aria-label="Zoom in">
              <Icon name="zoomIn" size={18} />
            </button>
          </div>

          <div className="preview-row">
            <span className="hint">Preview</span>
            {PREVIEWS.map((p) => (
              <span key={p} className="crop-preview" style={{ width: p, height: p }}>
                <img src={image.src} alt="" style={imgStyle(p / VIEW)} />
              </span>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-light" onClick={() => setView(START)} disabled={saving}>
            <Icon name="refresh" size={14} />
            Reset
          </button>
          <div className="header-spacer" />
          <button className="btn btn-light" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onSave(() => exportCrop(image, crop))} disabled={saving}>
            <Icon name="check" size={15} />
            {saving ? 'Saving…' : 'Save photo'}
          </button>
        </div>
      </div>
    </div>
  );
}

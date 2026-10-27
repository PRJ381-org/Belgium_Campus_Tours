/**
 * Low-power mode for the landing page.
 *
 * Slow phones and laptops keep every animation, just at lower quality: the orb
 * renders at a lower resolution with fewer vertices, the starfield has fewer
 * stars, and the frosted-glass blur is swapped for a solid tint.
 *
 * A device counts as low-power when:
 *  - it says so up front (2 CPU cores or less, 2 GB of memory or less, or
 *    Data Saver turned on), or
 *  - the page measurably stutters: the typical frame takes longer than ~25 ms
 *    (under ~40 fps) shortly after load. Phones in battery-saver mode, which
 *    cap the frame rate at 30 fps, land here too.
 *
 * Add ?lowpower to the URL to force it on for testing.
 */
const listeners = new Set();
let low = false;

function enable() {
  if (low) return;
  low = true;
  document.documentElement.classList.add('low-power');
  listeners.forEach((fn) => fn());
}

export const isLowPower = () => low;

/** Calls fn once when the page switches to low-power mode (or now, if it already has). Returns an unsubscribe. */
export function onLowPower(fn) {
  if (low) {
    fn();
    return () => {};
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function detect() {
  const params = new URLSearchParams(window.location.search);
  const cores = navigator.hardwareConcurrency || 8;
  const memory = navigator.deviceMemory || 8;
  if (params.has('lowpower') || cores <= 2 || memory <= 2 || navigator.connection?.saveData) {
    enable();
    return;
  }

  // Watch ~90 frames once the page has settled. The median ignores one-off
  // hiccups such as three.js starting up; only steady stutter counts.
  const SAMPLES = 90;
  const times = [];
  let last = 0;
  const sample = (now) => {
    if (document.hidden) {
      // Background tabs throttle frames - wait until the page is visible.
      last = 0;
      requestAnimationFrame(sample);
      return;
    }
    if (last) times.push(now - last);
    last = now;
    if (times.length < SAMPLES) {
      requestAnimationFrame(sample);
      return;
    }
    times.sort((a, b) => a - b);
    if (times[SAMPLES >> 1] > 25) enable();
  };
  setTimeout(() => requestAnimationFrame(sample), 1500);
}

detect();

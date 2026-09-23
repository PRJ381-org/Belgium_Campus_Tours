/**
 * Light/dark theme, remembered per browser.
 *
 * The choice is 'light', 'dark' or 'system' (follow the OS). It's applied as
 * <html data-theme="light|dark">, which the dashboard CSS keys its colour
 * tokens off.
 */
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'dashboard-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

export function getThemeChoice() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    // Storage blocked (private mode etc.) - fall through to the default.
  }
  return 'light';
}

function resolve(choice) {
  if (choice === 'system') return media.matches ? 'dark' : 'light';
  return choice;
}

export function applyTheme(choice = getThemeChoice()) {
  document.documentElement.dataset.theme = resolve(choice);
}

/**
 * React hook: returns [choice, setChoice, resolvedTheme].
 */
export function useTheme() {
  const [choice, setChoiceState] = useState(getThemeChoice);
  const [resolved, setResolved] = useState(() => resolve(choice));

  useEffect(() => {
    const update = () => {
      const next = resolve(choice);
      document.documentElement.dataset.theme = next;
      setResolved(next);
    };
    update();
    if (choice !== 'system') return undefined;
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [choice]);

  const setChoice = (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not persisted, but still applied for this visit.
    }
    setChoiceState(next);
  };

  return [choice, setChoice, resolved];
}

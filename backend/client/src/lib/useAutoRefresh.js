import { useEffect, useRef } from 'react';

/**
 * Calls `refresh` every `ms` (also while the tab is in the background -
 * browsers slow background timers to about once a minute anyway) and straight
 * away when the visitor comes back to the tab, so data is never stale.
 * Pass `enabled: false` to pause it (e.g. while a faster "live" mode is on).
 */
export default function useAutoRefresh(refresh, ms = 60000, enabled = true) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled) return undefined;
    const run = () => refreshRef.current();
    const onVisible = () => {
      if (!document.hidden) run();
    };

    const timer = setInterval(run, ms);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [ms, enabled]);
}

/**
 * Prefixes the browser tab title with a count, e.g. "(2) Virtual Campus Open Day",
 * so a reply is noticeable even from another tab.
 */
export function useTitleCount(count) {
  const baseRef = useRef(null);

  useEffect(() => {
    if (baseRef.current === null) baseRef.current = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = count > 0 ? `(${count}) ${baseRef.current}` : baseRef.current;
  }, [count]);

  useEffect(
    () => () => {
      if (baseRef.current !== null) document.title = baseRef.current;
    },
    []
  );
}

import { useEffect, useRef } from 'react';

interface AutoRefreshOptions {
  /** Optional background polling interval in milliseconds (only runs when tab is visible) */
  intervalMs?: number;
  /** Whether the auto-refresh behavior is active (defaults to true) */
  enabled?: boolean;
}

/**
 * Reusable hook that revalidates data when:
 * 1. The user switches back to or focuses the browser tab ('focus' / 'visibilitychange')
 * 2. Optionally on a gentle interval ONLY when the tab is actively visible.
 */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  options?: AutoRefreshOptions,
) {
  const { intervalMs = 0, enabled = true } = options || {};
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const lastRunRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!enabled) return;

    const runIfVisible = (throttleMs = 2000) => {
      if (
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        const now = Date.now();
        // Prevent firing multiple times if user rapidly alt-tabs
        if (now - lastRunRef.current >= throttleMs) {
          lastRunRef.current = now;
          void callbackRef.current();
        }
      }
    };

    // Revalidate on tab focus & visibility change
    const handleFocus = () => runIfVisible(1500);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runIfVisible(1500);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Optional background interval polling while tab is active
    let intervalId: any = null;
    if (intervalMs > 0) {
      intervalId = setInterval(() => {
        runIfVisible(Math.max(1000, intervalMs - 500));
      }, intervalMs);
    }

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (intervalId) clearInterval(intervalId);
    };
  }, [intervalMs, enabled]);
}

import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 72;  // px to trigger refresh
const MAX_PULL  = 110; // max visual pull distance
const RESIST    = 0.45; // pull resistance factor

export function usePullToRefresh(
  scrollRef: React.RefObject<HTMLElement | null>,
  onRefresh: () => Promise<void>,
) {
  const [pullY, setPullY]         = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let startY    = 0;
    let active    = false;
    let currentPull = 0;

    function onTouchStart(e: TouchEvent) {
      if (!el || el.scrollTop > 0) return;
      startY  = e.touches[0].clientY;
      active  = false;
      currentPull = 0;
    }

    function onTouchMove(e: TouchEvent) {
      const delta = e.touches[0].clientY - startY;
      if (delta <= 4) return;
      active = true;
      currentPull = Math.min(delta * RESIST, MAX_PULL);
      setPullY(currentPull);
      // prevent page scroll while pulling
      if (el && el.scrollTop === 0) e.preventDefault();
    }

    function onTouchEnd() {
      if (!active) return;
      active = false;
      if (currentPull >= THRESHOLD) {
        setRefreshing(true);
        setPullY(THRESHOLD);
        onRefreshRef.current().finally(() => {
          setRefreshing(false);
          setPullY(0);
        });
      } else {
        setPullY(0);
      }
      currentPull = 0;
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove',  onTouchMove,  { passive: false });
    el.addEventListener('touchend',   onTouchEnd,   { passive: true });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove',  onTouchMove);
      el.removeEventListener('touchend',   onTouchEnd);
    };
  }, [scrollRef]);

  return { pullY, refreshing };
}

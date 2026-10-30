import { useEffect, useState, type RefObject } from 'react';

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}
export function useCompactCalendar(ref: RefObject<HTMLElement>) {
  const [compact, setCompact] = useState(() => window.innerWidth < 900);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setCompact((element.getBoundingClientRect().width || window.innerWidth) < 900);
    update();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return compact;
}

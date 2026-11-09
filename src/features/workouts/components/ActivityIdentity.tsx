import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { resolveActivityIdentity, type ActivityCatalog } from '../services/activityIdentity';

type Props = { sport?: string; activities?: ActivityCatalog; compact?: boolean; tooltipOpen?: boolean };
export function ActivityIdentity({ sport, activities, compact = false, tooltipOpen = false }: Props) {
  const { name, Icon } = resolveActivityIdentity(sport, activities);
  const [hovered, setHovered] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const visible = compact && (hovered || tooltipOpen) && !dismissed;
  function positionTooltip() {
    setAlignRight((anchor.current?.getBoundingClientRect().left || 0) + 210 > window.innerWidth - 8);
  }
  useLayoutEffect(() => {
    if (tooltipOpen) { positionTooltip(); setDismissed(false); }
  }, [tooltipOpen]);
  useEffect(() => {
    if (!visible) return;
    function dismiss(event: KeyboardEvent) { if (event.key === 'Escape') setDismissed(true); }
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, [visible]);
  return <span ref={anchor} className={`activity-identity${compact ? ' activity-identity-compact' : ''}`}
    onMouseEnter={() => { positionTooltip(); setDismissed(false); setHovered(true); }} onMouseLeave={() => setHovered(false)}>
    <span className="activity-identity-icon" role={compact ? 'img' : undefined} aria-label={compact ? `Activity: ${name}` : undefined}>
      <Icon size={compact ? 16 : 18} aria-hidden="true" />
    </span>
    {!compact && <span>{name}</span>}
    {visible && <span className={`activity-identity-tooltip${alignRight ? " activity-identity-tooltip-right" : ""}`} role="tooltip" aria-hidden="true">{name}</span>}
  </span>;
}

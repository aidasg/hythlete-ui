import { useId, useState, type ReactNode } from "react";
import { detailedMusclePaths, type MuscleView } from "./muscleBreakdownData";
import type { BodyRegionState } from "./bodyStateMapping";
import { getBandCssValue, getBandFromReadinessScore } from "@/features/workouts/services/trainingStateDisplay";
import { loadBandLabels } from "./bodyPresentation";

export type MuscleKey = string;
export type MuscleColorMap = Partial<Record<MuscleKey, string>>;
export type BodyStateMap = Partial<Record<MuscleKey, BodyRegionState>>;
export type BodyOverlay = { id: string; name: string; label: string; color: string; view: MuscleView; points: [number, number][]; reported?: boolean; number?: number };
type Props = {
  muscleColors?: MuscleColorMap; muscleStrokeColors?: MuscleColorMap; bodyState?: BodyStateMap;
  selectedMuscle?: MuscleKey; selectedMuscles?: MuscleKey[]; onMuscleSelect?: (muscle: MuscleKey) => void;
  pathLabels?: Record<string, string>; overlays?: BodyOverlay[];
  selectedOverlay?: string; onOverlaySelect?: (id: string) => void; interactiveMuscles?: boolean;
};
export function MuscleBreakdownFigure({ muscleColors = {}, muscleStrokeColors = {}, bodyState = {}, selectedMuscle, selectedMuscles = [], onMuscleSelect, pathLabels, overlays = [], selectedOverlay, onOverlaySelect, interactiveMuscles = true }: Props) {
  const uid = useId();
  const [hover, setHover] = useState("");
  function activate(event: React.KeyboardEvent<SVGGElement>, callback: () => void) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); callback(); }
  }
  function view(side: MuscleView): ReactNode {
    const width = side === "front" ? 948 : 1097;
    const height = side === "front" ? 2388 : 2394;
    return <figure className="muscle-view-panel" key={side}>
      <svg className="muscle-figure muscle-figure-detailed" viewBox={`0 0 ${width} ${height}`} role="group" aria-labelledby={`${uid}-${side}`}>
        <title id={`${uid}-${side}`}>{side === "front" ? "Front" : "Back"} body map</title>
        {detailedMusclePaths.filter(m => m.view === side).map(m => {
          const state = bodyState[m.key];
          const isSelected = selectedMuscle === m.key || selectedMuscles.includes(m.key);
          const interactive = interactiveMuscles && (pathLabels === undefined || !!pathLabels[m.key]);
          const text = pathLabels?.[m.key] || `${m.groupName}: ${loadBandLabels[getBandFromReadinessScore(state?.readiness)]}`;
          const fill = muscleColors[m.key] || getBandCssValue(getBandFromReadinessScore(state?.readiness));
          return <g key={m.key} aria-hidden={!interactive || undefined} role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined}
            aria-label={interactive ? text : undefined} aria-pressed={interactive ? isSelected : undefined}
            onClick={() => interactive && onMuscleSelect?.(m.key)}
            onKeyDown={e => interactive && activate(e, () => onMuscleSelect?.(m.key))}
            onFocus={() => setHover(text)} onMouseEnter={() => setHover(text)} onBlur={() => setHover("")} onMouseLeave={() => setHover("")}>
            <title>{text}</title><path className="muscle-shape detailed-muscle-path" d={m.d} fill={fill} fillOpacity={isSelected ? 0.65 : 0.4}
              stroke={isSelected ? "#c9f5ff" : muscleStrokeColors[m.key] || fill} strokeWidth={muscleStrokeColors[m.key] || isSelected ? 3 : 1} vectorEffect="non-scaling-stroke" />
          </g>;
        })}
        {overlays.filter(o => o.view === side).flatMap(o => o.points.map(([x, y], i) => <g key={`${o.id}-${i}`} role="button" tabIndex={0}
          aria-label={`${o.name}: ${o.label}${o.reported ? "; reported issue" : ""}`} aria-pressed={selectedOverlay === o.id}
          onClick={() => onOverlaySelect?.(o.id)} onKeyDown={e => activate(e, () => onOverlaySelect?.(o.id))}
          onFocus={() => setHover(`${o.name}: ${o.label}`)} onMouseEnter={() => setHover(`${o.name}: ${o.label}`)} onBlur={() => setHover("")} onMouseLeave={() => setHover("")}>
          <title>{o.name}: {o.label}</title>
          <circle cx={width*x/100} cy={height*y/100} r={58} fill="transparent" />
          <circle cx={width*x/100} cy={height*y/100} r={44} fill={o.color} stroke={selectedOverlay === o.id ? "#ffffff" : "#111c30"} strokeWidth={selectedOverlay === o.id ? 9 : 5} />
          <text x={width*x/100} y={height*y/100+16} textAnchor="middle" fontSize={48} fill="#07101e" fontWeight="bold" aria-hidden="true">{o.number}</text>
          {o.reported && <text x={width*x/100+51} y={height*y/100-32} textAnchor="middle" fontSize={68} fill="#edb56a" fontWeight="bold" aria-hidden="true">!</text>}
        </g>))}
      </svg><figcaption className="muscle-view-label">{side === "front" ? "Front" : "Back"}</figcaption>
    </figure>;
  }
  return <div className="muscle-figure-shell"><div className="muscle-figure-views">{view("front")}{view("back")}</div><p className="body-map-hover" aria-live="polite">{hover || "Select an area on the map or in the list."}</p></div>;
}

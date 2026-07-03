import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useRef,
  useState,
} from "react";
import {
  detailedMusclePaths,
  type MusclePath,
  type MuscleView,
} from "@/features/dashboard/components/muscleBreakdownData";
import type { BodyRegionState } from "@/features/dashboard/components/bodyStateMapping";
import {
  getBandCssValue,
  getBandFromReadinessScore,
} from "@/features/workouts/services/trainingStateDisplay";

export type MuscleKey = string;
export type MuscleColorMap = Partial<Record<MuscleKey, string>>;
export type BodyStateMap = Partial<Record<MuscleKey, BodyRegionState>>;

type MuscleBreakdownFigureProps = {
  muscleColors?: MuscleColorMap;
  muscleStrokeColors?: MuscleColorMap;
  bodyState?: BodyStateMap;
  selectedMuscle?: MuscleKey;
  onMuscleSelect?: (muscle: MuscleKey) => void;
};

type TooltipState = {
  muscle: MusclePath;
  x: number;
  y: number;
};

type MuscleViewConfig = {
  view: MuscleView;
  label: string;
  title: string;
  viewBox: string;
  className?: string;
};

const selectedStroke = "rgba(139, 233, 247, 0.95)";

const muscleViews: MuscleViewConfig[] = [
  {
    view: "front",
    label: "Front",
    title: "Detailed front muscle map",
    viewBox: "0 0 948 2388",
  },
  {
    view: "back",
    label: "Back",
    title: "Detailed back muscle map",
    viewBox: "0 0 1097 2394",
    className: "muscle-figure-detailed-back",
  },
];

function getReadinessColor(readiness: number) {
  return getBandCssValue(getBandFromReadinessScore(readiness));
}

function getAccessibleName(muscle: MusclePath, state: BodyRegionState | undefined) {
  const readiness = state?.readiness ?? muscle.readiness;

  return `${muscle.side} ${muscle.scientificName}, ${muscle.groupName}, ${readiness} body state`;
}

function formatLoad(value: number | undefined) {
  return typeof value === "number" ? value.toFixed(1) : "0.0";
}

export function MuscleBreakdownFigure({
  muscleColors = {},
  muscleStrokeColors = {},
  bodyState = {},
  selectedMuscle,
  onMuscleSelect,
}: MuscleBreakdownFigureProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function handleKeyDown(event: KeyboardEvent<SVGGElement>, muscle: MuscleKey) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onMuscleSelect?.(muscle);
    }
  }

  function updateTooltipPosition(
    event: MouseEvent<SVGGElement>,
    muscle: MusclePath
  ) {
    const bounds = shellRef.current?.getBoundingClientRect();

    if (!bounds) {
      return;
    }

    setTooltip({
      muscle,
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    });
  }

  function updateTooltipForFocus(
    event: FocusEvent<SVGGElement>,
    muscle: MusclePath
  ) {
    const shellBounds = shellRef.current?.getBoundingClientRect();
    const targetBounds = event.currentTarget.getBoundingClientRect();

    if (!shellBounds) {
      return;
    }

    setTooltip({
      muscle,
      x: targetBounds.left - shellBounds.left + targetBounds.width / 2,
      y: targetBounds.top - shellBounds.top + targetBounds.height / 2,
    });
  }

  function renderMusclePath(muscle: MusclePath): ReactNode {
    const state = bodyState[muscle.key];
    const readiness = state?.readiness ?? muscle.readiness;
    const isSelected = selectedMuscle === muscle.key;
    const fill = muscleColors[muscle.key] || getReadinessColor(readiness);
    const customStroke = muscleStrokeColors[muscle.key];
    const stroke = customStroke || fill;

    return (
      <g
        key={muscle.key}
        role="button"
        tabIndex={0}
        aria-label={getAccessibleName(muscle, state)}
        onClick={() => onMuscleSelect?.(muscle.key)}
        onFocus={(event) => updateTooltipForFocus(event, muscle)}
        onMouseEnter={(event) => updateTooltipPosition(event, muscle)}
        onMouseMove={(event) => updateTooltipPosition(event, muscle)}
        onMouseLeave={() => setTooltip(null)}
        onBlur={() => setTooltip(null)}
        onKeyDown={(event) => handleKeyDown(event, muscle.key)}
      >
        <title>{getAccessibleName(muscle, state)}</title>
        <path
          className="muscle-shape detailed-muscle-path"
          d={muscle.d}
          fill={fill}
          fillOpacity={isSelected ? 0.28 : 0.16}
          pointerEvents="all"
          stroke={stroke}
          strokeWidth={
            customStroke ? (isSelected ? 5.6 : 4.6) : isSelected ? 3.5 : 2.4
          }
          vectorEffect="non-scaling-stroke"
        />
        {isSelected && (
          <path
            className="detailed-muscle-selection"
            d={muscle.d}
            fill="none"
            stroke={selectedStroke}
            strokeWidth={4}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </g>
    );
  }

  function renderMuscleView(viewConfig: MuscleViewConfig) {
    const muscles = detailedMusclePaths.filter(
      (muscle) => muscle.view === viewConfig.view
    );
    const titleId = `muscle-figure-${viewConfig.view}-title`;

    return (
      <figure className="muscle-view-panel" key={viewConfig.view}>
        <svg
          className={[
            "muscle-figure",
            "muscle-figure-detailed",
            viewConfig.className,
          ]
            .filter(Boolean)
            .join(" ")}
          viewBox={viewConfig.viewBox}
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>{viewConfig.title}</title>
          <g className="detailed-muscle-map">{muscles.map(renderMusclePath)}</g>
        </svg>
        <figcaption className="muscle-view-label">{viewConfig.label}</figcaption>
      </figure>
    );
  }

  return (
    <div className="muscle-figure-shell" ref={shellRef}>
      <div className="muscle-figure-views">
        {muscleViews.map(renderMuscleView)}
      </div>

      {tooltip && (
        <div
          className="muscle-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
          role="status"
        >
          <strong>
            {tooltip.muscle.side} {tooltip.muscle.scientificName}
          </strong>
          <span>{tooltip.muscle.groupName}</span>
          <small>
            Acute load{" "}
            {formatLoad(bodyState[tooltip.muscle.key]?.acuteLoad)} / Readiness{" "}
            {bodyState[tooltip.muscle.key]?.readiness ?? tooltip.muscle.readiness}
          </small>
        </div>
      )}
    </div>
  );
}

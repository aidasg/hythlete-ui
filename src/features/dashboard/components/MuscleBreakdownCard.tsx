import { useMemo, useState } from "react";
import {
  MuscleBreakdownFigure,
  type MuscleColorMap,
  type MuscleKey,
  type MuscleReadinessMap,
} from "@/features/dashboard/components/MuscleBreakdownFigure";
import { detailedMusclePaths } from "@/features/dashboard/components/muscleBreakdownData";

function getLoadColor(load: number) {
  if (load >= 75) {
    return "rgba(184, 167, 255, 0.86)";
  }

  if (load >= 55) {
    return "rgba(139, 233, 247, 0.76)";
  }

  return "rgba(174, 184, 214, 0.54)";
}

export function MuscleBreakdownCard() {
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleKey>(
    "front:R rectus femoris"
  );
  const muscleReadiness = useMemo<MuscleReadinessMap>(
    () =>
      detailedMusclePaths.reduce<MuscleReadinessMap>((readiness, muscle) => {
        readiness[muscle.key] = muscle.readiness;
        return readiness;
      }, {}),
    []
  );
  const muscleColors = useMemo<MuscleColorMap>(
    () =>
      detailedMusclePaths.reduce<MuscleColorMap>((colors, muscle) => {
        colors[muscle.key] = getLoadColor(muscle.readiness);
        return colors;
      }, {}),
    []
  );

  return (
    <section className="dashboard-card dashboard-card-muscle">
      <div className="dashboard-card-header">
        <div>
          <span className="eyebrow">Readiness map</span>
          <h2>Muscle breakdown</h2>
        </div>
      </div>

      <div className="muscle-card-body">
        <MuscleBreakdownFigure
          muscleColors={muscleColors}
          muscleReadiness={muscleReadiness}
          selectedMuscle={selectedMuscle}
          onMuscleSelect={setSelectedMuscle}
        />
      </div>
    </section>
  );
}

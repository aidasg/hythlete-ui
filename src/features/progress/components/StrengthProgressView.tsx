import { useAuth } from "@/features/auth/context/useAuth";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Dumbbell, Loader2 } from "lucide-react";
import { getStrengthCurve } from "@/features/progress/services/progressApi";
import { formatConfidence, formatMetric } from "@/features/progress/services/progressDisplay";
import { ExerciseSearchSelect } from "@/features/workouts/components/ExerciseSearchSelect";
import { getWorkoutCatalog } from "@/features/workouts/services/workoutApi";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";
import { throwApiResponseError } from "@/services/api/errors";
import { queryKeys } from "@/services/query/queryKeys";

const chartWidth = 760;
const chartHeight = 280;
const chartPadding = { left: 54, right: 24, top: 24, bottom: 42 };

type TrendPoint = {
  date?: string;
  estimated_1rm_kg?: number;
  lower_kg?: number;
  upper_kg?: number;
};

function buildChart(points: TrendPoint[]) {
  if (!points.length) return null;
  const times = points.map((point) => new Date(`${point.date}T00:00:00`).getTime());
  const values = points.flatMap((point) => [point.lower_kg, point.upper_kg, point.estimated_1rm_kg]).filter((value): value is number => typeof value === "number");
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const minValue = Math.max(0, Math.min(...values) * 0.92);
  const maxValue = Math.max(...values) * 1.06 || 1;
  const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
  const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const x = (time: number) => chartPadding.left + ((time - minTime) / Math.max(1, maxTime - minTime)) * innerWidth;
  const y = (value: number) => chartPadding.top + (1 - (value - minValue) / Math.max(1, maxValue - minValue)) * innerHeight;
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(times[index] || minTime)},${y(point.estimated_1rm_kg || 0)}`).join(" ");
  const upper = points.map((point, index) => `${index ? "L" : "M"}${x(times[index] || minTime)},${y(point.upper_kg || point.estimated_1rm_kg || 0)}`).join(" ");
  const lower = [...points].reverse().map((point, reverseIndex) => {
    const index = points.length - reverseIndex - 1;
    return `L${x(times[index] || minTime)},${y(point.lower_kg || point.estimated_1rm_kg || 0)}`;
  }).join(" ");
  return { x, y, line, area: `${upper} ${lower} Z`, minValue, maxValue };
}

function StrengthChart({ trend, observed }: { trend: TrendPoint[]; observed: { workout_date?: string; estimated_1rm_kg?: number }[] }) {
  const chart = buildChart(trend);
  if (!chart) return <div className="strength-chart-empty"><Dumbbell size={22} /><strong>No trend points yet</strong><span>Complete loaded work sets to build a curve.</span></div>;
  const firstDate = trend[0]?.date;
  const lastDate = trend[trend.length - 1]?.date;
  return (
    <div className="strength-chart-wrap">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-labelledby="strength-chart-title strength-chart-description">
        <title id="strength-chart-title">Rolling estimated one-repetition maximum</title>
        <desc id="strength-chart-description">Trend line with lower and upper confidence bounds. Exact observations are listed below the chart.</desc>
        {[0, 0.5, 1].map((ratio) => { const value = chart.minValue + (chart.maxValue - chart.minValue) * ratio; const chartY = chart.y(value); return <g key={ratio}><line className="strength-grid-line" x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={chartY} y2={chartY} /><text x={chartPadding.left - 8} y={chartY + 4} textAnchor="end">{Math.round(value)}</text></g>; })}
        <path className="strength-confidence-area" d={chart.area} />
        <path className="strength-trend-line" d={chart.line} />
        {observed.map((point, index) => {
          if (!point.workout_date || typeof point.estimated_1rm_kg !== "number") return null;
          const time = new Date(`${point.workout_date}T00:00:00`).getTime();
          return <circle key={`${point.workout_date}-${index}`} className="strength-observation" cx={chart.x(time)} cy={chart.y(point.estimated_1rm_kg)} r="4"><title>{formatDisplayDate(point.workout_date)}: {point.estimated_1rm_kg} kg</title></circle>;
        })}
        <text x={chartPadding.left} y={chartHeight - 12}>{formatDisplayDate(firstDate)}</text>
        <text x={chartWidth - chartPadding.right} y={chartHeight - 12} textAnchor="end">{formatDisplayDate(lastDate)}</text>
      </svg>
    </div>
  );
}

export function StrengthProgressView() {
  const { session } = useAuth();
  const uid = session?.profile?.user_id;
  const [exerciseCode, setExerciseCode] = useState("");
  const catalogQuery = useQuery({
    queryKey: [...queryKeys.workouts.catalog, uid],
    enabled: !!uid,
    queryFn: async () => {
      const result = await getWorkoutCatalog();
      if (result.error) throwApiResponseError(result, "Could not load the exercise catalog.");
      return result.data;
    },
  });
  const exerciseOptions = useMemo(() => catalogQuery.data?.exercises?.flatMap((exercise) => exercise.code ? [{ code: exercise.code, name: exercise.name || exercise.code }] : []) || [], [catalogQuery.data]);
  const curveQuery = useQuery({
    queryKey: [...queryKeys.progress.strength(exerciseCode), uid],
    enabled: !!uid && Boolean(exerciseCode),
    queryFn: async () => {
      const result = await getStrengthCurve(exerciseCode);
      if (result.error) throwApiResponseError(result, "Could not load strength progress.");
      return result.data;
    },
  });
  const curve = curveQuery.data;

  return (
    <div className="strength-progress-view">
      <div className="strength-exercise-picker"><label><span>Exercise</span><ExerciseSearchSelect options={exerciseOptions} value={exerciseCode} onChange={setExerciseCode} /></label><p>Curves use recent externally loaded work sets and include uncertainty bounds.</p></div>
      {(catalogQuery.isLoading || curveQuery.isLoading) && <div className="progress-loading" role="status"><Loader2 className="spin-icon" />Loading strength evidence</div>}
      {(catalogQuery.error || curveQuery.error) && <div className="inline-state inline-state-error" role="alert"><AlertCircle size={18} />{catalogQuery.error?.message || curveQuery.error?.message}</div>}
      {!exerciseCode && !catalogQuery.isLoading && <div className="progress-select-empty"><Dumbbell size={26} /><strong>Select a loaded exercise</strong><span>Its rolling e1RM trend and predicted rep loads will appear here.</span></div>}
      {exerciseCode && curve && (
        <>
          <div className="strength-summary-grid">
            <div><span>Current e1RM</span><strong>{formatMetric(curve.current_1rm_kg, "kg")}</strong><small>{formatMetric(curve.confidence_bounds?.lower, "kg")}–{formatMetric(curve.confidence_bounds?.upper, "kg")}</small></div>
            <div><span>All-time e1RM</span><strong>{formatMetric(curve.all_time_1rm_kg, "kg")}</strong></div>
            <div><span>Training max</span><strong>{formatMetric(curve.training_max_kg, "kg")}</strong></div>
            <div><span>Evidence</span><strong>{curve.sample_count || 0} work sets</strong><small>{formatConfidence(curve.confidence)} confidence</small></div>
          </div>
          {(curve.sample_count || 0) < 3 && <div className="strength-confidence-note"><AlertCircle size={16} />Sparse data widens the returned range. Treat predicted loads as estimates.</div>}
          <StrengthChart trend={curve.trend || []} observed={curve.observed_work_sets || []} />
          {curve.reasons?.map((reason) => <p className="progress-context" key={reason}>{reason}</p>)}
          <section className="predicted-loads" aria-labelledby="predicted-loads-title"><h2 id="predicted-loads-title">Predicted rep loads</h2><div className="table-scroll"><table><thead><tr><th>Reps</th><th>Estimate</th><th>Lower</th><th>Upper</th><th>Source</th></tr></thead><tbody>{curve.predicted_loads?.map((target) => <tr key={target.reps}><td>{target.reps}</td><td>{formatMetric(target.load_kg, "kg")}</td><td>{formatMetric(target.lower_load_kg, "kg")}</td><td>{formatMetric(target.upper_load_kg, "kg")}</td><td>{target.source || "model"}</td></tr>)}</tbody></table></div></section>
          {Boolean(curve.observed_work_sets?.length) && <details className="observed-strength-details"><summary>Observed work sets ({curve.observed_work_sets?.length})</summary><div>{curve.observed_work_sets?.map((effort, index) => <div key={`${effort.workout_id}-${index}`}><strong>{formatDisplayDate(effort.workout_date)}</strong><span>{effort.reps || 0} reps × {formatMetric(effort.load_kg, "kg")}</span><small>e1RM {formatMetric(effort.estimated_1rm_kg, "kg")} · {formatConfidence(effort.confidence)}</small></div>)}</div></details>}
        </>
      )}
    </div>
  );
}

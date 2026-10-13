import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2, ShieldAlert } from "lucide-react";
import { getMuscleStimulus } from "@/features/progress/services/progressApi";
import { formatCode, formatConfidence } from "@/features/progress/services/progressDisplay";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";
import { throwApiResponseError } from "@/services/api/errors";
import { queryKeys } from "@/services/query/queryKeys";

function percent(value: number, max: number) {
  return `${Math.min(100, Math.max(0, (value / max) * 100))}%`;
}

export function MuscleStimulusView({ date }: { date: string }) {
  const query = useQuery({
    queryKey: queryKeys.progress.muscleStimulus(date),
    queryFn: async () => {
      const result = await getMuscleStimulus(date);
      if (result.error) throwApiResponseError(result, "Could not load estimated muscle stimulus.");
      return result.data;
    },
  });

  if (query.isLoading) return <div className="progress-loading" role="status"><Loader2 className="spin-icon" />Loading estimated stimulus</div>;
  if (query.error) return <div className="inline-state inline-state-error" role="alert"><AlertCircle size={18} />{query.error.message}</div>;

  return (
    <div className="muscle-stimulus-view">
      <div className="progress-summary-line"><span>Week {formatDisplayDate(query.data?.week_start)} – {formatDisplayDate(query.data?.week_end)}</span><span>{formatConfidence(query.data?.confidence)} confidence</span></div>
      <p className="progress-context">Estimated stimulus is planning guidance. The projected target does not diagnose whether a muscle is physiologically trained or undertrained.</p>
      <div className="muscle-balance-grid">
        {query.data?.groups?.map((group, index) => {
          const max = Math.max(group.projected_stimulus || 0, group.target_high || 0, group.baseline || 0, 1) * 1.12;
          return (
            <article className="muscle-balance-card" data-status={group.status} key={`${group.group_name}-${index}`}>
              <div className="muscle-balance-heading"><div><span>{formatCode(group.region)} · {formatCode(group.role)}</span><h3>{group.group_name || "Muscle group"}</h3></div><span>{formatCode(group.status)}</span></div>
              {group.status === "recovering" && <div className="recovering-override"><ShieldAlert size={15} />Recovery guidance overrides additional stimulus.</div>}
              <div className="stimulus-scale" aria-label={`${group.group_name} estimated stimulus`}>
                <div className="stimulus-target" style={{ left: percent(group.target_low || 0, max), width: percent(Math.max(0, (group.target_high || 0) - (group.target_low || 0)), max) }} />
                <div className="stimulus-current" style={{ width: percent(group.current_stimulus || 0, max) }} />
                <span className="stimulus-projected" style={{ left: percent(group.projected_stimulus || 0, max) }} />
                <span className="stimulus-baseline" style={{ left: percent(group.baseline || 0, max) }} />
              </div>
              <div className="stimulus-legend"><span>Current <strong>{group.current_stimulus || 0}</strong></span><span>Projected <strong>{group.projected_stimulus || 0}</strong></span><span>Projected target <strong>{group.target_low || 0}–{group.target_high || 0}</strong></span><span>Baseline <strong>{group.baseline || 0}</strong></span></div>
              <small>{formatConfidence(group.confidence)} confidence</small>
              {group.reasons?.map((reason) => <p key={reason}>{reason}</p>)}
            </article>
          );
        })}
      </div>
      {!query.data?.groups?.length && <p className="empty-copy">No muscle stimulus evidence is available yet.</p>}
    </div>
  );
}

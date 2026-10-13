import { commonName } from "@/components/body/bodyPresentation";
import { useAuth } from "@/features/auth/context/useAuth";
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
  const { session } = useAuth();
  const query = useQuery({
    queryKey: [...queryKeys.progress.muscleStimulus(date), session?.profile?.user_id],
    enabled: !!session?.profile?.user_id,
    queryFn: async () => {
      const result = await getMuscleStimulus(date);
      if (result.error) throwApiResponseError(result, "Could not load muscle training.");
      return result.data;
    },
  });

  if (query.isLoading) return <div className="progress-loading" role="status"><Loader2 className="spin-icon" />Loading muscle training</div>;
  if (query.error) return <div className="inline-state inline-state-error" role="alert"><AlertCircle size={18} />{query.error.message}</div>;

  return (
    <div className="muscle-stimulus-view">
      <div className="progress-summary-line"><span>Week {formatDisplayDate(query.data?.week_start)} – {formatDisplayDate(query.data?.week_end)}</span><span>{formatConfidence(query.data?.confidence)} confidence</span></div>
      <p className="progress-context">See what you have done this week and what your planned sessions would add. Targets are estimates based on your training.</p>
      <div className="muscle-balance-grid">
        {query.data?.groups?.map((group, index) => {
          const max = Math.max(group.projected_stimulus || 0, group.target_high || 0, group.baseline || 0, 1) * 1.12;
          return (
            <article className="muscle-balance-card" data-status={group.status} key={`${group.group_name}-${index}`}>
              <div className="muscle-balance-heading"><div><h3>{commonName(group.group_name?.toLowerCase() || "", group.group_name || "Muscle group")}</h3></div></div>
              {group.status === "recovering" && <div className="recovering-override"><ShieldAlert size={15} />Give this area time to recover before adding more work.</div>}
              <div className="stimulus-scale" aria-label={`${group.group_name} estimated training`}>
                <div className="stimulus-target" style={{ left: percent(group.target_low || 0, max), width: percent(Math.max(0, (group.target_high || 0) - (group.target_low || 0)), max) }} />
                <div className="stimulus-current" style={{ width: percent(group.current_stimulus || 0, max) }} />
                <span className="stimulus-projected" style={{ left: percent(group.projected_stimulus || 0, max) }} />
                <span className="stimulus-baseline" style={{ left: percent(group.baseline || 0, max) }} />
              </div>
              <div className="stimulus-legend"><span>Done this week <strong>{group.current_stimulus || 0}</strong></span><span>Including planned sessions <strong>{group.projected_stimulus || 0}</strong></span><span>Weekly target <strong>{group.target_low || 0}–{group.target_high || 0}</strong></span><span>Your usual amount <strong>{group.baseline || 0}</strong></span></div>
              <details><summary>Details</summary><p>{formatCode(group.region)} · {formatCode(group.role)} · {formatCode(group.status)}</p><small>{formatConfidence(group.confidence)} confidence</small>
              {group.reasons?.map((reason) => <p key={reason}>{reason}</p>)}</details>
            </article>
          );
        })}
      </div>
      {!query.data?.groups?.length && <p className="empty-copy">No muscle training data is available yet.</p>}
    </div>
  );
}

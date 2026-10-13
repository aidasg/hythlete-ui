import { useAuth } from "@/features/auth/context/useAuth";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, Loader2, Target, X } from "lucide-react";
import { Link } from "react-router-dom";
import {
  listBreakthroughs,
  updateBreakthrough,
  type BreakthroughResponse,
} from "@/features/progress/services/progressApi";
import { formatCode, formatConfidence, formatMetric } from "@/features/progress/services/progressDisplay";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";
import { ApiResponseError, throwApiResponseError } from "@/services/api/errors";
import { queryKeys } from "@/services/query/queryKeys";
import { invalidateStrategyAndProgress } from "@/services/query/invalidation";
import { paths } from "@/routes/paths";

const currentStatuses = new Set(["suggested", "accepted"]);

function BreakthroughCard({ item, onStatus }: { item: BreakthroughResponse; onStatus: (item: BreakthroughResponse, status: "accepted" | "dismissed") => void }) {
  return (
    <article className="breakthrough-card" data-status={item.status}>
      <div className="breakthrough-card-heading"><div><span>{formatCode(item.status)} · {formatCode(item.capability_code)}</span><h3>{item.title || "Breakthrough"}</h3></div><span className="confidence-chip">{formatConfidence(item.confidence)}</span></div>
      <div className="breakthrough-target"><strong>{formatMetric(item.baseline_value, item.unit)}</strong><span>→</span><strong>{formatMetric(item.target_value, item.unit)}</strong></div>
      <dl className="breakthrough-meta"><div><dt>Metric</dt><dd>{formatCode(item.metric)}</dd></div><div><dt>Direction</dt><dd>{formatCode(item.direction)}</dd></div><div><dt>Valid until</dt><dd>{formatDisplayDate(item.valid_until)}</dd></div><div><dt>Attempts</dt><dd>{item.attempt_count || 0}</dd></div></dl>
      {item.reasons?.map((reason) => <p key={reason}>{reason}</p>)}
      {Boolean(item.evidence?.length) && <details><summary>Evidence ({item.evidence?.length})</summary><div className="breakthrough-evidence">{item.evidence?.map((evidence, index) => <div key={`${evidence.metric}-${evidence.date}-${index}`}><strong>{formatMetric(evidence.value, evidence.unit)}</strong><span>{formatCode(evidence.metric)}</span><small>{formatDisplayDate(evidence.date)} · {formatCode(evidence.source)}</small></div>)}</div></details>}
      <div className="breakthrough-card-actions">
        {item.status === "suggested" && <button type="button" className="primary-button" onClick={() => onStatus(item, "accepted")}><Target size={15} />Accept</button>}
        {(item.status === "suggested" || item.status === "accepted") && <button type="button" className="secondary-button" onClick={() => onStatus(item, "dismissed")}><X size={15} />Dismiss</button>}
        {item.status === "achieved" && typeof item.achievement_workout_id === "number" && <Link className="secondary-button" to={`${paths.workouts}?workout=${item.achievement_workout_id}`}><Check size={15} />View achievement workout</Link>}
      </div>
    </article>
  );
}

export function BreakthroughsView() {
  const { session } = useAuth();
  const uid = session?.profile?.user_id;
  const queryClient = useQueryClient();
  const [conflict, setConflict] = useState<{ requested: BreakthroughResponse; accepted: BreakthroughResponse } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const query = useQuery({
    queryKey: [...queryKeys.progress.breakthroughs(), uid],
    enabled: !!uid,
    queryFn: async () => {
      const result = await listBreakthroughs();
      if (result.error) throwApiResponseError(result, "Could not load breakthroughs.");
      return result.data;
    },
  });
  async function invalidate() {
    await invalidateStrategyAndProgress(queryClient);
  }
  const mutation = useMutation({
    mutationFn: async ({ item, status }: { item: BreakthroughResponse; status: "accepted" | "dismissed" }) => {
      if (typeof item.id !== "number") throw new Error("This breakthrough has no id.");
      const result = await updateBreakthrough(item.id, status);
      if (result.error) throw new ApiResponseError(result.response.status, result.error.error || "Could not update the breakthrough.");
      return result.data;
    },
    onSuccess: async () => { setErrorMessage(null); setConflict(null); await invalidate(); },
    onError: async (error, variables) => {
      if (error instanceof ApiResponseError && error.status === 409 && variables.status === "accepted") {
        const accepted = await listBreakthroughs("accepted");
        if (!accepted.error && accepted.data[0]) setConflict({ requested: variables.item, accepted: accepted.data[0] });
        setErrorMessage("Only one breakthrough can be accepted at a time.");
        return;
      }
      setErrorMessage(error.message);
    },
  });
  async function replaceAccepted() {
    if (!conflict || typeof conflict.accepted.id !== "number") return;
    setErrorMessage(null);
    try {
      const result = await updateBreakthrough(conflict.accepted.id, "dismissed");
      if (result.error) {
        throwApiResponseError(result, "Could not dismiss the current breakthrough.");
      }
      mutation.mutate({ item: conflict.requested, status: "accepted" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not replace the current breakthrough.");
    }
  }

  if (query.isLoading) return <div className="progress-loading" role="status"><Loader2 className="spin-icon" />Loading breakthroughs</div>;
  if (query.error) return <div className="inline-state inline-state-error" role="alert"><AlertCircle size={18} />{query.error.message}</div>;
  const current = query.data?.filter((item) => currentStatuses.has(item.status || "")) || [];
  const history = query.data?.filter((item) => !currentStatuses.has(item.status || "")) || [];

  return (
    <div className="breakthroughs-view">
      {errorMessage && !conflict && <div className="inline-state inline-state-error" role="alert"><AlertCircle size={18} />{errorMessage}</div>}
      <section className="breakthrough-section"><div><h2>Current opportunities</h2><p>Choose at most one accepted target at a time.</p></div>{current.length ? <div className="breakthrough-grid">{current.map((item, index) => <BreakthroughCard key={item.id || index} item={item} onStatus={(target, status) => mutation.mutate({ item: target, status })} />)}</div> : <p className="empty-copy">No current breakthrough opportunity was returned.</p>}</section>
      <section className="breakthrough-section"><div><h2>History</h2><p>Achieved, dismissed, and expired targets remain explainable.</p></div>{history.length ? <div className="breakthrough-grid">{history.map((item, index) => <BreakthroughCard key={item.id || index} item={item} onStatus={(target, status) => mutation.mutate({ item: target, status })} />)}</div> : <p className="empty-copy">No breakthrough history yet.</p>}</section>
      {conflict && <WorkoutModal eyebrow="Breakthrough conflict" title="Keep one active target" onClose={() => setConflict(null)}><div className="breakthrough-conflict"><p>{errorMessage}</p><article><span>Currently accepted</span><strong>{conflict.accepted.title}</strong><small>Valid until {formatDisplayDate(conflict.accepted.valid_until)}</small></article><div className="modal-action-row"><button type="button" className="secondary-button" onClick={() => setConflict(null)}>Keep current</button><button type="button" className="primary-button" onClick={() => void replaceAccepted()}>Dismiss current & accept new</button></div></div></WorkoutModal>}
    </div>
  );
}

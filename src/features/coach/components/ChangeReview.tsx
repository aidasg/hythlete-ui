import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCoach } from "../context/coachContext";
import { decideCoachChange, reviewCoachChange, type ChangeDecision } from "../services/changeApi";
import { trainingChangeAppliedEvent, invalidateWorkoutDerivedData } from "@/services/query/invalidation";
import { queryKeys } from "@/services/query/queryKeys";

function displayValue(value: unknown) {
  if (value == null || value === "") return "—";
  return typeof value === "object" ? <pre>{JSON.stringify(value, null, 2)}</pre> : String(value);
}

const statusLabels: Record<string, string> = {
  pending: "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  stale: "Training records changed. Ask for a fresh preview.",
};

export function ChangeReview({ id }: { id: number }) {
  const coach = useCoach();
  const client = useQueryClient();
  const baseKey = ["coach", coach?.userID, "changes"] as const;
  const key = [...baseKey, id];
  const review = useQuery({ queryKey: key, queryFn: () => reviewCoachChange(id), retry: false });
  const decision = useMutation({
    mutationFn: (value: ChangeDecision) => decideCoachChange(id, value, review.data?.review_token || ""),
    onSuccess: async change => {
      client.setQueryData(key, { change });
      if (change.status === "approved") {
        window.dispatchEvent(new Event(trainingChangeAppliedEvent));
        await Promise.all([
          invalidateWorkoutDerivedData(client),
          client.invalidateQueries({ queryKey: queryKeys.strategy.all }),
          client.invalidateQueries({ queryKey: queryKeys.progress.all }),
        ]);
      }
      await client.invalidateQueries({ queryKey: baseKey });
    },
    onError: async () => {
      await review.refetch();
    },
  });
  const change = review.data?.change;
  if (review.isPending) return <p role="status">Loading training change…</p>;
  if (review.error || !change) return <p role="alert">Could not load this training change.</p>;

  return <article className="coach-proposal coach-change-review" aria-label="Training change review">
    <h3>Review training change</h3>
    <p>{change.source === "mcp" ? "External AI connection" : "AI Coach"}</p>
    <p role="status">{statusLabels[change.status || ""] || change.status}</p>
    {change.status === "pending" && change.expires_at && <p>Expires {new Date(change.expires_at).toLocaleString()}.</p>}
    {change.diff?.map((diff, i) => <section key={i}>
      <h4>{diff.label}</h4>
      <dl>{diff.fields?.map((field, j) => <div key={j}>
        <dt>{field.label}</dt>
        <dd><span>Before</span>{displayValue(field.before)}</dd>
        <dd><span>After</span>{displayValue(field.after)}</dd>
      </div>)}</dl>
    </section>)}
    {change.status === "pending" && <div className="coach-change-actions">
      <button className="primary-button" type="button" disabled={!coach?.paid || !review.data?.review_token || decision.isPending}
        onClick={() => decision.mutate("approved")}>Approve change</button>
      <button className="secondary-button" type="button" disabled={!review.data?.review_token || decision.isPending}
        onClick={() => decision.mutate("rejected")}>Reject change</button>
    </div>}
    {decision.error && <p role="alert">{decision.error.message}</p>}
  </article>;
}

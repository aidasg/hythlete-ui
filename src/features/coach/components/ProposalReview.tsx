import { Link } from "react-router-dom";
import { paths } from "@/routes/paths";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCoachProposal } from "@/features/coach/services/aiApi";
import { acceptCoaching } from "@/features/coach/services/coachApi";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";
import { SessionBlocks } from "@/features/workouts/components/SessionBlocks";
export function ProposalReview({ id, canAccept = true }: { id: number; canAccept?: boolean }) {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["coach", "proposal", id], queryFn: () => getCoachProposal(id), retry: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function accept() {
    setBusy(true); setError("");
    try {
      const result = await acceptCoaching(id);
      if (result.error) throw new Error(result.error.error || "Could not accept proposal.");
      await Promise.all([query.refetch(), invalidateWorkoutDerivedData(client)]);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not accept proposal."); }
    finally { setBusy(false); }
  }
  if (query.isLoading) return <p role="status">Loading proposed workout...</p>;
  if (query.error) return <p role="alert">{query.error.message}</p>;
  const proposal = query.data;
  if (!proposal) return null;
  return <article className="coach-proposal">
    <h3>Review proposed workout</h3>
    <p>{proposal.source === "ai" ? "AI-assisted composition" : "Algorithmic proposal"} · {proposal.reason}</p>
    {proposal.before?.filter(w => w.planned && !w.completed).map(w => <p key={w.id}>Replaces: {w.date} · {w.title}</p>)}
    {proposal.sessions?.map((workout, i) => <div key={i}><h4>{workout.date} · {workout.title} · {workout.duration_minutes} min</h4><SessionBlocks blocks={workout.blocks || []} /></div>)}
    {proposal.status === "proposed" ? <><p>Expires {proposal.expires_at ? new Date(proposal.expires_at).toLocaleString() : "in 24 hours"}. Review before adding to your calendar.</p><button type="button" className="primary-button" disabled={busy || !canAccept} onClick={() => void accept()}>{busy ? "Accepting..." : "Accept calendar changes"}</button></> : <p role="status">Proposal {proposal.status}.</p>}
    {!canAccept && <Link to={paths.billing}>Choose Pro to accept this proposal</Link>}
    {error && <p role="alert">{error}</p>}
  </article>;
}

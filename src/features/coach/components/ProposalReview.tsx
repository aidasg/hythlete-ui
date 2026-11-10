import { throwApiResponseError } from "@/services/api/errors";
import { useCoach } from "@/features/coach/context/coachContext";
import { Link } from "react-router-dom";
import { paths } from "@/routes/paths";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCoachProposal } from "@/features/coach/services/aiApi";
import { acceptCoaching } from "@/features/coach/services/coachApi";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";
import { SessionBlocks } from "@/features/workouts/components/SessionBlocks";

const proposalTitles: Record<string, string> = {
  plan: "Review proposed training plan",
  adaptation: "Review proposed workout adaptation",
};

export function ProposalReview({ id, canAccept = true }: { id: number; canAccept?: boolean }) {
  const coach = useCoach();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["coach", coach?.userID || 0, "proposal", id],
    queryFn: () => getCoachProposal(id),
    retry: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function accept() {
    if (coach) {
      coach.acceptProposal(id);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await acceptCoaching(id);
      if (result.error || !result.response.ok) throwApiResponseError(result);
      await Promise.all([query.refetch(), invalidateWorkoutDerivedData(client)]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not accept proposal.");
    } finally {
      setBusy(false);
    }
  }
  if (query.isLoading) return <p role="status">Loading proposed workout…</p>;
  if (query.error) return <p role="alert">{query.error.message}</p>;
  const proposal = query.data;
  if (!proposal) return null;

  const replacements = proposal.before?.filter(workout => workout.planned && !workout.completed) || [];
  const issue = coach?.proposalErrors[id];
  const accepted = proposal.status === "accepted";
  const expired = proposal.status === "expired" || proposal.status === "proposed" &&
    !!proposal.expires_at && new Date(proposal.expires_at).getTime() <= Date.now();
  const pending = proposal.status === "proposed" && !expired && !issue?.stale;
  const working = busy || coach?.acceptingProposalID === id;
  const refresh = expired || proposal.status === "proposed" && !!issue?.stale;
  const draftConversation = proposal.conversation_id;

  return <article className="coach-proposal">
    <h3>{proposalTitles[proposal.kind || ""] || "Review proposed workout"}</h3>
    {proposal.reason && <p>{proposal.reason}</p>}
    {replacements.map(workout => <p key={workout.id}>Replaces {workout.date} · {workout.title}</p>)}
    {proposal.sessions?.map((workout, index) => <section key={index}>
      <h4>{replacements.some(before => before.date === workout.date) ? "Replacement" : "Add"} · {workout.date} · {workout.title} · {workout.duration_minutes} min</h4>
      <SessionBlocks blocks={workout.blocks || []} showTargets />
    </section>)}
    {pending && <>
      {proposal.expires_at && <p>Expires {new Date(proposal.expires_at).toLocaleString()}.</p>}
      <button type="button" className="primary-button" disabled={busy || !!coach?.acceptingProposalID || !canAccept} onClick={() => void accept()}>
        {working ? "Accepting…" : "Accept calendar changes"}
      </button>
    </>}
    {accepted && <p role="status">Added to your calendar. <Link to={paths.workouts}>View workouts</Link></p>}
    {proposal.status === "superseded" && <p role="status">Another version of this draft was applied.</p>}
    {expired && <p role="status">This draft has expired.</p>}
    {(error || issue?.message) && proposal.status === "proposed" && <p role="alert">{issue?.stale && proposal.status === "proposed" ? "Training details have changed. Refresh this draft before accepting it." : error || issue?.message}</p>}
    {draftConversation && coach && <button type="button" className="coach-quiet-button" disabled={!coach.paid || coach.busy || !!coach.reconnectJob}
      onClick={() => coach.continueFromProposal(id, draftConversation, refresh)}>
      {refresh ? "Refresh draft" : "Continue from this draft"}
    </button>}
    {!canAccept && pending && <Link to={paths.billing}>Choose Pro to accept this proposal</Link>}
  </article>;
}

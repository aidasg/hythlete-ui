import { useQuery } from "@tanstack/react-query";
import { useCoach } from "../context/coachContext";
import { listCoachChanges } from "../services/changeApi";
import { ChangeReview } from "./ChangeReview";

export function ChangeInbox() {
  const coach = useCoach();
  const inbox = useQuery({
    queryKey: ["coach", coach?.userID, "changes"],
    queryFn: listCoachChanges,
    enabled: !!coach?.changesOpen,
    retry: false,
  });
  if (!coach?.changesOpen) return null;

  return <section className="coach-change-inbox" aria-label="Pending training changes">
    <div className="coach-history-actions">
      <h3>Pending changes</h3>
      <button type="button" className="coach-quiet-button" onClick={() => coach.setChangesOpen(false)}>Back to conversation</button>
    </div>
    {coach.changeID > 0 ? <>
      <button type="button" className="coach-quiet-button" onClick={() => coach.reviewChange(0)}>All changes</button>
      <ChangeReview id={coach.changeID} />
    </> : <>
      {inbox.isPending && <p role="status">Loading changes…</p>}
      {inbox.error && <p role="alert">{inbox.error.message}</p>}
      {inbox.data?.length === 0 && <p>No training change requests yet.</p>}
      {inbox.data?.map(item => item.id ? <button key={item.id} type="button" className="secondary-button"
        onClick={() => coach.reviewChange(item.id!)}>
        {item.diff?.[0]?.label || "Training change"} · {item.status}
      </button> : null)}
    </>}
  </section>;
}

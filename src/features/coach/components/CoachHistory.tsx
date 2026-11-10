import { useCoach } from "@/features/coach/context/coachContext";
import { History, MoreHorizontal, Plus } from "lucide-react";

export function CoachHistory() {
  const coach = useCoach();
  if (!coach) return null;
  const locked = coach.busy || coach.stopping || !!coach.reconnectJob;
  return <div className="coach-history">
    <div className="coach-history-actions">
      <button className="coach-quiet-button" type="button" disabled={locked} onClick={coach.newConversation}>
        <Plus size={16} aria-hidden="true" /> New conversation
      </button>
      <button className="coach-quiet-button" type="button" aria-expanded={coach.historyOpen} onClick={() => coach.setHistoryOpen(!coach.historyOpen)}>
        <History size={16} aria-hidden="true" /> Saved conversations
      </button>
      <button className="coach-quiet-button" type="button" aria-expanded={coach.changesOpen}
        onClick={() => { coach.reviewChange(0); coach.setChangesOpen(!coach.changesOpen); }}>
        Pending changes
      </button>
      {coach.conversationID > 0 && <details className="coach-history-options" key={coach.conversationID}>
        <summary className="coach-quiet-button" title="Conversation options">
          <MoreHorizontal size={18} aria-hidden="true" /><span className="sr-only">Conversation options</span>
        </summary>
        <button className="coach-quiet-button" type="button" disabled={locked} onClick={coach.deleteConversation}>Delete conversation</button>
      </details>}
    </div>
    {coach.historyOpen && <nav aria-label="Saved conversations">
      {coach.conversations.length === 0 && <p>No saved conversations yet.</p>}
      {coach.conversations.map(item => <button type="button" key={item.id} className="coach-quiet-button" disabled={locked}
        aria-current={item.id === coach.conversationID ? "page" : undefined} onClick={() => item.id && coach.selectConversation(item.id)}>
        {item.title}
      </button>)}
    </nav>}
  </div>;
}

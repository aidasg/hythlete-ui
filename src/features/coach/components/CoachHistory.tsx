import { useCoach } from "@/features/coach/context/coachContext";
export function CoachHistory() {
  const coach = useCoach(); if (!coach) return null;
  return <div className="coach-history"><div className="coach-history-actions"><button className="secondary-button" type="button" disabled={coach.busy} onClick={coach.newConversation}>New conversation</button><button className="secondary-button" type="button" aria-expanded={coach.historyOpen} onClick={() => coach.setHistoryOpen(!coach.historyOpen)}>Saved conversations</button></div>
    {coach.historyOpen && <nav aria-label="Saved conversations">{coach.conversations.length === 0 && <p>No saved conversations yet.</p>}{coach.conversations.map(item => <button type="button" key={item.id} className="secondary-button" disabled={coach.busy} aria-current={item.id === coach.conversationID ? "page" : undefined} onClick={() => item.id && coach.selectConversation(item.id)}>{item.title}</button>)}</nav>}
    {coach.conversationID > 0 && <details><summary>Conversation options</summary><button className="secondary-button" type="button" disabled={coach.busy} onClick={coach.deleteConversation}>Delete conversation</button></details>}
  </div>;
}

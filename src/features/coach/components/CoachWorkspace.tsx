import { billingKeys, getSubscription } from "@/features/billing/services/billingApi";
import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createConversation, deleteConversation, getConversation, listConversations, sendCoachMessage, reviewWorkout, type TurnRequest, type TurnResult } from "@/features/coach/services/aiApi";
import { ProposalReview } from "@/features/coach/components/ProposalReview";
import { McpConnections } from "@/features/coach/components/McpConnections";
import { paths } from "@/routes/paths";
import { useAuth } from "@/features/auth/context/useAuth";
import { dateInTimezone } from "@/features/strategy/hooks/useTodayDate";
import { getStrategyConstraints } from "@/features/strategy/services/strategyConstraints";
import { PlanningInputs, type PlanningDraft } from "@/features/coach/components/PlanningInputs";
const actions = { review_recent_workout: "Review workout", plan_next_workout: "Generate next workout", coach_chat: "Chat with coach" } as const;
type Action = keyof typeof actions;
function tomorrow(timezone?: string | null) { const date = new Date(`${dateInTimezone(timezone)}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); }
function actionFromQuery(value: string | null, workoutID?: number): Action { return value && Object.prototype.hasOwnProperty.call(actions, value) ? value as Action : workoutID ? "review_recent_workout" : "coach_chat"; }
function EvidenceDetails({ result, paid }: { result: TurnResult; paid: boolean }) {
  const statuses: Record<string,string> = { needs_input: "More details needed", no_fit: "No matching workout", failed: "Coach unavailable", explanation_unavailable: "Draft ready; explanation unavailable" };
  return <>
    {result.outcome && statuses[result.outcome] && <p role="status">{statuses[result.outcome]}</p>}
    {!!result.tools?.length && <details><summary>Evidence retrieved</summary><ul>{result.tools.map((tool, i) => <li key={i}>{tool.name?.replace(/_/g, " ")} · {tool.outcome}</li>)}</ul></details>}
    {!!result.evidence?.length && <ul className="coach-evidence">{result.evidence.map(evidence => <li key={evidence.id}>{evidence.workout_id ? <Link to={`${paths.workouts}?workout=${evidence.workout_id}`}>{evidence.date} · Workout #{evidence.workout_id}</Link> : <span>{evidence.date} · {((evidence.id || "context").split(":")[0] || "context").replace(/_/g, " ")}</span>}</li>)}</ul>}
    {!!result.missing?.length && <details><summary>Data limitations</summary><ul>{result.missing.map((missing, i) => <li key={i}>{missing}</li>)}</ul></details>}
    {result.proposals?.map(proposal => proposal.id ? <ProposalReview key={proposal.id} id={proposal.id} canAccept={paid} /> : null)}
  </>;
}
export function CoachWorkspace() {
  const [params, setParams] = useSearchParams();
  const cid = Number(params.get("conversation")) || 0;
  const workoutID = Number(params.get("workout")) || undefined;
  const proposalID = Number(params.get("proposal")) || 0;
  const { session } = useAuth();
  const [prompt, setPrompt] = useState<Action>(() => actionFromQuery(params.get("action"), workoutID));
  const [content, setContent] = useState("");
  const [planning, setPlanning] = useState<PlanningDraft>(() => {
    const day = params.get("date") || tomorrow(session?.profile?.timezone);
    const existing = getStrategyConstraints(day, session?.profile);
    return { date: day, minutes: existing.availableMinutes, activity_mode: existing.activityMode || "profile", activities: existing.allowedSports, equipment: existing.equipment || ["bodyweight"], formats: existing.formats || [] };
  });
  const pending = useRef<{ cid: number; request: TurnRequest } | null>(null);
  const client = useQueryClient();
  const billing = useQuery({ queryKey: billingKeys.subscription, queryFn: getSubscription, retry: false });
  const paid = billing.data?.ai_access === true;
  const conversations = useQuery({ queryKey: ["coach", "conversations"], queryFn: listConversations, retry: false });
  const conversation = useQuery({ queryKey: ["coach", "conversation", cid], queryFn: () => getConversation(cid), enabled: cid > 0, retry: false });
  const send = useMutation({
    mutationFn: async () => {
      if (!paid) throw new Error("Choose Pro to use AI coaching.");
      let target = cid;
      const text = content.trim() || (prompt === "review_recent_workout" ? "Review my completed workout against its prescription, history and goals." : "Prepare my next workout using these constraints and explain an alternative.");
      const payload = { content: text, prompt, workout_id: prompt === "review_recent_workout" ? workoutID : undefined, constraints: prompt === "plan_next_workout" ? planning : undefined };
      if (pending.current && JSON.stringify({ ...pending.current.request, key: undefined }) !== JSON.stringify(payload)) pending.current = null;
      if (pending.current) target = pending.current.cid;
      if (!target) { const created = await createConversation(text.slice(0, 80)); target = created.id || 0; if (!target) throw new Error("Conversation could not be created."); setParams({ conversation: String(target), action: prompt, ...(workoutID && prompt === "review_recent_workout" ? { workout: String(workoutID) } : {}) }); }
      const request = pending.current?.request || { key: crypto.randomUUID(), ...payload };
      pending.current = { cid: target, request };
      const result = prompt === "review_recent_workout" ? await reviewWorkout(target, request) : await sendCoachMessage(target, request);
      pending.current = null;
      return result;
    },
    onSuccess: () => { setContent(""); void client.invalidateQueries({ queryKey: ["coach"] }); },
  });
  const remove = useMutation({ mutationFn: deleteConversation, onSuccess: () => { setParams({}); pending.current = null; void client.invalidateQueries({ queryKey: ["coach"] }); } });
  const error = send.error || remove.error || conversations.error || conversation.error;
  return <main className="coach-workspace">
    <header><span className="eyebrow">Pro coaching</span><h1>Your training coach</h1><p>Review your training, discuss choices, and prepare your next workout.</p></header>
    {billing.isPending && <p role="status">Checking your plan...</p>}
    {billing.error && <p role="alert">Your plan could not be checked. <button onClick={() => void billing.refetch()}>Retry</button></p>}
    {billing.data && !paid && <div className="coach-upgrade"><h2>Unlock AI coaching with Pro</h2><p>Your saved conversations remain available.</p><Link to={paths.billing}>Choose a plan</Link></div>}
    <div className="coach-layout">
      <aside className="coach-conversations"><button className="secondary-button" disabled={send.isPending} onClick={() => { setParams({}); setContent(""); send.reset(); pending.current = null; }}>New conversation</button><nav aria-label="Saved conversations">{conversations.data?.map(item => <button key={item.id} className="secondary-button" aria-current={item.id === cid ? "page" : undefined} disabled={send.isPending} onClick={() => { setParams({ conversation: String(item.id) }); setContent(""); send.reset(); pending.current = null; }}>{item.title}</button>)}</nav></aside>
      <section className="coach-chat" aria-label="Coach conversation">
        {cid > 0 && <div className="coach-chat-heading"><h2>{conversation.data?.title || "Conversation"}</h2><button className="secondary-button" disabled={send.isPending || remove.isPending} onClick={() => remove.mutate(cid)}>Delete conversation</button></div>}
        {proposalID > 0 && <ProposalReview id={proposalID} canAccept={paid} />}
        {conversation.isLoading && <p role="status">Loading conversation...</p>}
        {conversation.data?.messages?.map(message => <article key={message.id} className={`coach-message coach-message-${message.role}`}><strong>{message.role === "user" ? "You" : "Coach"}</strong><p className="coach-answer">{message.content}</p>{message.result && <EvidenceDetails result={message.result} paid={paid} />}</article>)}
        {send.isPending && <p role="status">Checking your training evidence and preparing a response...</p>}
        {error && <p role="alert">{error.message}</p>}
        <form onSubmit={event => { event.preventDefault(); if (paid) send.mutate(); }}><fieldset disabled={!paid || send.isPending}>
          <div className="coach-actions" role="group" aria-label="Coaching actions">{(Object.keys(actions) as Action[]).map(action => <button type="button" className="secondary-button" key={action} disabled={send.isPending} aria-pressed={prompt === action} onClick={() => { setPrompt(action); setContent(""); send.reset(); pending.current = null; }}>{actions[action]}</button>)}</div>
          {prompt === "plan_next_workout" && <PlanningInputs value={planning} onChange={setPlanning} disabled={send.isPending} />}
          {prompt === "review_recent_workout" && <p>{workoutID ? `Reviewing workout #${workoutID}.` : "Review your latest completed workout."}</p>}
          <label>{prompt === "coach_chat" ? "Your message" : "Additional preferences or questions"}<textarea required={prompt === "coach_chat"} maxLength={8000} disabled={send.isPending} value={content} onChange={event => setContent(event.target.value)} placeholder={prompt === "coach_chat" ? "Ask about your training or request a workout change." : "Optional: tell the coach what to focus on."} /></label>
          <button className="primary-button" disabled={send.isPending || prompt === "coach_chat" && !content.trim() || prompt === "plan_next_workout" && planning.activity_mode === "custom" && planning.activities.length === 0}>{send.isPending ? "Working..." : prompt === "coach_chat" ? "Send to coach" : prompt === "plan_next_workout" ? "Generate workout draft" : "Review completed workout"}</button>
        </fieldset></form>
      </section>
    </div>
    <McpConnections canCreate={paid} />
  </main>;
}

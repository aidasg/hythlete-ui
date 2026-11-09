import { throwApiResponseError } from "@/services/api/errors";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/context/useAuth";
import { billingKeys, getSubscription } from "@/features/billing/services/billingApi";
import { CoachContext, type CoachController } from "./coachContext";
import { createConversation, deleteConversation, getConversation, listConversations, reviewWorkout, sendCoachMessage, type TurnRequest } from "@/features/coach/services/aiApi";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";
import { acceptCoaching, proposeCoaching } from "@/features/coach/services/coachApi";
import type { CoachAction, CoachIntent, CoachTarget, CoachResult } from "@/features/coach/types";
import { contextLabel } from "@/features/coach/types";
import { getStrategyConstraints } from "@/features/strategy/services/strategyConstraints";
import { dateInTimezone } from "@/features/strategy/hooks/useTodayDate";
import type { PlanningDraft } from "@/features/coach/components/PlanningInputs";

export function CoachProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth(); const userID = session?.profile?.user_id || 0;
  return <CoachSession key={userID} userID={userID}>{children}</CoachSession>;
}
function CoachSession({ children, userID }: { children: ReactNode; userID: number }) {
  const { session } = useAuth(); const client = useQueryClient();
  const [isOpen, setOpen] = useState(false), [everOpened, setEverOpened] = useState(false), [unread, setUnread] = useState(false);
  const [conversationID, setConversationID] = useState(0), [action, setAction] = useState<CoachAction>("coach_chat"), [target, setTarget] = useState<CoachTarget | null>(null);
  const [content, setContent] = useState(""), [weeks, setWeeks] = useState(4), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [proposalID, setProposalID] = useState(0), [previewID, setPreviewID] = useState(0), [historyOpen, setHistoryOpen] = useState(false);
  const [attachments, setAttachments] = useState<{ cid: number; id: number }[]>([]), [pendingLabel, setPendingLabel] = useState("");
  const [acceptingProposalID,setAcceptingProposalID]=useState(0),[proposalErrors,setProposalErrors]=useState<Record<number,string>>({});
  const acceptance=useRef(false);
  const threadDrafts=useRef(new Map<number,{content:string;target:CoachTarget|null;planning:PlanningDraft;action:CoachAction;weeks:number}>());
  const [optimisticResult, setOptimisticResult] = useState<CoachResult>();
  const [planning, setPlanning] = useState<PlanningDraft>(() => {
    const day = new Date(`${dateInTimezone(session?.profile?.timezone)}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + 1); const date = day.toISOString().slice(0, 10);
    const c = getStrategyConstraints(date, session?.profile);
    return { date, minutes: c.availableMinutes, activity_mode: c.activityMode || "profile", activities: c.allowedSports, equipment: c.equipment || ["bodyweight"], formats: c.formats || [] };
  });
  const [currentContext, setCurrentContext] = useState<CoachTarget | null>(null);
  const contexts = useRef(new Map<symbol, { target: CoachTarget; priority: number }>());
  const registerContext = useCallback((key: symbol, value: CoachTarget, priority: number) => {
    function refresh() { setCurrentContext([...contexts.current.values()].sort((a, b) => b.priority - a.priority)[0]?.target || null); }
    contexts.current.set(key, { target: value, priority }); refresh();
    return () => { contexts.current.delete(key); refresh(); };
  }, []);
  const live = useRef(true), openRef = useRef(isOpen), triggerRef = useRef<HTMLElement | null>(null), focusNeeded = useRef(false), busyRef = useRef(false);
  openRef.current = isOpen;
  useEffect(() => { live.current = true; return () => { live.current = false; }; }, []);
  const billing = useQuery({ queryKey: billingKeys.subscription, queryFn: getSubscription, enabled: !!userID, retry: false });
  const conversations = useQuery({ queryKey: ["coach", userID, "conversations"], queryFn: listConversations, enabled: !!userID && everOpened, retry: false });
  const conversation = useQuery({ queryKey: ["coach", userID, "conversation", conversationID], queryFn: () => getConversation(conversationID), enabled: !!userID && conversationID > 0, retry: false });
  const retry = useRef<{ signature: string; cid: number; request: TurnRequest } | null>(null);
  function openCoach(intent: CoachIntent = {}, trigger?: HTMLElement) {
    triggerRef.current = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    focusNeeded.current = true; setOpen(true); setEverOpened(true); setUnread(false); if(intent.target||intent.action||intent.conversationID||intent.proposalID)setPreviewID(0);
    if(intent.conversationID&&!busyRef.current)selectConversation(intent.conversationID);
    if (intent.target) {
      setTarget(intent.target);
      const c = intent.target.constraints || (intent.target.date ? getStrategyConstraints(intent.target.date, session?.profile) : undefined);
      setPlanning(previous => ({ ...previous, ...(intent.target?.date ? { date: intent.target.date } : {}), ...(c ? { minutes: c.availableMinutes, activity_mode: c.activityMode || "profile", activities: c.allowedSports, equipment: c.equipment || ["bodyweight"], formats: c.formats || [] } : {}) }));
    } else if (!everOpened && currentContext) { setTarget(currentContext); }
    if (intent.action) setAction(intent.action);
    if (intent.proposalID) setProposalID(intent.proposalID);
  }
  function changeAction(next: CoachAction) {
    setAction(next);
    if (next === "plan_next_workout" || next === "plan_training") {
      setTarget({ surface: "plan", date: planning.date });
    }
  }
  function closeCoach() {
    openRef.current = false; setOpen(false);
    requestAnimationFrame(() => { const trigger = triggerRef.current; (trigger?.isConnected ? trigger : document.querySelector<HTMLElement>("[data-coach-launcher]"))?.focus({ preventScroll: true }); });
  }
  function newConversation() { if (busyRef.current) return; threadDrafts.current.set(conversationID, { content, target, planning, action, weeks }); setConversationID(0); setContent(""); setError(""); setProposalID(0); setOptimisticResult(undefined); retry.current = null; setAttachments(old => old.filter(item => item.cid !== 0)); setHistoryOpen(false); }
  function selectConversation(id: number) {
    if(busyRef.current)return;
    threadDrafts.current.set(conversationID,{content,target,planning,action,weeks});
    const draft=threadDrafts.current.get(id);setConversationID(id);setContent(draft?.content||"");setTarget(draft?.target||null);setAction(draft?.action||"coach_chat");if(draft){setPlanning(draft.planning);setWeeks(draft.weeks)}
    setOptimisticResult(undefined);setProposalID(0);setPreviewID(0);setError("");setHistoryOpen(false);retry.current=null;
  }
  async function removeConversation() { if (!conversationID || busyRef.current) return; try { await deleteConversation(conversationID); if (!live.current) return; newConversation(); await client.invalidateQueries({ queryKey: ["coach", userID] }); } catch (e) { if (live.current) setError(e instanceof Error ? e.message : "Could not delete conversation."); } }
  async function submit() {
    if (busyRef.current || !userID) return;
    if (!billing.data?.ai_access) { setError("Choose Pro to use AI coaching."); return; }
    const snapshot = JSON.parse(JSON.stringify({ action, target, planning, weeks, content, cid: conversationID })) as { action: CoachAction; target: CoachTarget | null; planning: PlanningDraft; weeks: number; content: string; cid: number };
    const text = snapshot.content.trim() || (snapshot.action === "review_recent_workout" ? "Review this workout against its prescription, history and my goals." : snapshot.action === "coach_chat" ? `Explain ${contextLabel(snapshot.target)} using my saved training data.` : "Prepare a workout using these constraints and explain an alternative.");
    const context = snapshot.target ? { surface: snapshot.target.surface, date: snapshot.target.date, progress_view: snapshot.target.progressView, exercise_code: snapshot.target.exerciseCode } : undefined;
    const request: TurnRequest = { key: "", content: text, prompt: snapshot.action === "plan_next_workout" || snapshot.action === "review_recent_workout" ? snapshot.action : "coach_chat", workout_id: snapshot.action !== "plan_next_workout" ? snapshot.target?.workoutID : undefined, context, constraints: snapshot.action === "plan_next_workout" ? snapshot.planning : undefined };
    const signature = JSON.stringify({ ...request, key: undefined });
    if (retry.current?.signature !== signature) retry.current = null;
    busyRef.current = true; setBusy(true); setError(""); setPendingLabel(contextLabel(snapshot.target));
    try {
      let cid = retry.current?.cid || snapshot.cid;
      const legacy = snapshot.action === "adapt_session" || snapshot.action === "plan_training";
      if (legacy) {
        if (snapshot.action === "adapt_session" && !snapshot.target?.workoutID) throw new Error("Choose a saved planned workout to adapt.");
        const result = await proposeCoaching({ start: snapshot.planning.date, weeks: snapshot.weeks, workout_id: snapshot.action === "adapt_session" ? snapshot.target?.workoutID : undefined, minutes: snapshot.planning.minutes, equipment: snapshot.planning.equipment, activities: snapshot.planning.activity_mode === "any" ? [] : snapshot.planning.activities, instruction: snapshot.content });
        if (result.error || !result.data?.id) throwApiResponseError(result);
        if (!live.current) return;
        setAttachments(previous => [...previous, { cid: snapshot.cid, id: result.data.id! }]);
      } else {
        if (!cid) {
          const created = await createConversation(text.slice(0, 80)); cid = created.id || 0;
          if (!cid) throw new Error("Conversation could not be created.");
          if (!live.current) return; setConversationID(cid); setAttachments(old => old.map(item => item.cid === 0 ? { ...item, cid } : item));
        }
        const saved = retry.current?.request || { ...request, key: crypto.randomUUID() };
        retry.current = { signature, cid, request: saved };
        const result = snapshot.action === "review_recent_workout" ? await reviewWorkout(cid, saved) : await sendCoachMessage(cid, saved);
        if (!live.current) return; retry.current = null; setOptimisticResult(result);
        await client.invalidateQueries({ queryKey: ["coach", userID] });
      }
      if (!live.current) return;
      // Preserve edits made while this immutable submission was in flight.
      setContent(previous => previous === snapshot.content ? "" : previous);
      if (!openRef.current) setUnread(true);
    } catch (e) { if (live.current) setError(e instanceof Error ? e.message : "The coaching request failed."); }
    finally { if (live.current) { busyRef.current = false; setBusy(false); setPendingLabel(""); } }
  }
  async function acceptProposal(id:number){
    if(acceptance.current||!billing.data?.ai_access)return;acceptance.current=true;setAcceptingProposalID(id);setProposalErrors(old=>({...old,[id]:""}));
    try{const result=await acceptCoaching(id);if(result.error)throwApiResponseError(result);if(!live.current)return;await Promise.all([client.invalidateQueries({queryKey:["coach",userID,"proposal",id]}),invalidateWorkoutDerivedData(client)]);}
    catch(e){if(live.current)setProposalErrors(old=>({...old,[id]:e instanceof Error?e.message:"Could not accept proposal."}));}
    finally{if(live.current){acceptance.current=false;setAcceptingProposalID(0)}}
  }
  const value: CoachController = {
    acceptingProposalID,proposalErrors,acceptProposal:(id:number)=>{void acceptProposal(id)},
    userID, isOpen, unread, busy, paid: billing.data?.ai_access === true, checkingAccess: billing.isPending, accessError: billing.error,
    conversationID, conversation: conversation.data, conversations: conversations.data || [], loadingConversation: conversation.isLoading && conversationID > 0,
    action, target, currentContext, content, planning, weeks, error: error || conversation.error?.message || conversations.error?.message || "", pendingLabel,
    extraProposals: attachments.filter(item => item.cid === conversationID).map(item => item.id), proposalID, previewID, historyOpen,
    openCoach, closeCoach, setContent, setPlanning, setWeeks, setAction: changeAction, selectConversation, newConversation,
    deleteConversation: () => { void removeConversation(); }, submit: () => { void submit(); }, setPreviewID, setHistoryOpen,
    retryAccess: () => { void billing.refetch(); }, claimFocus: () => { if (!focusNeeded.current) return false; focusNeeded.current = false; return true; }, registerContext, optimisticResult,
  };
  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

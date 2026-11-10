import { ApiResponseError, throwApiResponseError } from "@/services/api/errors";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/context/useAuth";
import { billingKeys, getSubscription } from "@/features/billing/services/billingApi";
import { CoachContext, type CoachController } from "./coachContext";
import { createConversation, deleteConversation, getConversation, listConversations, type TurnRequest } from "@/features/coach/services/aiApi";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";
import { acceptCoaching } from "@/features/coach/services/coachApi";
import type { CoachAction, CoachIntent, CoachTarget, CoachResult } from "@/features/coach/types";
import { coachStarter, contextLabel } from "@/features/coach/types";
import { getStrategyConstraints } from "@/features/strategy/services/strategyConstraints";
import { dateInTimezone } from "@/features/strategy/hooks/useTodayDate";
import { followCoachJob, startCoachJob, stopCoachJob, type CoachJob, type CoachJobStart } from "../services/coachJobsApi";
import type { CoachSource } from "../services/coachSources";
import type { PlanningDraft } from "@/features/coach/components/PlanningInputs";

type JobReference = { id: string; cid: number };
type Timeline = NonNullable<CoachController["timeline"]> & JobReference;
type ActiveJob = { reference: JobReference; draft?: string; admission?: Promise<CoachJob> };
type TurnAttachments = { goalHint?: CoachAction; proposalID?: number; preferences?: boolean; starter?: string };
type ComposerDraft = { content: string; target: CoachTarget | null; planning: PlanningDraft; turn: TurnAttachments };

function pendingJob(userID: number, value?: JobReference | null): JobReference | undefined {
  if (!userID) return;
  const key = `hythlete:coach:pending:${userID}`;
  try {
    if (value === null) sessionStorage.removeItem(key);
    else if (value) sessionStorage.setItem(key, JSON.stringify(value));
    else {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null") as JobReference | null;
      if (saved && typeof saved.id === "string" && Number.isInteger(saved.cid)) return saved;
    }
  } catch { /* The live stream still works when storage is blocked. */ }
}

function jobError(job: CoachJob) {
  switch (job.failure_code) {
    case "timeout": return "Coach ran out of time.";
    case "interrupted": return "Coach generation was interrupted.";
    case "invalid": return "Check your workout details and coaching constraints.";
    case "not_found": return "The saved workout could not be found.";
    case "plan_required": return "An active Pro plan is required to finish this request.";
    default: return "Coach could not finish this request.";
  }
}

export function CoachProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth(); const userID = session?.profile?.user_id || 0;
  return <CoachSession key={userID} userID={userID}>{children}</CoachSession>;
}
function CoachSession({ children, userID }: { children: ReactNode; userID: number }) {
  const { session } = useAuth(); const client = useQueryClient();
  const [isOpen, setOpen] = useState(false), [everOpened, setEverOpened] = useState(false), [unread, setUnread] = useState(false);
  const [conversationID, setConversationID] = useState(0), [target, setTarget] = useState<CoachTarget | null>(null);
  const [turnAttachments, setTurnAttachments] = useState<TurnAttachments>({});
  const [content, setContent] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [changeID, setChangeID] = useState(0), [changesOpen, setChangesOpen] = useState(false);
  const [proposalID, setProposalID] = useState(0), [preview, setPreview] = useState<CoachSource | null>(null), [historyOpen, setHistoryOpen] = useState(false);
  const [attachments, setAttachments] = useState<{ cid: number; id: number }[]>([]), [pendingLabel, setPendingLabel] = useState("");
  const [acceptingProposalID, setAcceptingProposalID] = useState(0);
  const [proposalErrors, setProposalErrors] = useState<CoachController["proposalErrors"]>({});
  const acceptance=useRef(false);
  const threadDrafts = useRef(new Map<number, ComposerDraft>());
  const [optimisticResult, setOptimisticResult] = useState<CoachResult>();
  const [timeline, setTimeline] = useState<Timeline>();
  const [retryJob, setRetryJob] = useState<JobReference>();
  const [reconnectJob, setReconnectJob] = useState<JobReference>();
  const connection = useRef<AbortController>();
  const preparingConversation = useRef<AbortController>();
  const activeJob = useRef<ActiveJob>();
  const stopRequest = useRef<AbortController>();
  const [stopping, setStopping] = useState(false);
  const [notice, setNotice] = useState("");
  const lastEvent = useRef("");
  const unviewedJob = useRef(false);
  const [resumeOnMount] = useState(() => pendingJob(userID));
  function defaultPlanning(): PlanningDraft {
    const day = new Date(`${dateInTimezone(session?.profile?.timezone)}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + 1); const date = day.toISOString().slice(0, 10);
    const c = getStrategyConstraints(date, session?.profile);
    return { date, minutes: c.availableMinutes, activity_mode: c.activityMode || "profile", activities: c.allowedSports, equipment: c.equipment || ["bodyweight"], formats: c.formats || [] };
  }
  const [planning, setPlanning] = useState(defaultPlanning);
  const [currentContext, setCurrentContext] = useState<CoachTarget | null>(null);
  const contexts = useRef(new Map<symbol, { target: CoachTarget; priority: number }>());
  const registerContext = useCallback((key: symbol, value: CoachTarget, priority: number) => {
    function refresh() { setCurrentContext([...contexts.current.values()].sort((a, b) => b.priority - a.priority)[0]?.target || null); }
    contexts.current.set(key, { target: value, priority }); refresh();
    return () => { contexts.current.delete(key); refresh(); };
  }, []);
  const live = useRef(true), openRef = useRef(isOpen), triggerRef = useRef<HTMLElement | null>(null), focusNeeded = useRef(false), busyRef = useRef(false);
  openRef.current = isOpen;
  useEffect(() => { live.current = true; return () => { live.current = false; connection.current?.abort(); stopRequest.current?.abort(); }; }, []);
  const billing = useQuery({ queryKey: billingKeys.subscription, queryFn: getSubscription, enabled: !!userID, retry: false });
  const conversations = useQuery({ queryKey: ["coach", userID, "conversations"], queryFn: listConversations, enabled: !!userID && everOpened, retry: false });
  const conversation = useQuery({ queryKey: ["coach", userID, "conversation", conversationID], queryFn: () => getConversation(conversationID), enabled: !!userID && conversationID > 0, retry: false });
  const retry = useRef<{ signature: string; cid: number; request: CoachJobStart } | null>(null);
  function openCoach(intent: CoachIntent = {}, trigger?: HTMLElement) {
    openRef.current = true;
    if (unviewedJob.current) {
      pendingJob(userID, null);
      unviewedJob.current = false;
    }
    triggerRef.current = trigger || (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    focusNeeded.current = true; setOpen(true); setEverOpened(true); setUnread(false); if(intent.target||intent.action||intent.conversationID||intent.proposalID)setPreview(null);
    if (intent.conversationID && intent.conversationID !== conversationID) selectConversation(intent.conversationID);
    if (intent.target) {
      setTarget(intent.target);
      const c = intent.target.constraints || (intent.target.date ? getStrategyConstraints(intent.target.date, session?.profile) : undefined);
      setPlanning(previous => ({ ...previous, ...(intent.target?.date ? { date: intent.target.date } : {}), ...(c ? { minutes: c.availableMinutes, activity_mode: c.activityMode || "profile", activities: c.allowedSports, equipment: c.equipment || ["bodyweight"], formats: c.formats || [] } : {}) }));
    } else if (!everOpened && currentContext) { setTarget(currentContext); }
    if (intent.action) {
      const starter = coachStarter(intent.action, intent.target || null);
      setContent(previous => !previous.trim() || previous === turnAttachments.starter ? starter : previous);
      setTurnAttachments(previous => ({ preferences: previous.preferences, goalHint: intent.action, starter }));
    }
    if (intent.proposalID) setProposalID(intent.proposalID);
    if (intent.changeID) {
      setChangeID(intent.changeID);
      setChangesOpen(true);
    } else if (intent.target || intent.conversationID || intent.proposalID) {
      setChangesOpen(false);
    }
  }
  function closeCoach() {
    openRef.current = false; setOpen(false);
    requestAnimationFrame(() => { const trigger = triggerRef.current; (trigger?.isConnected ? trigger : document.querySelector<HTMLElement>("[data-coach-launcher]"))?.focus({ preventScroll: true }); });
  }
  function switchConversation(id: number, draft?: ComposerDraft) {
    threadDrafts.current.set(conversationID, { content, target, planning, turn: turnAttachments });
    setConversationID(id);
    setContent(draft?.content || "");
    setTarget(draft?.target || null);
    setTurnAttachments(draft?.turn || {});
    setPlanning(draft?.planning || defaultPlanning());
    setOptimisticResult(undefined);
    setTimeline(undefined);
    setRetryJob(undefined);
    setReconnectJob(undefined);
    setProposalID(0);
    setPreview(null);
    setError("");
    setNotice("");
    setHistoryOpen(false);
    retry.current = null;
  }

  function newConversation() {
    if (busyRef.current || reconnectJob || stopRequest.current) return;
    switchConversation(0);
    setAttachments(old => old.filter(item => item.cid !== 0));
  }

  function selectConversation(id: number) {
    if (busyRef.current || reconnectJob || stopRequest.current) return;
    if (id === conversationID) {
      setHistoryOpen(false);
      return;
    }
    switchConversation(id, threadDrafts.current.get(id));
  }

  function continueFromProposal(id: number, cid: number, refresh: boolean) {
    if (busyRef.current || reconnectJob || stopRequest.current) return;
    if (cid !== conversationID) selectConversation(cid);
    setTurnAttachments(previous => ({ ...previous, proposalID: id, goalHint: undefined, starter: undefined }));
    setTarget(null);
    if (refresh) setContent(previous => previous.trim() ? previous : "Refresh this draft against my current calendar and readiness.");
    requestAnimationFrame(() => document.getElementById("coach-message-input")?.focus());
  }
  async function removeConversation() { if (!conversationID || busyRef.current || reconnectJob || stopRequest.current) return; try { await deleteConversation(conversationID); if (!live.current) return; newConversation(); await client.invalidateQueries({ queryKey: ["coach", userID] }); } catch (e) { if (live.current) setError(e instanceof Error ? e.message : "Could not delete conversation."); } }
  const consumeJob = useCallback(async (reference: JobReference, signal: AbortSignal, text?: string, initial?: CoachJob) => {
    try {
      const completed = initial?.status && initial.status !== "running" ? initial : await followCoachJob(reference.id, lastEvent.current, signal, event => {
        if (signal.aborted) return;
        lastEvent.current = event.id;
        setTimeline(current => {
          if (current?.id !== reference.id) return current;
          if ("text" in event) return { ...current, draft: event.text };
          const draft = event.stage === "model" || event.stage === "run_tool" ? undefined : current.draft;
          return { ...current, draft, events: [...current.events, event] };
        });
      });
      if (signal.aborted) return;
      activeJob.current = undefined;
      if (stopRequest.current) {
        stopRequest.current.abort();
        stopRequest.current = undefined;
        setStopping(false);
      }
      setTimeline(current => current?.id === reference.id ? { ...current, active: false, draft: undefined } : current);
      if (openRef.current) pendingJob(userID, null);
      else unviewedJob.current = true;
      retry.current = null;
      setReconnectJob(undefined);
      if (completed.turn) setOptimisticResult(completed.turn);
      else if (completed.proposal_id) {
        const proposalID = completed.proposal_id;
        setAttachments(previous => previous.some(item => item.id === proposalID) ? previous : [...previous, { cid: reference.cid, id: proposalID }]);
      }
      if (completed.failure_code === "stopped") {
        setError("");
        if (!completed.turn) setNotice("Coach generation stopped.");
      } else if (completed.status === "failed") {
        setError(jobError(completed));
        if (completed.failure_code === "timeout" || completed.failure_code === "interrupted") setRetryJob(reference);
      } else {
        setContent(previous => previous === text ? "" : previous);
      }
      await client.invalidateQueries({ queryKey: ["coach", userID] });
      if (!openRef.current && !signal.aborted) setUnread(true);
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof ApiResponseError && [401, 403, 404].includes(error.status)) {
        activeJob.current = undefined;
        pendingJob(userID, null);
      } else setReconnectJob(reference);
      setError(error instanceof Error ? error.message : "Could not follow Coach progress.");
    } finally {
      if (!signal.aborted) {
        busyRef.current = false;
        setBusy(false);
        setPendingLabel("");
        setTimeline(current => current?.id === reference.id ? { ...current, active: false } : current);
      }
    }
  }, [client, userID]);

  const resume = useCallback((reference: JobReference) => {
    if (stopRequest.current) return;
    connection.current?.abort();
    const controller = new AbortController();
    connection.current = controller;
    const draft = activeJob.current?.reference.id === reference.id ? activeJob.current.draft : undefined;
    activeJob.current = { reference, draft };
    busyRef.current = true;
    setBusy(true);
    setConversationID(reference.cid);
    setError("");
    setReconnectJob(undefined);
    setTimeline(current => current?.id === reference.id ? { ...current, active: true } : { ...reference, events: [], active: true });
    void consumeJob(reference, controller.signal, draft);
  }, [consumeJob]);
  useEffect(() => {
    if (resumeOnMount) resume(resumeOnMount);
    return () => connection.current?.abort();
  }, [resume, resumeOnMount]);

  async function launch(request: CoachJobStart, cid: number, controller: AbortController, text?: string, draft?: string, admitted?: () => void) {
    const reference = { id: request.id, cid };
    unviewedJob.current = false;
    lastEvent.current = "";
    setRetryJob(undefined);
    setReconnectJob(undefined);
    setOptimisticResult(undefined);
    setTimeline({ ...reference, pendingText: text, events: [], active: true });
    pendingJob(userID, reference);
    const admission = startCoachJob(request, controller.signal);
    const job: ActiveJob = { reference, draft, admission };
    activeJob.current = job;
    let receipt: CoachJob;
    try {
      receipt = await admission;
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiResponseError && error.status >= 400 && error.status < 500) pendingJob(userID, null);
      if (!stopRequest.current) activeJob.current = undefined;
      setTimeline(undefined);
      throw error;
    } finally {
      job.admission = undefined;
    }
    if (!controller.signal.aborted) {
      admitted?.();
      await consumeJob(reference, controller.signal, draft, receipt);
    }
  }

  async function stop() {
    if (stopRequest.current) return;
    const job = activeJob.current;
    if (!job) {
      if (!preparingConversation.current) return;
      preparingConversation.current.abort();
      preparingConversation.current = undefined;
      busyRef.current = false;
      setBusy(false);
      setPendingLabel("");
      setNotice("Coach generation stopped.");
      return;
    }
    const controller = new AbortController();
    stopRequest.current = controller;
    setStopping(true);
    setError("");
    let admissionFailed = false;
    try {
      if (job.admission) {
        await job.admission.catch(() => { admissionFailed = true; });
      }
      if (controller.signal.aborted || activeJob.current !== job) return;
      const receipt = await stopCoachJob(job.reference.id, controller.signal);
      if (controller.signal.aborted || activeJob.current !== job) return;
      connection.current?.abort();
      const follow = new AbortController();
      connection.current = follow;
      busyRef.current = true;
      setBusy(true);
      setReconnectJob(undefined);
      setTimeline(current => current?.id === job.reference.id ? { ...current, draft: undefined } : current);
      await consumeJob(job.reference, follow.signal, job.draft, receipt);
    } catch (error) {
      if (controller.signal.aborted || activeJob.current !== job) return;
      if (admissionFailed) {
        busyRef.current = false;
        setBusy(false);
        setPendingLabel("");
        if (error instanceof ApiResponseError && error.status === 404) {
          activeJob.current = undefined;
          retry.current = null;
          pendingJob(userID, null);
          setError("");
          setNotice("Coach generation stopped.");
          return;
        }
        setReconnectJob(job.reference);
      }
      setError(error instanceof Error ? error.message : "Could not stop Coach generation.");
    } finally {
      if (stopRequest.current === controller) {
        stopRequest.current = undefined;
        if (!controller.signal.aborted) setStopping(false);
      }
    }
  }

  async function submit(again?: JobReference) {
    if (busyRef.current || reconnectJob || stopRequest.current || !userID) return;
    if (!billing.data?.ai_access) { setError("Choose Pro to use AI coaching."); return; }
    const snapshot = { target, planning, content, cid: conversationID, attachments: turnAttachments };
    if (!again && !snapshot.content.trim()) return;
    const controller = new AbortController();
    connection.current = controller;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    setPendingLabel(contextLabel(snapshot.target));
    try {
      if (again) {
        const request = retry.current?.signature === again.id ? retry.current.request : { id: crypto.randomUUID(), retry_of: again.id };
        retry.current = { signature: again.id, cid: again.cid, request };
        await launch(request, again.cid, controller);
        return;
      }
      const text = snapshot.content.trim();
      const context = snapshot.target ? { surface: snapshot.target.surface, date: snapshot.target.date, progress_view: snapshot.target.progressView, exercise_code: snapshot.target.exerciseCode } : undefined;
      const turn: TurnRequest = {
        content: text,
        prompt: "coach_unified",
        goal_hint: snapshot.attachments.goalHint,
        proposal_id: snapshot.attachments.proposalID,
        workout_id: snapshot.target?.workoutID,
        context,
        constraints: snapshot.attachments.preferences ? snapshot.planning : undefined,
      };
      const body = { turn };
      const signature = JSON.stringify(body);
      if (retry.current?.signature !== signature) retry.current = null;
      let cid = retry.current?.cid || snapshot.cid;
      if (!cid) {
        preparingConversation.current = controller;
        try {
          const created = await createConversation(text.slice(0, 80));
          cid = created.id || 0;
        } finally {
          if (preparingConversation.current === controller) preparingConversation.current = undefined;
        }
        if (!cid) throw new Error("Conversation could not be created.");
        if (controller.signal.aborted) return;
        setConversationID(cid);
        setAttachments(old => old.map(item => item.cid === 0 ? { ...item, cid } : item));
      }
      const request = retry.current?.request || { ...body, id: crypto.randomUUID(), conversation_id: cid || undefined };
      retry.current = { signature, cid, request };
      await launch(request, cid, controller, text, snapshot.content, () => {
        setTurnAttachments(previous => previous === snapshot.attachments ? {} : previous);
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setError(error instanceof Error ? error.message : "The coaching request failed.");
        if (again) setRetryJob(again);
      }
    } finally {
      if (!controller.signal.aborted && !stopRequest.current) {
        busyRef.current = false;
        setBusy(false);
        setPendingLabel("");
      }
    }
  }
  async function acceptProposal(id: number) {
    if (acceptance.current || !billing.data?.ai_access) return;
    acceptance.current = true;
    setAcceptingProposalID(id);
    setProposalErrors(previous => ({ ...previous, [id]: undefined }));
    try {
      const result = await acceptCoaching(id);
      if (result.error || !result.response.ok) throwApiResponseError(result);
      if (!live.current) return;
      await Promise.all([
        client.invalidateQueries({ queryKey: ["coach", userID, "proposal"] }),
        invalidateWorkoutDerivedData(client),
      ]);
    } catch (error) {
      if (!live.current) return;
      const stale = error instanceof ApiResponseError && error.status === 409;
      setProposalErrors(previous => ({ ...previous, [id]: { message: error instanceof Error ? error.message : "Could not accept proposal.", stale } }));
      if (stale) await client.invalidateQueries({ queryKey: ["coach", userID, "proposal"] });
    } finally {
      if (live.current) {
        acceptance.current = false;
        setAcceptingProposalID(0);
      }
    }
  }
  const value: CoachController = {
    acceptingProposalID,proposalErrors,acceptProposal:(id:number)=>{void acceptProposal(id)},
    userID, isOpen, unread, busy, paid: billing.data?.ai_access === true, checkingAccess: billing.isPending, accessError: billing.error,
    conversationID, conversation: conversation.data, conversations: conversations.data || [], loadingConversation: conversation.isLoading && conversationID > 0,
    target, currentContext, content, planning,
    attachPreferences: turnAttachments.preferences === true,
    draftReference: turnAttachments.proposalID,
    setAttachPreferences: preferences => setTurnAttachments(previous => ({ ...previous, preferences })),
    clearDraftReference: () => setTurnAttachments(previous => ({ ...previous, proposalID: undefined })),
    continueFromProposal,
    timeline: timeline?.cid === conversationID ? timeline : undefined,
    retryJob: retryJob ? () => { void submit(retryJob); } : undefined,
    reconnectJob: reconnectJob ? () => resume(reconnectJob) : undefined,
    stopJob: busy || reconnectJob ? () => { void stop(); } : undefined, stopping, notice,
    error: error || conversation.error?.message || conversations.error?.message || "", pendingLabel,
    extraProposals: attachments.filter(item => item.cid === conversationID).map(item => item.id), proposalID, preview, historyOpen,
    changeID, changesOpen, setChangesOpen, reviewChange: setChangeID,
    openCoach, closeCoach, setContent, setPlanning, selectConversation, newConversation,
    deleteConversation: () => { void removeConversation(); }, submit: () => { void submit(); }, setPreview, setHistoryOpen,
    retryAccess: () => { void billing.refetch(); }, claimFocus: () => { if (!focusNeeded.current) return false; focusNeeded.current = false; return true; }, registerContext, optimisticResult,
  };
  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

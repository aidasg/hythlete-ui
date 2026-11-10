import { memo, useCallback, useLayoutEffect, useRef, useState, type MouseEvent, type MutableRefObject } from "react";
import { ArrowDown, Sparkles } from "lucide-react";
import { useCoach } from "@/features/coach/context/coachContext";
import { contextLabel, type CoachResult } from "@/features/coach/types";
import type { CoachProgress } from "../services/coachJobsApi";
import type { CoachSource } from "../services/coachSources";
import { ProposalReview } from "./ProposalReview";
import { CoachComposer } from "./CoachComposer";
import { CoachEvidencePreview } from "./CoachEvidencePreview";
import { CoachMarkdown } from "./CoachMarkdown";

const toolLabels: Record<string, string> = {
  get_athlete_context: "Your goals and preferences",
  list_workouts: "Training history and schedule",
  get_workout: "Workout details",
  compare_workout: "Comparison with your plan and history",
  get_readiness: "Training readiness",
  get_training_progress: "Progress evidence",
  get_training_strategy: "Training priorities",
  get_training_catalog: "Supported activities and equipment",
  preview_workout: "Estimated workout demands",
  create_workout_proposal: "Validated workout draft",
};
const stageLabels: Record<string, string> = {
  queued: "Request queued",
  read_training: "Reading saved training data",
  model: "Generating a coaching response",
  prepare_draft: "Preparing the workout draft",
  validate_draft: "Checking the draft against your constraints",
  fallback: "Using the validated baseline plan",
  save_draft: "Saving the workout draft",
  save_result: "Saving the coaching result",
};
const outcomes: Record<string, string> = {
  needs_input: "More details needed",
  no_fit: "No matching workout",
  failed: "Coach unavailable",
  explanation_unavailable: "Draft ready; explanation unavailable",
};
const introductions = {
  coach_chat: "Ask about your training, explore your progress, or prepare your next session.",
  review_recent_workout: "Understand this session against your plan and recent training.",
  plan_next_workout: "Prepare a workout that fits your goals, recent training and available time.",
  adapt_session: "Tell Coach how this planned session should change.",
  plan_training: "Build a four-to-six-week proposal around your training priorities.",
};
const introductionTitles = {
  coach_chat: "What are you working on?",
  review_recent_workout: "Review a workout",
  plan_next_workout: "Plan your next workout",
  adapt_session: "Adapt a session",
  plan_training: "Plan your training",
};

function progressLabel(event?: CoachProgress) {
  if (!event) return "Starting your coaching job…";
  if (event.stage === "prepare_week") return event.week ? `Preparing week ${event.week}` : "Preparing the training plan";
  if (event.stage === "run_tool") return `Checking ${toolLabels[event.tool || ""]?.toLowerCase() || "training evidence"}`;
  return stageLabels[event.stage] || "Coach is working";
}

type OpenSource = (source: CoachSource, event: MouseEvent<HTMLButtonElement>) => void;

function EvidenceDetails({ result }: { result: CoachResult }) {
  const coach = useCoach();
  return <div className="coach-message-details">
    {result.outcome && outcomes[result.outcome] && <p role="status">{outcomes[result.outcome]}</p>}
    {!!result.tools?.length && <details><summary>Actions</summary>
      <ul className="coach-action-list" aria-label="Coach actions">{result.tools.map((tool, index) => {
        const available = tool.outcome === "ok" || tool.outcome === "ready";
        const status = tool.reused ? "Reused" : available ? "Checked" : tool.outcome === "no_fit" ? "No fit" : "Unavailable";
        return <li key={index}>
          <span>{toolLabels[tool.name || ""] || "Training evidence"}</span>
          <span className="coach-action-status" data-reused={tool.reused || undefined}>{status}</span>
        </li>;
      })}</ul>
    </details>}
    {!!result.missing?.length && <details><summary>Data limitations</summary>
      <ul>{result.missing.map((missing, index) => <li key={index}>{missing.replace(/_/g, " ")}</li>)}</ul>
    </details>}
    {result.proposals?.map(proposal => proposal.id ? <ProposalReview key={proposal.id} id={proposal.id} canAccept={coach?.paid === true} /> : null)}
  </div>;
}

const Message = memo(function Message({ role, content, result, live, onOpen }: {
  role: string;
  content: string;
  result?: CoachResult;
  live?: boolean;
  onOpen: OpenSource;
}) {
  const athlete = role === "user";
  return <article className={`coach-message coach-message-${athlete ? "user" : "assistant"}`}>
    <div className="coach-message-byline">{!athlete && <Sparkles size={15} aria-hidden="true" />}<strong>{athlete ? "You" : "Coach"}</strong></div>
    {athlete ? <p className="coach-answer">{content}</p> : result?.outcome === "stopped"
      ? <p role="status" className="coach-answer">{content}</p>
      : <CoachMarkdown content={content} evidence={result?.evidence} live={live} onOpen={onOpen} />}
    {result && <EvidenceDetails result={result} />}
  </article>;
});

function nearBottom(root: HTMLElement) {
  return root.scrollHeight - root.clientHeight - root.scrollTop <= 48;
}

export function CoachWorkspace({ scrollPosition }: { scrollPosition?: MutableRefObject<number> }) {
  const coach = useCoach();
  const scrollRef = useRef<HTMLDivElement>(null);
  const sourceTrigger = useRef<HTMLButtonElement | null>(null);
  const sourceBack = useRef<HTMLButtonElement>(null);
  const localPosition = useRef(0);
  const position = scrollPosition || localPosition;
  const follow = useRef(true);
  const skipFollow = useRef(false);
  const [showJump, setShowJump] = useState(false);
  const preview = coach?.preview;
  const setPreview = coach?.setPreview;
  const timeline = coach?.timeline;
  const messages = coach?.conversation?.messages;
  const lastMessage = messages?.at(-1);
  const optimistic = coach?.optimisticResult;
  const savedOptimistic = !!optimistic && (optimistic.job_id
    ? messages?.some(message => message.result?.job_id === optimistic.job_id)
    : lastMessage?.role === "assistant" && lastMessage.content === optimistic.content);
  const conversationID = coach?.conversationID;
  const previousConversation = useRef(conversationID);
  const savedForJob = !!timeline && messages?.some(message => message.result?.job_id === timeline.id);
  const openSource = useCallback<OpenSource>((source, event) => {
    sourceTrigger.current = event.currentTarget;
    position.current = scrollRef.current?.scrollTop || 0;
    setPreview?.(source);
  }, [position, setPreview]);

  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    if (previousConversation.current !== conversationID) {
      previousConversation.current = conversationID;
      position.current = 0;
      follow.current = true;
    }
    if (preview) {
      root.scrollTop = 0;
      sourceBack.current?.focus({ preventScroll: true });
    } else {
      const restoringSource = !!sourceTrigger.current;
      root.scrollTop = position.current;
      follow.current = (!restoringSource && position.current === 0) || nearBottom(root);
      setShowJump(!follow.current);
      if (sourceTrigger.current) {
        skipFollow.current = true;
        (sourceTrigger.current.isConnected ? sourceTrigger.current : root).focus({ preventScroll: true });
        sourceTrigger.current = null;
      }
    }
  }, [conversationID, position, preview]);

  useLayoutEffect(() => {
    if (skipFollow.current) {
      skipFollow.current = false;
      return;
    }
    const root = scrollRef.current;
    if (root && !preview && follow.current) {
      root.scrollTop = root.scrollHeight;
      position.current = root.scrollTop;
    }
  }, [messages, optimistic, position, timeline?.draft, timeline?.active, timeline?.events.length, preview]);

  if (!coach) return null;

  const rows = (messages || []).map(message => <Message
    key={message.result?.job_id || message.id}
    role={message.role || "assistant"} content={message.content || ""} result={message.result} onOpen={openSource}
  />);
  if (timeline?.pendingText && (timeline.active || optimistic) && !savedForJob && !savedOptimistic) {
    rows.push(<Message key={`pending-${timeline.id}`} role="user" content={timeline.pendingText} onOpen={openSource} />);
  }
  if (timeline && (timeline.active || timeline.events.length > 0)) {
    rows.push(<div key="job-progress">
      <details className="coach-progress" open={timeline.active && !timeline.draft}>
        <summary>Coach progress</summary>
        {timeline.events.length > 0
          ? <ol aria-label="Coaching progress">{timeline.events.map(event => <li key={event.id}>{progressLabel(event)}</li>)}</ol>
          : <p>{progressLabel()}</p>}
      </details>
      {timeline.active && <p role="status" className="sr-only">{timeline.draft ? "Coach is writing" : progressLabel(timeline.events.at(-1))}</p>}
    </div>);
  }
  if (optimistic && !savedOptimistic) {
    rows.push(<Message key={optimistic.job_id || timeline?.id || "completed-reply"} role="assistant" content={optimistic.content || ""} result={optimistic} onOpen={openSource} />);
  } else if (timeline?.draft && (timeline.active || coach.reconnectJob) && !coach.stopping && !savedForJob) {
    rows.push(<Message key={timeline.id} role="assistant" content={timeline.draft} live onOpen={openSource} />);
  }

  return <div className="coach-workspace coach-panel-workspace">
    <div className="coach-context">
      <div><span>Context</span><strong>{contextLabel(coach.target)}</strong></div>
      {coach.target?.workoutID && <small>Using the saved workout. Unsaved edits stay in your workspace.</small>}
      {coach.currentContext && JSON.stringify(coach.target) !== JSON.stringify(coach.currentContext) &&
        <button type="button" className="coach-quiet-button" onClick={() => coach.openCoach({ target: coach.currentContext! })}>
          Use current view: {contextLabel(coach.currentContext)}
        </button>}
    </div>
    <div className="coach-transcript">
      <div ref={scrollRef} className="coach-conversation-scroll" tabIndex={-1} onScroll={event => {
        if (preview) return;
        const root = event.currentTarget;
        position.current = root.scrollTop;
        follow.current = nearBottom(root);
        setShowJump(!follow.current);
      }}>
        <section className="coach-chat" aria-label="Coach conversation" hidden={!!preview}>
          {coach.conversation?.title && <h3 className="coach-thread-title">{coach.conversation.title}</h3>}
          {coach.loadingConversation && <p role="status">Loading conversation…</p>}
          {!coach.loadingConversation && rows.length === 0 && <div className="coach-introduction">
            <Sparkles size={22} aria-hidden="true" />
            <h3>{introductionTitles[coach.action]}</h3>
            <p>{introductions[coach.action]}</p>
          </div>}
          <div className="coach-turns">{rows}</div>
          {coach.proposalID > 0 && <ProposalReview id={coach.proposalID} canAccept={coach.paid} />}
          {coach.extraProposals.map(id => <ProposalReview key={id} id={id} canAccept={coach.paid} />)}
          {coach.busy && !timeline?.active && <p role="status">Coach is working on {coach.pendingLabel || "your training"}.</p>}
          {coach.error && <p role="alert" className="coach-chat-error">{coach.error}</p>}
          {coach.retryJob && <button type="button" className="coach-quiet-button" disabled={coach.busy || !coach.paid} onClick={coach.retryJob}>Retry coaching job</button>}
          {coach.notice && <p role="status">{coach.notice}</p>}
          {coach.reconnectJob && <button type="button" className="coach-quiet-button" disabled={coach.busy || coach.stopping} onClick={coach.reconnectJob}>Reconnect to coaching job</button>}
        </section>
        {preview && <CoachEvidencePreview source={preview} onBack={() => coach.setPreview(null)} backRef={sourceBack} />}
      </div>
      {showJump && !preview && <button type="button" className="coach-jump coach-quiet-button" onClick={() => {
        const root = scrollRef.current;
        if (!root) return;
        root.scrollTop = root.scrollHeight;
        position.current = root.scrollTop;
        follow.current = true;
        setShowJump(false);
        root.focus({ preventScroll: true });
      }}><ArrowDown size={15} aria-hidden="true" /> Jump to latest</button>}
    </div>
    {!preview && <CoachComposer />}
  </div>;
}

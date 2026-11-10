import { createContext, useContext, useEffect } from "react";
import type { CoachIntent, CoachTarget, CoachAction, CoachResult } from "@/features/coach/types";
import type { PlanningDraft } from "@/features/coach/components/PlanningInputs";
import type { Conversation } from "@/features/coach/services/aiApi";
import type { CoachProgress } from "../services/coachJobsApi";
import type { CoachSource } from "../services/coachSources";
export type CoachController = {
  timeline?: { id: string; pendingText?: string; draft?: string; events: CoachProgress[]; active: boolean };
  retryJob?: () => void; reconnectJob?: () => void;
  stopJob?: () => void; stopping: boolean; notice: string;
  acceptingProposalID:number;proposalErrors:Record<number,string>;acceptProposal:(id:number)=>void;
  userID: number; isOpen: boolean; unread: boolean; busy: boolean; paid: boolean; checkingAccess: boolean; accessError: Error | null;
  conversationID: number; conversation?: Conversation; conversations: Conversation[]; loadingConversation: boolean;
  action: CoachAction; target: CoachTarget | null; currentContext: CoachTarget | null;
  content: string; planning: PlanningDraft; weeks: number; error: string; pendingLabel: string;
  extraProposals: number[]; proposalID: number; preview: CoachSource | null; historyOpen: boolean;
  openCoach: (intent?: CoachIntent, trigger?: HTMLElement) => void; closeCoach: () => void;
  setContent: (text: string) => void; setPlanning: (draft: PlanningDraft) => void; setWeeks: (weeks: number) => void;
  setAction: (action: CoachAction) => void; selectConversation: (id: number) => void; newConversation: () => void;
  deleteConversation: () => void; submit: () => void; setPreview: (source: CoachSource | null) => void;
  setHistoryOpen: (open: boolean) => void; retryAccess: () => void; claimFocus: () => boolean;
  registerContext: (key: symbol, target: CoachTarget, priority: number) => () => void;
  optimisticResult?: CoachResult;
};
export const CoachContext = createContext<CoachController | null>(null);
export const useCoach = () => useContext(CoachContext);
export function useCoachPageContext(target: CoachTarget | null, priority = 0) {
  const register = useCoach()?.registerContext;
  const signature = JSON.stringify(target);
  useEffect(() => { if (!register || signature === "null") return; return register(Symbol("page-context"), JSON.parse(signature) as CoachTarget, priority); }, [register, signature, priority]);
}

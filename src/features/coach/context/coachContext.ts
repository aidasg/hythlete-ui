import { createContext, useContext, useEffect } from "react";
import type { CoachIntent, CoachTarget, CoachResult } from "@/features/coach/types";
import type { PlanningDraft } from "@/features/coach/components/PlanningInputs";
import type { Conversation } from "@/features/coach/services/aiApi";
import type { CoachProgress } from "../services/coachJobsApi";
import type { CoachSource } from "../services/coachSources";
export type CoachController = {
  timeline?: { id: string; pendingText?: string; draft?: string; events: CoachProgress[]; active: boolean };
  retryJob?: () => void; reconnectJob?: () => void;
  stopJob?: () => void; stopping: boolean; notice: string;
  acceptingProposalID: number;
  proposalErrors: Record<number, { message: string; stale: boolean } | undefined>;
  acceptProposal: (id: number) => void;
  userID: number; isOpen: boolean; unread: boolean; busy: boolean; paid: boolean; checkingAccess: boolean; accessError: Error | null;
  conversationID: number; conversation?: Conversation; conversations: Conversation[]; loadingConversation: boolean;
  target: CoachTarget | null; currentContext: CoachTarget | null;
  content: string; planning: PlanningDraft; error: string; pendingLabel: string;
  attachPreferences: boolean; draftReference?: number;
  setAttachPreferences: (attached: boolean) => void;
  clearDraftReference: () => void;
  continueFromProposal: (id: number, conversationID: number, refresh: boolean) => void;
  extraProposals: number[]; proposalID: number; preview: CoachSource | null; historyOpen: boolean;
  changeID: number; changesOpen: boolean; reviewChange: (id: number) => void; setChangesOpen: (open: boolean) => void;
  openCoach: (intent?: CoachIntent, trigger?: HTMLElement) => void; closeCoach: () => void;
  setContent: (text: string) => void; setPlanning: (draft: PlanningDraft) => void;
  selectConversation: (id: number) => void; newConversation: () => void;
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

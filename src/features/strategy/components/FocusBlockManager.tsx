import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CalendarRange, Loader2, Target } from "lucide-react";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import {
  createFocusProposal,
  getActiveFocusBlock,
  updateFocusBlock,
  type FocusBlockResponse,
} from "@/features/strategy/services/strategyApi";
import { formatDisplayDate, parseDateKey, formatDateKey } from "@/features/workouts/services/workoutDates";
import { ApiResponseError, throwApiResponseError } from "@/services/api/errors";
import { invalidateStrategyAndProgress } from "@/services/query/invalidation";
import { queryKeys } from "@/services/query/queryKeys";

function formatCode(value: string | undefined) {
  return value?.replace(/_/g, " ") || "Unspecified";
}

function getNextMonday(dateKey: string) {
  const date = parseDateKey(dateKey);
  const daysUntilMonday = ((8 - date.getDay()) % 7) || 7;
  date.setDate(date.getDate() + daysUntilMonday);
  return formatDateKey(date);
}

function FocusDetails({ block }: { block: FocusBlockResponse }) {
  return (
    <div className="focus-block-details">
      <div className="focus-block-meta">
        <span>{formatDisplayDate(block.starts_on)} – {formatDisplayDate(block.ends_on)}</span>
        <span>{Math.round((block.confidence || 0) * 100)}% confidence</span>
        {block.expires_on && <span>Proposal expires {formatDisplayDate(block.expires_on)}</span>}
      </div>
      <div className="focus-capability-list">
        {block.capabilities?.map((capability, index) => (
          <div key={`${capability.role}-${capability.capability_code}-${capability.scope_id}-${index}`}>
            <span data-role={capability.role}>{formatCode(capability.role)}</span>
            <div>
              <strong>{formatCode(capability.capability_code)}</strong>
              <small>
                {[formatCode(capability.scope_id), `${capability.target_sessions || 0} sessions`, `${capability.target_minutes || 0} min`].join(" · ")}
              </small>
            </div>
          </div>
        ))}
      </div>
      {Boolean(block.reasons?.length) && (
        <ul className="reason-list">
          {block.reasons?.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>
      )}
    </div>
  );
}

export function FocusBlockManager({ date }: { date: string }) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [proposal, setProposal] = useState<FocusBlockResponse | null>(null);
  const [startDate, setStartDate] = useState(() => getNextMonday(date));
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictingBlock, setConflictingBlock] = useState<FocusBlockResponse | null>(null);

  const activeQuery = useQuery({
    queryKey: queryKeys.strategy.activeFocus(date),
    queryFn: async () => {
      const result = await getActiveFocusBlock(date);
      if (result.error) {
        if (result.response.status === 404) return null;
        throwApiResponseError(result, "Could not load the active focus block.");
      }
      return result.data;
    },
  });

  async function refreshRelated() {
    await invalidateStrategyAndProgress(queryClient);
    await activeQuery.refetch();
  }

  const proposalMutation = useMutation({
    mutationFn: async () => {
      const result = await createFocusProposal({ start_date: startDate, duration_weeks: durationWeeks });
      if (result.error) throwApiResponseError(result, "Could not generate a focus proposal.");
      return result.data;
    },
    onSuccess: (value) => {
      setProposal(value);
      setErrorMessage(null);
    },
    onError: (error) => setErrorMessage(error.message),
  });

  async function changeStatus(block: FocusBlockResponse, status: "active" | "completed" | "cancelled") {
    if (typeof block.id !== "number") return;
    setErrorMessage(null);
    const result = await updateFocusBlock(block.id, status);
    if (result.error) {
      throw new ApiResponseError(result.response.status, result.error.error || "Could not update the focus block.");
    }
    await refreshRelated();
    return result.data;
  }

  const statusMutation = useMutation({
    mutationFn: ({ block, status }: { block: FocusBlockResponse; status: "active" | "completed" | "cancelled" }) => changeStatus(block, status),
    onSuccess: (_value, variables) => {
      if (variables.status === "active") {
        setProposal(null);
        setIsOpen(false);
      }
      if (variables.status !== "active") setConflictingBlock(null);
    },
    onError: async (error, variables) => {
      if (error instanceof ApiResponseError && error.status === 409 && variables.status === "active") {
        const refreshed = await activeQuery.refetch();
        setConflictingBlock(refreshed.data || null);
        setErrorMessage("Another focus block is already active.");
        return;
      }
      setErrorMessage(error.message);
    },
  });

  const active = activeQuery.data;

  return (
    <>
      <section className="focus-summary-card">
        <div>
          <span className="eyebrow">Focus block</span>
          <h2>{active ? "Active training direction" : "No active block"}</h2>
          <p>
            {active
              ? active.capabilities?.find((item) => item.role === "primary")?.capability_code?.replace(/_/g, " ") || "Your active focus"
              : "Generate a four-to-six-week proposal when you are ready to specialize."}
          </p>
        </div>
        <button type="button" className="secondary-button" onClick={() => setIsOpen(true)}>
          <Target size={16} aria-hidden="true" /> {active ? "Manage" : "Plan focus"}
        </button>
      </section>

      {isOpen && (
        <WorkoutModal eyebrow="Training direction" title={active ? "Active focus block" : proposal ? "Review focus proposal" : "Generate a focus proposal"} onClose={() => setIsOpen(false)}>
          <div className="focus-manager">
            {(activeQuery.isLoading || proposalMutation.isPending || statusMutation.isPending) && (
              <div className="recommendation-preview-state" role="status"><Loader2 className="spin-icon" size={20} /><span>Updating focus block</span></div>
            )}
            {errorMessage && <p className="form-message form-message-error" role="alert"><AlertCircle size={15} />{errorMessage}</p>}

            {conflictingBlock && (
              <section className="focus-conflict-card">
                <strong>Resolve the active block first</strong>
                <FocusDetails block={conflictingBlock} />
                <div className="modal-action-row">
                  <button type="button" className="secondary-button" onClick={() => setConflictingBlock(null)}>Keep current</button>
                  <button type="button" className="secondary-button" onClick={() => statusMutation.mutate({ block: conflictingBlock, status: "completed" })}>Complete current</button>
                  <button type="button" className="danger-button" onClick={() => statusMutation.mutate({ block: conflictingBlock, status: "cancelled" })}>Cancel current</button>
                </div>
                {!activeQuery.data && proposal && (
                  <button type="button" className="primary-button" onClick={() => statusMutation.mutate({ block: proposal, status: "active" })}>Retry activation</button>
                )}
              </section>
            )}

            {!conflictingBlock && active && (
              <>
                <FocusDetails block={active} />
                <div className="modal-action-row">
                  <button type="button" className="secondary-button" onClick={() => statusMutation.mutate({ block: active, status: "completed" })}>Complete block</button>
                  <button type="button" className="danger-button" onClick={() => statusMutation.mutate({ block: active, status: "cancelled" })}>Cancel block</button>
                </div>
              </>
            )}

            {!conflictingBlock && !active && proposal && (
              <>
                <FocusDetails block={proposal} />
                <div className="modal-action-row">
                  <button type="button" className="secondary-button" onClick={() => setProposal(null)}>Change dates</button>
                  <button type="button" className="primary-button" onClick={() => statusMutation.mutate({ block: proposal, status: "active" })}>Activate focus block</button>
                </div>
              </>
            )}

            {!conflictingBlock && !active && !proposal && (
              <form className="focus-proposal-form" onSubmit={(event) => { event.preventDefault(); proposalMutation.mutate(); }}>
                <label>Start date<input type="date" min={date} value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>
                <label>Duration<select value={durationWeeks} onChange={(event) => setDurationWeeks(Number(event.target.value))}><option value={4}>4 weeks</option><option value={5}>5 weeks</option><option value={6}>6 weeks</option></select></label>
                <p><CalendarRange size={16} />The strategist chooses the primary, secondary, and maintenance capabilities from your goals and evidence.</p>
                <button type="submit" className="primary-button" disabled={proposalMutation.isPending}>Generate proposal</button>
              </form>
            )}
          </div>
        </WorkoutModal>
      )}
    </>
  );
}

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Sparkles, Target, X } from "lucide-react";
import {
  listBreakthroughs,
  updateBreakthrough,
} from "@/features/progress/services/progressApi";
import type { DailyStrategyResponse } from "@/features/strategy/services/strategyApi";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";
import { ApiResponseError, throwApiResponseError } from "@/services/api/errors";
import { invalidateStrategyAndProgress } from "@/services/query/invalidation";

type StrategyBreakthrough = NonNullable<
  NonNullable<DailyStrategyResponse["today"]>["breakthrough"]
>;

function formatValue(value: number | undefined, unit: string | undefined) {
  if (typeof value !== "number") return "—";
  return `${value.toFixed(1).replace(".0", "")} ${unit || ""}`.trim();
}

export function BreakthroughOpportunityCard({
  breakthrough,
  onCreateAttempt,
}: {
  breakthrough: StrategyBreakthrough;
  onCreateAttempt: (breakthrough: StrategyBreakthrough) => void;
}) {
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [acceptedConflict, setAcceptedConflict] = useState<StrategyBreakthrough | null>(null);

  async function invalidate() {
    await invalidateStrategyAndProgress(queryClient);
  }

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "accepted" | "dismissed" }) => {
      const result = await updateBreakthrough(id, status);
      if (result.error) {
        throw new ApiResponseError(
          result.response.status,
          result.error.error || "Could not update the breakthrough."
        );
      }
      return result.data;
    },
    onSuccess: async (value) => {
      setErrorMessage(null);
      setAcceptedConflict(null);
      await invalidate();
      if (value.status === "accepted") onCreateAttempt(value);
    },
    onError: async (error, variables) => {
      if (error instanceof ApiResponseError && error.status === 409 && variables.status === "accepted") {
        const result = await listBreakthroughs("accepted");
        if (result.error) {
          setErrorMessage("Another breakthrough is active, but it could not be loaded.");
          return;
        }
        setAcceptedConflict(result.data[0] || null);
        setErrorMessage("Only one breakthrough can be accepted at a time.");
        return;
      }
      setErrorMessage(error.message);
    },
  });

  async function replaceAccepted() {
    if (typeof acceptedConflict?.id !== "number" || typeof breakthrough.id !== "number") return;
    setErrorMessage(null);
    try {
      const dismissResult = await updateBreakthrough(acceptedConflict.id, "dismissed");
      if (dismissResult.error) {
        throwApiResponseError(dismissResult, "Could not dismiss the current breakthrough.");
      }
      setAcceptedConflict(null);
      statusMutation.mutate({ id: breakthrough.id, status: "accepted" });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not replace the current breakthrough.");
    }
  }

  const isSuggested = breakthrough.status === "suggested";

  return (
    <>
      <section className="breakthrough-opportunity-card">
        <div className="breakthrough-icon"><Sparkles size={20} aria-hidden="true" /></div>
        <div className="breakthrough-copy">
          <span className="eyebrow">Breakthrough opportunity</span>
          <h2>{breakthrough.title || "A meaningful target is within reach"}</h2>
          <div className="breakthrough-target">
            <strong>{formatValue(breakthrough.baseline_value, breakthrough.unit)}</strong>
            <span>→</span>
            <strong>{formatValue(breakthrough.target_value, breakthrough.unit)}</strong>
          </div>
          <p>{breakthrough.reasons?.[0] || "The backend found enough comparable evidence for a targeted attempt."}</p>
          <small>{Math.round((breakthrough.confidence || 0) * 100)}% confidence · valid until {formatDisplayDate(breakthrough.valid_until)}</small>
        </div>
        <div className="breakthrough-actions">
          {isSuggested ? (
            <>
              <button type="button" className="primary-button" disabled={statusMutation.isPending || typeof breakthrough.id !== "number"} onClick={() => statusMutation.mutate({ id: breakthrough.id!, status: "accepted" })}><Target size={16} />Accept & create attempt</button>
              <button type="button" className="text-button" disabled={statusMutation.isPending || typeof breakthrough.id !== "number"} onClick={() => statusMutation.mutate({ id: breakthrough.id!, status: "dismissed" })}><X size={15} />Dismiss</button>
            </>
          ) : (
            <button type="button" className="primary-button" onClick={() => onCreateAttempt(breakthrough)}><Target size={16} />Create attempt</button>
          )}
        </div>
        {errorMessage && !acceptedConflict && <p className="form-message form-message-error" role="alert"><AlertCircle size={15} />{errorMessage}</p>}
      </section>

      {acceptedConflict && (
        <WorkoutModal eyebrow="Breakthrough conflict" title="Keep one active target" onClose={() => setAcceptedConflict(null)}>
          <div className="breakthrough-conflict">
            <p>{errorMessage}</p>
            <article><span>Currently accepted</span><strong>{acceptedConflict.title}</strong><small>Valid until {formatDisplayDate(acceptedConflict.valid_until)}</small></article>
            <div className="modal-action-row">
              <button type="button" className="secondary-button" onClick={() => setAcceptedConflict(null)}>Keep current</button>
              <button type="button" className="primary-button" onClick={() => void replaceAccepted()}>Dismiss current & accept new</button>
            </div>
          </div>
        </WorkoutModal>
      )}
    </>
  );
}

import { getApiErrorMessage } from "@/services/api/errors";
import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Loader2, RefreshCw } from "lucide-react";
import { WorkoutModal } from "./WorkoutModal";
import { FitPowerTargetUnitsField } from "./FitPowerTargetUnitsField";
import type { FitPowerTargetUnit, WorkoutResponse } from "../services/workoutApi";

type Props = {
  workout: WorkoutResponse;
  isReanalysing: boolean;
  errorMessage?: string | null;
  onCancel: () => void;
  onConfirm: (unit: FitPowerTargetUnit, useStrydPower: boolean) => void | Promise<boolean>;
};

export function WorkoutReanalysisModal({ workout, isReanalysing, errorMessage, onCancel, onConfirm }: Props) {
  const saved = workout.execution?.imported_activity;
  const [unit, setUnit] = useState<FitPowerTargetUnit>(saved?.power_target_unit || "auto");
  const [useStrydPower, setUseStrydPower] = useState(saved?.use_stryd_power ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const pending = isReanalysing || submitting;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setSubmitting(true);
    setLocalError(null);
    try {
      const success = await onConfirm(unit, useStrydPower);
      if (success !== false) onCancel();
    } catch (error) {
      setLocalError(getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal(
    <WorkoutModal title="Reanalyse activity" eyebrow="FIT processing" size="compact"
      dismissDisabled={pending} onClose={() => { if (!pending) onCancel(); }}>
      <form className="workout-reanalysis-form" onSubmit={submit} aria-busy={pending}>
        <p>Refresh recorded zones and analysis with your current baselines. Manual changes to recorded segments, exercises, and sets will be replaced with the original FIT data.</p>
        <FitPowerTargetUnitsField value={unit} onChange={setUnit} disabled={pending} />
        <label className="workout-reanalysis-checkbox">
          <input type="checkbox" checked={useStrydPower} disabled={pending}
            onChange={(event) => setUseStrydPower(event.target.checked)} />
          <span>Use Stryd power when standard power is missing</span>
        </label>
        <p className="workout-reanalysis-hint">Standard power takes priority. Stryd power is used in watts when no standard power samples are available.</p>
        {(errorMessage || localError) && <p className="form-message form-message-error" role="alert">{errorMessage || localError}</p>}
        {pending && <p role="status">Reanalysing activity with current baselines...</p>}
        <div className="workout-reanalysis-actions">
          <button type="button" className="secondary-button" disabled={pending} onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary-button" disabled={pending}>
            {pending ? <Loader2 className="spin-icon" size={16} aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
            {pending ? "Reanalysing..." : "Reanalyse"}
          </button>
        </div>
      </form>
    </WorkoutModal>, document.body
  );
}

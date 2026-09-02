import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { WorkoutCreateForm } from "@/features/workouts/components/WorkoutCreateForm";
import type {
  ExerciseStrengthProfileResponse,
  TrainingOptionResponse,
  WorkoutCatalogResponse,
  WorkoutPrescriptionResponse,
  WorkoutResponse,
} from "@/features/workouts/services/workoutApi";
import { formatReadinessLabel } from "@/features/workouts/services/readinessDisplay";
import { formatDisplayDate, getTodayKey } from "@/features/workouts/services/workoutDates";

type WorkoutRecommendationPreviewProps = {
  option: TrainingOptionResponse;
  date: string;
  prescription: WorkoutPrescriptionResponse | null;
  selectedDraftIndex: number;
  catalog: WorkoutCatalogResponse | null;
  strengthProfiles?: ExerciseStrengthProfileResponse[];
  isLoading: boolean;
  errorMessage: string | null;
  onDraftSelect: (index: number) => void;
  onRetry: () => void;
  onCreated: (workout: WorkoutResponse) => void;
};

function getDraftKey(
  draft: NonNullable<WorkoutPrescriptionResponse["workouts"]>[number] | undefined,
  index: number
) {
  return `${draft?.key || draft?.title || "draft"}-${index}`;
}

export function WorkoutRecommendationPreview({
  option,
  date,
  prescription,
  selectedDraftIndex,
  catalog,
  strengthProfiles = [],
  isLoading,
  errorMessage,
  onDraftSelect,
  onRetry,
  onCreated,
}: WorkoutRecommendationPreviewProps) {
  const drafts = prescription?.workouts || [];
  const selectedDraft = drafts[selectedDraftIndex] || drafts[0];
  const selectedDraftKey = getDraftKey(selectedDraft, selectedDraftIndex);
  const warnings = [
    ...(prescription?.warnings || []),
    ...(selectedDraft?.warnings || []),
  ];
  const reasons = [
    ...(prescription?.reasons || []),
    ...(selectedDraft?.reasons || []),
  ];

  if (isLoading) {
    return (
      <div className="recommendation-preview-state" role="status">
        <Loader2 className="spin-icon" size={21} aria-hidden="true" />
        <div>
          <strong>Building your session</strong>
          <span>Balancing readiness, goals, and recent load.</span>
        </div>
      </div>
    );
  }

  if (errorMessage || !selectedDraft?.workout) {
    return (
      <div className="recommendation-preview-state recommendation-preview-error">
        <AlertTriangle size={22} aria-hidden="true" />
        <div>
          <strong>{errorMessage || "No suggested workout was returned."}</strong>
          <span>Your selected recommendation is still available.</span>
        </div>
        <button type="button" className="secondary-button" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="recommendation-preview">
      {drafts.length > 1 && (
        <div className="suggested-draft-tabs" aria-label="Workout alternatives">
          {drafts.map((draft, index) => (
            <button
              type="button"
              key={getDraftKey(draft, index)}
              className="secondary-button"
              data-active={index === selectedDraftIndex ? "true" : "false"}
              onClick={() => onDraftSelect(index)}
            >
              {draft.title || `Option ${index + 1}`}
            </button>
          ))}
        </div>
      )}

      <div className="recommendation-preview-heading">
        <div>
          <span className="eyebrow">Recommended for {formatDisplayDate(date)}</span>
          <h3>{selectedDraft.title || formatReadinessLabel(option.focus) || "Workout"}</h3>
        </div>
        <span className="recommendation-score">
          {typeof option.score === "number" ? `${Math.round(option.score)} match` : "Best match"}
        </span>
      </div>

      {Boolean(warnings.length || reasons.length) && (
        <div className="recommendation-rationale">
          {warnings.map((warning) => (
            <span key={warning} className="recommendation-warning">
              <AlertTriangle size={14} aria-hidden="true" />
              {warning}
            </span>
          ))}
          {reasons.slice(0, 3).map((reason) => (
            <span key={reason}>{reason}</span>
          ))}
        </div>
      )}

      <div className="recommendation-session-summary" aria-label="Session summary">
        <div>
          <span>Duration</span>
          <strong>
            {typeof selectedDraft.workout.duration_minutes === "number"
              ? `${Math.round(selectedDraft.workout.duration_minutes)} min`
              : "Flexible"}
          </strong>
        </div>
        <div>
          <span>Effort</span>
          <strong>
            {typeof selectedDraft.workout.rpe === "number"
              ? `RPE ${selectedDraft.workout.rpe}`
              : "Adaptive"}
          </strong>
        </div>
        <div>
          <span>Structure</span>
          <strong>
            {selectedDraft.workout.components?.length
              ? `${selectedDraft.workout.components.length} parts`
              : "Open session"}
          </strong>
        </div>
      </div>

      <WorkoutCreateForm
        key={selectedDraftKey}
        catalog={catalog}
        selectedDate={date}
        initialWorkout={selectedDraft.workout}
        initialWorkoutKey={selectedDraftKey}
        initialImpactPreview={selectedDraft.planned_impact}
        strengthProfiles={strengthProfiles}
        onCreated={onCreated}
        showHeader={false}
        compact
        submitLabel={date === getTodayKey() ? "Save to today" : "Save workout"}
      />
    </div>
  );
}

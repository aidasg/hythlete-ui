import { useEffect } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import type { WorkoutResponse } from "@/features/workouts/services/workoutApi";

type WorkoutDeleteConfirmationModalProps = {
  workout: WorkoutResponse;
  isDeleting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onConfirm: () => void;
};

function getWorkoutTitle(workout: WorkoutResponse) {
  return workout.title || workout.subtype || workout.category || "Workout";
}

export function WorkoutDeleteConfirmationModal({
  workout,
  isDeleting,
  errorMessage,
  onCancel,
  onConfirm,
}: WorkoutDeleteConfirmationModalProps) {
  const workoutTitle = getWorkoutTitle(workout);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isDeleting) {
        event.stopImmediatePropagation();
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isDeleting, onCancel]);

  return (
    <div
      className="workout-confirm-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
    >
      <section
        className="workout-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workout-delete-confirm-title"
      >
        <div className="workout-confirm-header">
          <div className="workout-confirm-icon">
            <AlertTriangle size={20} aria-hidden="true" />
          </div>
          <div>
            <span className="eyebrow">Delete workout</span>
            <h2 id="workout-delete-confirm-title">{workoutTitle}</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close delete confirmation"
            disabled={isDeleting}
            onClick={onCancel}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="workout-confirm-copy">
          This will permanently remove the workout from your calendar and refresh
          derived training state.
        </p>

        {errorMessage && (
          <p className="form-message form-message-error" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="workout-confirm-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={isDeleting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="workout-confirm-delete-button"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting ? (
              <Loader2 className="spin-icon" size={17} aria-hidden="true" />
            ) : (
              <Trash2 size={17} aria-hidden="true" />
            )}
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}

import { FormEvent, useRef, useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import {
  importFitWorkout,
  type FitImportResponse,
  type WorkoutResponse,
} from "@/features/workouts/services/workoutApi";

type WorkoutFitImportFormProps = {
  onImported: (workout: WorkoutResponse) => void;
};

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = error as { error?: unknown };

    if (typeof apiError.error === "string" && apiError.error.trim()) {
      return apiError.error;
    }
  }

  return "The workout service did not accept that FIT file.";
}

function toWorkoutResponse(importedWorkout: FitImportResponse): WorkoutResponse {
  return importedWorkout;
}

export function WorkoutFitImportForm({ onImported }: WorkoutFitImportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setErrorMessage("Choose a FIT file to import.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await importFitWorkout(file);

      if (result.error) {
        setErrorMessage(getErrorMessage(result.error));
        return;
      }

      setSuccessMessage(
        result.data.matched_existing
          ? "FIT file matched an existing workout."
          : "FIT workout imported."
      );
      onImported(toWorkoutResponse(result.data));
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch {
      setErrorMessage("Could not reach the workout import service.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="workout-create-panel" aria-label="Import FIT activity">
      <form className="workout-form" onSubmit={handleSubmit}>
        <label className="fit-import-dropzone">
          <FileUp size={24} aria-hidden="true" />
          <span>{file?.name || "Choose FIT activity file"}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".fit,application/octet-stream"
            onChange={(event) => {
              setFile(event.target.files?.[0] || null);
              setErrorMessage(null);
              setSuccessMessage(null);
            }}
          />
        </label>

        {errorMessage && (
          <p className="form-message form-message-error" role="alert">
            {errorMessage}
          </p>
        )}

        {successMessage && (
          <p className="form-message form-message-success" role="status">
            {successMessage}
          </p>
        )}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? (
            <Loader2 className="spin-icon" size={17} aria-hidden="true" />
          ) : (
            <Upload size={17} aria-hidden="true" />
          )}
          {isSubmitting ? "Importing..." : "Import FIT"}
        </button>
      </form>
    </section>
  );
}

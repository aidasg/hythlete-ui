import { AlertTriangle, Dumbbell, History, Loader2, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  listStrengthProfiles,
  type ExerciseStrengthProfileResponse,
  type StrengthEffortResponse,
} from "@/features/workouts/services/workoutApi";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";

type StrengthProfilePanelProps = {
  profiles: ExerciseStrengthProfileResponse[];
  isLoading: boolean;
  errorMessage: string | null;
};

function getProfileKey(profile: ExerciseStrengthProfileResponse) {
  return profile.exercise_code || profile.exercise_name || "strength-profile";
}

function formatKg(value: number | undefined) {
  return typeof value === "number" ? `${value.toFixed(1).replace(".0", "")} kg` : null;
}

function formatPercent(value: number | undefined) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "n/a";
}

function formatEffortMeta(effort: StrengthEffortResponse) {
  return [
    typeof effort.reps === "number" ? `${effort.reps} reps` : null,
    formatKg(effort.load_kg),
    typeof effort.rir === "number" ? `RIR ${effort.rir}` : null,
    typeof effort.rpe === "number" ? `RPE ${effort.rpe}` : null,
    typeof effort.estimated_1rm_kg === "number"
      ? `${formatKg(effort.estimated_1rm_kg)} est. 1RM`
      : null,
  ].filter(Boolean);
}

function sortProfiles(profiles: ExerciseStrengthProfileResponse[]) {
  return [...profiles].sort((left, right) => {
    const rightDate = right.latest_workout_date || "";
    const leftDate = left.latest_workout_date || "";

    if (rightDate !== leftDate) {
      return rightDate.localeCompare(leftDate);
    }

    return (right.confidence || 0) - (left.confidence || 0);
  });
}

export function StrengthProfilePanel({
  profiles,
  isLoading,
  errorMessage,
}: StrengthProfilePanelProps) {
  const sortedProfiles = useMemo(() => sortProfiles(profiles), [profiles]);
  const [selectedExerciseCode, setSelectedExerciseCode] = useState<string | null>(
    null
  );
  const [selectedProfile, setSelectedProfile] =
    useState<ExerciseStrengthProfileResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (
      selectedExerciseCode &&
      !profiles.some((profile) => profile.exercise_code === selectedExerciseCode)
    ) {
      setSelectedExerciseCode(null);
      setSelectedProfile(null);
      setDetailErrorMessage(null);
    }
  }, [profiles, selectedExerciseCode]);

  function handleProfileSelect(profile: ExerciseStrengthProfileResponse) {
    const exerciseCode = profile.exercise_code;

    if (!exerciseCode) {
      return;
    }

    setSelectedExerciseCode(exerciseCode);
    setSelectedProfile(profile);
    setIsLoadingDetail(true);
    setDetailErrorMessage(null);

    listStrengthProfiles({ exerciseCode })
      .then((result) => {
        if (result.error) {
          setDetailErrorMessage("Could not load recent source efforts.");
          return;
        }

        setSelectedProfile(result.data[0] || profile);
      })
      .catch(() => {
        setDetailErrorMessage("Could not reach the strength profile service.");
      })
      .finally(() => {
        setIsLoadingDetail(false);
      });
  }

  return (
    <section className="strength-profile-panel" aria-labelledby="strength-profile-title">
      <div className="workout-panel-header">
        <div>
          <span className="eyebrow">Strength profile</span>
          <h2 id="strength-profile-title">Calibrated lifts</h2>
        </div>
        {(isLoading || isLoadingDetail) && (
          <Loader2 className="spin-icon" size={18} aria-hidden="true" />
        )}
      </div>

      {errorMessage && (
        <p className="form-message form-message-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!errorMessage && !isLoading && !sortedProfiles.length && (
        <div className="strength-profile-empty">
          <Dumbbell size={20} aria-hidden="true" />
          <strong>No calibrated loaded strength exercises yet.</strong>
        </div>
      )}

      {Boolean(sortedProfiles.length) && (
        <div className="strength-profile-list">
          {sortedProfiles.slice(0, 5).map((profile) => {
            const profileKey = getProfileKey(profile);
            const isSelected = profile.exercise_code === selectedExerciseCode;

            return (
              <button
                type="button"
                key={profileKey}
                className="strength-profile-row"
                data-selected={isSelected ? "true" : "false"}
                disabled={!profile.exercise_code}
                onClick={() => handleProfileSelect(profile)}
              >
                <div>
                  <strong>{profile.exercise_name || profile.exercise_code}</strong>
                  <span>
                    {[
                      formatKg(profile.estimated_1rm_kg)
                        ? `${formatKg(profile.estimated_1rm_kg)} est. 1RM`
                        : null,
                      `${formatPercent(profile.confidence)} confidence`,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                  </span>
                </div>
                <div className="strength-profile-stat">
                  <strong>{formatKg(profile.training_max_kg) || "No load"}</strong>
                  <span>{profile.sample_count || 0} sets</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {detailErrorMessage && (
        <div className="readiness-empty-note">
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{detailErrorMessage}</span>
        </div>
      )}

      {selectedProfile && (
        <section className="strength-profile-detail" aria-label="Strength detail">
          <div className="readiness-section-heading">
            <Target size={16} aria-hidden="true" />
            <strong>{selectedProfile.exercise_name || selectedProfile.exercise_code}</strong>
          </div>

          <div className="strength-target-grid">
            {(selectedProfile.rep_max_targets || []).slice(0, 4).map((target) => (
              <span key={`${target.reps}-${target.load_kg}-${target.source}`}>
                {target.reps || 0}RM {formatKg(target.load_kg) || "No load"}
              </span>
            ))}
            {!selectedProfile.rep_max_targets?.length && (
              <small className="muted-copy">No rep targets returned.</small>
            )}
          </div>

          <div className="strength-source-list">
            {(selectedProfile.source_efforts || []).slice(0, 3).map((effort) => (
              <div key={effort.id || `${effort.workout_id}-${effort.set_order}`}>
                <History size={14} aria-hidden="true" />
                <div>
                  <strong>{formatDisplayDate(effort.workout_date)}</strong>
                  <span>{formatEffortMeta(effort).join(" / ")}</span>
                </div>
              </div>
            ))}
            {selectedProfile.latest_workout_date &&
              !selectedProfile.source_efforts?.length && (
                <small className="muted-copy">
                  Latest workout {formatDisplayDate(selectedProfile.latest_workout_date)}
                </small>
              )}
          </div>
        </section>
      )}
    </section>
  );
}

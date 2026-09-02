import {
  type DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  Loader2,
  Save,
} from "lucide-react";
import { useAuth } from "@/features/auth/context/useAuth";
import {
  getProfileOptions,
  type ProfileOptionsResponse,
  type ProfileRequest,
  type ProfileResponse,
  upsertProfile,
} from "@/features/profile/services/profileApi";

type ProfileEditorProps = {
  profile: ProfileResponse | undefined;
};

type ProfileFormState = {
  birthDate: string;
  activelyTrainingSince: string;
  weightKg: string;
  weeklyTimeBudgetHours: string;
  preferredSportIds: number[];
  preferredTrainingDays: string[];
  enduranceBaselines: EnduranceBaselineSelection[];
  goalPriorities: GoalSelection[];
};

type EnduranceBaselineSelection = {
  sport: string;
  thresholdHrBpm: string;
  maxHrBpm: string;
  restingHrBpm: string;
  ftpWatts: string;
  thresholdSpeedMps: string;
};

type GoalSelection = {
  goalId: number;
  priority: number;
  sportId: number | "";
};

type ProfileSection = "vitals" | "training" | "baselines" | "goals";

const compactProfileQuery = "(max-width: 760px)";

function getIsCompactProfileLayout() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia(compactProfileQuery).matches
  );
}

const weekdays = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

function createBaselineForSport(
  sport: string,
  baseline?: NonNullable<ProfileResponse["endurance_baselines"]>[number]
): EnduranceBaselineSelection {
  return {
    sport,
    thresholdHrBpm: baseline?.threshold_hr_bpm
      ? String(baseline.threshold_hr_bpm)
      : "",
    maxHrBpm: baseline?.max_hr_bpm ? String(baseline.max_hr_bpm) : "",
    restingHrBpm: baseline?.resting_hr_bpm ? String(baseline.resting_hr_bpm) : "",
    ftpWatts: baseline?.ftp_watts ? String(baseline.ftp_watts) : "",
    thresholdSpeedMps: baseline?.threshold_speed_mps
      ? String(baseline.threshold_speed_mps)
      : "",
  };
}

function createInitialState(profile: ProfileResponse | undefined): ProfileFormState {
  return {
    birthDate: profile?.birth_date || "",
    activelyTrainingSince: profile?.actively_training_since || "",
    weightKg: profile?.weight_kg ? String(profile.weight_kg) : "",
    weeklyTimeBudgetHours: profile?.weekly_time_budget_hours
      ? String(profile.weekly_time_budget_hours)
      : "",
    preferredSportIds:
      profile?.preferred_sports?.flatMap((sport) =>
        typeof sport.id === "number" ? [sport.id] : []
      ) || [],
    preferredTrainingDays: profile?.preferred_training_days || [],
    enduranceBaselines:
      profile?.endurance_baselines?.flatMap((baseline) =>
        baseline.sport ? [createBaselineForSport(baseline.sport, baseline)] : []
      ) || [],
    goalPriorities:
      profile?.goal_priorities?.flatMap((goalPriority, index) => {
        if (typeof goalPriority.goal?.id !== "number") {
          return [];
        }

        return [
          {
            goalId: goalPriority.goal.id,
            priority: goalPriority.priority || index + 1,
            sportId: goalPriority.sport?.id || "",
          },
        ];
      }) || [],
  };
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = error as { error?: unknown };

    if (typeof apiError.error === "string" && apiError.error.trim()) {
      return apiError.error;
    }
  }

  return "The profile service did not accept those details.";
}

function toggleNumberValue(values: number[], value: number) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function toggleStringValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function parseOptionalNumber(value: string) {
  const parsedValue = Number(value);

  return value.trim() && Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function hasBaselineMetrics(baseline: EnduranceBaselineSelection) {
  return Boolean(
    parseOptionalNumber(baseline.thresholdHrBpm) ||
      parseOptionalNumber(baseline.maxHrBpm) ||
      parseOptionalNumber(baseline.restingHrBpm) ||
      parseOptionalNumber(baseline.ftpWatts) ||
      parseOptionalNumber(baseline.thresholdSpeedMps)
  );
}

function reorderGoalPriorities(
  goalPriorities: GoalSelection[],
  sourceGoalId: number,
  targetGoalId: number
) {
  const sourceIndex = goalPriorities.findIndex(
    (goalPriority) => goalPriority.goalId === sourceGoalId
  );
  const targetIndex = goalPriorities.findIndex(
    (goalPriority) => goalPriority.goalId === targetGoalId
  );

  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return goalPriorities;
  }

  const reorderedGoals = [...goalPriorities];
  const [movedGoal] = reorderedGoals.splice(sourceIndex, 1);

  if (!movedGoal) {
    return goalPriorities;
  }

  reorderedGoals.splice(targetIndex, 0, movedGoal);

  return reorderedGoals.map((goalPriority, index) => ({
    ...goalPriority,
    priority: index + 1,
  }));
}

export function ProfileEditor({ profile }: ProfileEditorProps) {
  const { refreshSession } = useAuth();
  const [formState, setFormState] = useState(() => createInitialState(profile));
  const [savedState, setSavedState] = useState(() => createInitialState(profile));
  const [options, setOptions] = useState<ProfileOptionsResponse | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggingGoalId, setDraggingGoalId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isCompactLayout, setIsCompactLayout] = useState(
    getIsCompactProfileLayout
  );
  const [openSections, setOpenSections] = useState<Set<ProfileSection>>(
    () => new Set(["vitals"])
  );

  useEffect(() => {
    const nextState = createInitialState(profile);

    setFormState(nextState);
    setSavedState(nextState);
  }, [profile]);

  useEffect(() => {
    let isActive = true;

    setIsLoadingOptions(true);
    setErrorMessage(null);

    getProfileOptions()
      .then((result) => {
        if (!isActive) {
          return;
        }

        if (result.error) {
          setErrorMessage(getErrorMessage(result.error));
          return;
        }

        setOptions(result.data);
      })
      .catch(() => {
        if (isActive) {
          setErrorMessage("Could not load profile options. Try again in a moment.");
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingOptions(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(compactProfileQuery);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsCompactLayout(event.matches);
    };

    setIsCompactLayout(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const formError = useMemo(() => {
    if (!formState.birthDate) {
      return "Birth date is required.";
    }

    if (!formState.activelyTrainingSince) {
      return "Training start date is required.";
    }

    if (!Number(formState.weightKg)) {
      return "Weight is required.";
    }

    if (!Number(formState.weeklyTimeBudgetHours)) {
      return "Weekly time budget is required.";
    }

    if (!formState.preferredSportIds.length) {
      return "Choose at least one preferred sport.";
    }

    if (!formState.preferredTrainingDays.length) {
      return "Choose at least one training day.";
    }

    if (!formState.goalPriorities.length) {
      return "Choose at least one training goal.";
    }

    const missingGoalSport = formState.goalPriorities.some((goalPriority) => {
      const goal = options?.goals?.find((item) => item.id === goalPriority.goalId);

      return Boolean(goal?.allowed_sports?.length) && !goalPriority.sportId;
    });

    if (missingGoalSport) {
      return "Choose a sport for every sport-specific goal.";
    }

    return null;
  }, [formState, options?.goals]);

  function updateField<Field extends keyof ProfileFormState>(
    field: Field,
    value: ProfileFormState[Field]
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function updatePreferredSportIds(preferredSportIds: number[]) {
    const selectedSports =
      options?.sports?.filter(
        (sport) =>
          typeof sport.id === "number" &&
          preferredSportIds.includes(sport.id) &&
          sport.name
      ) || [];

    setFormState((current) => ({
      ...current,
      preferredSportIds,
      enduranceBaselines: selectedSports.map((sport) => {
        const sportKey = sport.name?.toLowerCase().replace(/\s+/g, "_") || "";
        const existing = current.enduranceBaselines.find(
          (baseline) => baseline.sport === sportKey
        );

        return existing || createBaselineForSport(sportKey);
      }),
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function updateBaseline<Field extends keyof EnduranceBaselineSelection>(
    sport: string,
    field: Field,
    value: EnduranceBaselineSelection[Field]
  ) {
    setFormState((current) => ({
      ...current,
      enduranceBaselines: current.enduranceBaselines.map((baseline) =>
        baseline.sport === sport
          ? {
              ...baseline,
              [field]: value,
            }
          : baseline
      ),
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function toggleGoal(goalId: number) {
    setFormState((current) => {
      const isSelected = current.goalPriorities.some(
        (goalPriority) => goalPriority.goalId === goalId
      );

      if (isSelected) {
        const remainingGoals = current.goalPriorities.filter(
          (goalPriority) => goalPriority.goalId !== goalId
        );

        return {
          ...current,
          goalPriorities: remainingGoals.map((goalPriority, index) => ({
            ...goalPriority,
            priority: index + 1,
          })),
        };
      }

      return {
        ...current,
        goalPriorities: [
          ...current.goalPriorities,
          {
            goalId,
            priority: current.goalPriorities.length + 1,
            sportId: "",
          },
        ],
      };
    });
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function updateGoalSport(goalId: number, sportId: string) {
    setFormState((current) => ({
      ...current,
      goalPriorities: current.goalPriorities.map((goalPriority) =>
        goalPriority.goalId === goalId
          ? {
              ...goalPriority,
              sportId: sportId ? Number(sportId) : "",
            }
          : goalPriority
      ),
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function handleGoalDragStart(
    event: DragEvent<HTMLButtonElement>,
    goalId: number
  ) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(goalId));
    setDraggingGoalId(goalId);
  }

  function handleGoalDrop(event: DragEvent<HTMLDivElement>, targetGoalId: number) {
    event.preventDefault();
    const sourceGoalId = Number(event.dataTransfer.getData("text/plain"));

    if (!sourceGoalId) {
      return;
    }

    setFormState((current) => ({
      ...current,
      goalPriorities: reorderGoalPriorities(
        current.goalPriorities,
        sourceGoalId,
        targetGoalId
      ),
    }));
    setDraggingGoalId(null);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function moveGoalPriority(goalId: number, direction: -1 | 1) {
    setFormState((current) => {
      const currentIndex = current.goalPriorities.findIndex(
        (goalPriority) => goalPriority.goalId === goalId
      );
      const targetGoal = current.goalPriorities[currentIndex + direction];

      if (currentIndex < 0 || !targetGoal) {
        return current;
      }

      return {
        ...current,
        goalPriorities: reorderGoalPriorities(
          current.goalPriorities,
          goalId,
          targetGoal.goalId
        ),
      };
    });
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (formError) {
      setErrorMessage(formError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload: ProfileRequest = {
      actively_training_since: formState.activelyTrainingSince,
      birth_date: formState.birthDate,
      goal_priorities: formState.goalPriorities.map((goalPriority) => ({
        goal_id: goalPriority.goalId,
        priority: goalPriority.priority,
        sport_id:
          typeof goalPriority.sportId === "number"
            ? goalPriority.sportId
            : undefined,
      })),
      endurance_baselines: formState.enduranceBaselines
        .filter((baseline) => baseline.sport && hasBaselineMetrics(baseline))
        .map((baseline) => ({
          sport: baseline.sport,
          calibration_source: "manual",
          threshold_hr_bpm: parseOptionalNumber(baseline.thresholdHrBpm),
          max_hr_bpm: parseOptionalNumber(baseline.maxHrBpm),
          resting_hr_bpm: parseOptionalNumber(baseline.restingHrBpm),
          ftp_watts: parseOptionalNumber(baseline.ftpWatts),
          threshold_speed_mps: parseOptionalNumber(baseline.thresholdSpeedMps),
        })),
      preferred_sport_ids: formState.preferredSportIds,
      preferred_training_days: formState.preferredTrainingDays,
      weekly_time_budget_hours: Number(formState.weeklyTimeBudgetHours),
      weight_kg: Number(formState.weightKg),
    };

    try {
      const result = await upsertProfile(payload);

      if (result.error) {
        setErrorMessage(getErrorMessage(result.error));
        return;
      }

      const nextSavedState = createInitialState(result.data);

      setFormState(nextSavedState);
      setSavedState(nextSavedState);
      setSuccessMessage("Profile saved.");
      await refreshSession();
    } catch {
      setErrorMessage("Could not save your profile. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedGoals = formState.goalPriorities
    .map((goalPriority) => ({
      ...goalPriority,
      goal: options?.goals?.find((goal) => goal.id === goalPriority.goalId),
    }))
    .filter((goalPriority) => goalPriority.goal);
  const isDirty = JSON.stringify(formState) !== JSON.stringify(savedState);

  function isSectionOpen(section: ProfileSection) {
    return !isCompactLayout || openSections.has(section);
  }

  function handleSectionToggle(section: ProfileSection, isOpen: boolean) {
    if (!isCompactLayout) {
      return;
    }

    setOpenSections((current) => {
      const next = new Set(current);

      if (isOpen) {
        next.add(section);
      } else {
        next.delete(section);
      }

      return next;
    });
  }

  return (
    <section className="profile-page-panel">
      <div className="profile-page-header">
        <div>
          <span className="eyebrow">Athlete profile</span>
          <h1>Profile</h1>
        </div>
        <div className="profile-identity" aria-label="Account identity">
          <span>{profile?.username || "Athlete"}</span>
          <strong>{profile?.email || "Authenticated account"}</strong>
        </div>
      </div>

      <nav className="profile-section-nav" aria-label="Profile sections">
        <a href="#profile-vitals">Vitals</a>
        <a href="#profile-training">Training</a>
        {formState.enduranceBaselines.length > 0 && (
          <a href="#profile-baselines">Baselines</a>
        )}
        <a href="#profile-goals">Goals</a>
      </nav>

      {isLoadingOptions ? (
        <div className="profile-wizard-loader" role="status">
          <Loader2 size={22} aria-hidden="true" />
          Loading profile options
        </div>
      ) : (
        <form className="profile-editor-form" onSubmit={handleSubmit}>
          <details
            className="profile-editor-section"
            open={isSectionOpen("vitals")}
            onToggle={(event) =>
              handleSectionToggle("vitals", event.currentTarget.open)
            }
          >
            <summary id="profile-vitals"><h2>Vitals</h2></summary>
            <div className="profile-field-grid">
              <label htmlFor="profile-birth-date">Birth date</label>
              <input
                id="profile-birth-date"
                type="date"
                required
                value={formState.birthDate}
                onChange={(event) => updateField("birthDate", event.target.value)}
              />

              <label htmlFor="profile-training-since">Training since</label>
              <input
                id="profile-training-since"
                type="date"
                required
                value={formState.activelyTrainingSince}
                onChange={(event) =>
                  updateField("activelyTrainingSince", event.target.value)
                }
              />

              <label htmlFor="profile-weight-kg">Weight, kg</label>
              <input
                id="profile-weight-kg"
                type="number"
                inputMode="decimal"
                min="1"
                step="0.1"
                required
                value={formState.weightKg}
                onChange={(event) => updateField("weightKg", event.target.value)}
              />

              <label htmlFor="profile-weekly-hours">Weekly hours</label>
              <input
                id="profile-weekly-hours"
                type="number"
                inputMode="decimal"
                min="0.5"
                step="0.5"
                required
                value={formState.weeklyTimeBudgetHours}
                onChange={(event) =>
                  updateField("weeklyTimeBudgetHours", event.target.value)
                }
              />
            </div>
          </details>

          <details
            className="profile-editor-section"
            open={isSectionOpen("training")}
            onToggle={(event) =>
              handleSectionToggle("training", event.currentTarget.open)
            }
          >
            <summary id="profile-training"><h2>Training preferences</h2></summary>
            <fieldset>
              <legend>Preferred sports</legend>
              <div className="choice-grid">
                {options?.sports?.map((sport) => (
                  <label key={sport.id} className="choice-pill">
                    <input
                      type="checkbox"
                      checked={
                        typeof sport.id === "number" &&
                        formState.preferredSportIds.includes(sport.id)
                      }
                      onChange={() => {
                        if (typeof sport.id === "number") {
                          updatePreferredSportIds(
                            toggleNumberValue(formState.preferredSportIds, sport.id)
                          );
                        }
                      }}
                    />
                    {sport.name}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Preferred training days</legend>
              <div className="weekday-grid">
                {weekdays.map((weekday) => (
                  <label key={weekday.value} className="choice-pill">
                    <input
                      type="checkbox"
                      checked={formState.preferredTrainingDays.includes(
                        weekday.value
                      )}
                      onChange={() =>
                        updateField(
                          "preferredTrainingDays",
                          toggleStringValue(
                            formState.preferredTrainingDays,
                            weekday.value
                          )
                        )
                      }
                    />
                    {weekday.label}
                  </label>
                ))}
              </div>
            </fieldset>

          </details>

          {formState.enduranceBaselines.length > 0 && (
            <details
              className="profile-editor-section"
              open={isSectionOpen("baselines")}
              onToggle={(event) =>
                handleSectionToggle("baselines", event.currentTarget.open)
              }
            >
              <summary id="profile-baselines"><h2>Fitness baselines</h2></summary>
              <fieldset>
                <legend>Manual performance markers</legend>
                <div className="baseline-grid">
                  {formState.enduranceBaselines.map((baseline) => (
                    <div key={baseline.sport} className="baseline-card">
                      <strong>{baseline.sport.replace("_", " ")}</strong>
                      <label>
                        Threshold HR
                        <input
                          type="number"
                          min="0"
                          value={baseline.thresholdHrBpm}
                          onChange={(event) =>
                            updateBaseline(
                              baseline.sport,
                              "thresholdHrBpm",
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <label>
                        Max HR
                        <input
                          type="number"
                          min="0"
                          value={baseline.maxHrBpm}
                          onChange={(event) =>
                            updateBaseline(
                              baseline.sport,
                              "maxHrBpm",
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <label>
                        Resting HR
                        <input
                          type="number"
                          min="0"
                          value={baseline.restingHrBpm}
                          onChange={(event) =>
                            updateBaseline(
                              baseline.sport,
                              "restingHrBpm",
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <label>
                        FTP watts
                        <input
                          type="number"
                          min="0"
                          value={baseline.ftpWatts}
                          onChange={(event) =>
                            updateBaseline(
                              baseline.sport,
                              "ftpWatts",
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <label>
                        Threshold m/s
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={baseline.thresholdSpeedMps}
                          onChange={(event) =>
                            updateBaseline(
                              baseline.sport,
                              "thresholdSpeedMps",
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
            </details>
          )}

          <details
            className="profile-editor-section"
            open={isSectionOpen("goals")}
            onToggle={(event) =>
              handleSectionToggle("goals", event.currentTarget.open)
            }
          >
            <summary id="profile-goals"><h2>Goals and priorities</h2></summary>
            <fieldset>
              <legend>Training goals</legend>
              <div className="choice-grid">
                {options?.goals?.map((goal) => (
                  <label key={goal.id} className="choice-pill choice-pill-wide">
                    <input
                      type="checkbox"
                      checked={
                        typeof goal.id === "number" &&
                        formState.goalPriorities.some(
                          (goalPriority) => goalPriority.goalId === goal.id
                        )
                      }
                      onChange={() => {
                        if (typeof goal.id === "number") {
                          toggleGoal(goal.id);
                        }
                      }}
                    />
                    {goal.name}
                  </label>
                ))}
              </div>
            </fieldset>

            {selectedGoals.length > 0 && (
              <div className="goal-priority-list">
                {selectedGoals.map((goalPriority) => {
                  const allowedSports =
                    goalPriority.goal?.allowed_sports?.filter(
                      (sport) => typeof sport.id === "number"
                    ) || [];

                  return (
                    <div
                      key={goalPriority.goalId}
                      className={
                        draggingGoalId === goalPriority.goalId
                          ? "goal-priority-row is-dragging"
                          : "goal-priority-row"
                      }
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) =>
                        handleGoalDrop(event, goalPriority.goalId)
                      }
                    >
                      <button
                        className="goal-drag-handle"
                        type="button"
                        draggable
                        aria-label={`Drag ${goalPriority.goal?.name} priority`}
                        onDragStart={(event) =>
                          handleGoalDragStart(event, goalPriority.goalId)
                        }
                        onDragEnd={() => setDraggingGoalId(null)}
                      >
                        <GripVertical size={17} aria-hidden="true" />
                      </button>
                      <span>{goalPriority.priority}</span>
                      <strong>{goalPriority.goal?.name}</strong>
                      <div className="goal-priority-actions" aria-label="Reorder goal">
                        <button
                          type="button"
                          aria-label={`Move ${goalPriority.goal?.name} up`}
                          disabled={goalPriority.priority === 1}
                          onClick={() => moveGoalPriority(goalPriority.goalId, -1)}
                        >
                          <ArrowUp size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${goalPriority.goal?.name} down`}
                          disabled={goalPriority.priority === selectedGoals.length}
                          onClick={() => moveGoalPriority(goalPriority.goalId, 1)}
                        >
                          <ArrowDown size={15} aria-hidden="true" />
                        </button>
                      </div>
                      {allowedSports.length > 0 && (
                        <select
                          aria-label={`Sport for ${goalPriority.goal?.name}`}
                          required
                          value={goalPriority.sportId}
                          onChange={(event) =>
                            updateGoalSport(
                              goalPriority.goalId,
                              event.target.value
                            )
                          }
                        >
                          <option value="">Sport</option>
                          {allowedSports.map((sport) => (
                            <option key={sport.id} value={sport.id}>
                              {sport.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </details>

          <div className="profile-save-bar">
            <div>
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

              {!errorMessage && !successMessage && (
                <span>{isDirty ? "You have unsaved changes." : "Profile is up to date."}</span>
              )}
            </div>

            <button
              className="primary-button profile-save-button"
              type="submit"
              disabled={isSubmitting || !isDirty}
            >
              {isSubmitting ? "Saving..." : "Save profile"}
              {isSubmitting ? (
                <Loader2 size={17} aria-hidden="true" />
              ) : successMessage ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <Save size={17} aria-hidden="true" />
              )}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

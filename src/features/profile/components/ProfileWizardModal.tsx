import {
  type DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  GripVertical,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/features/auth/context/useAuth";
import {
  getProfileOptions,
  type ProfileOptionsResponse,
  type ProfileRequest,
  type ProfileResponse,
  upsertProfile,
} from "@/features/profile/services/profileApi";

type ProfileWizardModalProps = {
  profile: ProfileResponse | undefined;
};

type WizardStep = 0 | 1 | 2;

type WizardFormState = {
  birthDate: string;
  activelyTrainingSince: string;
  weightKg: string;
  weeklyTimeBudgetHours: string;
  preferredSportIds: number[];
  preferredTrainingDays: string[];
  knownInjuryRiskIds: number[];
  goalPriorities: GoalSelection[];
};

type GoalSelection = {
  goalId: number;
  priority: number;
  sportId: number | "";
};

const weekdays = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

const stepLabels = ["Identity", "Training", "Goals"];

function hasItems<T>(value: T[] | undefined) {
  return Array.isArray(value) && value.length > 0;
}

function needsProfileWizard(profile: ProfileResponse | undefined) {
  if (!profile) {
    return false;
  }

  return (
    !profile.age ||
    !profile.birth_date ||
    !profile.actively_training_since ||
    !hasItems(profile.goal_priorities) ||
    !hasItems(profile.preferred_sports) ||
    !hasItems(profile.preferred_training_days) ||
    !profile.weekly_time_budget_hours ||
    !profile.weight_kg
  );
}

function createInitialState(profile: ProfileResponse | undefined): WizardFormState {
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
    knownInjuryRiskIds:
      profile?.known_injury_risks?.flatMap((injuryRisk) =>
        typeof injuryRisk.id === "number" ? [injuryRisk.id] : []
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

export function ProfileWizardModal({ profile }: ProfileWizardModalProps) {
  const { refreshSession } = useAuth();
  const [formState, setFormState] = useState(() => createInitialState(profile));
  const [options, setOptions] = useState<ProfileOptionsResponse | null>(null);
  const [step, setStep] = useState<WizardStep>(0);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggingGoalId, setDraggingGoalId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const shouldShow = needsProfileWizard(profile);

  useEffect(() => {
    setFormState(createInitialState(profile));
  }, [profile]);

  useEffect(() => {
    if (!shouldShow || options) {
      return;
    }

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
  }, [options, shouldShow]);

  const stepError = useMemo(() => {
    if (step === 0) {
      if (!formState.birthDate) {
        return "Birth date is required.";
      }

      if (!formState.activelyTrainingSince) {
        return "Training start date is required.";
      }

      if (!Number(formState.weightKg)) {
        return "Weight is required.";
      }
    }

    if (step === 1) {
      if (!formState.preferredSportIds.length) {
        return "Choose at least one preferred sport.";
      }

      if (!formState.preferredTrainingDays.length) {
        return "Choose at least one training day.";
      }

      if (!Number(formState.weeklyTimeBudgetHours)) {
        return "Weekly time budget is required.";
      }
    }

    if (step === 2) {
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
    }

    return null;
  }, [formState, options?.goals, step]);

  if (!shouldShow) {
    return null;
  }

  function updateField<Field extends keyof WizardFormState>(
    field: Field,
    value: WizardFormState[Field]
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
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

  function moveToNextStep() {
    if (stepError) {
      setErrorMessage(stepError);
      return;
    }

    setErrorMessage(null);
    setStep((current) => Math.min(current + 1, 2) as WizardStep);
  }

  function moveToPreviousStep() {
    setErrorMessage(null);
    setStep((current) => Math.max(current - 1, 0) as WizardStep);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (stepError) {
      setErrorMessage(stepError);
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
      known_injury_risk_ids: formState.knownInjuryRiskIds,
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

  return (
    <div className="profile-wizard-backdrop" role="presentation">
      <section
        className="profile-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-wizard-title"
      >
        <div className="profile-wizard-header">
          <div>
            <span className="eyebrow">Profile setup</span>
            <h2 id="profile-wizard-title">Complete your athlete profile</h2>
          </div>
          <div className="profile-wizard-progress" aria-label="Profile setup steps">
            {stepLabels.map((label, index) => (
              <span
                key={label}
                className={index === step ? "is-active" : ""}
                aria-current={index === step ? "step" : undefined}
              >
                {index + 1}
              </span>
            ))}
          </div>
        </div>

        {isLoadingOptions ? (
          <div className="profile-wizard-loader" role="status">
            <Loader2 size={22} aria-hidden="true" />
            Loading profile options
          </div>
        ) : (
          <form className="profile-wizard-form" onSubmit={handleSubmit}>
            {step === 0 && (
              <div className="profile-wizard-step">
                <label htmlFor="birth-date">Birth date</label>
                <input
                  id="birth-date"
                  type="date"
                  required
                  value={formState.birthDate}
                  onChange={(event) => updateField("birthDate", event.target.value)}
                />

                <label htmlFor="training-since">Training since</label>
                <input
                  id="training-since"
                  type="date"
                  required
                  value={formState.activelyTrainingSince}
                  onChange={(event) =>
                    updateField("activelyTrainingSince", event.target.value)
                  }
                />

                <label htmlFor="weight-kg">Weight, kg</label>
                <input
                  id="weight-kg"
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="0.1"
                  required
                  value={formState.weightKg}
                  onChange={(event) => updateField("weightKg", event.target.value)}
                />
              </div>
            )}

            {step === 1 && (
              <div className="profile-wizard-step">
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
                              updateField(
                                "preferredSportIds",
                                toggleNumberValue(
                                  formState.preferredSportIds,
                                  sport.id
                                )
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
                  <legend>Training days</legend>
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

                <label htmlFor="weekly-hours">Weekly time budget, hours</label>
                <input
                  id="weekly-hours"
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
            )}

            {step === 2 && (
              <div className="profile-wizard-step">
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

                <fieldset>
                  <legend>Known injury risks</legend>
                  <div className="choice-grid">
                    {options?.injury_risks?.map((injuryRisk) => (
                      <label key={injuryRisk.id} className="choice-pill">
                        <input
                          type="checkbox"
                          checked={
                            typeof injuryRisk.id === "number" &&
                            formState.knownInjuryRiskIds.includes(injuryRisk.id)
                          }
                          onChange={() => {
                            if (typeof injuryRisk.id === "number") {
                              updateField(
                                "knownInjuryRiskIds",
                                toggleNumberValue(
                                  formState.knownInjuryRiskIds,
                                  injuryRisk.id
                                )
                              );
                            }
                          }}
                        />
                        {injuryRisk.name}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}

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

            <div className="profile-wizard-actions">
              <button
                className="ghost-button"
                type="button"
                disabled={step === 0 || isSubmitting}
                onClick={moveToPreviousStep}
              >
                <ArrowLeft size={17} aria-hidden="true" />
                Back
              </button>

              {step < 2 ? (
                <button
                  className="primary-button"
                  type="button"
                  onClick={moveToNextStep}
                >
                  Continue
                  <ArrowRight size={17} aria-hidden="true" />
                </button>
              ) : (
                <button
                  className="primary-button"
                  type="submit"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save profile"}
                  {isSubmitting ? (
                    <Loader2 size={17} aria-hidden="true" />
                  ) : (
                    <Check size={17} aria-hidden="true" />
                  )}
                </button>
              )}
            </div>
          </form>
        )}

      </section>
    </div>
  );
}

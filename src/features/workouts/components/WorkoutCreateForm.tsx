import { FormEvent, useEffect, useMemo, useState } from "react";
import { Copy, Plus, Save, Trash2 } from "lucide-react";
import {
  createWorkout,
  type ExerciseSetRequest,
  type WorkoutCatalogResponse,
  type WorkoutComponentRequest,
  type WorkoutRequest,
  type WorkoutResponse,
} from "@/features/workouts/services/workoutApi";
import {
  seededExercises,
  seededSports,
  workoutCategories,
  workoutComponentTypes,
  workoutIntensityZones,
} from "@/features/workouts/services/workoutOptions";

type WorkoutCreateFormProps = {
  catalog: WorkoutCatalogResponse | null;
  selectedDate: string;
  onCreated: (workout: WorkoutResponse) => void;
  showHeader?: boolean;
};

type WorkoutFormState = {
  date: string;
  category: string;
  subtype: string;
  sport: string;
  title: string;
  durationMinutes: string;
  rpe: string;
  planned: boolean;
  completed: boolean;
  notes: string;
  primaryAdaptations: string;
  secondaryAdaptations: string;
};

type ComponentRow = {
  id: string;
  type: string;
  sport: string;
  durationSeconds: string;
  distanceM: string;
  intensityZone: string;
  repeats: string;
  exerciseCode: string;
  targetType: string;
  sets: SetRow[];
};

type SetRow = {
  id: string;
  reps: string;
  loadKg: string;
  rir: string;
  rpe: string;
  durationSeconds: string;
  distanceM: string;
  tempo: string;
  isWarmup: boolean;
};

const enduranceComponentTypes = new Set([
  "warmup",
  "interval_block",
  "cooldown",
  "steady",
  "recovery",
  "run",
  "ride",
  "row",
]);

const defaultSetRow: Omit<SetRow, "id"> = {
  reps: "",
  loadKg: "",
  rir: "",
  rpe: "",
  durationSeconds: "",
  distanceM: "",
  tempo: "",
  isWarmup: false,
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSetRow(overrides: Partial<SetRow> = {}): SetRow {
  return {
    ...defaultSetRow,
    id: createId("set"),
    ...overrides,
  };
}

function createComponentRow(overrides: Partial<ComponentRow> = {}): ComponentRow {
  const type = overrides.type || "interval_block";

  return {
    id: createId("component"),
    type,
    sport: "running",
    durationSeconds: type === "exercise" ? "" : "300",
    distanceM: "",
    intensityZone: "threshold",
    repeats: type === "interval_block" ? "4" : "",
    exerciseCode: "back_squat",
    targetType: "",
    sets:
      type === "exercise"
        ? [
            createSetRow({ reps: "5", loadKg: "", rir: "2" }),
            createSetRow({ reps: "5", loadKg: "", rir: "2" }),
          ]
        : [],
    ...overrides,
  };
}

function createInitialState(selectedDate: string): WorkoutFormState {
  return {
    date: selectedDate,
    category: "endurance",
    subtype: "threshold",
    sport: "running",
    title: "",
    durationMinutes: "52",
    rpe: "8",
    planned: false,
    completed: true,
    notes: "",
    primaryAdaptations: "threshold",
    secondaryAdaptations: "running_durability",
  };
}

function getInitialComponents() {
  return [
    createComponentRow({
      type: "warmup",
      durationSeconds: "600",
      intensityZone: "easy",
      repeats: "",
    }),
    createComponentRow(),
    createComponentRow({
      type: "cooldown",
      durationSeconds: "600",
      intensityZone: "easy",
      repeats: "",
    }),
  ];
}

function getErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "error" in error) {
    const apiError = error as { error?: unknown };

    if (typeof apiError.error === "string" && apiError.error.trim()) {
      return apiError.error;
    }
  }

  return "The workout service did not accept that workout.";
}

function formatOptionLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseOptionalNumber(value: string) {
  const parsedValue = Number(value);

  return value.trim() && Number.isFinite(parsedValue) ? parsedValue : undefined;
}

function parsePositiveNumber(value: string) {
  const parsedValue = parseOptionalNumber(value);

  return typeof parsedValue === "number" && parsedValue > 0
    ? parsedValue
    : undefined;
}

function parseTags(value: string) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function hasSetWork(set: SetRow) {
  return Boolean(
    parsePositiveNumber(set.reps) ||
      parsePositiveNumber(set.loadKg) ||
      parsePositiveNumber(set.durationSeconds) ||
      parsePositiveNumber(set.distanceM) ||
      parseOptionalNumber(set.rpe) ||
      parseOptionalNumber(set.rir) ||
      set.tempo.trim()
  );
}

function getSportOptions(catalog: WorkoutCatalogResponse | null) {
  const catalogSports =
    catalog?.sport_muscle_maps?.flatMap((map) => (map.sport ? [map.sport] : [])) ||
    [];

  return Array.from(new Set([...catalogSports, ...seededSports])).sort();
}

function getExerciseOptions(catalog: WorkoutCatalogResponse | null) {
  const options = new Map<string, string>();

  seededExercises.forEach((exercise) => {
    options.set(exercise.code, exercise.name);
  });

  catalog?.exercises?.forEach((exercise) => {
    if (exercise.code) {
      options.set(exercise.code, exercise.name || formatOptionLabel(exercise.code));
    }
  });

  return Array.from(options.entries()).map(([code, name]) => ({ code, name }));
}

function buildSetPayload(set: SetRow, index: number): ExerciseSetRequest {
  return {
    set_order: index + 1,
    reps: parseOptionalNumber(set.reps),
    load_kg: parseOptionalNumber(set.loadKg),
    rir: parseOptionalNumber(set.rir),
    rpe: parseOptionalNumber(set.rpe),
    duration_seconds: parseOptionalNumber(set.durationSeconds),
    distance_m: parseOptionalNumber(set.distanceM),
    tempo: set.tempo.trim() || undefined,
    is_warmup: set.isWarmup,
  };
}

function buildComponentPayload(
  component: ComponentRow,
  order: number
): WorkoutComponentRequest {
  if (component.type === "exercise") {
    return {
      type: "exercise",
      order,
      exercise_code: component.exerciseCode,
      sets: component.sets.filter(hasSetWork).map(buildSetPayload),
    };
  }

  return {
    type: component.type,
    order,
    sport: component.sport,
    duration_seconds: parseOptionalNumber(component.durationSeconds),
    distance_m: parseOptionalNumber(component.distanceM),
    intensity_zone: component.intensityZone,
    repeats: parseOptionalNumber(component.repeats),
    target_type: component.targetType.trim() || undefined,
  };
}

function getComponentError(component: ComponentRow, index: number) {
  const label = `Component ${index + 1}`;

  if (!component.type) {
    return `${label} needs a type.`;
  }

  if (component.type === "exercise") {
    if (!component.exerciseCode) {
      return `${label} needs an exercise.`;
    }

    if (!component.sets.some(hasSetWork)) {
      return `${label} needs at least one configured set.`;
    }

    return null;
  }

  if (enduranceComponentTypes.has(component.type) && !component.sport) {
    return `${label} needs a sport.`;
  }

  const hasDuration = Boolean(parsePositiveNumber(component.durationSeconds));
  const hasDistance = Boolean(parsePositiveNumber(component.distanceM));

  if (!hasDuration && !hasDistance) {
    return `${label} needs duration or distance.`;
  }

  return null;
}

export function WorkoutCreateForm({
  catalog,
  selectedDate,
  onCreated,
  showHeader = true,
}: WorkoutCreateFormProps) {
  const [formState, setFormState] = useState(() => createInitialState(selectedDate));
  const [components, setComponents] = useState<ComponentRow[]>(getInitialComponents);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sportOptions = useMemo(() => getSportOptions(catalog), [catalog]);
  const exerciseOptions = useMemo(() => getExerciseOptions(catalog), [catalog]);

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      date: selectedDate,
    }));
  }, [selectedDate]);

  const formError = useMemo(() => {
    if (!formState.date) {
      return "Workout date is required.";
    }

    if (!formState.title.trim()) {
      return "Workout title is required.";
    }

    if (!parsePositiveNumber(formState.durationMinutes)) {
      return "Duration must be greater than zero.";
    }

    const rpe = parseOptionalNumber(formState.rpe);

    if (typeof rpe !== "number" || rpe < 1 || rpe > 10) {
      return "RPE must be between 1 and 10.";
    }

    if (!components.length) {
      return "Add at least one workout component.";
    }

    for (let index = 0; index < components.length; index += 1) {
      const component = components[index];

      if (!component) {
        continue;
      }

      const componentError = getComponentError(component, index);

      if (componentError) {
        return componentError;
      }
    }

    return null;
  }, [components, formState]);

  function updateField<Field extends keyof WorkoutFormState>(
    field: Field,
    value: WorkoutFormState[Field]
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function updateComponent<Field extends keyof ComponentRow>(
    componentId: string,
    field: Field,
    value: ComponentRow[Field]
  ) {
    setComponents((current) =>
      current.map((component) => {
        if (component.id !== componentId) {
          return component;
        }

        if (field === "type" && value === "exercise" && !component.sets.length) {
          return {
            ...component,
            [field]: value,
            sets: [
              createSetRow({ reps: "5", rir: "2" }),
              createSetRow({ reps: "5", rir: "2" }),
            ],
          };
        }

        return {
          ...component,
          [field]: value,
        };
      })
    );
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function updateSet<Field extends keyof SetRow>(
    componentId: string,
    setId: string,
    field: Field,
    value: SetRow[Field]
  ) {
    setComponents((current) =>
      current.map((component) =>
        component.id === componentId
          ? {
              ...component,
              sets: component.sets.map((set) =>
                set.id === setId
                  ? {
                      ...set,
                      [field]: value,
                    }
                  : set
              ),
            }
          : component
      )
    );
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function addComponent(type = "interval_block") {
    setComponents((current) => [
      ...current,
      createComponentRow({
        type,
        sport: formState.sport || "running",
        ...(type === "exercise" ? { durationSeconds: "", repeats: "" } : {}),
      }),
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (formError) {
      setErrorMessage(formError);
      return;
    }

    const payload: WorkoutRequest = {
      date: formState.date,
      category: formState.category,
      subtype: formState.subtype.trim() || undefined,
      sport: formState.sport || undefined,
      title: formState.title.trim(),
      duration_minutes: parseOptionalNumber(formState.durationMinutes),
      rpe: parseOptionalNumber(formState.rpe),
      source: "manual",
      planned: formState.planned,
      completed: formState.completed,
      notes: formState.notes.trim() || undefined,
      primary_adaptations: parseTags(formState.primaryAdaptations),
      secondary_adaptations: parseTags(formState.secondaryAdaptations),
      components: components.map((component, index) =>
        buildComponentPayload(component, index + 1)
      ),
    };

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await createWorkout(payload);

      if (result.error) {
        setErrorMessage(getErrorMessage(result.error));
        return;
      }

      setSuccessMessage("Workout saved. Load signals are ready.");
      onCreated(result.data);
      setFormState((current) => ({
        ...createInitialState(result.data.date || current.date),
        title: "",
      }));
      setComponents(getInitialComponents());
    } catch {
      setErrorMessage("Could not reach the workout service. Try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section
      className="workout-create-panel"
      aria-labelledby={showHeader ? "workout-create-title" : undefined}
      aria-label={showHeader ? undefined : "New workout"}
    >
      {showHeader && (
        <div className="workout-panel-header">
          <div>
            <span className="eyebrow">New workout</span>
            <h2 id="workout-create-title">Manual entry</h2>
          </div>
        </div>
      )}

      <form className="workout-form" onSubmit={handleSubmit}>
        <div className="workout-form-grid">
          <label>
            Date
            <input
              type="date"
              value={formState.date}
              onChange={(event) => updateField("date", event.target.value)}
              required
            />
          </label>

          <label>
            Category
            <select
              value={formState.category}
              onChange={(event) => updateField("category", event.target.value)}
            >
              {workoutCategories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Sport
            <select
              value={formState.sport}
              onChange={(event) => updateField("sport", event.target.value)}
            >
              {sportOptions.map((sport) => (
                <option key={sport} value={sport}>
                  {formatOptionLabel(sport)}
                </option>
              ))}
            </select>
          </label>

          <label>
            RPE
            <input
              type="number"
              min="1"
              max="10"
              value={formState.rpe}
              onChange={(event) => updateField("rpe", event.target.value)}
              required
            />
          </label>

          <label className="workout-form-wide">
            Title
            <input
              type="text"
              value={formState.title}
              placeholder="4 x 5 min threshold run + squats"
              onChange={(event) => updateField("title", event.target.value)}
              required
            />
          </label>

          <label>
            Subtype
            <input
              type="text"
              value={formState.subtype}
              placeholder="threshold"
              onChange={(event) => updateField("subtype", event.target.value)}
            />
          </label>

          <label>
            Duration
            <input
              type="number"
              min="1"
              value={formState.durationMinutes}
              onChange={(event) => updateField("durationMinutes", event.target.value)}
              required
            />
          </label>
        </div>

        <section className="workout-component-builder">
          <div className="workout-builder-header">
            <div>
              <span className="eyebrow">Components</span>
              <h3>Session structure</h3>
            </div>
            <div className="workout-builder-actions">
              <button
                type="button"
                className="secondary-button workout-inline-button"
                onClick={() => addComponent("interval_block")}
              >
                <Plus size={16} aria-hidden="true" />
                Cardio
              </button>
              <button
                type="button"
                className="secondary-button workout-inline-button"
                onClick={() => addComponent("exercise")}
              >
                <Plus size={16} aria-hidden="true" />
                Exercise
              </button>
            </div>
          </div>

          <div className="workout-component-editor-list">
            {components.map((component, componentIndex) => (
              <section key={component.id} className="workout-component-editor">
                <div className="workout-component-editor-header">
                  <strong>{componentIndex + 1}</strong>
                  <label>
                    Type
                    <select
                      value={component.type}
                      onChange={(event) =>
                        updateComponent(component.id, "type", event.target.value)
                      }
                    >
                      {workoutComponentTypes.map((componentType) => (
                        <option key={componentType.value} value={componentType.value}>
                          {componentType.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="workout-component-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Duplicate component"
                      onClick={() =>
                        setComponents((current) => [
                          ...current.slice(0, componentIndex + 1),
                          {
                            ...component,
                            id: createId("component"),
                            sets: component.sets.map((set) => ({
                              ...set,
                              id: createId("set"),
                            })),
                          },
                          ...current.slice(componentIndex + 1),
                        ])
                      }
                    >
                      <Copy size={15} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove component"
                      disabled={components.length === 1}
                      onClick={() =>
                        setComponents((current) =>
                          current.filter((item) => item.id !== component.id)
                        )
                      }
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {component.type === "exercise" ? (
                  <div className="workout-form-section">
                    <label>
                      Exercise
                      <select
                        value={component.exerciseCode}
                        onChange={(event) =>
                          updateComponent(
                            component.id,
                            "exerciseCode",
                            event.target.value
                          )
                        }
                      >
                        {exerciseOptions.map((exercise) => (
                          <option key={exercise.code} value={exercise.code}>
                            {exercise.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="workout-set-list">
                      <div className="workout-set-heading" aria-hidden="true">
                        <span>Set</span>
                        <span>Reps</span>
                        <span>kg</span>
                        <span>RIR</span>
                        <span>RPE</span>
                        <span>Sec</span>
                        <span>m</span>
                        <span>Tempo</span>
                        <span>Warm</span>
                        <span />
                      </div>

                      {component.sets.map((set, setIndex) => (
                        <div key={set.id} className="workout-set-row">
                          <span>{setIndex + 1}</span>
                          <input
                            type="number"
                            min="0"
                            placeholder="Reps"
                            value={set.reps}
                            onChange={(event) =>
                              updateSet(
                                component.id,
                                set.id,
                                "reps",
                                event.target.value
                              )
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="kg"
                            value={set.loadKg}
                            onChange={(event) =>
                              updateSet(
                                component.id,
                                set.id,
                                "loadKg",
                                event.target.value
                              )
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            max="10"
                            placeholder="RIR"
                            value={set.rir}
                            onChange={(event) =>
                              updateSet(component.id, set.id, "rir", event.target.value)
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            max="10"
                            placeholder="RPE"
                            value={set.rpe}
                            onChange={(event) =>
                              updateSet(component.id, set.id, "rpe", event.target.value)
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="Sec"
                            value={set.durationSeconds}
                            onChange={(event) =>
                              updateSet(
                                component.id,
                                set.id,
                                "durationSeconds",
                                event.target.value
                              )
                            }
                          />
                          <input
                            type="number"
                            min="0"
                            placeholder="m"
                            value={set.distanceM}
                            onChange={(event) =>
                              updateSet(
                                component.id,
                                set.id,
                                "distanceM",
                                event.target.value
                              )
                            }
                          />
                          <input
                            type="text"
                            placeholder="3-1-1"
                            value={set.tempo}
                            onChange={(event) =>
                              updateSet(component.id, set.id, "tempo", event.target.value)
                            }
                          />
                          <label className="compact-checkbox compact-checkbox-icon">
                            <input
                              type="checkbox"
                              checked={set.isWarmup}
                              onChange={(event) =>
                                updateSet(
                                  component.id,
                                  set.id,
                                  "isWarmup",
                                  event.target.checked
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Remove set"
                            disabled={component.sets.length === 1}
                            onClick={() =>
                              setComponents((current) =>
                                current.map((item) =>
                                  item.id === component.id
                                    ? {
                                        ...item,
                                        sets: item.sets.filter(
                                          (setItem) => setItem.id !== set.id
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="secondary-button workout-add-set-button"
                      onClick={() =>
                        setComponents((current) =>
                          current.map((item) =>
                            item.id === component.id
                              ? {
                                  ...item,
                                  sets: [...item.sets, createSetRow()],
                                }
                              : item
                          )
                        )
                      }
                    >
                      <Plus size={17} aria-hidden="true" />
                      Add set
                    </button>
                  </div>
                ) : (
                  <div className="workout-form-grid">
                    <label>
                      Sport
                      <select
                        value={component.sport}
                        onChange={(event) =>
                          updateComponent(component.id, "sport", event.target.value)
                        }
                      >
                        {sportOptions.map((sport) => (
                          <option key={sport} value={sport}>
                            {formatOptionLabel(sport)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Zone
                      <select
                        value={component.intensityZone}
                        onChange={(event) =>
                          updateComponent(
                            component.id,
                            "intensityZone",
                            event.target.value
                          )
                        }
                      >
                        {workoutIntensityZones.map((zone) => (
                          <option key={zone.value} value={zone.value}>
                            {zone.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Seconds
                      <input
                        type="number"
                        min="0"
                        value={component.durationSeconds}
                        onChange={(event) =>
                          updateComponent(
                            component.id,
                            "durationSeconds",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label>
                      Distance m
                      <input
                        type="number"
                        min="0"
                        value={component.distanceM}
                        onChange={(event) =>
                          updateComponent(component.id, "distanceM", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Repeats
                      <input
                        type="number"
                        min="0"
                        value={component.repeats}
                        onChange={(event) =>
                          updateComponent(component.id, "repeats", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      Target type
                      <input
                        type="text"
                        value={component.targetType}
                        placeholder="pace, watts, HR"
                        onChange={(event) =>
                          updateComponent(component.id, "targetType", event.target.value)
                        }
                      />
                    </label>
                  </div>
                )}
              </section>
            ))}
          </div>
        </section>

        <div className="workout-form-grid">
          <label className="workout-form-wide">
            Primary adaptations
            <input
              type="text"
              value={formState.primaryAdaptations}
              onChange={(event) =>
                updateField("primaryAdaptations", event.target.value)
              }
            />
          </label>

          <label className="workout-form-wide">
            Secondary adaptations
            <input
              type="text"
              value={formState.secondaryAdaptations}
              onChange={(event) =>
                updateField("secondaryAdaptations", event.target.value)
              }
            />
          </label>

          <label className="workout-form-wide">
            Notes
            <textarea
              value={formState.notes}
              rows={3}
              placeholder="Calves slightly tight"
              onChange={(event) => updateField("notes", event.target.value)}
            />
          </label>
        </div>

        <div className="workout-check-row">
          <label className="choice-pill">
            <input
              type="checkbox"
              checked={formState.completed}
              onChange={(event) => updateField("completed", event.target.checked)}
            />
            Completed
          </label>
          <label className="choice-pill">
            <input
              type="checkbox"
              checked={formState.planned}
              onChange={(event) => updateField("planned", event.target.checked)}
            />
            Planned
          </label>
        </div>

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
          <Save size={17} aria-hidden="true" />
          {isSubmitting ? "Saving workout..." : "Save workout"}
        </button>
      </form>
    </section>
  );
}

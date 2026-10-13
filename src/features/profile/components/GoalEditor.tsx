import type { Goal, ProfileDraft, Sport } from "@/features/profile/services/profileModel";

type GoalEditorProps = {
  draft: ProfileDraft;
  goals: Goal[];
  sports: Sport[];
  primaryOnly?: boolean;
  onChange: (draft: ProfileDraft) => void;
};

export function GoalEditor({ draft, goals, sports, primaryOnly = false, onChange }: GoalEditorProps) {
  const availableGoals = goals.filter((goal) => typeof goal.id === "number" && !draft.goals.some((item) => item.goalId === goal.id));

  function selectedSports(goal: Goal) {
    const selected = sports.filter((sport) => typeof sport.id === "number" && draft.preferredSportIds.includes(sport.id));
    const allowedIds = goal.allowed_sports?.map((sport) => sport.id) || [];
    return allowedIds.length ? selected.filter((sport) => allowedIds.includes(sport.id)) : selected;
  }

  function addGoal(id: number) {
    const goal = goals.find((item) => item.id === id);
    if (!goal) return;
    const compatible = selectedSports(goal);
    const sportId = goal.allowed_sports?.length && compatible.length === 1 ? compatible[0]?.id || "" : "";
    onChange({
      ...draft,
      goals: primaryOnly
        ? [{ goalId: id, sportId }, ...draft.goals.filter((item) => item.goalId !== id).slice(1)]
        : [...draft.goals, { goalId: id, sportId }],
    });
  }

  return (
    <div className="profile-input-stack">
      {primaryOnly ? (
        <fieldset>
          <legend>Choose one goal to guide your training</legend>
          <div className="goal-choice-list">
            {goals.map((goal) => {
              if (typeof goal.id !== "number") return null;
              const compatible = selectedSports(goal);
              const disabled = Boolean(goal.allowed_sports?.length) && !compatible.length;
              return (
                <button key={goal.id} type="button" disabled={disabled}
                  aria-pressed={draft.goals[0]?.goalId === goal.id}
                  onClick={() => addGoal(goal.id!)}>
                  <strong>{goal.name}</strong>
                  {goal.description && <small>{goal.description}</small>}
                  {disabled && <small>Add a compatible activity to choose this goal.</small>}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <label>Add goal
          <select value="" onChange={(event) => {
            if (event.target.value) addGoal(Number(event.target.value));
          }}>
            <option value="">Choose a goal</option>
            {availableGoals.map((goal) => <option key={goal.id} value={goal.id}
              disabled={Boolean(goal.allowed_sports?.length) && !selectedSports(goal).length}>{goal.name}</option>)}
          </select>
        </label>
      )}
      {draft.goals.map((item, index) => {
        const goal = goals.find((candidate) => candidate.id === item.goalId);
        if (!goal) return null;
        const compatible = selectedSports(goal);
        return (
          <div className="focused-goal-row" key={item.goalId}>
            <span className="goal-rank">{index + 1}</span>
            <strong>{goal.name}</strong>
            {Boolean(goal.allowed_sports?.length) && (
              <label>Activity
                <select value={item.sportId} onChange={(event) => onChange({
                  ...draft,
                  goals: draft.goals.map((candidate) => candidate.goalId === item.goalId
                    ? { ...candidate, sportId: event.target.value ? Number(event.target.value) : "" }
                    : candidate),
                })}>
                  <option value="">Choose activity</option>
                  {compatible.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}
                </select>
              </label>
            )}
            {!primaryOnly && (
              <div className="focused-goal-actions">
                <button type="button" disabled={index === 0} aria-label={`Move ${goal.name} up`} onClick={() => {
                  const next = [...draft.goals];
                  const moved = next.splice(index, 1)[0];
                  if (moved) next.splice(index - 1, 0, moved);
                  onChange({ ...draft, goals: next });
                }}>Up</button>
                <button type="button" disabled={index === draft.goals.length - 1} aria-label={`Move ${goal.name} down`} onClick={() => {
                  const next = [...draft.goals];
                  const moved = next.splice(index, 1)[0];
                  if (moved) next.splice(index + 1, 0, moved);
                  onChange({ ...draft, goals: next });
                }}>Down</button>
                <button type="button" aria-label={`Remove ${goal.name}`} onClick={() => onChange({
                  ...draft,
                  goals: draft.goals.filter((candidate) => candidate.goalId !== item.goalId),
                })}>Remove</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

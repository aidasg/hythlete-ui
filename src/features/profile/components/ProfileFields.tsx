import { getDetectedTimeZone } from "@/features/profile/services/timezones";
import type { ProfileDraft } from "@/features/profile/services/profileModel";
import { weekdays } from "@/features/profile/services/profileModel";

type FieldsProps = {
  draft: ProfileDraft;
  onChange: (draft: ProfileDraft) => void;
};

export function ScheduleFields({ draft, onChange }: FieldsProps) {
  return (
    <div className="profile-input-stack">
      <fieldset>
        <legend>Preferred training days</legend>
        <div className="weekday-grid">
          {weekdays.map((day) => (
            <label key={day.value} className="choice-pill">
              <input type="checkbox" checked={draft.preferredTrainingDays.includes(day.value)}
                onChange={() => onChange({
                  ...draft,
                  preferredTrainingDays: draft.preferredTrainingDays.includes(day.value)
                    ? draft.preferredTrainingDays.filter((value) => value !== day.value)
                    : [...draft.preferredTrainingDays, day.value],
                })} />
              {day.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label>Weekly time budget, hours
        <input type="number" inputMode="decimal" min="0.5" step="0.5" value={draft.weeklyTimeBudgetHours}
          onChange={(event) => onChange({ ...draft, weeklyTimeBudgetHours: event.target.value })} />
      </label>
    </div>
  );
}

export function PersonalFields({ draft, onChange }: FieldsProps) {
  return (
    <div className="profile-input-stack profile-input-grid">
      <label>Birth date
        <input type="date" value={draft.birthDate}
          onChange={(event) => onChange({ ...draft, birthDate: event.target.value })} />
      </label>
      <label>Training since
        <input type="date" value={draft.activelyTrainingSince}
          onChange={(event) => onChange({ ...draft, activelyTrainingSince: event.target.value })} />
      </label>
      <label>Weight, kg
        <input type="number" inputMode="decimal" min="1" step="0.1" value={draft.weightKg}
          onChange={(event) => onChange({ ...draft, weightKg: event.target.value })} />
      </label>
      <label>Timezone
        <span className="profile-timezone-input">
          <input type="text" value={draft.timezone} placeholder="Europe/Vilnius"
            onChange={(event) => onChange({ ...draft, timezone: event.target.value })} />
          <button type="button" className="secondary-button" onClick={() => onChange({ ...draft, timezone: getDetectedTimeZone() })}>Use detected</button>
        </span>
      </label>
    </div>
  );
}

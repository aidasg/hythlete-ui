import { WeightField } from '@/components/units/UnitFields';
import type { WeightUnit, DistanceUnit } from '@/services/units';
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
      <label>Weight units<select value={draft.weightUnit} onChange={e => onChange({ ...draft, weightUnit: e.target.value as WeightUnit })}><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></label>
      <label>Distance units<select value={draft.distanceUnit} onChange={e => onChange({ ...draft, distanceUnit: e.target.value as DistanceUnit })}><option value="km">Kilometers (km)</option><option value="mi">Miles (mi)</option></select></label>
      <WeightField label="Weight" unit={draft.weightUnit} min={0.001} value={draft.weightKg === '' ? undefined : Number(draft.weightKg)} onChange={v => onChange({ ...draft, weightKg: v === undefined ? '' : String(v) })} />
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

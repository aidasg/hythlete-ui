import { throwApiResponseError } from "@/services/api/errors";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ActivityPicker } from "@/features/profile/components/ActivityPicker";
import { getProfileOptions } from "@/features/profile/services/profileApi";
import { label, sessionFormats } from "@/features/workouts/services/sessionStructure";
export type PlanningDraft = { date: string; minutes: number; activity_mode: "profile" | "any" | "custom"; activities: string[]; equipment: string[]; formats: string[] };
export function PlanningInputs({ value, onChange, disabled }: { value: PlanningDraft; onChange: (value: PlanningDraft) => void; disabled: boolean }) {
  const [picker, setPicker] = useState(false);
  const catalog = useQuery({ queryKey: ["profile", "options"], queryFn: async () => { const result = await getProfileOptions(); if (result.error || !result.data) throwApiResponseError(result); return result.data; }, enabled: value.activity_mode === "custom", retry: false });
  return <fieldset disabled={disabled} className="coach-planning-inputs"><legend>Your next workout</legend>
    <label>Workout date<input type="date" required value={value.date} onChange={event => onChange({ ...value, date: event.target.value })} /></label>
    <label>Available minutes<input type="number" required min={5} max={360} value={value.minutes} onChange={event => onChange({ ...value, minutes: Number(event.target.value) })} /></label>
    <label>Activities<select value={value.activity_mode} onChange={event => onChange({ ...value, activity_mode: event.target.value as PlanningDraft["activity_mode"] })}><option value="profile">My profile activities</option><option value="any">Any supported activity</option><option value="custom">Choose activities</option></select></label>
    {value.activity_mode === "custom" && <><div>{value.activities.map(code => <button className="secondary-button" type="button" key={code} onClick={() => onChange({ ...value, activities: value.activities.filter(item => item !== code) })}>{label(code)} ×</button>)}</div>
      <button className="secondary-button" type="button" onClick={() => setPicker(!picker)}>Browse activities</button>
      {picker && <ActivityPicker sports={catalog.data?.sports || []} selectedIds={(catalog.data?.sports || []).filter(sport => value.activities.includes(sport.code || "")).map(sport => sport.id!)} onClose={() => setPicker(false)} onAdd={sport => { if (sport.code && !value.activities.includes(sport.code)) onChange({ ...value, activities: [...value.activities, sport.code] }); }} />}
      {catalog.error && <p role="alert">{catalog.error.message}</p>}
      {value.activities.length === 0 && <p>Choose at least one activity.</p>}
    </>}
    <label>Format<select value={value.formats[0] || ""} onChange={event => onChange({ ...value, formats: event.target.value ? [event.target.value] : [] })}><option value="">Any supported format</option>{sessionFormats.map(format => <option key={format} value={format}>{label(format)}</option>)}</select></label>
    <fieldset><legend>Available equipment and access</legend><div className="coach-equipment">{["bodyweight", "dumbbell", "barbell", "kettlebell", "machine", "band", "pull_up_bar", "bicycle", "rowing_machine", "rowing_boat", "pool", "open_water"].map(code => <label className="choice-pill" key={code}><input type="checkbox" checked={value.equipment.includes(code)} onChange={event => onChange({ ...value, equipment: event.target.checked ? [...value.equipment, code] : value.equipment.filter(item => item !== code) })} />{label(code)}</label>)}</div></fieldset>
  </fieldset>;
}

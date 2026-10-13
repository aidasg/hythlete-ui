import { useAuth } from "@/features/auth/context/useAuth";
import { getProfileSportCodes } from "@/features/strategy/services/strategyConstraints";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProfileOptions } from "@/features/profile/services/profileApi";
import { ActivityPicker } from "@/features/profile/components/ActivityPicker";
import { sessionFormats, label } from "@/features/workouts/services/sessionStructure";
import type { StrategyConstraints } from "@/features/strategy/services/strategyConstraints";
import type { RankedStrategyOption } from "@/features/strategy/services/strategyApi";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import { Link } from "react-router-dom";
import { paths } from "@/routes/paths";
export function ChangeSession({ value, onApply, onClose, alternatives, onChoose, onSomethingElse }: {
  value: StrategyConstraints; onApply: (v: StrategyConstraints) => void; onClose: () => void;
  alternatives: RankedStrategyOption[]; onChoose: (v: RankedStrategyOption) => void; onSomethingElse: () => void;
}) {
  const { session } = useAuth();
  const favorites = getProfileSportCodes(session?.profile);
  const [draft, setDraft] = useState(value);
  const [picker, setPicker] = useState(false);
  const catalog = useQuery({ queryKey: ["profile", "options"], queryFn: async () => { const r = await getProfileOptions(); if (r.error) throw Error("Cannot load activities"); return r.data; } });
  const sports = catalog.data?.sports || [];
  return <WorkoutModal title="Change today's session" eyebrow="Your choice" onClose={onClose}><div className="today-change">
    <label>Available minutes<input type="number" min={1} max={360} value={draft.availableMinutes} onChange={e => setDraft({ ...draft, availableMinutes: Number(e.target.value) })} /></label>
    <label>Activities<select value={draft.activityMode || "profile"} onChange={e => setDraft({ ...draft, activityMode: e.target.value as StrategyConstraints["activityMode"] })}>
      <option value="profile">My activities</option><option value="any">Any supported activity</option><option value="custom">Choose activities for today</option>
    </select></label>
    {draft.activityMode === "custom" && <><div className="suggested-pill-list">{draft.allowedSports.map(code => <button type="button" key={code} onClick={() => setDraft({ ...draft, allowedSports: draft.allowedSports.filter(s => s !== code) })}>{label(code)} ×</button>)}</div>
      <button className="secondary-button" onClick={() => setPicker(true)}>Browse activities</button>
      {picker && <ActivityPicker sports={sports} favoriteIds={sports.filter(s => favorites.includes(s.code || "")).map(s => s.id!)} selectedIds={sports.filter(s => draft.allowedSports.includes(s.code || "")).map(s => s.id!)} onClose={() => setPicker(false)} onAdd={sport => { if (sport.code) setDraft({ ...draft, allowedSports: [...draft.allowedSports, sport.code] }); }} />}
      {sports.filter(s => draft.allowedSports.includes(s.code || "") && s.coaching_coverage !== "structured").map(s => <p key={s.id}>{s.name}: {label(s.coaching_coverage)}. You can record a self-planned session for this activity.</p>)}
      {catalog.isError && <button onClick={() => void catalog.refetch()}>Retry activity catalog</button>}
    </>}
    <label>Format<select value={draft.formats?.[0] || ""} onChange={e => setDraft({ ...draft, formats: e.target.value ? [e.target.value] : [] })}><option value="">Any format</option>{sessionFormats.map(f => <option key={f} value={f}>{label(f)}</option>)}</select></label>
    <fieldset><legend>Equipment and access</legend>{["bodyweight", "dumbbell", "barbell", "kettlebell", "machine", "band", "pull_up_bar", "bicycle", "rowing_machine", "rowing_boat", "pool", "open_water"].map(e => <label className="choice-pill" key={e}><input type="checkbox" checked={draft.equipment?.includes(e) || false} onChange={() => setDraft({ ...draft, equipment: draft.equipment?.includes(e) ? draft.equipment.filter(v => v !== e) : [...(draft.equipment || []), e] })} />{label(e)}</label>)}</fieldset>
    <button className="primary-button" disabled={!Number.isInteger(draft.availableMinutes) || draft.availableMinutes < 1 || draft.availableMinutes > 360 || (draft.activityMode === "custom" && !draft.allowedSports.length)} onClick={() => onApply({ ...draft, excludedKeys: [] })}>Find a session</button>
    {alternatives.length > 0 && <section><h3>Other sessions that fit</h3>{alternatives.map(o => <button className="secondary-button" key={o.key} onClick={() => onChoose(o)}>{o.session?.title || label(o.focus)}</button>)}</section>}
    <button className="secondary-button" onClick={onSomethingElse}>Something else</button>
    <Link to={paths.workouts}>Record a self-planned workout</Link>
  </div></WorkoutModal>;
}

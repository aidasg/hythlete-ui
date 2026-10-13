import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/context/useAuth";
import { ActivityPicker } from "@/features/profile/components/ActivityPicker";
import { BaselineEditor } from "@/features/profile/components/BaselineEditor";
import { GoalEditor } from "@/features/profile/components/GoalEditor";
import { PersonalFields, ScheduleFields } from "@/features/profile/components/ProfileFields";
import { getProfileOptions, type ProfileOptionsResponse, type ProfileResponse, upsertProfile } from "@/features/profile/services/profileApi";
import {
  baselineMetrics, clearBaseline, createProfileDraft, isProfileComplete, matchingBaseline,
  setBaselineMetric, toProfileRequest, type ProfileDraft, type Sport, validateProfileDraft,
} from "@/features/profile/services/profileModel";
import { invalidateStrategyAndProgress } from "@/services/query/invalidation";
import { paths } from "@/routes/paths";

type Editor = "activities" | "goals" | "schedule" | "personal";
type Props = { profile: ProfileResponse | undefined };

function apiMessage(error: unknown) {
  if (error && typeof error === "object" && "error" in error && typeof error.error === "string") return error.error;
  return "Could not save your profile. Try again.";
}

export function ProfileEditor({ profile }: Props) {
  const { refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProfileDraft>(() => createProfileDraft(profile));
  const [savedDraft, setSavedDraft] = useState<ProfileDraft>(() => createProfileDraft(profile));
  const [options, setOptions] = useState<ProfileOptionsResponse | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [focusedSportId, setFocusedSportId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const next = createProfileDraft(profile);
    setDraft(next);
    setSavedDraft(next);
  }, [profile]);

  async function loadOptions() {
    setLoadingOptions(true);
    setOptionsError(null);
    try {
      const result = await getProfileOptions();
      if (result.error) setOptionsError("Could not load profile options.");
      else setOptions(result.data);
    } catch {
      setOptionsError("Could not load profile options.");
    } finally {
      setLoadingOptions(false);
    }
  }

  useEffect(() => { void loadOptions(); }, []);

  useEffect(() => {
    if (editor) {
      editorRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      editorRef.current?.focus();
    }
  }, [editor]);

  const complete = isProfileComplete(profile);
  const allSports = options?.sports || [];
  const selectedSports = (options?.sports || profile?.preferred_sports || []).filter(
    (sport) => typeof sport.id === "number" && draft.preferredSportIds.includes(sport.id)
  );
  const focusedSport = selectedSports.find((sport) => sport.id === focusedSportId);
  const isDirty = JSON.stringify(draft) !== JSON.stringify(savedDraft);

  function openEditor(next: Editor, sportId?: number) {
    if (editor === next && next === "activities" && sportId) {
      setFocusedSportId(sportId);
      setPickerOpen(false);
      return;
    }
    if (editor && isDirty && !window.confirm("Discard your unsaved profile changes?")) return;
    const current = createProfileDraft(profile);
    setDraft(current);
    setSavedDraft(current);
    setEditor(next);
    setFocusedSportId(sportId || profile?.preferred_sports?.[0]?.id || null);
    setPickerOpen(false);
    setSaveError(null);
    setSuccess(false);
  }

  function update(next: ProfileDraft) {
    setDraft(next);
    setSaveError(null);
    setSuccess(false);
  }

  function addSport(sport: Sport) {
    if (typeof sport.id !== "number") return;
    update({ ...draft, preferredSportIds: [...draft.preferredSportIds, sport.id] });
    setFocusedSportId(sport.id);
    setPickerOpen(false);
    addButtonRef.current?.focus();
  }

  function removeSport(sport: Sport) {
    if (draft.goals.some((goal) => goal.sportId === sport.id)) {
      setSaveError(`Reassign the goal linked to ${sport.name} before removing this activity.`);
      return;
    }
    update({ ...draft, preferredSportIds: draft.preferredSportIds.filter((id) => id !== sport.id) });
    if (focusedSportId === sport.id) {
      setFocusedSportId(draft.preferredSportIds.find((id) => id !== sport.id) || null);
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = validateProfileDraft(draft, options);
    if (error) { setSaveError(error); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const result = await upsertProfile(toProfileRequest(draft));
      if (result.error) { setSaveError(apiMessage(result.error)); return; }
      const next = createProfileDraft(result.data);
      setSavedDraft(next);
      setDraft(next);
      setEditor(null);
      setSuccess(true);
      await refreshSession();
      await invalidateStrategyAndProgress(queryClient);
    } catch {
      setSaveError("Could not save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function panel(kind: Editor, content: ReactNode) {
    if (editor !== kind) return null;
    return (
      <form ref={editorRef} tabIndex={-1} className="focused-editor" onSubmit={save}>
        {content}
        {saveError && <p className="form-message form-message-error" role="alert">{saveError}</p>}
        <div className="focused-editor-actions">
          <button type="button" className="ghost-button" disabled={saving} onClick={() => {
            setDraft(createProfileDraft(profile)); setEditor(null); setPickerOpen(false); setSaveError(null);
          }}>Cancel</button>
          <button type="submit" className="primary-button" disabled={saving || !isDirty}>
            {saving ? "Saving..." : "Save changes"} {saving && <Loader2 size={16} aria-hidden="true" />}
          </button>
        </div>
      </form>
    );
  }

  const primaryGoal = profile?.goal_priorities?.[0]?.goal?.name || "Choose your training goal";
  return (
    <section className="profile-page-panel focused-profile">
      <header className="profile-page-header">
        <div><span className="eyebrow">Athlete profile</span><h1>Your training profile</h1>
          <p>Keep your training direction and the details that shape it in one place.</p></div>
        <div className="profile-identity" aria-label="Account identity">
          <span>{profile?.username || "Athlete"}</span><strong>{profile?.email || "Authenticated account"}</strong>
        </div>
      </header>

      {!complete && <div className="profile-setup-callout">
        <div><strong>Finish your training setup</strong><p>Add your activities, goal, schedule, and personal basics to personalize your plan.</p></div>
        <Link className="primary-button" to={paths.setup}>Continue setup</Link>
      </div>}
      {success && <p className="form-message form-message-success" role="status">Profile saved.</p>}
      {optionsError && <div className="inline-state inline-state-error" role="alert">{optionsError}
        <button type="button" onClick={() => void loadOptions()}>Retry</button></div>}

      <div className="profile-overview-grid">
        <section className="profile-overview-card profile-goal-card">
          <div className="profile-card-heading"><div><span className="eyebrow">Direction</span><h2>Goals</h2></div>
            {complete && <button type="button" className="secondary-button" onClick={() => openEditor("goals")}>Edit goals</button>}</div>
          <strong className="profile-summary-value">{primaryGoal}</strong>
          <p>{profile?.goal_priorities?.length ? `${profile.goal_priorities.length} prioritized ${profile.goal_priorities.length === 1 ? "goal" : "goals"}` : "Start with one primary goal."}</p>
        </section>
        <section className="profile-overview-card profile-activities-card">
          <div className="profile-card-heading"><div><span className="eyebrow">Training</span><h2>Activities</h2></div>
            {complete && <button type="button" className="secondary-button" onClick={() => openEditor("activities")}>Manage activities</button>}</div>
          <p>Choose an activity to edit its fitness baseline.</p>
          <div className="profile-activity-list">
            {profile?.preferred_sports?.length ? profile.preferred_sports.map((sport) => {
              const baseline = matchingBaseline(createProfileDraft(profile), sport);
              const count = baselineMetrics.filter((metric) => Boolean(baseline?.[metric.key])).length;
              return <button className="profile-activity-row" type="button" key={sport.id} disabled={!complete}
                onClick={() => openEditor("activities", sport.id)}>
                <span><strong>{sport.name}</strong><small>{sport.training_category?.replace(/_/g, " ") || "Activity"}</small></span>
                <span>{count ? `${count} ${count === 1 ? "metric" : "metrics"}` : "Add baseline"}</span>
              </button>;
            }) : <p className="profile-empty-note">No activities added yet.</p>}
          </div>
        </section>
        <section className="profile-overview-card">
          <div className="profile-card-heading"><div><span className="eyebrow">Rhythm</span><h2>Schedule</h2></div>
            {complete && <button type="button" className="secondary-button" onClick={() => openEditor("schedule")}>Edit schedule</button>}</div>
          <strong className="profile-summary-value">{profile?.weekly_time_budget_hours ? `${profile.weekly_time_budget_hours} hours / week` : "Set your weekly time"}</strong>
          <p>{profile?.preferred_training_days?.length ? profile.preferred_training_days.map((day) => day.slice(0, 3)).join(", ") : "Not set"}</p>
        </section>
        <section className="profile-overview-card">
          <div className="profile-card-heading"><div><span className="eyebrow">About you</span><h2>Personal basics</h2></div>
            {complete && <button type="button" className="secondary-button" onClick={() => openEditor("personal")}>Edit details</button>}</div>
          <strong className="profile-summary-value">{profile?.weight_kg ? `${profile.weight_kg} kg` : "Add your details"}</strong>
          <p>{profile?.timezone || "Timezone not set"}</p>
        </section>
      </div>

      {panel("activities", <>
        <div className="profile-editor-heading"><div><span className="eyebrow">Focused editor</span><h2>Activities and baselines</h2></div></div>
        {loadingOptions && <p role="status">Loading activities...</p>}
        <div className="activity-workspace">
          <div className="activity-workspace-list">
            {selectedSports.map((sport) => <button type="button" key={sport.id} aria-pressed={focusedSportId === sport.id}
              onClick={() => setFocusedSportId(sport.id || null)}>{sport.name}</button>)}
            <button ref={addButtonRef} type="button" className="secondary-button" onClick={() => setPickerOpen(true)}>
              <Plus size={16} aria-hidden="true" /> Add activity
            </button>
          </div>
          <div className="activity-workspace-detail">
            {pickerOpen ? <ActivityPicker sports={allSports} selectedIds={draft.preferredSportIds} onAdd={addSport}
              onClose={() => { setPickerOpen(false); addButtonRef.current?.focus(); }} /> : focusedSport ? <>
              <BaselineEditor key={focusedSport.id} sport={focusedSport} baseline={matchingBaseline(draft, focusedSport)}
                onChange={(metric, value) => update(setBaselineMetric(draft, focusedSport, metric, value))}
                onClear={() => update(clearBaseline(draft, focusedSport))} />
              <button type="button" className="text-button" onClick={() => removeSport(focusedSport)}>Remove activity from profile</button>
              <p className="profile-help-text">Removing an activity keeps its baseline if you add it again later.</p>
            </> : <p className="profile-empty-note">Add an activity to get started.</p>}
          </div>
        </div>
      </>)}
      {panel("goals", <>
        <div className="profile-editor-heading"><div><span className="eyebrow">Focused editor</span><h2>Goals and priorities</h2></div></div>
        <GoalEditor draft={draft} goals={options?.goals || []} sports={allSports} onChange={update} />
      </>)}
      {panel("schedule", <>
        <div className="profile-editor-heading"><div><span className="eyebrow">Focused editor</span><h2>Training schedule</h2></div></div>
        <ScheduleFields draft={draft} onChange={update} />
      </>)}
      {panel("personal", <>
        <div className="profile-editor-heading"><div><span className="eyebrow">Focused editor</span><h2>Personal basics</h2></div></div>
        <PersonalFields draft={draft} onChange={update} />
      </>)}
    </section>
  );
}

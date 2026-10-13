import { type FormEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, Plus } from "lucide-react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/context/useAuth";
import { ActivityPicker } from "@/features/profile/components/ActivityPicker";
import { GoalEditor } from "@/features/profile/components/GoalEditor";
import { PersonalFields, ScheduleFields } from "@/features/profile/components/ProfileFields";
import { getProfileOptions, type ProfileOptionsResponse, type ProfileResponse, upsertProfile } from "@/features/profile/services/profileApi";
import {
  createProfileDraft, isProfileComplete, toProfileRequest, type ProfileDraft,
  type Sport, validateProfileDraft, validateSetupStep,
} from "@/features/profile/services/profileModel";
import { invalidateStrategyAndProgress } from "@/services/query/invalidation";
import { paths } from "@/routes/paths";

const steps = ["Activities", "Primary goal", "Training schedule", "About you"];

export function ProfileSetup({ profile }: { profile: ProfileResponse | undefined }) {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ProfileDraft>(() => createProfileDraft(profile));
  const [options, setOptions] = useState<ProfileOptionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => setDraft(createProfileDraft(profile)), [profile]);

  async function loadOptions() {
    setLoading(true);
    setError(null);
    try {
      const result = await getProfileOptions();
      if (result.error) setError("Could not load setup options. Try again.");
      else setOptions(result.data);
    } catch {
      setError("Could not load setup options. Try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOptions(); }, []);

  if (isProfileComplete(profile) && !submittedRef.current) return <Navigate to={paths.profile} replace />;

  function update(next: ProfileDraft) { setDraft(next); setError(null); }

  function addSport(sport: Sport) {
    if (typeof sport.id !== "number") return;
    update({ ...draft, preferredSportIds: [...draft.preferredSportIds, sport.id] });
    setPickerOpen(false);
    addButtonRef.current?.focus();
  }

  function removeSport(sport: Sport) {
    if (draft.goals.some((goal) => goal.sportId === sport.id)) {
      setError("Choose another activity for your goal before removing this one.");
      return;
    }
    update({ ...draft, preferredSportIds: draft.preferredSportIds.filter((id) => id !== sport.id) });
  }

  function next() {
    const message = validateSetupStep(step, draft, options);
    if (message) { setError(message); return; }
    setError(null);
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = validateProfileDraft(draft, options);
    if (message) {
      const firstInvalid = steps.findIndex((_, index) => validateSetupStep(index, draft, options));
      if (firstInvalid >= 0) setStep(firstInvalid);
      setError(message);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await upsertProfile(toProfileRequest(draft));
      if (result.error) {
        setError(typeof result.error === "object" && result.error && "error" in result.error && typeof result.error.error === "string"
          ? result.error.error : "Could not save your profile. Try again.");
        return;
      }
      submittedRef.current = true;
      await refreshSession();
      await invalidateStrategyAndProgress(queryClient);
      navigate(paths.dashboard, { replace: true });
    } catch {
      setError("Could not save your profile. Try again.");
    } finally {
      setSaving(false);
    }
  }

  const sports = options?.sports || [];
  const selectedSports = sports.filter((sport) => typeof sport.id === "number" && draft.preferredSportIds.includes(sport.id));
  const dirty = JSON.stringify(draft) !== JSON.stringify(createProfileDraft(profile));

  function skip() {
    if (dirty && !window.confirm("Leave setup and discard these unsaved changes?")) return;
    navigate(paths.dashboard, { replace: true });
  }

  return (
    <section className="profile-setup-page">
      <header className="profile-setup-heading">
        <div><span className="eyebrow">Athlete setup</span><h1>Build your training profile</h1>
          <p>Start with your activities and direction. Fitness baselines can be added later.</p></div>
        <button type="button" className="text-button" onClick={skip}>Skip for now</button>
      </header>
      <ol className="setup-progress" aria-label="Setup steps">
        {steps.map((label, index) => <li key={label} aria-current={index === step ? "step" : undefined}
          className={index === step ? "is-current" : index < step ? "is-complete" : ""}>
          <span>{index + 1}</span><small>{label}</small>
        </li>)}
      </ol>
      <form className="setup-panel" onSubmit={finish}>
        <div className="setup-step-heading"><span className="eyebrow">Step {step + 1} of {steps.length}</span>
          <h2>{steps[step]}</h2>
          {step === 0 && <p>Add the activities you train in. Search by name or browse by category.</p>}
          {step === 1 && <p>Pick the goal that matters most right now. You can add more goals later.</p>}
          {step === 2 && <p>Set a realistic weekly rhythm. You can adjust it at any time.</p>}
          {step === 3 && <p>These details help tailor your training guidance.</p>}
        </div>
        {loading ? <div className="profile-wizard-loader" role="status"><Loader2 size={20} /> Loading profile options</div>
          : !options ? <div className="inline-state inline-state-error">Setup options are unavailable.
            <button type="button" onClick={() => void loadOptions()}>Retry</button></div>
          : <>
            {step === 0 && <div className="profile-input-stack">
              <div className="setup-selected-activities" aria-label="Selected activities">
                {selectedSports.length ? selectedSports.map((sport) => <div key={sport.id}>
                  <span>{sport.name}</span><button type="button" aria-label={`Remove ${sport.name}`} onClick={() => removeSport(sport)}>Remove</button>
                </div>) : <p className="profile-empty-note">No activities selected yet.</p>}
              </div>
              <button ref={addButtonRef} type="button" className="secondary-button setup-add-activity" onClick={() => setPickerOpen(true)}>
                <Plus size={16} aria-hidden="true" /> Add activity
              </button>
              {pickerOpen && <ActivityPicker sports={sports} selectedIds={draft.preferredSportIds} onAdd={addSport}
                onClose={() => { setPickerOpen(false); addButtonRef.current?.focus(); }} />}
            </div>}
            {step === 1 && <GoalEditor draft={draft} goals={options.goals || []} sports={sports} primaryOnly onChange={update} />}
            {step === 2 && <ScheduleFields draft={draft} onChange={update} />}
            {step === 3 && <PersonalFields draft={draft} onChange={update} />}
          </>}
        {error && <p className="form-message form-message-error" role="alert">{error}</p>}
        <div className="setup-actions">
          <button type="button" className="ghost-button" disabled={step === 0 || saving} onClick={() => { setError(null); setStep((current) => current - 1); }}>
            <ArrowLeft size={16} aria-hidden="true" /> Back
          </button>
          {step < steps.length - 1 ? <button type="button" className="primary-button" disabled={!options} onClick={next}>
            Continue <ArrowRight size={16} aria-hidden="true" /></button>
            : <button type="submit" className="primary-button" disabled={saving || !options}>
              {saving ? "Saving..." : "Finish setup"} {saving && <Loader2 size={16} aria-hidden="true" />}
            </button>}
        </div>
      </form>
      <p className="setup-footer">Want to explore first? <button type="button" className="text-button" onClick={skip}>Go to dashboard</button></p>
    </section>
  );
}

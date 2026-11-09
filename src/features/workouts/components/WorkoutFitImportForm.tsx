import { getApiErrorMessage } from "@/services/api/errors";
import { getApiErrorMessage as getErrorMessage } from "@/services/api/errors";
import { useEffect, useRef, useState } from "react";
import { FileUp, Loader2, Upload } from "lucide-react";
import { FitPowerTargetUnitsField } from "./FitPowerTargetUnitsField";
import { WorkoutCreateForm } from "./WorkoutCreateForm";
import { WorkoutDetailPanel } from "./WorkoutDetailPanel";
import { WorkoutFitImportReview } from "./WorkoutFitImportReview";
import {
  inspectFitUploads, importFitBatch,
  type FitBatchOutcome, type FitImportReference, type FitUploadInventory,
  type FitPowerTargetUnit, type WorkoutResponse, type WorkoutCatalogResponse,
} from "../services/workoutApi";

type Props = {
  onImported: (workouts: WorkoutResponse[]) => void;
  catalog?: WorkoutCatalogResponse | null;
  onBusyChange?: (busy: boolean) => void;
};


function referenceKey(ref: FitImportReference) { return `${ref.source_index}:${ref.source_sha256}:${ref.entry_index}`; }

export function WorkoutFitImportForm({ onImported, catalog = null, onBusyChange }: Props) {
  const root = useRef<HTMLElement>(null);
  const inFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [sources, setSources] = useState<FitUploadInventory[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [powerTargetUnit, setPowerTargetUnit] = useState<FitPowerTargetUnit>("auto");
  const [error, setError] = useState("");
  const [results, setResults] = useState<FitBatchOutcome[] | null>(null);
  const [opened, setOpened] = useState<WorkoutResponse | null>(null);
  const [editing, setEditing] = useState(false);
  const entries = sources.flatMap(source => source.entries);

  useEffect(() => {
    if (!busy) return;
    const leave = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [busy]);
  useEffect(() => { heading.current?.focus(); }, [results, opened, editing]);

  function setWorking(value: boolean) {
    inFlight.current = value;
    setBusy(value);
    onBusyChange?.(value);
  }

  async function inspect(next: File[]) {
    if (inFlight.current) return;
    if (next.length > 10) { setError("Choose at most 10 FIT or ZIP uploads."); return; }
    if (next.reduce((sum, file) => sum + file.size, 0) > 250 * 1024 * 1024) { setError("Uploads must total 250 MiB or less."); return; }
    if (!next.length) { setFiles([]); setSources([]); setSelected([]); setError(""); return; }
    setWorking(true); setError("");
    try {
      const response = await inspectFitUploads(next);
      if (response.error) { setError(getErrorMessage(response.error)); return; }
      setFiles(next);
      setSources(response.data.sources);
      const eligible = response.data.sources.flatMap(source => source.entries).filter(entry => !entry.error);
      setSelected(eligible.length <= 10 ? eligible.map(entry => referenceKey(entry.reference)) : []);
    } catch (requestError) { setError(getApiErrorMessage(requestError)); }
    finally { setWorking(false); }
  }

  async function submit(selection: FitImportReference[]) {
    if (inFlight.current || !selection.length) return;
    setWorking(true); setError("");
    try {
      const response = await importFitBatch(files, selection, powerTargetUnit);
      if (response.error) { setError(getErrorMessage(response.error)); return; }
      const updates = response.data.results;
      setResults(previous => previous ? previous.map(item => updates.find(update => referenceKey(update.reference) === referenceKey(item.reference)) || item) : updates);
      const imported = updates.flatMap(item => item.activity ? [item.activity] : []);
      if (imported.length) onImported(imported);
    } catch (requestError) {
      const interrupted: FitBatchOutcome[] = selection.map(reference => ({ reference, filename: entries.find(entry => referenceKey(entry.reference) === referenceKey(reference))?.filename || "FIT activity", status: "failed", error: getApiErrorMessage(requestError) }));
      setResults(previous => previous ? previous.map(item => interrupted.find(update => referenceKey(update.reference) === referenceKey(item.reference)) || item) : interrupted);
      // A lost response can still mean that activities were saved.
      onImported([]);
    } finally { setWorking(false); }
  }

  function backToReview() {
    if (root.current?.querySelector('[data-builder-dirty="true"]') && !window.confirm("Discard your unsaved workout changes?")) return;
    setOpened(null); setEditing(false);
  }

  function updated(workout: WorkoutResponse) {
    setResults(previous => previous?.map(item => item.activity?.id === workout.id ? { ...item, activity: { ...item.activity, ...workout } } : item) || null);
    setOpened(null); setEditing(false); onImported([workout]);
  }

  return <section ref={root} className="workout-create-panel fit-import-flow" aria-label="Import FIT activities" aria-busy={busy}>
    {opened ? <>
      <button className="secondary-button" type="button" onClick={backToReview}>Back to uploaded activities</button>
      <h3 ref={heading} tabIndex={-1}>{editing ? "Edit uploaded activity" : opened.title || "Uploaded activity"}</h3>
      {editing ? <WorkoutCreateForm catalog={catalog} selectedDate={opened.date || ""} initialWorkout={opened} initialWorkoutKey={`import-edit-${opened.id}`} workoutId={opened.id} onCreated={updated} />
        : <WorkoutDetailPanel activities={catalog?.activities} workout={opened} isLoading={false} errorMessage={null} onEdit={() => setEditing(true)} />}
    </> : results ? <WorkoutFitImportReview
      results={results}
      activities={catalog?.activities}
      busy={busy}
      headingRef={heading}
      onOpen={setOpened}
      onRetry={() => void submit(results.filter(item => item.status === "failed").map(item => item.reference))}
      onImportMore={() => {
        setResults(null); setFiles([]); setSources([]); setSelected([]); setError(""); setPowerTargetUnit("auto");
      }}
    /> : <form className="workout-form" onSubmit={event => { event.preventDefault(); void submit(entries.filter(entry => selected.includes(referenceKey(entry.reference))).map(entry => entry.reference)); }}>
      <label className="fit-import-dropzone"><FileUp size={24} aria-hidden="true" /><span>Choose FIT or ZIP files</span>
        <input type="file" multiple accept=".fit,.zip,application/zip,application/x-zip-compressed,application/octet-stream" disabled={busy} onChange={event => { const added = Array.from(event.target.files || []); event.target.value = ""; if (added.length) void inspect([...files, ...added]); }} />
      </label>
      <p>Import up to 10 activities. ZIP files can contain activities in folders. Maximum 25 MiB per FIT and 250 MiB total.</p>
      {sources.map((source, index) => <section className="fit-import-source" key={`${index}:${source.sha256}`} aria-label={source.filename}>
        <div className="fit-import-source-heading"><strong>{source.filename}</strong><button type="button" className="secondary-button" disabled={busy} onClick={() => void inspect(files.filter((_, i) => i !== index))}>Remove {source.filename}</button></div>
        {source.error && <p role="alert">{source.error}</p>}
        <ul className="fit-import-list">{source.entries.map(entry => { const key = referenceKey(entry.reference); return <li key={key}><label className="fit-import-choice"><input type="checkbox" checked={selected.includes(key)} disabled={busy || !!entry.error || selected.length >= 10 && !selected.includes(key)} onChange={event => setSelected(previous => event.target.checked ? [...previous, key] : previous.filter(item => item !== key))} /><span>{entry.filename}<small>{entry.error || `${(entry.size / 1024).toFixed(1)} KiB`}</small></span></label></li>; })}</ul>
      </section>)}
      <p role="status">{busy ? "Processing uploads..." : `${selected.length} of 10 activities selected`}{!busy && entries.filter(entry => !entry.error).length > 10 ? ". Choose up to 10 activities to import." : ""}</p>
      <details className="fit-target-options"><summary>FIT target options</summary><FitPowerTargetUnitsField value={powerTargetUnit} onChange={setPowerTargetUnit} disabled={busy} /></details>
      <button className="primary-button" type="submit" disabled={busy || !selected.length}>{busy ? <Loader2 className="spin-icon" size={17} aria-hidden="true" /> : <Upload size={17} aria-hidden="true" />}{busy ? "Importing..." : `Import ${selected.length || "selected"} ${selected.length === 1 ? "activity" : "activities"}`}</button>
    </form>}
    {error && <p className="form-message form-message-error" role="alert">{error}</p>}
  </section>;
}

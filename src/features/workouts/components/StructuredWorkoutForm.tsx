import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createWorkout, updateWorkout, type WorkoutRequest, type WorkoutResponse } from "@/features/workouts/services/workoutApi";
import { StructuredSessionEditor } from "@/features/workouts/components/StructuredSessionEditor";
import { invalidateWorkoutDerivedData } from "@/services/query/invalidation";
import { Link } from "react-router-dom";
export function StructuredWorkoutForm({ initialWorkout, workoutId, onCreated }: { initialWorkout: WorkoutRequest; workoutId?: number; onCreated: (w: WorkoutResponse) => void }) {
  const [value, setValue] = useState(initialWorkout); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const client = useQueryClient();
  if (initialWorkout.completed) return <p>This session has recorded results. <Link to={`/workouts/${workoutId}/execute`}>View the saved execution</Link>.</p>;
  async function save() { setBusy(true); setError(""); try { const payload = { ...value, planned: true, completed: false, components: [] }; const r = workoutId ? await updateWorkout(workoutId, payload) : await createWorkout(payload); if (r.error) throw Error(r.error.error); await invalidateWorkoutDerivedData(client); onCreated(r.data); } catch (e) { setError(e instanceof Error ? e.message : "Could not save session"); } finally { setBusy(false); } }
  return <div><StructuredSessionEditor value={value} onChange={setValue} />{error && <p role="alert">{error}</p>}<button className="primary-button" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save planned session"}</button></div>;
}

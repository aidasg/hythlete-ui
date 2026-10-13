import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/context/useAuth";
import { BodyVisualization } from "@/components/body/BodyVisualization";
import { getWorkoutCatalog, getWorkoutReadiness } from "@/features/workouts/services/workoutApi";
import { listCalendarReadinessEntries } from "@/features/workouts/services/calendarReadinessApi";
import { recentBodyRegions } from "@/features/workouts/services/bodyImpact";

export function BodyProgressView({ date }: { date: string }) {
  const { session } = useAuth(); const uid = session?.profile?.user_id;
  const readiness = useQuery({ queryKey: ["workouts", "body", uid, date, "readiness"], enabled: !!uid, queryFn: async () => { const r = await getWorkoutReadiness(date); if (r.error) throw Error("Could not load recent training. Please retry."); return r.data; } });
  const catalog = useQuery({ queryKey: ["workouts", "catalog", uid], enabled: !!uid, queryFn: async () => { const r = await getWorkoutCatalog(); if (r.error) throw Error("Could not load body regions."); return r.data; } });
  const reports = useQuery({ queryKey: ["workouts", "body", uid, date, "reports"], enabled: !!uid, queryFn: async () => {
    const from = new Date(`${date}T00:00:00Z`); from.setUTCDate(from.getUTCDate() - 29);
    const r = await listCalendarReadinessEntries({ from: from.toISOString().slice(0, 10), to: date }); if (r.error) throw Error("Could not load your recent reports."); return r.data;
  } });
  return <section className="body-progress-view" aria-label="Body overview"><h2>Your body, today</h2><p>See which areas have done more work recently. Select an area to explore.</p>
    {(readiness.isLoading || catalog.isLoading || reports.isLoading) && <p role="status">Loading your body overview...</p>}
    {[readiness, catalog, reports].map((q, i) => q.error && <p role="alert" key={i}>{q.error.message} <button type="button" onClick={() => void q.refetch()}>Retry</button></p>)}
    <BodyVisualization key={`${uid}:${date}`} mode="recent-load" regions={recentBodyRegions(readiness.data, catalog.data, reports.data?.entries || [])} />
    <p className="body-context">Recent reports cover the last 30 days. They are shown separately from estimated training load.</p>
  </section>;
}

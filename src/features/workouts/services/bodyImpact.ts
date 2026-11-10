import type { BodyLayer, BodyRegion, LoadBand } from "@/components/body/bodyPresentation";
import { commonName, loadBandOrder } from "@/components/body/bodyPresentation";
import { getMappedPathKeysForBackendEntity } from "@/components/body/bodyStateMapping";
import type { CalendarReadinessEntryResponse } from "./calendarReadinessApi";
import type { PlannedImpactResponse, ReadinessResponse, WorkoutCatalogResponse, WorkoutResponse } from "./workoutApi";

function region(id: string, layer: BodyLayer, name?: string): BodyRegion {
  return { id, layer, name: commonName(id, name), anatomy: name || id.replace(/_/g, " "), pathKeys: layer === "muscle" ? getMappedPathKeysForBackendEntity(id, layer) : [], band: "unknown", metrics: [], weeklyLoads: [], reports: [] };
}
const finite = (v: number | undefined) => typeof v === "number" && Number.isFinite(v) ? Math.max(0, v) : 0;

function weeklyLoadScale(decayDays: number, dayCount: number) {
  // Match the daily weights in calculateLoadStates over the readiness lookback.
  const weightSum = Array.from({ length: dayCount }, (_, age) => Math.exp(-age / decayDays))
    .reduce((sum, weight) => sum + weight, 0);
  return 7 / weightSum;
}

function pointsPerWeek(load: number | undefined, scale: number) {
  return typeof load === "number" && Number.isFinite(load) && load >= 0 ? load * scale : undefined;
}

export function recentBodyRegions(
  readiness?: ReadinessResponse,
  catalog?: WorkoutCatalogResponse,
  reports: CalendarReadinessEntryResponse[] = [],
  forecastTomorrow = false,
): BodyRegion[] {
  // Readiness includes the selected day and 84 days before it. Tomorrow's
  // forecast carries that same history forward one day.
  const dayCount = forecastTomorrow ? 86 : 85;
  const shortTermScale = weeklyLoadScale(7, dayCount);
  const longTermScale = weeklyLoadScale(42, dayCount);
  const regions = new Map<string, BodyRegion>();
  const ensure = (id: string, layer: BodyLayer, name?: string) => {
    const key = `${layer}:${id}`;
    if (!regions.has(key)) regions.set(key, region(id, layer, name));
    return regions.get(key)!;
  };
  catalog?.muscles?.forEach(m => m.code && ensure(m.code, "muscle", m.name));
  catalog?.tissue_regions?.forEach(t => t.code && ensure(t.code, "tissue", t.name));
  readiness?.entities?.forEach(e => {
    if (!e.entity_id || (e.entity_type !== "muscle" && e.entity_type !== "tissue")) return;
    const r = ensure(e.entity_id, e.entity_type, e.name);
    const evidence = finite(e.acute_load) + finite(e.chronic_load) + finite(e.recent_load) > 0;
    const reportAdjusted = e.reasons?.some(reason => /^user (injury|limiter) magnitude /.test(reason));
    const band: LoadBand = evidence && !reportAdjusted && loadBandOrder.includes(e.label as LoadBand) ? e.label as LoadBand : "unknown";
    if (loadBandOrder.indexOf(band) > loadBandOrder.indexOf(r.band)) r.band = band;
    const shortTerm = pointsPerWeek(e.acute_load, shortTermScale);
    const longTerm = pointsPerWeek(e.chronic_load, longTermScale);
    if ((shortTerm ?? 0) > 0 || (longTerm ?? 0) > 0) {
      r.weeklyLoads.push({ type: (e.load_type || "load").replace(/_/g, " "), shortTerm, longTerm });
    }
    if (reportAdjusted) r.reportAdjusted = true;
  });
  const currentReports: CalendarReadinessEntryResponse[] = (readiness?.limiters || []).filter(l => l.source === "user").map(l => ({ date: readiness?.date, entity_id: l.entity_id, entity_type: l.entity_type, kind: l.kind, magnitude: l.magnitude }));
  [...reports, ...currentReports].forEach(e => {
    if (!e.entity_id || !e.date || (e.entity_type !== "muscle" && e.entity_type !== "tissue") || !finite(e.magnitude)) return;
    const r = ensure(e.entity_id, e.entity_type);
    const report = { date: e.date, kind: e.kind === "injury" ? "Reported injury" : "Reported limitation", severity: e.magnitude! };
    if (!r.reports.some(item => item.date === report.date && item.kind === report.kind && item.severity === report.severity)) r.reports.push(report);
  });
  return [...regions.values()].sort((a, b) => loadBandOrder.indexOf(b.band) - loadBandOrder.indexOf(a.band) || a.name.localeCompare(b.name));
}
export function sessionBodyRegions(work: Pick<WorkoutResponse | PlannedImpactResponse, "muscle_loads" | "tissue_loads">): BodyRegion[] {
  const regions = new Map<string, BodyRegion>();
  work.muscle_loads?.forEach((m, i) => {
    const id = m.muscle_code || `unmapped_muscle_${i}`;
    const r = regions.get(`muscle:${id}`) || region(id, "muscle", m.muscle_name);
    const dimensions = [m.strength_load, m.endurance_load, m.power_load, m.eccentric_load, m.stabilizer_load];
    if (dimensions.some(v => typeof v === "number")) r.value = (r.value || 0) + dimensions.reduce<number>((sum, v) => sum + finite(v), 0);
    r.metrics = [{ label: "Estimated session load", value: r.value?.toFixed(2) || "Not available" }];
    regions.set(`muscle:${id}`, r);
  });
  work.tissue_loads?.forEach((t, i) => {
    const id = t.region_code || `unmapped_tissue_${i}`;
    const r = regions.get(`tissue:${id}`) || region(id, "tissue", t.region_name);
    if (typeof t.load === "number") r.value = (r.value || 0) + finite(t.load);
    r.metrics = [{ label: "Estimated session load", value: r.value?.toFixed(2) || "Not available" }];
    regions.set(`tissue:${id}`, r);
  });
  return [...regions.values()].sort((a, b) => (b.value || 0) - (a.value || 0) || a.name.localeCompare(b.name));
}

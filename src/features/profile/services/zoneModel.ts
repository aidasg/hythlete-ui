export type ZoneMetric = "heart_rate" | "power" | "speed";
export type ZoneRangesDraft = Partial<Record<ZoneMetric, string[]>>;
export const zoneMetrics: { key: ZoneMetric; label: string; unit: string }[] = [
  { key: "heart_rate", label: "Heart rate", unit: "bpm" },
  { key: "power", label: "Power", unit: "W" },
  { key: "speed", label: "Speed", unit: "m/s" },
];
export const zoneNames = ["Recovery", "Steady", "Tempo", "Threshold", "VO2"];
export function validateZoneRanges(ranges: ZoneRangesDraft | undefined, sport: string, speedLimit = 100) {
  for (const metric of zoneMetrics) {
    const bounds = ranges?.[metric.key];
    if (!bounds) continue;
    if (sport === "default" && metric.key !== "heart_rate") return "Default zones support heart rate only.";
    const max = metric.key === "heart_rate" ? 240 : metric.key === "power" ? 3000 : speedLimit;
    if (bounds.length !== 4 || bounds.some((raw, i) => !raw.trim() || !Number.isFinite(Number(raw)) ||
      Number(raw) <= (i ? Number(bounds[i - 1]) : 0) || Number(raw) > max)) {
      return `${metric.label} zones need four increasing boundaries between 0 and ${max} ${metric.unit}.`;
    }
  }
  return null;
}

export function zoneSpeedLimit(code: string, sports: {code?: string; parent_code?: string}[]) {
  const seen = new Set<string>();
  while (!seen.has(code)) {
    seen.add(code);
    const parent = sports.find((sport) => sport.code === code)?.parent_code;
    if (!parent) break;
    code = parent;
  }
  return ["running", "walking", "hiking"].includes(code) ? 15 : code === "cycling" ? 50 : 100;
}

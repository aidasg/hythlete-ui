import { describe, expect, it } from "vitest";
import { recentBodyRegions, sessionBodyRegions } from "./bodyImpact";
import { detailedMusclePaths } from "@/components/body/muscleBreakdownData";
import { getRegionReadiness } from "@/components/body/bodyStateMapping";

describe("body impact adapters", () => {
  it("keeps catalog regions neutral when there is no training evidence", () => {
    const regions = recentBodyRegions({ entities: [{ entity_type: "muscle", entity_id: "rectus_femoris", label: "ready", acute_load: 0 }] }, { muscles: [{ code: "rectus_femoris", name: "Rectus femoris" }], tissue_regions: [{ code: "achilles_tendon" }] });
    expect(regions.every(r => r.band === "unknown")).toBe(true);
    expect(getRegionReadiness(0, "none")).toBeUndefined();
    expect(detailedMusclePaths.every(p => !("readiness" in p))).toBe(true);
  });
  it("uses familiar names, maps both sides, and keeps tissue separate from muscle", () => {
    const regions = sessionBodyRegions({ muscle_loads: [{ muscle_code: "rectus_femoris", strength_load: 20 }], tissue_loads: [{ region_code: "patellar_tendon", load: 3 }] });
    const muscle = regions.find(r => r.layer === "muscle")!;
    expect(muscle.name).toBe("Front thighs");
    expect(new Set(detailedMusclePaths.filter(p => muscle.pathKeys.includes(p.key)).map(p => p.side))).toEqual(new Set(["Left", "Right"]));
    expect(regions.find(r => r.layer === "tissue")?.pathKeys).toEqual([]);
  });
  it("preserves unmapped regions, zeros, and unknown values without manufacturing loads", () => {
    const regions = sessionBodyRegions({ muscle_loads: [{ muscle_code: "new_region", muscle_name: "New area", strength_load: 0 }, { muscle_code: "unknown_value" }], tissue_loads: [{ region_code: "unmapped_tissue", load: 2 }] });
    expect(regions).toHaveLength(3);
    expect(regions.find(r => r.id === "new_region")).toMatchObject({ name: "New area", value: 0, pathKeys: [] });
    expect(regions.find(r => r.id === "unknown_value")?.value).toBeUndefined();
  });
  it("keeps dated reports distinct and does not call an injury-adjusted band high training load", () => {
    const [region] = recentBodyRegions({ date: "2026-10-13", entities: [{ entity_type: "tissue", entity_id: "achilles_tendon", label: "avoid", acute_load: 12, reasons: ["user injury magnitude 70"] }], limiters: [{ source: "user", entity_type: "tissue", entity_id: "achilles_tendon", kind: "injury", magnitude: 70 }] }, undefined, [{ entity_type: "tissue", entity_id: "achilles_tendon", kind: "injury", date: "2026-10-13", magnitude: 70 }, { entity_type: "tissue", entity_id: "achilles_tendon", kind: "limiter", date: "2026-10-10", magnitude: 25 }]);
    expect(region?.band).toBe("unknown");
    expect(region?.reports).toEqual([{ date: "2026-10-13", kind: "Reported injury", severity: 70 }, { date: "2026-10-10", kind: "Reported limitation", severity: 25 }]);
  });
  it("translates backend bands without adding ratios or counting readiness scores as session work", () => {
    const [region] = recentBodyRegions({ entities: [{ entity_type: "muscle", entity_id: "gastrocnemius", label: "loaded", acute_load: 30, ratio: 1, load_type: "endurance" }, { entity_type: "muscle", entity_id: "gastrocnemius", label: "caution", acute_load: 10, ratio: 1.3, load_type: "strength" }] });
    expect(region?.band).toBe("caution");
    expect(region?.value).toBeUndefined();
    expect(region?.metrics.filter(m => m.label.includes("ratio")).map(m => m.value)).toEqual(["1.00", "1.30"]);
  });
});

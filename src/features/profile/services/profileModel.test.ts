import { describe, expect, it } from "vitest";
import {
  clearBaseline, createProfileDraft, matchingBaseline, setBaselineMetric, toProfileRequest,
} from "@/features/profile/services/profileModel";

describe("profile baseline mapping", () => {
  it("uses canonical activity codes while preserving unrelated saved baselines", () => {
    const sport = { id: 10, name: "Bike Commuting", code: "commuting_cycling" };
    const draft = createProfileDraft({
      preferred_sports: [sport],
      endurance_baselines: [
        { sport: "bike_commuting", ftp_watts: 210 },
        { sport: "running", threshold_hr_bpm: 175, calibration_source: "suggested" },
      ],
    });
    expect(matchingBaseline(draft, sport)?.ftpWatts).toBe("210");
    const updated = setBaselineMetric(draft, sport, "ftpWatts", "220");
    expect(toProfileRequest(updated).endurance_baselines).toEqual([
      expect.objectContaining({ sport: "running", threshold_hr_bpm: 175, calibration_source: "suggested" }),
      expect.objectContaining({ sport: "commuting_cycling", ftp_watts: 220 }),
    ]);
    expect(toProfileRequest(clearBaseline(updated, sport)).endurance_baselines).toEqual([
      expect.objectContaining({ sport: "running" }),
    ]);
  });
});

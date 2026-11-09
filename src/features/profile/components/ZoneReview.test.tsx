import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { ZoneReview } from "./ZoneReview";
import { previewZones } from "../services/profileApi";
import { createProfileDraft, toProfileRequest, type ProfileDraft } from "../services/profileModel";
vi.mock("../services/profileApi", async (original) => ({ ...await original<typeof import("../services/profileApi")>(), previewZones: vi.fn() }));
const sport = { code: "running", name: "Running" };
const data = { zones: [
  { metric: "heart_rate", unit: "bpm", available: true, custom: false, source_sport: "default", reference_metric: "threshold_hr_bpm", reference_value: 170, model_name: "Friel running threshold heart rate", model_source_url: "https://www.trainingpeaks.com/learn/articles/joe-friel-s-quick-guide-to-setting-zones/", boundary_precision: 0, upper_bounds: [145, 151, 160, 168] },
  { metric: "power", unit: "W", available: false },
  { metric: "speed", unit: "m/s", available: false },
] };
function Editor() {
  const [draft, setDraft] = useState<ProfileDraft>(() => createProfileDraft({endurance_baselines:[{sport:"default",threshold_hr_bpm:170}]}));
  return <><ZoneReview sport={sport} sports={[sport]} draft={draft} onChange={setDraft}/><output data-testid="payload">{JSON.stringify(toProfileRequest(draft))}</output></>;
}
beforeEach(() => {vi.clearAllMocks();vi.mocked(previewZones).mockResolvedValue({data} as never);});
it("only fetches after opening and reviewing does not create overrides", async () => {
  const user = userEvent.setup();render(<Editor/>);
  expect(previewZones).not.toHaveBeenCalled();
  const original = screen.getByTestId("payload").textContent;
  await user.click(screen.getByText("Review zones"));
  expect(await screen.findByText("Calculated ranges from Default baseline")).toBeInTheDocument();
  expect(screen.getByText("Above 151, up to 160")).toBeInTheDocument();
  expect(screen.getByText("Calculated boundaries rounded to whole bpm.")).toBeInTheDocument();
  expect(screen.getByRole("link",{name:"Friel running threshold heart rate"})).toHaveAttribute("href","https://www.trainingpeaks.com/learn/articles/joe-friel-s-quick-guide-to-setting-zones/");
  expect(screen.getByTestId("payload")).toHaveTextContent(original!);
});
it("customizes fixed bounds, resets overrides, and permits customization without a baseline", async () => {
  const user = userEvent.setup();render(<Editor/>);
  await user.click(screen.getByText("Review zones"));
  const hr = await screen.findByRole("region", {name:"Heart rate zones"});
  await waitFor(() => expect(within(hr).getByRole("button",{name:"Customize ranges"})).toBeEnabled());
  await user.click(within(hr).getByRole("button",{name:"Customize ranges"}));
  fireEvent.change(screen.getByLabelText("Heart rate Recovery upper boundary"), {target:{value:"130"}});
  const payload = JSON.parse(screen.getByTestId("payload").textContent!);
  expect(payload.endurance_baselines.find((b: {sport:string}) => b.sport === "running").zone_ranges.heart_rate.upper_bounds).toEqual([130,151,160,168]);
  await user.click(screen.getByRole("button",{name:"Reset to inherited/calculated ranges"}));
  expect(JSON.parse(screen.getByTestId("payload").textContent!).endurance_baselines.map((b: {sport:string}) => b.sport)).toEqual(["default"]);
  const power = screen.getByRole("region",{name:"Power zones"});
  await waitFor(() => expect(within(power).getByRole("button",{name:"Customize ranges"})).toBeEnabled());
  await user.click(within(power).getByRole("button",{name:"Customize ranges"}));
  expect(screen.getByLabelText("Power Recovery upper boundary")).toHaveValue(null);
  expect(screen.getByRole("alert")).toHaveTextContent("four increasing boundaries");
});
it("ignores an outdated preview response", async () => {
  let finish!: (result: unknown) => void;
  vi.mocked(previewZones).mockReturnValueOnce(new Promise(resolve => {finish=resolve;}) as never);
  const first = createProfileDraft({endurance_baselines:[{sport:"running",threshold_hr_bpm:170}]});
  const second = createProfileDraft({endurance_baselines:[{sport:"running",threshold_hr_bpm:180}]});
  const {rerender} = render(<ZoneReview sport={sport} sports={[sport]} draft={first} onChange={vi.fn()}/>);
  const user=userEvent.setup();await user.click(screen.getByText("Review zones"));
  await waitFor(() => expect(previewZones).toHaveBeenCalledTimes(1));
  vi.mocked(previewZones).mockResolvedValueOnce({data:{zones:[{...data.zones[0],upper_bounds:[140,160,180,195]}]}} as never);
  rerender(<ZoneReview sport={sport} sports={[sport]} draft={second} onChange={vi.fn()}/>);
  expect(await screen.findByText("Above 160, up to 180")).toBeInTheDocument();
  finish({data});
  await waitFor(() => expect(screen.queryByText("Above 151, up to 160")).not.toBeInTheDocument());
});
it("shows only heart rate customization for Default", async () => {
  render(<ZoneReview sport={{code:"default",name:"Default baseline"}} sports={[]} draft={createProfileDraft(undefined)} onChange={vi.fn()}/>);
  await userEvent.setup().click(screen.getByText("Review zones"));
  expect(screen.getByRole("region",{name:"Heart rate zones"})).toBeInTheDocument();
  expect(screen.queryByRole("region",{name:"Power zones"})).not.toBeInTheDocument();
});

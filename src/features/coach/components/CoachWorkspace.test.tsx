import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { useState } from "react";
import { CoachProvider } from "../context/CoachProvider";
import { useCoach, useCoachPageContext } from "../context/coachContext";
import { CoachOverlayHost } from "./CoachOverlayHost";
import { CoachLauncher, CoachTrigger } from "./CoachTrigger";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import { CoachPage } from "@/pages/CoachPage";
import { ProposalReview } from "./ProposalReview";
import { McpConnections } from "./McpConnections";
import { getSubscription } from "@/features/billing/services/billingApi";
import { getWorkout, getWorkoutReadiness } from "@/features/workouts/services/workoutApi";
import { getProfile } from "@/features/profile/services/profileApi";
import * as api from "../services/aiApi";
import { acceptCoaching } from "../services/coachApi";
import { decideCoachChange, listCoachChanges, reviewCoachChange, type ChangeRecord } from "../services/changeApi";
vi.mock("../services/changeApi", () => ({ decideCoachChange: vi.fn(), listCoachChanges: vi.fn(), reviewCoachChange: vi.fn() }));
import { startCoachJob, followCoachJob, stopCoachJob, type CoachJob, type CoachJobEvent } from "../services/coachJobsApi";
vi.mock("../services/coachJobsApi", () => ({ startCoachJob: vi.fn(), followCoachJob: vi.fn(), stopCoachJob: vi.fn() }));
const auth = vi.hoisted(() => ({ userID: 1 }));
vi.mock("@/features/billing/services/billingApi", () => ({ getSubscription: vi.fn(), billingKeys: { subscription: ["billing", "subscription"] } }));
vi.mock("../services/aiApi", () => ({ listConversations: vi.fn(), createConversation: vi.fn(), getConversation: vi.fn(), deleteConversation: vi.fn(), sendCoachMessage: vi.fn(), reviewWorkout: vi.fn(), getCoachProposal: vi.fn(), listMcpTokens: vi.fn(), createMcpToken: vi.fn(), revokeMcpToken: vi.fn() }));
vi.mock("../services/coachApi", () => ({ acceptCoaching: vi.fn() }));
vi.mock("@/features/workouts/services/workoutApi", () => ({ getWorkout: vi.fn(), getWorkoutReadiness: vi.fn() }));
vi.mock("@/features/profile/services/profileApi", () => ({ getProfile: vi.fn() }));
vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ session: { profile: { user_id: auth.userID, timezone: "Europe/Vilnius", preferred_sports: [{ id: 1, code: "running", name: "Running" }] } } }) }));
function Harness() {
  const location = useLocation(); const coach = useCoach(); const [modal, setModal] = useState(false);
  useCoachPageContext({ surface: location.pathname === "/plan" ? "plan" : "today", date: "2026-11-01" });
  return <><CoachLauncher /><output aria-label="Current location">{location.pathname}{location.search}</output><Link to="/plan">Go to plan</Link><Link to="/dashboard">Go to today</Link>
    <label>Unfinished workout note<input defaultValue="Original note" /></label>
    <CoachTrigger label="Coach insights" intent={{ action: "review_recent_workout", target: { surface: "workout", workoutID: 42, title: "Easy run", date: "2026-11-01" } }} />
    <CoachTrigger label="Another workout" intent={{ action: "review_recent_workout", target: { surface: "workout", workoutID: 43, title: "Long run", date: "2026-11-02" } }} />
    <CoachTrigger label="Plan with Coach" intent={{ action: "plan_next_workout", target: { surface: "calendar", date: "2026-11-05" } }} />
    <CoachTrigger label="Plan my training with Coach" intent={{ action: "plan_training", target: { surface: "plan", date: "2026-11-05" } }} />
    <CoachTrigger label="Explain with Coach" intent={{ action: "coach_chat", target: { surface: "progress", progressView: "strength", exerciseCode: "back_squat", date: "2026-11-01" } }} />
    <button onClick={() => coach?.openCoach({ conversationID: 1 })}>Open saved discussion</button>
    <button onClick={() => setModal(true)}>Open workout detail</button>
    {modal && <WorkoutModal title="Workout detail" eyebrow="Calendar" onClose={() => setModal(false)}><label>Unsaved dialog note<input /></label><CoachTrigger label="Coach insights" intent={{ action: "review_recent_workout", target: { surface: "workout", workoutID: 42, title: "Easy run" } }} /></WorkoutModal>}
  </>;
}
function mount(path = "/dashboard?keep=selection") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Root() { return <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><CoachProvider><Routes><Route path="/coach" element={<CoachPage />} /><Route path="*" element={<Harness />} /></Routes><CoachOverlayHost /></CoachProvider></MemoryRouter></QueryClientProvider>; }
  const view = render(<Root />); return { ...view, refresh: () => view.rerender(<Root />) };
}
async function ready() { await waitFor(() => expect(screen.getByLabelText("Message to Coach")).toBeEnabled()); }
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); auth.userID = 1;
  vi.mocked(window.matchMedia).mockImplementation(query=>({matches:false,media:query,onchange:null,addEventListener:vi.fn(),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:vi.fn()}));
  vi.mocked(getSubscription).mockResolvedValue({ plan_id: "pro", ai_access: true });
  vi.mocked(api.listConversations).mockResolvedValue([{ id: 1, title: "Saved training discussion" }]);
  vi.mocked(api.createConversation).mockResolvedValue({ id: 2 });
  vi.mocked(api.getConversation).mockImplementation(async id => id === 1 ? { id, title: "Saved training discussion", messages: [{ id: 1, role: "assistant", content: "Keep the effort controlled.", result: { missing: ["Detailed execution unavailable"], evidence: [{ id: "workout:42", date: "2026-11-01", workout_id: 42 }] } }] } : { id, messages: [] });
  vi.mocked(startCoachJob).mockImplementation(async body => ({ id: body.id, status: "running" }));
  vi.mocked(followCoachJob).mockImplementation(async id => ({ id, status: "completed", turn: { outcome: "ok", content: "Coach reply" } }));
  vi.mocked(api.listMcpTokens).mockResolvedValue([]);
});
describe("Persistent contextual coach", () => {
  it("opens without navigating or changing unsaved work; closing preserves the composer", async () => {
    const user = userEvent.setup(); mount(); const input = screen.getByLabelText("Unfinished workout note"); await user.type(input, " edited");
    await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready();
    expect(screen.getByRole("dialog", { name: "AI Coach" })).toHaveAttribute("aria-modal", "false"); expect(document.body.style.overflow).not.toBe("hidden");
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?keep=selection");
    await user.type(screen.getByLabelText("Message to Coach"), "Keep this question"); await user.click(screen.getByRole("button", { name: "Close Coach" }));
    expect(input).toHaveValue("Original note edited"); expect(startCoachJob).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "AI Coach" })); expect(screen.getByLabelText("Message to Coach")).toHaveValue("Keep this question");
  });
  it("retains context and draft across navigation; contextual actions change only the next target", async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "Coach insights" })); await ready();
    expect(screen.getByLabelText("Message to Coach")).toHaveValue("Review this workout against its prescription, my recent training, and my goals.");
    await user.clear(screen.getByLabelText("Message to Coach"));
    await user.type(screen.getByLabelText("Message to Coach"), "Retained draft"); await user.click(screen.getByRole("link", { name: "Go to plan" }));
    expect(screen.getByText("Easy run · 2026-11-01")).toBeInTheDocument(); expect(screen.getByLabelText("Message to Coach")).toHaveValue("Retained draft");
    await user.click(screen.getByRole("button", { name: "Another workout" })); expect(screen.getByText("Long run · 2026-11-02")).toBeInTheDocument();
    expect(screen.getByLabelText("Message to Coach")).toHaveValue("Retained draft"); expect(startCoachJob).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Send" })); await waitFor(() => expect(startCoachJob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(startCoachJob).mock.calls[0]?.[0].turn).toMatchObject({ prompt: "coach_unified", goal_hint: "review_recent_workout", workout_id: 43, content: "Retained draft", context: { surface: "workout", date: "2026-11-02" } });
  });
  it("completes pending responses while closed and keeps immutable submission context", async () => {
    let resolve!: (value: CoachJob) => void; vi.mocked(followCoachJob).mockReturnValue(new Promise(done => { resolve = done; }));
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready(); await user.type(screen.getByLabelText("Message to Coach"), "Explain today"); await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(startCoachJob).toHaveBeenCalledTimes(1)); await user.click(screen.getByRole("button", { name: "Another workout" })); await user.click(screen.getByRole("button", { name: "Close Coach" })); await user.click(screen.getByRole("link", { name: "Go to plan" }));
    await act(async () => resolve({ status: "completed", turn: { outcome: "ok", content: "Ready after closing" } }));
    expect(await screen.findByLabelText("Coach response ready")).toBeInTheDocument();
    expect(sessionStorage.getItem("hythlete:coach:pending:1")).toContain(vi.mocked(startCoachJob).mock.calls[0]?.[0].id);
    expect(vi.mocked(startCoachJob).mock.calls[0]?.[0].turn).toMatchObject({ content: "Explain today", context: { surface: "today", date: "2026-11-01" } });
    await user.click(screen.getByRole("button", { name: "AI Coach" })); expect(screen.getByText("Ready after closing")).toBeInTheDocument();
    expect(sessionStorage.getItem("hythlete:coach:pending:1")).toBeNull();
  });
  it("replays an active timeline after reload and renders the saved answer once", async () => {
    const id = "50e6a79c-9367-4073-9e29-89c44a54e2fd";
    sessionStorage.setItem("hythlete:coach:pending:1", JSON.stringify({ id, cid: 2 }));
    let complete!: (value: CoachJob) => void;
    vi.mocked(followCoachJob).mockImplementation((jobID, cursor, _signal, progress) => {
      expect(jobID).toBe(id);
      expect(cursor).toBe("");
      progress({ id: "1-0", stage: "queued", at: "2026-11-10T10:00:00Z" });
      progress({ id: "2-0", stage: "read_training", at: "2026-11-10T10:00:01Z" });
      return new Promise(done => { complete = done; });
    });
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole("button", { name: "AI Coach" }));
    expect(await screen.findByRole("list", { name: "Coaching progress" })).toHaveTextContent("Request queuedReading saved training data");
    expect(startCoachJob).not.toHaveBeenCalled();
    vi.mocked(api.getConversation).mockResolvedValue({ id: 2, messages: [{ id: 4, role: "assistant", content: "Saved answer" }] });
    await act(async () => complete({ id, status: "completed", turn: { outcome: "ok", content: "Saved answer" } }));
    expect(screen.getAllByText("Saved answer")).toHaveLength(1);
    expect(sessionStorage.getItem("hythlete:coach:pending:1")).toBeNull();
  });
  it("stops a streamed answer, preserves the draft and allows a revised request", async () => {
    let oldSignal!: AbortSignal;
    let finishOld!: (job: CoachJob) => void;
    let finishStop!: (job: CoachJob) => void;
    vi.mocked(followCoachJob)
      .mockImplementationOnce((_id, _cursor, signal, publish) => {
        oldSignal = signal;
        publish({ id: "1-0", text: "Partial reply ", at: "2026-11-10T10:00:00Z" });
        return new Promise(resolve => { finishOld = resolve; });
      })
      .mockImplementationOnce((_id, cursor, _signal, publish) => {
        expect(cursor).toBe("1-0");
        publish({ id: "2-0", text: "Buffered reply ", at: "2026-11-10T10:00:01Z" });
        return new Promise(resolve => { finishStop = resolve; });
      });
    vi.mocked(stopCoachJob).mockImplementation(async id => ({ id, status: "running", failure_code: "stopped" }));
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "AI Coach" }));
    await ready();
    const input = screen.getByLabelText("Message to Coach");
    await user.type(input, "Original question");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Partial reply")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Stop generation" }));
    await waitFor(() => expect(followCoachJob).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("button", { name: "Stopping…" })).toBeDisabled();
    expect(screen.queryByText("Buffered reply")).not.toBeInTheDocument();
    const id = vi.mocked(startCoachJob).mock.calls[0]?.[0].id;
    await act(async () => finishStop({
      id, status: "failed", failure_code: "stopped",
      turn: { job_id: id, outcome: "stopped", content: "Coach generation stopped." },
    }));
    expect(await screen.findByText("Coach generation stopped.")).toBeVisible();
    await ready();
    expect(oldSignal.aborted).toBe(true);
    expect(input).toHaveValue("Original question");
    expect(screen.queryByText("Partial reply")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry coaching job" })).not.toBeInTheDocument();
    expect(sessionStorage.getItem("hythlete:coach:pending:1")).toBeNull();
    await act(async () => finishOld({ status: "completed", turn: { outcome: "ok", content: "Late reply" } }));
    expect(screen.queryByText("Late reply")).not.toBeInTheDocument();
    await user.clear(input);
    await user.type(input, "Revised question");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Coach reply");
    const [original, revised] = vi.mocked(startCoachJob).mock.calls.map(([request]) => request);
    expect(stopCoachJob).toHaveBeenCalledWith(original?.id, expect.any(AbortSignal));
    expect(revised?.id).not.toBe(original?.id);
    expect(revised?.turn?.content).toBe("Revised question");
  });

  it("can stop before conversation creation returns", async () => {
    let created!: (result: api.Conversation) => void;
    vi.mocked(api.createConversation).mockReturnValueOnce(new Promise(resolve => { created = resolve; }));
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "AI Coach" }));
    await ready();
    await user.type(screen.getByLabelText("Message to Coach"), "Review my training.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await user.click(screen.getByRole("button", { name: "Stop generation" }));
    await ready();
    await act(async () => created({ id: 99 }));
    expect(startCoachJob).not.toHaveBeenCalled();
    expect(stopCoachJob).not.toHaveBeenCalled();
    expect(screen.getByText("Coach generation stopped.")).toBeVisible();
  });

  it("waits for admission before stopping the submitted job", async () => {
    let admit!: (job: CoachJob) => void;
    vi.mocked(startCoachJob).mockReturnValueOnce(new Promise(resolve => { admit = resolve; }));
    vi.mocked(followCoachJob).mockImplementationOnce(() => new Promise(() => undefined));
    vi.mocked(stopCoachJob).mockImplementation(async id => ({ id, status: "failed", failure_code: "stopped" }));
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "AI Coach" }));
    await ready();
    await user.type(screen.getByLabelText("Message to Coach"), "Review my training.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(startCoachJob).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Stop generation" }));
    expect(stopCoachJob).not.toHaveBeenCalled();
    const id = vi.mocked(startCoachJob).mock.calls[0]?.[0].id;
    await act(async () => admit({ id, status: "running" }));
    expect(await screen.findByText("Coach generation stopped.")).toBeVisible();
    expect(stopCoachJob).toHaveBeenCalledWith(id, expect.any(AbortSignal));
    await ready();
  });
  it("explicitly retries a timed-out job under a new UUID", async () => {
    vi.mocked(followCoachJob).mockResolvedValueOnce({ status: "failed", failure_code: "timeout" });
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready();
    await user.type(screen.getByLabelText("Message to Coach"), "Original question");
    await user.click(screen.getByRole("button", { name: "Send" }));
    const retry = await screen.findByRole("button", { name: "Retry coaching job" });
    await waitFor(() => expect(retry).toBeEnabled());
    await user.click(retry);
    expect(await screen.findByText("Coach reply")).toBeInTheDocument();
    const [original, next] = vi.mocked(startCoachJob).mock.calls.map(([request]) => request);
    expect(next).toMatchObject({ retry_of: original?.id });
    expect(next?.id).not.toBe(original?.id);
  });
  it("reuses retry keys after uncertain requests", async () => {
    vi.mocked(startCoachJob).mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce({ status: "completed", turn: { outcome: "ok", content: "Retried" } });
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready(); await user.type(screen.getByLabelText("Message to Coach"), "Question"); await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable"); await user.click(screen.getByRole("button", { name: "Send" })); await waitFor(() => expect(startCoachJob).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(startCoachJob).mock.calls; expect(calls[0]?.[0].id).toBe(calls[1]?.[0].id); expect(api.createConversation).toHaveBeenCalledTimes(1);
  });
  it("prepares explicit planning inputs and progress references without auto-generation", async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "Plan with Coach" })); await ready();
    await user.click(screen.getByText(/Workout preferences/)); await user.click(screen.getByLabelText("Attach preferences to this message")); const minutes = screen.getByLabelText("Available minutes"); await user.clear(minutes); await user.type(minutes, "45");
    await user.click(screen.getByRole("checkbox", { name: /^dumbbell$/i })); expect(startCoachJob).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Send" })); await waitFor(() => expect(startCoachJob).toHaveBeenCalledTimes(1));
    expect(vi.mocked(startCoachJob).mock.calls[0]?.[0].turn?.constraints).toMatchObject({ date: "2026-11-05", minutes: 45, equipment: ["bodyweight", "dumbbell"] });
    await waitFor(() => expect(screen.getByLabelText("Message to Coach")).toBeEnabled()); await user.click(screen.getByRole("button", { name: "Explain with Coach" })); await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(startCoachJob).toHaveBeenCalledTimes(2)); expect(vi.mocked(startCoachJob).mock.calls[1]?.[0].turn?.context).toMatchObject({ surface: "progress", progress_view: "strength", exercise_code: "back_squat" });
    expect(vi.mocked(startCoachJob).mock.calls[1]?.[0].turn?.constraints).toBeUndefined();
  });
  it("keeps workout dialogs open and handles Escape at the coach layer first", async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "Open workout detail" })); const dialog = screen.getByRole("dialog", { name: "Workout detail" });
    await user.type(within(dialog).getByLabelText("Unsaved dialog note"), "Do not lose"); const trigger = within(dialog).getByRole("button", { name: "Coach insights" }); await user.click(trigger);
    const coach = screen.getByRole("dialog", { name: "AI Coach" }); expect(dialog).toContainElement(coach);
    await user.keyboard("{Escape}"); expect(screen.queryByRole("dialog", { name: "AI Coach" })).not.toBeInTheDocument(); expect(within(dialog).getByLabelText("Unsaved dialog note")).toHaveValue("Do not lose");
    await waitFor(() => expect(trigger).toHaveFocus()); expect(document.body.style.overflow).toBe("hidden"); await user.keyboard("{Escape}"); expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(document.body.style.overflow).not.toBe("hidden");
  });
  it("traps focus on mobile and restores the launcher on close", async () => {
    vi.mocked(window.matchMedia).mockImplementation(query => ({ matches: query.includes("1023"), media: query, onchange: null, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() }));
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready(); expect(screen.getByRole("dialog", { name: "AI Coach" })).toHaveAttribute("aria-modal", "true"); expect(document.body.style.overflow).toBe("hidden");
    await user.type(screen.getByLabelText("Message to Coach"), "Today"); screen.getByRole("button", { name: "Send" }).focus(); await user.tab(); expect(screen.getByRole("button", { name: "Close Coach" })).toHaveFocus(); await user.keyboard("{Escape}"); await waitFor(() => expect(screen.getByRole("button", { name: "AI Coach" })).toHaveFocus());
  });
  it("allows Free users to read saved history and preview sources in place", async () => {
    vi.mocked(getSubscription).mockResolvedValue({ plan_id: "free", ai_access: false }); vi.mocked(getWorkout).mockResolvedValue({ data: { id: 42, title: "Source easy run", date: "2026-11-01", completed: true, duration_minutes: 20, components: [] }, response: new Response() } as Awaited<ReturnType<typeof getWorkout>>);
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "Open saved discussion" })); expect(await screen.findByText("Keep the effort controlled.")).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Send" })).toBeDisabled(); expect(screen.getByRole("link", { name: "Choose a plan" })).toHaveAttribute("href", "/billing");
    await user.click(screen.getByText("Sources")); await user.click(screen.getByRole("button", { name: /Workout #42/ })); expect(await screen.findByText("Source easy run")).toBeInTheDocument(); expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?keep=selection"); await user.click(screen.getByRole("button", { name: "Back to conversation" })); expect(screen.getByText("Keep the effort controlled.")).toBeInTheDocument();
    await user.click(screen.getByText("Conversation options")); await user.click(screen.getByRole("button", { name: "Delete conversation" })); await waitFor(() => expect(api.deleteConversation).toHaveBeenCalledWith(1));
  });

  it("renders saved Markdown and resolves grouped citations to their source previews", async () => {
    const content = [
      "**Yes, as a block design, repeating a simple 4 × 4 min session and a 3 × 8 min session each week for three weeks can make sense** for a trained runner.",
      "The two sessions offer **different emphases, but not necessarily separate adaptation targets**. Your Nov 4 reps averaged **400–411 W**; Nov 6 averaged **368–373 W**. [workout:40; workout:39]",
      "Today's readiness output labels high-intensity running “avoid” and flags impact-load estimates. [get_readiness:2026-11-10; get_athlete_context:2026-11-10]",
      "[workout:999]",
      "### Session comparison\n\n| Reps | Focus |\n| --- | --- |\n| 4 × 4 | Hard |\n\n- Keep recovery easy.\n\n> Use controlled efforts.\n\nInline code: `[workout:40]`.",
      "<script>private()</script>\n\n![Remote image](https://example.test/pixel.png) [Unsafe](javascript:alert%281%29)",
    ].join("\n\n");
    vi.mocked(api.getConversation).mockResolvedValue({ id: 1, messages: [
      { id: 1, role: "user", content: "**Question** [workout:40]" },
      { id: 2, role: "assistant", content, result: { evidence: [
        { id: "workout:40", workout_id: 40, date: "2026-11-04" },
        { id: "workout:39", workout_id: 39, date: "2026-11-06" },
        { id: "get_readiness:2026-11-10", date: "2026-11-10" },
        { id: "get_athlete_context:2026-11-10", date: "2026-11-10" },
        { id: "get_training_progress:2026-11-10", date: "2026-11-10", kind: "context" },
      ] } },
    ] });
    vi.mocked(getWorkout).mockResolvedValue({ data: { id: 40, title: "4 × 4 min intervals", completed: true }, response: new Response() } as Awaited<ReturnType<typeof getWorkout>>);
    vi.mocked(getWorkoutReadiness).mockResolvedValue({ data: {
      date: "2026-11-10", recommendation: "modify", training_options: [{ sport: "running", focus: "high_intensity", recommendation: "avoid" }],
      limiters: [{ name: "Achilles Tendon", label: "caution" }],
    }, response: new Response() } as Awaited<ReturnType<typeof getWorkoutReadiness>>);
    vi.mocked(getProfile).mockResolvedValue({ data: {
      goal_priorities: [{ goal: { name: "Build endurance" } }],
      preferred_sports: [{ name: "Running" }],
      endurance_baselines: [{ sport: "running", threshold_hr_bpm: 175 }],
    }, response: new Response() } as Awaited<ReturnType<typeof getProfile>>);

    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Open saved discussion" }));
    expect(await screen.findByText("400–411 W")).toHaveProperty("tagName", "STRONG");
    expect(screen.getByText("**Question** [workout:40]")).toBeVisible();
    expect(screen.getByRole("table")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Session comparison" })).toBeVisible();
    expect(screen.queryByRole("img", { name: "Remote image" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Unsafe" })).not.toBeInTheDocument();
    expect(screen.getByText("Workout #999 · Source unavailable")).toBeVisible();
    expect(screen.getByRole("button", { name: "Workout #39" })).toBeVisible();

    const workout = screen.getByRole("button", { name: "Workout #40" });
    const scroll = workout.closest<HTMLElement>(".coach-conversation-scroll")!;
    Object.defineProperties(scroll, { scrollHeight: { value: 900 }, clientHeight: { value: 250 } });
    scroll.scrollTop = 125;
    fireEvent.scroll(scroll);
    await user.click(workout);
    expect(await screen.findByRole("heading", { name: "4 × 4 min intervals" })).toBeVisible();
    expect(getWorkout).toHaveBeenCalledWith(40);
    expect(screen.getByRole("link", { name: "Open in Calendar" })).toHaveAttribute("href", "/workouts?workout=40");
    expect(screen.getByRole("button", { name: "Back to conversation" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(workout).toHaveFocus();
    expect(scroll.scrollTop).toBe(125);

    await user.click(screen.getByRole("button", { name: /Training readiness · 2026-11-10/ }));
    expect(await screen.findByText("Achilles Tendon")).toBeVisible();
    expect(getWorkoutReadiness).toHaveBeenCalledWith("2026-11-10");
    await user.click(screen.getByRole("button", { name: "Back to conversation" }));
    await user.click(screen.getByRole("button", { name: /Athlete context · 2026-11-10/ }));
    expect(await screen.findByText("Build endurance")).toBeVisible();
    expect(screen.getByText("Threshold 175 bpm")).toBeVisible();
    expect(screen.getByText("Current profile")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?keep=selection");
    await user.click(screen.getByRole("button", { name: "Back to conversation" }));
    await user.click(screen.getByText("Sources"));
    await user.click(screen.getByRole("button", { name: /Training progress · 2026-11-10/ }));
    expect(screen.getByRole("link", { name: "Open Progress" })).toHaveAttribute("href", "/progress");
  });

  it("shows live text, clears a tool round, and reconciles the final reply without moving a reader", async () => {
    let publish!: (event: CoachJobEvent) => void;
    let finish!: (job: CoachJob) => void;
    let jobID!: string;
    vi.mocked(followCoachJob).mockImplementation((id, _cursor, _signal, onEvent) => {
      publish = onEvent;
      jobID = id;
      return new Promise(resolve => { finish = resolve; });
    });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "AI Coach" }));
    await ready();
    await user.type(screen.getByLabelText("Message to Coach"), "Review my training.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(followCoachJob).toHaveBeenCalled());
    const at = "2026-11-10T10:00:00Z";
    act(() => publish({ id: "1-0", text: "**Provisional** answer ", at }));
    expect(screen.getByText("Provisional")).toHaveProperty("tagName", "STRONG");
    act(() => {
      publish({ id: "2-0", text: "", at });
      publish({ id: "3-0", stage: "run_tool", tool: "get_readiness", at });
    });
    expect(screen.queryByText("Provisional")).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Coaching progress" })).toHaveTextContent("Checking training readiness");

    const scroll = screen.getByRole("region", { name: "Coach conversation" }).parentElement!;
    Object.defineProperties(scroll, { scrollHeight: { value: 1000 }, clientHeight: { value: 300 } });
    scroll.scrollTop = 120;
    fireEvent.scroll(scroll);
    const content = "Keep the effort controlled.";
    act(() => publish({ id: "4-0", text: content + " ", at }));
    const liveRow = screen.getByText(content).closest("article");
    expect(scroll.scrollTop).toBe(120);

    const result = { job_id: jobID, outcome: "ok", content };
    vi.mocked(api.getConversation).mockResolvedValue({ id: 1, messages: [
      { id: 45, role: "user", content: "My question" },
      { id: 46, role: "assistant", content, result },
    ] });
    await act(async () => finish({ id: jobID, status: "completed", turn: result }));
    await screen.findByText("My question");
    expect(screen.getByText(content).closest("article")).toBe(liveRow);
    expect(scroll.scrollTop).toBe(120);
    await user.click(screen.getByRole("button", { name: "Jump to latest" }));
    expect(screen.queryByRole("button", { name: "Jump to latest" })).not.toBeInTheDocument();
    expect(scroll).toHaveFocus();
  });

  it("replaces partial text with the saved fallback and preserves the proposal", async () => {
    let finish!: (job: CoachJob) => void;
    vi.mocked(followCoachJob).mockImplementation((_id, _cursor, _signal, publish) => {
      publish({ id: "1-0", text: "Partial explanation ", at: "2026-11-10T10:00:00Z" });
      return new Promise(resolve => { finish = resolve; });
    });
    vi.mocked(api.getCoachProposal).mockResolvedValue({ id: 55, status: "proposed", sessions: [] });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "AI Coach" }));
    await ready();
    await user.type(screen.getByLabelText("Message to Coach"), "Review my training.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Partial explanation")).toBeVisible();
    await act(async () => finish({ status: "completed", turn: { outcome: "explanation_unavailable", content: "The draft is ready.", proposals: [{ id: 55 }] } }));
    expect(screen.queryByText("Partial explanation")).not.toBeInTheDocument();
    expect(await screen.findByText("Draft ready; explanation unavailable")).toBeVisible();
    expect(await screen.findByRole("button", { name: "Accept calendar changes" })).toBeVisible();
  });

  it("shows readable Actions on completion and when opening saved history", async () => {
    const tools = [
      { name: "get_readiness", outcome: "ok" },
      { name: "list_workouts", outcome: "ok", reused: true },
      { name: "get_training_progress", outcome: "error" },
    ];
    vi.mocked(followCoachJob).mockResolvedValue({ status: "completed", turn: { outcome: "ok", content: "Evidence reviewed", tools } });
    vi.mocked(api.getConversation).mockImplementation(async id => id === 1 ? { id, messages: [
      { id: 24, role: "assistant", content: "Saved review", result: { tools } },
    ] } : { id, messages: [] });
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "AI Coach" }));
    await ready();
    await user.type(screen.getByLabelText("Message to Coach"), "Review my training.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Evidence reviewed");
    for (const content of ["Evidence reviewed", "Saved review"]) {
      const reply = (await screen.findByText(content)).closest("article")!;
      await user.click(within(reply).getByText("Actions"));
      const actions = within(reply).getByRole("list", { name: "Coach actions" });
      const rows = within(actions).getAllByRole("listitem");
      expect(rows[0]).toHaveTextContent(/Training readiness.*Checked/);
      expect(rows[1]).toHaveTextContent(/Training history and schedule.*Reused/);
      expect(rows[2]).toHaveTextContent(/Progress evidence.*Unavailable/);
      if (content === "Evidence reviewed") {
        await user.click(screen.getByRole("button", { name: "Saved conversations" }));
        await user.click(screen.getByRole("button", { name: "Saved training discussion" }));
      }
    }
  });
  it("supports old coaching URLs as overlay intents", async () => {
    mount("/coach?workout=42"); expect(await screen.findByRole("dialog", { name: "AI Coach" })).toBeInTheDocument(); expect(screen.getByLabelText("Current location")).toHaveTextContent("/workouts?workout=42"); expect(startCoachJob).not.toHaveBeenCalled();
  });
  it("clears coaching state and ignores old responses after an account change", async () => {
    let resolve!: (value: CoachJob) => void; vi.mocked(followCoachJob).mockReturnValue(new Promise(done => { resolve = done; })); const user = userEvent.setup(); const view = mount();
    await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready(); await user.type(screen.getByLabelText("Message to Coach"), "Private old question"); await user.click(screen.getByRole("button", { name: "Send" })); await waitFor(() => expect(startCoachJob).toHaveBeenCalled());
    auth.userID = 2; view.refresh(); await act(async () => resolve({ status: "completed", turn: { outcome: "ok", content: "Private old reply" } }));
    expect(screen.queryByRole("dialog", { name: "AI Coach" })).not.toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "AI Coach" })); expect(screen.getByLabelText("Message to Coach")).toHaveValue(""); expect(screen.queryByText("Private old reply")).not.toBeInTheDocument();
  });
  it("keeps each conversation draft when switching history", async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready();
    await user.click(screen.getByRole("button", { name: "Saved conversations" })); await user.click(screen.getByRole("button", { name: "Saved training discussion" }));
    await user.type(screen.getByLabelText("Message to Coach"), "Saved conversation draft"); await user.click(screen.getByRole("button", { name: "New conversation" }));
    await user.type(screen.getByLabelText("Message to Coach"), "New discussion draft"); await user.click(screen.getByRole("button", { name: "Saved conversations" })); await user.click(screen.getByRole("button", { name: "Saved training discussion" }));
    expect(screen.getByLabelText("Message to Coach")).toHaveValue("Saved conversation draft"); expect(startCoachJob).not.toHaveBeenCalled();
  });
  it.each([["needs_input", "More details needed"], ["no_fit", "No matching workout"], ["failed", "Coach unavailable"], ["explanation_unavailable", "Draft ready; explanation unavailable"]])("renders %s explicitly", async (outcome, label) => {
    vi.mocked(followCoachJob).mockResolvedValue({ status: "completed", turn: { outcome, content: "Qualified coaching response" } }); const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready(); await user.type(screen.getByLabelText("Message to Coach"), "Plan a workout"); await user.click(screen.getByRole("button", { name: "Send" })); expect(await screen.findByText(label)).toBeInTheDocument();
  });
  it("finishes explicit acceptance while hidden and refreshes training without navigation", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof acceptCoaching>>) => void;
    vi.mocked(followCoachJob).mockResolvedValue({ status: "completed", turn: { outcome: "ok", content: "Draft created", proposals: [{ id: 55 }] } });
    vi.mocked(api.getCoachProposal).mockResolvedValue({id:55,status:"proposed",sessions:[]});
    vi.mocked(acceptCoaching).mockReturnValue(new Promise(done=>{resolve=done}));
    const user=userEvent.setup();mount();await user.click(screen.getByRole("button",{name:"AI Coach"}));await ready();await user.type(screen.getByLabelText("Message to Coach"), "Plan a workout");await user.click(screen.getByRole("button",{name:"Send"}));
    const accept=await screen.findByRole("button",{name:"Accept calendar changes"});expect(acceptCoaching).not.toHaveBeenCalled();await user.click(accept);await waitFor(()=>expect(acceptCoaching).toHaveBeenCalledTimes(1));await user.click(screen.getByRole("button",{name:"Close Coach"}));
    vi.mocked(api.getCoachProposal).mockResolvedValue({id:55,status:"accepted",sessions:[]});
    await act(async()=>resolve({data:{workout_ids:[55]},response:new Response()} as Awaited<ReturnType<typeof acceptCoaching>>));expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?keep=selection");
    await user.click(screen.getByRole("button",{name:"AI Coach"}));expect(await screen.findByText("Added to your calendar.")).toBeInTheDocument();
  });
  it("keeps a stale draft visible and prepares an editable refresh message", async () => {
    vi.mocked(api.getCoachProposal).mockResolvedValue({
      id: 55, conversation_id: 1, status: "proposed", sessions: [],
    });
    vi.mocked(api.getConversation).mockResolvedValue({
      id: 1, messages: [{ role: "assistant", content: "Your workout is ready to review.", result: { proposals: [{ id: 55 }] } }],
    });
    vi.mocked(acceptCoaching).mockResolvedValue({
      error: { error: "Plan changed" }, response: new Response(null, { status: 409 }),
    } as Awaited<ReturnType<typeof acceptCoaching>>);
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole("button", { name: "Open saved discussion" }));
    await user.click(await screen.findByRole("button", { name: "Accept calendar changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Training details have changed.");
    expect(screen.getByText("Review proposed workout")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept calendar changes" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh draft" }));
    expect(screen.getByLabelText("Message to Coach")).toHaveValue("Refresh this draft against my current calendar and readiness.");
    expect(screen.getByRole("button", { name: "Remove draft #55 reference" })).toBeInTheDocument();
    expect(startCoachJob).not.toHaveBeenCalled();
  });
  it("keeps review, multiweek drafting and revision in one saved conversation", async () => {
    vi.mocked(api.getCoachProposal).mockResolvedValue({
      id: 55, conversation_id: 1, status: "proposed", kind: "plan",
      before: [{ id: 42, date: "2026-11-05", title: "Old session", planned: true }],
      sessions: [{ date: "2026-11-05", title: "New session", duration_minutes: 30 }],
    });
    vi.mocked(followCoachJob)
      .mockResolvedValueOnce({ status: "completed", turn: { outcome: "ok", content: "Review response" } })
      .mockResolvedValueOnce({ status: "completed", turn: { outcome: "ok", content: "Plan response", proposals: [{ id: 55 }] } })
      .mockResolvedValueOnce({ status: "completed", turn: { outcome: "ok", content: "Revision response" } });
    const user = userEvent.setup(); mount();
    await user.click(screen.getByRole("button", { name: "Open saved discussion" }));
    await ready();
    await user.type(screen.getByLabelText("Message to Coach"), "How did my last run go?");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Review response");
    await user.click(screen.getByRole("button", { name: "Plan my training with Coach" }));
    const input = screen.getByLabelText("Message to Coach");
    await user.clear(input);
    await user.type(input, "Draft a six-week plan with more variety.");
    await user.click(screen.getByRole("button", { name: "Close Coach" }));
    await user.click(screen.getByRole("button", { name: "AI Coach" }));
    expect(screen.getByLabelText("Message to Coach")).toHaveValue("Draft a six-week plan with more variety.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Review proposed training plan")).toBeInTheDocument();
    expect(screen.getByText("Replaces 2026-11-05 · Old session")).toBeInTheDocument();
    expect(acceptCoaching).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Continue from this draft" }));
    expect(screen.getByRole("button", { name: "Remove draft #55 reference" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Message to Coach"), "Make that 30 minutes per session.");
    await user.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Revision response");

    const requests = vi.mocked(startCoachJob).mock.calls.map(([body]) => body);
    expect(requests.map(request => request.conversation_id)).toEqual([1, 1, 1]);
    expect(requests.every(request => request.turn?.prompt === "coach_unified" && !request.proposal)).toBe(true);
    expect(requests[1]?.turn?.goal_hint).toBe("plan_training");
    expect(requests[2]?.turn?.goal_hint).toBeUndefined();
    expect(requests[2]?.turn?.proposal_id).toBe(55);
    expect(screen.queryByRole("button", { name: "Remove draft #55 reference" })).not.toBeInTheDocument();
  });
});
describe("Training change approvals", () => {
  const item: ChangeRecord = {
    id: 55, status: "pending", source: "mcp", kind: "readiness_report",
    diff: [{ label: "Set injury report", fields: [{ label: "Area", after: "achilles_tendon" }, { label: "Severity (0–100)", before: 30, after: 45 }] }],
  };

  it("opens a review link without applying and keeps the inbox receipt after approval", async () => {
    const user = userEvent.setup();
    let current = item;
    vi.mocked(listCoachChanges).mockImplementation(async () => [current]);
    vi.mocked(reviewCoachChange).mockImplementation(async () => ({ change: current, review_token: "review-55" }));
    vi.mocked(decideCoachChange).mockImplementation(async () => (current = { ...item, status: "approved" }));
    mount("/coach?change=55");
    const card = await screen.findByRole("article", { name: "Training change review" });
    expect(within(card).getByText("External AI connection")).toBeInTheDocument();
    expect(within(card).getByText("30")).toBeInTheDocument();
    expect(within(card).getByText("45")).toBeInTheDocument();
    expect(decideCoachChange).not.toHaveBeenCalled();
    await user.click(within(card).getByRole("button", { name: "Approve change" }));
    expect(await within(card).findByText("Approved")).toBeInTheDocument();
    expect(decideCoachChange).toHaveBeenCalledWith(55, "approved", "review-55");
    await user.click(screen.getByRole("button", { name: "All changes" }));
    expect(await screen.findByRole("button", { name: "Set injury report · approved" })).toBeInTheDocument();
  });

  it("shows the same review inline for a saved Coach request", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getConversation).mockResolvedValue({
      id: 1, messages: [{ role: "assistant", content: "Ready for review.", result: { changes: [{ id: 55 }] } }],
    });
    vi.mocked(reviewCoachChange).mockResolvedValue({ change: { ...item, source: "coach" }, review_token: "review-55" });
    mount();
    await user.click(screen.getByRole("button", { name: "Open saved discussion" }));
    const card = await screen.findByRole("article", { name: "Training change review" });
    expect(within(card).getByText("Set injury report")).toBeInTheDocument();
    expect(decideCoachChange).not.toHaveBeenCalled();
  });
});

describe("Coaching artifacts", () => {
  it("requires explicit acceptance and displays conflicts", async () => {
    vi.mocked(api.getCoachProposal).mockResolvedValue({ id: 5, status: "proposed", sessions: [] }); vi.mocked(acceptCoaching).mockResolvedValue({ error: { error: "Plan changed" }, response: new Response(null, { status: 409, headers: {"X-REQUEST-ID":"coach-123"} }) } as Awaited<ReturnType<typeof acceptCoaching>>);
    const user = userEvent.setup(); render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><ProposalReview id={5} /></MemoryRouter></QueryClientProvider>); await user.click(await screen.findByRole("button", { name: "Accept calendar changes" })); expect(await screen.findByRole("alert")).toHaveTextContent("Request failed. Plan changed Request ID: coach-123");
  });
  it("retains token creation and revocation in integration settings", async () => {
    vi.mocked(api.createMcpToken).mockResolvedValue({ secret: "hythlete_example", token: { id: 8 } }); vi.mocked(api.listMcpTokens).mockResolvedValue([{ id: 8, name: "My client" }]); const user = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><McpConnections title="AI integrations" /></QueryClientProvider>); await user.click(screen.getByText("AI integrations")); await user.type(screen.getByLabelText("Connection name"), "My client"); await user.click(screen.getByRole("button", { name: "Create token" })); expect(await screen.findByLabelText("New MCP token")).toHaveValue("hythlete_example"); await user.click(screen.getByRole("button", { name: "Revoke" })); await waitFor(() => expect(screen.queryByLabelText("New MCP token")).not.toBeInTheDocument());
  });
});

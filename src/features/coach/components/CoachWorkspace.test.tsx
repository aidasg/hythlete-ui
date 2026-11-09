import { act, render, screen, waitFor, within } from "@testing-library/react";
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
import { getWorkout } from "@/features/workouts/services/workoutApi";
import * as api from "../services/aiApi";
import { acceptCoaching, proposeCoaching } from "../services/coachApi";
const auth = vi.hoisted(() => ({ userID: 1 }));
vi.mock("@/features/billing/services/billingApi", () => ({ getSubscription: vi.fn(), billingKeys: { subscription: ["billing", "subscription"] } }));
vi.mock("../services/aiApi", () => ({ listConversations: vi.fn(), createConversation: vi.fn(), getConversation: vi.fn(), deleteConversation: vi.fn(), sendCoachMessage: vi.fn(), reviewWorkout: vi.fn(), getCoachProposal: vi.fn(), listMcpTokens: vi.fn(), createMcpToken: vi.fn(), revokeMcpToken: vi.fn() }));
vi.mock("../services/coachApi", () => ({ acceptCoaching: vi.fn(), proposeCoaching: vi.fn() }));
vi.mock("@/features/workouts/services/workoutApi", () => ({ getWorkout: vi.fn() }));
vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ session: { profile: { user_id: auth.userID, timezone: "Europe/Vilnius", preferred_sports: [{ id: 1, code: "running", name: "Running" }] } } }) }));
function Harness() {
  const location = useLocation(); const coach = useCoach(); const [modal, setModal] = useState(false);
  useCoachPageContext({ surface: location.pathname === "/plan" ? "plan" : "today", date: "2026-11-01" });
  return <><CoachLauncher /><output aria-label="Current location">{location.pathname}{location.search}</output><Link to="/plan">Go to plan</Link><Link to="/dashboard">Go to today</Link>
    <label>Unfinished workout note<input defaultValue="Original note" /></label>
    <CoachTrigger label="Coach insights" intent={{ action: "review_recent_workout", target: { surface: "workout", workoutID: 42, title: "Easy run", date: "2026-11-01" } }} />
    <CoachTrigger label="Another workout" intent={{ action: "review_recent_workout", target: { surface: "workout", workoutID: 43, title: "Long run", date: "2026-11-02" } }} />
    <CoachTrigger label="Plan with Coach" intent={{ action: "plan_next_workout", target: { surface: "calendar", date: "2026-11-05" } }} />
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
  vi.resetAllMocks(); auth.userID = 1;
  vi.mocked(window.matchMedia).mockImplementation(query=>({matches:false,media:query,onchange:null,addEventListener:vi.fn(),removeEventListener:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),dispatchEvent:vi.fn()}));
  vi.mocked(getSubscription).mockResolvedValue({ plan_id: "pro", ai_access: true });
  vi.mocked(api.listConversations).mockResolvedValue([{ id: 1, title: "Saved training discussion" }]);
  vi.mocked(api.createConversation).mockResolvedValue({ id: 2 });
  vi.mocked(api.getConversation).mockImplementation(async id => id === 1 ? { id, title: "Saved training discussion", messages: [{ id: 1, role: "assistant", content: "Keep the effort controlled.", result: { missing: ["Detailed execution unavailable"], evidence: [{ id: "workout:42", date: "2026-11-01", workout_id: 42 }] } }] } : { id, messages: [] });
  vi.mocked(api.sendCoachMessage).mockResolvedValue({ outcome: "ok", content: "Coach reply" });
  vi.mocked(api.reviewWorkout).mockResolvedValue({ outcome: "ok", content: "Workout reviewed" });
  vi.mocked(api.listMcpTokens).mockResolvedValue([]);
});
describe("Persistent contextual coach", () => {
  it("opens without navigating or changing unsaved work; closing preserves the composer", async () => {
    const user = userEvent.setup(); mount(); const input = screen.getByLabelText("Unfinished workout note"); await user.type(input, " edited");
    await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready();
    expect(screen.getByRole("dialog", { name: "AI Coach" })).toHaveAttribute("aria-modal", "false"); expect(document.body.style.overflow).not.toBe("hidden");
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?keep=selection");
    await user.type(screen.getByLabelText("Message to Coach"), "Keep this question"); await user.click(screen.getByRole("button", { name: "Close Coach" }));
    expect(input).toHaveValue("Original note edited"); expect(api.sendCoachMessage).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "AI Coach" })); expect(screen.getByLabelText("Message to Coach")).toHaveValue("Keep this question");
  });
  it("retains context and draft across navigation; contextual actions change only the next target", async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "Coach insights" })); await ready();
    await user.type(screen.getByLabelText("Message to Coach"), "Retained draft"); await user.click(screen.getByRole("link", { name: "Go to plan" }));
    expect(screen.getByText("Easy run · 2026-11-01")).toBeInTheDocument(); expect(screen.getByLabelText("Message to Coach")).toHaveValue("Retained draft");
    await user.click(screen.getByRole("button", { name: "Another workout" })); expect(screen.getByText("Long run · 2026-11-02")).toBeInTheDocument();
    expect(screen.getByLabelText("Message to Coach")).toHaveValue("Retained draft"); expect(api.reviewWorkout).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Get Coach insights" })); await waitFor(() => expect(api.reviewWorkout).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.reviewWorkout).mock.calls[0]?.[1]).toMatchObject({ workout_id: 43, content: "Retained draft", context: { surface: "workout", date: "2026-11-02" } });
  });
  it("completes pending responses while closed and keeps immutable submission context", async () => {
    let resolve!: (value: api.TurnResult) => void; vi.mocked(api.sendCoachMessage).mockReturnValue(new Promise(done => { resolve = done; }));
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready(); await user.type(screen.getByLabelText("Message to Coach"), "Explain today"); await user.click(screen.getByRole("button", { name: "Ask Coach" }));
    await waitFor(() => expect(api.sendCoachMessage).toHaveBeenCalledTimes(1)); await user.click(screen.getByRole("button", { name: "Another workout" })); await user.click(screen.getByRole("button", { name: "Close Coach" })); await user.click(screen.getByRole("link", { name: "Go to plan" }));
    await act(async () => resolve({ outcome: "ok", content: "Ready after closing" }));
    expect(await screen.findByLabelText("Coach response ready")).toBeInTheDocument();
    expect(vi.mocked(api.sendCoachMessage).mock.calls[0]?.[1]).toMatchObject({ content: "Explain today", context: { surface: "today", date: "2026-11-01" } });
    await user.click(screen.getByRole("button", { name: "AI Coach" })); expect(screen.getByText("Ready after closing")).toBeInTheDocument();
  });
  it("reuses retry keys after uncertain requests", async () => {
    vi.mocked(api.sendCoachMessage).mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce({ outcome: "ok", content: "Retried" });
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready(); await user.type(screen.getByLabelText("Message to Coach"), "Question"); await user.click(screen.getByRole("button", { name: "Ask Coach" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable"); await user.click(screen.getByRole("button", { name: "Ask Coach" })); await waitFor(() => expect(api.sendCoachMessage).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(api.sendCoachMessage).mock.calls; expect(calls[0]?.[1].key).toBe(calls[1]?.[1].key); expect(api.createConversation).toHaveBeenCalledTimes(1);
  });
  it("prepares explicit planning inputs and progress references without auto-generation", async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "Plan with Coach" })); await ready();
    await user.click(screen.getByText(/Workout preferences/)); const minutes = screen.getByLabelText("Available minutes"); await user.clear(minutes); await user.type(minutes, "45");
    await user.click(screen.getByRole("checkbox", { name: /^dumbbell$/i })); expect(api.sendCoachMessage).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Generate workout draft" })); await waitFor(() => expect(api.sendCoachMessage).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.sendCoachMessage).mock.calls[0]?.[1].constraints).toMatchObject({ date: "2026-11-05", minutes: 45, equipment: ["bodyweight", "dumbbell"] });
    await waitFor(() => expect(screen.getByLabelText("Message to Coach")).toBeEnabled()); await user.click(screen.getByRole("button", { name: "Explain with Coach" })); await user.click(screen.getByRole("button", { name: "Ask Coach" }));
    await waitFor(() => expect(api.sendCoachMessage).toHaveBeenCalledTimes(2)); expect(vi.mocked(api.sendCoachMessage).mock.calls[1]?.[1].context).toMatchObject({ surface: "progress", progress_view: "strength", exercise_code: "back_squat" });
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
    screen.getByRole("button", { name: "Ask Coach" }).focus(); await user.tab(); expect(screen.getByRole("button", { name: "Close Coach" })).toHaveFocus(); await user.keyboard("{Escape}"); await waitFor(() => expect(screen.getByRole("button", { name: "AI Coach" })).toHaveFocus());
  });
  it("allows Free users to read saved history and preview sources in place", async () => {
    vi.mocked(getSubscription).mockResolvedValue({ plan_id: "free", ai_access: false }); vi.mocked(getWorkout).mockResolvedValue({ data: { id: 42, title: "Source easy run", date: "2026-11-01", completed: true, duration_minutes: 20, components: [] }, response: new Response() } as Awaited<ReturnType<typeof getWorkout>>);
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "Open saved discussion" })); expect(await screen.findByText("Keep the effort controlled.")).toBeInTheDocument(); expect(screen.getByRole("button", { name: "Ask Coach" })).toBeDisabled(); expect(screen.getByRole("link", { name: "Choose a plan" })).toHaveAttribute("href", "/billing");
    await user.click(screen.getByRole("button", { name: /Workout #42/ })); expect(await screen.findByText("Source easy run")).toBeInTheDocument(); expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?keep=selection"); await user.click(screen.getByRole("button", { name: "Back to conversation" })); expect(screen.getByText("Keep the effort controlled.")).toBeInTheDocument();
    await user.click(screen.getByText("Conversation options")); await user.click(screen.getByRole("button", { name: "Delete conversation" })); await waitFor(() => expect(api.deleteConversation).toHaveBeenCalledWith(1));
  });
  it("supports old coaching URLs as overlay intents", async () => {
    mount("/coach?workout=42"); expect(await screen.findByRole("dialog", { name: "AI Coach" })).toBeInTheDocument(); expect(screen.getByLabelText("Current location")).toHaveTextContent("/workouts?workout=42"); expect(api.reviewWorkout).not.toHaveBeenCalled();
  });
  it("clears coaching state and ignores old responses after an account change", async () => {
    let resolve!: (value: api.TurnResult) => void; vi.mocked(api.sendCoachMessage).mockReturnValue(new Promise(done => { resolve = done; })); const user = userEvent.setup(); const view = mount();
    await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready(); await user.type(screen.getByLabelText("Message to Coach"), "Private old question"); await user.click(screen.getByRole("button", { name: "Ask Coach" })); await waitFor(() => expect(api.sendCoachMessage).toHaveBeenCalled());
    auth.userID = 2; view.refresh(); await act(async () => resolve({ outcome: "ok", content: "Private old reply" }));
    expect(screen.queryByRole("dialog", { name: "AI Coach" })).not.toBeInTheDocument(); await user.click(screen.getByRole("button", { name: "AI Coach" })); expect(screen.getByLabelText("Message to Coach")).toHaveValue(""); expect(screen.queryByText("Private old reply")).not.toBeInTheDocument();
  });
  it("keeps each conversation draft when switching history", async () => {
    const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready();
    await user.click(screen.getByRole("button", { name: "Saved conversations" })); await user.click(screen.getByRole("button", { name: "Saved training discussion" }));
    await user.type(screen.getByLabelText("Message to Coach"), "Saved conversation draft"); await user.click(screen.getByRole("button", { name: "New conversation" }));
    await user.type(screen.getByLabelText("Message to Coach"), "New discussion draft"); await user.click(screen.getByRole("button", { name: "Saved conversations" })); await user.click(screen.getByRole("button", { name: "Saved training discussion" }));
    expect(screen.getByLabelText("Message to Coach")).toHaveValue("Saved conversation draft"); expect(api.sendCoachMessage).not.toHaveBeenCalled();
  });
  it.each([["needs_input", "More details needed"], ["no_fit", "No matching workout"], ["failed", "Coach unavailable"], ["explanation_unavailable", "Draft ready; explanation unavailable"]])("renders %s explicitly", async (outcome, label) => {
    vi.mocked(api.sendCoachMessage).mockResolvedValue({ outcome, content: "Qualified coaching response" }); const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready(); await user.click(screen.getByRole("button", { name: "Ask Coach" })); expect(await screen.findByText(label)).toBeInTheDocument();
  });
  it("finishes explicit acceptance while hidden and refreshes training without navigation", async () => {
    let resolve!: (value: Awaited<ReturnType<typeof acceptCoaching>>) => void;
    vi.mocked(api.sendCoachMessage).mockResolvedValue({ outcome: "ok", content: "Draft created", proposals: [{id:55}] });
    vi.mocked(api.getCoachProposal).mockResolvedValue({id:55,status:"proposed",sessions:[]});
    vi.mocked(acceptCoaching).mockReturnValue(new Promise(done=>{resolve=done}));
    const user=userEvent.setup();mount();await user.click(screen.getByRole("button",{name:"AI Coach"}));await ready();await user.click(screen.getByRole("button",{name:"Ask Coach"}));
    const accept=await screen.findByRole("button",{name:"Accept calendar changes"});expect(acceptCoaching).not.toHaveBeenCalled();await user.click(accept);await waitFor(()=>expect(acceptCoaching).toHaveBeenCalledTimes(1));await user.click(screen.getByRole("button",{name:"Close Coach"}));
    await act(async()=>resolve({data:{id:55},response:new Response()} as Awaited<ReturnType<typeof acceptCoaching>>));expect(screen.getByLabelText("Current location")).toHaveTextContent("/dashboard?keep=selection");
    await user.click(screen.getByRole("button",{name:"AI Coach"}));expect(screen.getByRole("button",{name:"Accept calendar changes"})).toBeEnabled();
  });
  it("preserves multiweek proposal inputs and drafts when hidden", async () => {
    vi.mocked(proposeCoaching).mockResolvedValue({ data: { id: 55 } } as Awaited<ReturnType<typeof proposeCoaching>>); vi.mocked(api.getCoachProposal).mockResolvedValue({ id: 55, status: "proposed", sessions: [] }); const user = userEvent.setup(); mount(); await user.click(screen.getByRole("button", { name: "AI Coach" })); await ready();
    await user.click(screen.getByText("Coaching tools")); await user.click(within(screen.getByLabelText("Coaching tools")).getByRole("button", { name: "Plan my training with Coach" })); await user.selectOptions(screen.getByLabelText("Plan length"), "6"); await user.type(screen.getByLabelText("What would you like to change?"), "More variety"); await user.click(screen.getByRole("button", { name: "Close Coach" })); await user.click(screen.getByRole("button", { name: "AI Coach" }));
    expect(screen.getByLabelText("Plan length")).toHaveValue("6"); expect(screen.getByLabelText("What would you like to change?")).toHaveValue("More variety"); await user.click(screen.getByRole("button", { name: "Propose changes" })); await waitFor(() => expect(proposeCoaching).toHaveBeenCalledTimes(1)); expect(vi.mocked(proposeCoaching).mock.calls[0]?.[0]).toMatchObject({ weeks: 6, instruction: "More variety" }); expect(await screen.findByText("Review proposed workout")).toBeInTheDocument(); expect(acceptCoaching).not.toHaveBeenCalled();
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

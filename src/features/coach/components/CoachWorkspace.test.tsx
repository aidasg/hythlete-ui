import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { CoachWorkspace } from "./CoachWorkspace";
import { ProposalReview } from "./ProposalReview";
import { McpConnections } from "./McpConnections";
import { getSubscription } from "@/features/billing/services/billingApi";
import * as api from "../services/aiApi";
import { acceptCoaching } from "../services/coachApi";
vi.mock("@/features/billing/services/billingApi", () => ({ getSubscription: vi.fn(), billingKeys: { subscription: ["billing", "subscription"] } }));
vi.mock("../services/aiApi", () => ({ listConversations: vi.fn(), createConversation: vi.fn(), getConversation: vi.fn(), deleteConversation: vi.fn(), sendCoachMessage: vi.fn(), reviewWorkout: vi.fn(), getCoachProposal: vi.fn(), listMcpTokens: vi.fn(), createMcpToken: vi.fn(), revokeMcpToken: vi.fn() }));
vi.mock("@/features/auth/context/useAuth", () => ({ useAuth: () => ({ session: { profile: { user_id: 1, timezone: "Europe/Vilnius", preferred_sports: [{ id: 1, code: "running", name: "Running" }] } } }) }));
vi.mock("../services/coachApi", () => ({ acceptCoaching: vi.fn() }));
function mount(element: React.ReactNode, path = "/coach") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{element}</MemoryRouter></QueryClientProvider>);
}
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getSubscription).mockResolvedValue({plan_id:"pro",ai_access:true});
  vi.mocked(api.listConversations).mockResolvedValue([{ id: 1, title: "Saved training discussion" }]);
  vi.mocked(api.listMcpTokens).mockResolvedValue([]);
  vi.mocked(api.getConversation).mockResolvedValue({ id: 1, title: "Saved training discussion", messages: [{ id: 1, role: "assistant", content: "Keep the effort controlled.", result: { missing: ["Detailed execution unavailable"], evidence: [{ id: "workout:42", date: "2026-10-30", workout_id: 42 }] } }] });
});
describe("Coach workspace", () => {
  it("prompts Free users to upgrade while preserving saved conversations", async () => {
    vi.mocked(getSubscription).mockResolvedValue({plan_id:"free",ai_access:false});
    mount(<CoachWorkspace/>,"/coach?conversation=1");
    expect(await screen.findByRole("link",{name:"Choose a plan"})).toHaveAttribute("href","/billing");
    expect(await screen.findByText("Keep the effort controlled.")).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"Send to coach"})).toBeDisabled();
  });
  it("reloads saved evidence and deletes a conversation", async () => {
    const user = userEvent.setup(); mount(<CoachWorkspace />, "/coach?conversation=1");
    expect(await screen.findByText("Keep the effort controlled.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Workout #42/ })).toHaveAttribute("href", "/workouts?workout=42");
    await user.click(screen.getByText("Data limitations")); expect(screen.getByText("Detailed execution unavailable")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Delete conversation" }));
    await waitFor(() => expect(api.deleteConversation).toHaveBeenCalledWith(1, expect.anything()));
  });
  it("uses a stable request key when retrying an uncertain message", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createConversation).mockResolvedValue({ id: 2 });
    vi.mocked(api.sendCoachMessage).mockRejectedValueOnce(new Error("Network unavailable")).mockResolvedValueOnce({ content: "Reviewed", outcome: "ok" });
    mount(<CoachWorkspace />);
    await user.type(screen.getByLabelText("Your message"), "Help me plan");
    await user.click(screen.getByRole("button", { name: "Send to coach" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network unavailable");
    await user.click(screen.getByRole("button", { name: "Send to coach" }));
    await waitFor(() => expect(api.sendCoachMessage).toHaveBeenCalledTimes(2));
    const calls = vi.mocked(api.sendCoachMessage).mock.calls;
    expect(calls[0]?.[1].key).toBeTruthy(); expect(calls[0]?.[1].key).toBe(calls[1]?.[1].key);
    expect(api.createConversation).toHaveBeenCalledTimes(1);
  });
  it("submits explicit planning constraints without sample availability", async () => {
    const user=userEvent.setup();vi.mocked(api.createConversation).mockResolvedValue({id:2});vi.mocked(api.sendCoachMessage).mockResolvedValue({outcome:"ok",content:"Draft ready"});
    mount(<CoachWorkspace/>,"/coach?action=plan_next_workout&date=2026-11-05");
    expect(screen.getByLabelText("Workout date")).toHaveValue("2026-11-05");
    const minutes=screen.getByLabelText("Available minutes");await waitFor(()=>expect(minutes).toBeEnabled());await user.clear(minutes);await user.type(minutes,"45");
    await user.click(screen.getByRole("checkbox",{name:/^dumbbell$/i}));
    await user.click(screen.getByRole("button",{name:"Generate workout draft"}));
    await waitFor(()=>expect(api.sendCoachMessage).toHaveBeenCalledTimes(1));
    const request=vi.mocked(api.sendCoachMessage).mock.calls[0]?.[1];
    expect(request?.constraints).toMatchObject({date:"2026-11-05",minutes:45,activity_mode:"profile",equipment:["bodyweight","dumbbell"]});
    expect(request?.content).not.toContain("bicycle");expect(request?.prompt).toBe("plan_next_workout");
  });
  it("runs the review action through the insight endpoint",async()=>{
    const user=userEvent.setup();vi.mocked(api.createConversation).mockResolvedValue({id:2});vi.mocked(api.reviewWorkout).mockResolvedValue({outcome:"ok",content:"Review complete"});
    mount(<CoachWorkspace/>,"/coach?workout=42");await user.click(screen.getByRole("button",{name:"Review completed workout"}));
    await waitFor(()=>expect(api.reviewWorkout).toHaveBeenCalledTimes(1));expect(vi.mocked(api.reviewWorkout).mock.calls[0]?.[1].workout_id).toBe(42);expect(api.sendCoachMessage).not.toHaveBeenCalled();
  });
  it("requires explicit acceptance and displays stale proposal errors", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getCoachProposal).mockResolvedValue({ id: 5, status: "proposed", source: "deterministic", sessions: [{ date: "2026-10-31", title: "Easy run", duration_minutes: 30, blocks: [] }] });
    vi.mocked(acceptCoaching).mockResolvedValue({ error: { error: "Plan changed; generate a new proposal" } } as Awaited<ReturnType<typeof acceptCoaching>>);
    mount(<ProposalReview id={5} />);
    expect(await screen.findByText(/Easy run/)).toBeInTheDocument(); expect(acceptCoaching).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Accept calendar changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Plan changed");
  });
  it("shows token secrets once and supports revocation", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createMcpToken).mockResolvedValue({ secret: "hythlete_example", token: { id: 8 } });
    vi.mocked(api.listMcpTokens).mockResolvedValue([{ id: 8, name: "My client", scopes: ["training:read"] }]);
    mount(<McpConnections />); await user.click(screen.getByText("External AI connections (MCP pilot)"));
    await user.type(screen.getByLabelText("Connection name"), "My client"); await user.click(screen.getByRole("button", { name: "Create token" }));
    expect(await screen.findByLabelText("New MCP token")).toHaveValue("hythlete_example");
    await user.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(screen.queryByLabelText("New MCP token")).not.toBeInTheDocument());
    expect(api.revokeMcpToken).toHaveBeenCalledWith(8, expect.anything());
  });
});

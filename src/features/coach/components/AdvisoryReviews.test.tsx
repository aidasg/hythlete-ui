import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, it, vi } from "vitest";
import { ProposalReview } from "./ProposalReview";
import { ChangeReview } from "./ChangeReview";
import { getCoachProposal } from "../services/aiApi";
import { decideCoachChange, reviewCoachChange } from "../services/changeApi";

const { acceptProposal } = vi.hoisted(() => ({ acceptProposal: vi.fn() }));
vi.mock("../context/coachContext", () => ({
  useCoach: () => ({ userID: 7, paid: true, proposalErrors: {}, acceptProposal }),
}));
vi.mock("../services/aiApi", () => ({ getCoachProposal: vi.fn() }));
vi.mock("../services/changeApi", () => ({ reviewCoachChange: vi.fn(), decideCoachChange: vi.fn() }));

const advisories = [
  { code: "estimated_load_elevated", source: "load_estimate", message: "Estimated Achilles load is high.", date: "2026-11-18" },
  { code: "reported_injury", source: "athlete_report", concern: "strong_caution", message: "You reported an Achilles issue.", date: "2026-11-18" },
];
function renderReview(element: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{element}</MemoryRouter>
  </QueryClientProvider>);
}
beforeEach(() => { vi.clearAllMocks(); });

it("separates estimate and symptom advice while keeping proposal acceptance available", async () => {
  vi.mocked(getCoachProposal).mockResolvedValue({ id: 9, status: "proposed", expires_at: "2099-11-18T12:00:00Z", advisories });
  renderReview(<ProposalReview id={9} />);
  expect(await screen.findByRole("heading", { name: "Your reported symptoms" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Estimated training load" })).toBeInTheDocument();
  const accept = screen.getByRole("button", { name: "Accept calendar changes" });
  expect(accept).toBeEnabled();
  fireEvent.click(accept);
  expect(acceptProposal).toHaveBeenCalledWith(9);
});

it("allows approving a planned workout change with stronger symptom advice", async () => {
  vi.mocked(reviewCoachChange).mockResolvedValueOnce({ review_token: "review-token", change: { id: 12, status: "pending", advisories } }).mockResolvedValue({ change: { id: 12, status: "approved", advisories } });
  vi.mocked(decideCoachChange).mockResolvedValue({ id: 12, status: "approved", advisories });
  renderReview(<ChangeReview id={12} />);
  expect(await screen.findByText("You reported an Achilles issue.")).toBeInTheDocument();
  const approve = screen.getByRole("button", { name: "Approve change" });
  expect(approve).toBeEnabled();
  fireEvent.click(approve);
  await waitFor(() => expect(decideCoachChange).toHaveBeenCalledWith(12, "approved", "review-token"));
  expect(await screen.findByText("Approved")).toBeInTheDocument();
});

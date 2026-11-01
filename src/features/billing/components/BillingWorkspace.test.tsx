import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../services/billingApi";
import { BillingWorkspace } from "./BillingWorkspace";
import { InvoiceDetail } from "./InvoiceDetail";
vi.mock("../services/billingApi", async importOriginal => ({ ...await importOriginal<typeof api>(), getPlans: vi.fn(), getSubscription: vi.fn(), getPayments: vi.fn(), selectPlan: vi.fn(), getInvoice: vi.fn(), getLatestInvoice: vi.fn() }));
const subscription = { id: 1, price_id: "pro-monthly", provider: "fake", environment: "test", status: "active", period_end: "2027-01-31T12:00:00Z" };
function mount(invoice = false, id = "7") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[invoice ? `/billing/invoices/${id}` : "/billing"]}><Routes><Route path="/billing" element={<BillingWorkspace />} /><Route path="/billing/invoices/:id" element={<InvoiceDetail />} /></Routes></MemoryRouter></QueryClientProvider>);
}
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.getPlans).mockResolvedValue([{ id: "free", name: "Free", prices: [] }, { id: "pro", name: "Pro", prices: [{ id: "pro-monthly", amount: 999, currency: "EUR", interval: "month", providers: [{ provider: "fake", environment: "test" }] }, { id: "pro-yearly", amount: 9999, currency: "EUR", interval: "year", providers: [{ provider: "fake", environment: "test" }] }] }]);
  vi.mocked(api.getSubscription).mockResolvedValue({ plan_id: "free", ai_access: false });
  vi.mocked(api.getPayments).mockResolvedValue({ items: [], next_cursor: "" });
  vi.mocked(api.getLatestInvoice).mockResolvedValue(null);
  vi.mocked(api.selectPlan).mockResolvedValue({ plan_id: "pro", ai_access: true, subscription });
});
describe("Billing", () => {
  it("selects Pro with a durable request key and no payment credentials", async () => {
    const user = userEvent.setup(); mount();
    const buttons = await screen.findAllByRole("button", { name: "Select Pro (simulated)" });
    await user.click(buttons[0]!);
    await waitFor(() => expect(api.selectPlan).toHaveBeenCalledTimes(1));
    expect(vi.mocked(api.selectPlan).mock.calls[0]![0]).toMatchObject({ price_id: "pro-monthly", provider: "fake", environment: "test", key: expect.any(String) });
    expect(await screen.findByText("Your plan selection has been saved.")).toBeInTheDocument();
  });
  it("shows scheduled cancellation and lets the user keep the current plan", async () => {
    vi.mocked(api.getSubscription).mockResolvedValue({ plan_id: "pro", ai_access: true, subscription: { ...subscription, cancel_at_period_end: true } });
    const user = userEvent.setup(); mount();
    expect(await screen.findByText("Free starts at the end of your current paid period.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Keep current plan" }));
    expect(api.selectPlan).toHaveBeenCalledWith(expect.objectContaining({ price_id: "pro-monthly" }));
  });
  it("retains the request key for retry after an ambiguous failure", async () => {
    vi.mocked(api.selectPlan).mockRejectedValueOnce(new Error("Connection lost"));
    const user = userEvent.setup(); mount();
    const buttons = await screen.findAllByRole("button", { name: "Select Pro (simulated)" }); await user.click(buttons[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost");
    await user.click(buttons[0]!); await waitFor(() => expect(api.selectPlan).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.selectPlan).mock.calls[0]![0].key).toBe(vi.mocked(api.selectPlan).mock.calls[1]![0].key);
  });
  it("loads older payments and links each invoice", async () => {
    vi.mocked(api.getPayments).mockImplementation(async cursor => cursor ? { items: [{ id: 1, invoice_id: 7, amount: 999, currency: "EUR", status: "succeeded", simulated: true }], next_cursor: "" } : { items: [{ id: 2, invoice_id: 8, amount: 999, currency: "EUR", status: "succeeded", simulated: true }], next_cursor: "2" });
    const user = userEvent.setup(); mount();
    await user.click(await screen.findByRole("button", { name: "Load older payments" }));
    await waitFor(() => expect(screen.getAllByRole("link", { name: "View invoice" })).toHaveLength(2));
    expect(screen.getAllByRole("link", { name: "View invoice" })[1]).toHaveAttribute("href", "/billing/invoices/7");
  });
  it("shows an owned printable simulated invoice", async () => {
    vi.mocked(api.getInvoice).mockResolvedValue({ id: 7, number: "SIM-00000007", simulated: true, billing_name: "Athlete", billing_email: "athlete@example.test", status: "paid", currency: "EUR", subtotal: 999, tax: 0, total: 999, lines: [{ description: "Pro month", quantity: 1, amount: 999, unit_amount: 999 }] });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const user = userEvent.setup(); mount(true);
    expect(await screen.findByText("Invoice SIM-00000007")).toBeInTheDocument();
    expect(screen.getByText("Simulated invoice. No money was charged.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Print / Save as PDF" })); expect(print).toHaveBeenCalledOnce(); print.mockRestore();
  });
  it("does not expose another user's invoice", async () => {
    vi.mocked(api.getInvoice).mockRejectedValue(new api.BillingError("Not found", 404)); mount(true);
    expect(await screen.findByRole("alert")).toHaveTextContent("Invoice not found.");
    expect(screen.queryByRole("button", { name: "Print / Save as PDF" })).not.toBeInTheDocument();
  });
  it("rejects malformed invoice IDs locally", async () => {
    mount(true, "bad"); expect(screen.getByRole("alert")).toHaveTextContent("Invoice not found."); expect(api.getInvoice).not.toHaveBeenCalled();
  });
});

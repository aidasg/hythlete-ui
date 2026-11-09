import { useRef } from "react";
import { Sparkles } from "lucide-react";
import { BillingPlanCard } from "@/features/billing/components/BillingPlanCard";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { billingDate, billingKeys, getLatestInvoice, getPayments, getPlans, getSubscription, money, selectPlan, type Selection } from "@/features/billing/services/billingApi";
import { paths } from "@/routes/paths";

export function BillingWorkspace() {
  const client = useQueryClient();
  const plans = useQuery({ queryKey: ["billing", "plans"], queryFn: getPlans });
  const current = useQuery({ queryKey: billingKeys.subscription, queryFn: getSubscription });
  const latest = useQuery({ queryKey: ["billing", "latest-invoice"], queryFn: getLatestInvoice, retry: false });
  const payments = useInfiniteQuery({ queryKey: ["billing", "payments"], initialPageParam: "", queryFn: ({ pageParam }) => getPayments(pageParam || undefined), getNextPageParam: page => page.next_cursor || undefined });
  const pending = useRef<Selection | null>(null);
  const change = useMutation({ mutationFn: (selection: Selection) => selectPlan(selection), onSuccess: async state => {
    pending.current = null;
    if (state.checkout_url) { window.location.assign(state.checkout_url); return; }
    await client.invalidateQueries({ queryKey: ["billing"] });
  } });
  function choose(price_id: string, provider = "", environment = "") {
    if (change.isPending) return;
    const previous = pending.current;
    const selection = previous?.price_id === price_id && previous.provider === provider && previous.environment === environment ? previous : { key: crypto.randomUUID(), price_id, provider, environment };
    pending.current = selection;
    change.mutate(selection);
  }
  const sub = current.data?.subscription;
  const pendingPrice = plans.data?.flatMap(plan => plan.prices || []).find(price => price.id === sub?.pending_price_id);
  const rows = payments.data?.pages.flatMap(page => page.items || []) || [];
  const error = current.error || plans.error || change.error;
  return <section className="billing-workspace">
    <header><span className="eyebrow">Account</span><h1>Invest in your next personal best.</h1><p>Your training essentials, with the option to go further with AI coaching.</p></header>
    {(plans.isPending || current.isPending) && <p role="status">Loading billing details...</p>}
    {error && <p role="alert">{error.message} <button className="secondary-button" onClick={() => { void plans.refetch(); void current.refetch(); }}>Refresh billing</button></p>}
    {current.data && <section className="billing-card billing-current" aria-label="Current subscription">
      <div className="billing-current-summary"><div><span className="eyebrow">Your membership</span><h2>{current.data.plan_id === "pro" ? "Pro" : "Free"} <span className="billing-current-badge">Current plan</span></h2></div><p><Sparkles size={18} aria-hidden="true" />{current.data.ai_access ? "Your AI coach is ready when you are." : "Ready for your next level? Meet your AI coach with Pro."}</p></div>
      {sub && <><p>Status: {sub.status} · {sub.provider === "fake" ? "Simulated payments" : sub.provider}</p><p>{sub.cancel_at_period_end ? "Pro access ends" : "Next renewal"}: {billingDate(sub.period_end)}</p>
        {sub.pending_price_id && <p role="status">Scheduled change: Pro {pendingPrice ? `${money(pendingPrice.amount, pendingPrice.currency)} / ${pendingPrice.interval}` : "price change"}, effective {billingDate(sub.period_end)}.</p>}
        {sub.cancel_at_period_end && <p role="status">Free starts at the end of your current paid period.</p>}
        {(sub.cancel_at_period_end || sub.pending_price_id) && <button className="secondary-button" disabled={change.isPending || !sub.price_id} onClick={() => choose(sub.price_id!, sub.provider, sub.environment)}>Keep current plan</button>}
      </>}
    </section>}
    <div className="billing-plans">{plans.data?.map(plan => <BillingPlanCard key={plan.id} plan={plan} current={current.data} updating={change.isPending} onChoose={choose} />)}</div>
    {change.isPending && <p role="status">Updating your subscription...</p>}
    {change.isSuccess && <p role="status">Your plan selection has been saved.</p>}
    <section className="billing-card"><h2>Payments & invoices</h2>
      {latest.data && <Link className="secondary-button" to={paths.billingInvoice.replace(":id", String(latest.data.id))}>Open latest invoice</Link>}
      {latest.error && <p role="alert">{latest.error.message} <button onClick={() => void latest.refetch()}>Retry</button></p>}
      {payments.isPending && <p role="status">Loading payments...</p>}
      {payments.error && <p role="alert">{payments.error.message} <button onClick={() => void payments.refetch()}>Retry</button></p>}
      {payments.isSuccess && !rows.length && <p>No payments yet.</p>}
      {!!rows.length && <div className="billing-table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Provider</th><th>Invoice</th></tr></thead><tbody>{rows.map(payment => <tr key={payment.id}><td>{billingDate(payment.created_at)}</td><td>{money(payment.amount, payment.currency)}</td><td>{payment.status}</td><td>{payment.simulated ? "Simulated" : payment.provider}</td><td><Link to={paths.billingInvoice.replace(":id", String(payment.invoice_id))}>View invoice</Link></td></tr>)}</tbody></table></div>}
      {payments.hasNextPage && <button className="secondary-button" disabled={payments.isFetchingNextPage} onClick={() => void payments.fetchNextPage()}>{payments.isFetchingNextPage ? "Loading..." : "Load older payments"}</button>}
    </section>
  </section>;
}

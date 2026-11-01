import { useRef } from "react";
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
    <header><span className="eyebrow">Account</span><h1>Plan & billing</h1><p>Choose your plan and review your payment history.</p></header>
    {(plans.isPending || current.isPending) && <p role="status">Loading billing details...</p>}
    {error && <p role="alert">{error.message} <button className="secondary-button" onClick={() => { void plans.refetch(); void current.refetch(); }}>Refresh billing</button></p>}
    {current.data && <section className="billing-card" aria-label="Current subscription"><h2>Current plan: {current.data.plan_id === "pro" ? "Pro" : "Free"}</h2>
      <p>{current.data.ai_access ? "Unlimited AI coaching is included." : "Choose Pro to use AI coaching."}</p>
      {sub && <><p>Status: {sub.status} · {sub.provider === "fake" ? "Simulated payments" : sub.provider}</p><p>{sub.cancel_at_period_end ? "Pro access ends" : "Next renewal"}: {billingDate(sub.period_end)}</p>
        {sub.pending_price_id && <p role="status">Scheduled change: Pro {pendingPrice ? `${money(pendingPrice.amount, pendingPrice.currency)} / ${pendingPrice.interval}` : "price change"}, effective {billingDate(sub.period_end)}.</p>}
        {sub.cancel_at_period_end && <p role="status">Free starts at the end of your current paid period.</p>}
        {(sub.cancel_at_period_end || sub.pending_price_id) && <button className="secondary-button" disabled={change.isPending || !sub.price_id} onClick={() => choose(sub.price_id!, sub.provider, sub.environment)}>Keep current plan</button>}
      </>}
    </section>}
    <div className="billing-plans">{plans.data?.map(plan => <section className="billing-card" key={plan.id}><h2>{plan.name}</h2><p>{plan.description}</p>
      {plan.id === "free" ? <><strong>Free</strong><p>Workout tracking without AI coaching.</p><button className="secondary-button" disabled={change.isPending || !current.data || !sub || !!sub.cancel_at_period_end} onClick={() => choose("free")}>{sub?.cancel_at_period_end ? "Free scheduled" : !sub ? "Current plan" : "Switch to Free at renewal"}</button></> : plan.prices?.map(price => <div className="billing-price" key={price.id}><strong>{money(price.amount, price.currency)} / {price.interval}</strong><p>Example pricing · unlimited AI coaching</p>
        {price.providers?.map(provider => <button className="primary-button" key={`${provider.provider}:${provider.environment}`} disabled={change.isPending || !current.data || (sub?.price_id === price.id && !sub?.cancel_at_period_end && !sub?.pending_price_id) || (sub?.pending_price_id === price.id) || (!!sub && (sub.provider !== provider.provider || sub.environment !== provider.environment))} onClick={() => choose(price.id!, provider.provider, provider.environment)}>
          {sub?.pending_price_id === price.id ? "Scheduled" : sub?.price_id === price.id && !sub?.cancel_at_period_end && !sub?.pending_price_id ? "Current plan" : `${sub ? "Select at renewal" : "Select Pro"}${provider.provider === "fake" ? " (simulated)" : ` via ${provider.provider}`}`}
        </button>)}
        {!price.providers?.length && <p>Plan selection is currently unavailable.</p>}
      </div>)}
    </section>)}</div>
    {change.isPending && <p role="status">Updating your subscription...</p>}
    {change.isSuccess && <p role="status">Your plan selection has been saved.</p>}
    <section className="billing-card"><h2>Payments & invoices</h2>
      {latest.data && <Link className="secondary-button" to={paths.billingInvoice.replace(":id", String(latest.data.id))}>Open latest invoice</Link>}
      {latest.error && <p role="alert">Latest invoice could not be loaded. <button onClick={() => void latest.refetch()}>Retry</button></p>}
      {payments.isPending && <p role="status">Loading payments...</p>}
      {payments.error && <p role="alert">{payments.error.message} <button onClick={() => void payments.refetch()}>Retry</button></p>}
      {payments.isSuccess && !rows.length && <p>No payments yet.</p>}
      {!!rows.length && <div className="billing-table-wrap"><table><thead><tr><th>Date</th><th>Amount</th><th>Status</th><th>Provider</th><th>Invoice</th></tr></thead><tbody>{rows.map(payment => <tr key={payment.id}><td>{billingDate(payment.created_at)}</td><td>{money(payment.amount, payment.currency)}</td><td>{payment.status}</td><td>{payment.simulated ? "Simulated" : payment.provider}</td><td><Link to={paths.billingInvoice.replace(":id", String(payment.invoice_id))}>View invoice</Link></td></tr>)}</tbody></table></div>}
      {payments.hasNextPage && <button className="secondary-button" disabled={payments.isFetchingNextPage} onClick={() => void payments.fetchNextPage()}>{payments.isFetchingNextPage ? "Loading..." : "Load older payments"}</button>}
    </section>
  </section>;
}

import { ArrowUpRight, Check, Dumbbell, Sparkles } from "lucide-react";
import type { components } from "@/services/api/types";
import { money, type BillingState } from "@/features/billing/services/billingApi";

type Plan = components["schemas"]["billing.Plan"];
type Props = {
  plan: Plan;
  current: BillingState | undefined;
  updating: boolean;
  onChoose: (priceId: string, provider?: string, environment?: string) => void;
};

const freeBenefits = [
  "Log workouts across your activities",
  "Keep your goals and fitness baselines together",
  "Build a clear picture of your training",
];
const proBenefits = [
  "Everything in Free, plus unlimited AI coaching",
  "Get guidance shaped around your training goals",
  "Discuss your workouts and next steps with your coach",
];

export function BillingPlanCard({ plan, current, updating, onChoose }: Props) {
  const isFree = plan.id === "free";
  const isPro = plan.id === "pro";
  const sub = current?.subscription;
  const monthly = plan.prices?.find(price => price.interval === "month");
  const Icon = isFree ? Dumbbell : Sparkles;

  return <section className={`billing-card billing-plan-card ${isFree ? "billing-plan-free" : "billing-plan-pro"}`} aria-label={`${plan.name} plan`}>
    <div className="billing-plan-heading">
      <span className="billing-plan-icon"><Icon size={23} aria-hidden="true" /></span>
      <span className="billing-plan-badge">{isFree ? "Your training foundation" : "Unlock your potential"}</span>
    </div>
    <div><h2>{plan.name}</h2><p className="billing-plan-tagline">{isFree ? "Make every workout count." : isPro ? "Train with a coach in your corner." : plan.description}</p></div>
    {isFree && <div className="billing-plan-cost"><strong>{money(0, plan.prices?.[0]?.currency)}</strong><span> / always free</span></div>}
    <ul className="billing-benefits">{(isFree ? freeBenefits : isPro ? proBenefits : [plan.description]).filter(Boolean).map(benefit => <li key={benefit}><Check size={17} aria-hidden="true" /><span>{benefit}</span></li>)}</ul>
    {isFree ? <div className="billing-free-footer"><p>Start with the essentials. Add AI coaching whenever you're ready.</p><button className="secondary-button" disabled={updating || !current || !sub || !!sub.cancel_at_period_end} onClick={() => onChoose("free")}>{sub?.cancel_at_period_end ? "Free scheduled" : !sub ? "Current plan" : "Switch to Free at renewal"}</button></div> : <div className="billing-price-options">{plan.prices?.map(price => {
      const savings = price.interval === "year" && monthly?.amount && price.amount != null && price.currency === monthly.currency
        ? Math.floor((1 - price.amount / (monthly.amount * 12)) * 100) : 0;
      return <div className="billing-price" key={price.id}>
        <div className="billing-price-heading"><span>{price.interval === "year" ? "Yearly" : price.interval === "month" ? "Monthly" : price.interval}</span>{savings > 0 && <span className="billing-savings">Save {savings}%</span>}</div>
        <div className="billing-plan-cost"><strong>{money(price.amount, price.currency)}</strong><span> / {price.interval}</span></div>
        <p className="billing-price-note">{price.interval === "year" ? "Billed once a year" : price.interval === "month" ? "Billed monthly" : `Billed every ${price.interval}`}</p>
        {price.providers?.map(provider => <button className="primary-button" key={`${provider.provider}:${provider.environment}`} disabled={updating || !current || (sub?.price_id === price.id && !sub?.cancel_at_period_end && !sub?.pending_price_id) || sub?.pending_price_id === price.id || (!!sub && (sub.provider !== provider.provider || sub.environment !== provider.environment))} onClick={() => onChoose(price.id!, provider.provider, provider.environment)}>
          <span>{sub?.pending_price_id === price.id ? "Scheduled" : sub?.price_id === price.id && !sub?.cancel_at_period_end && !sub?.pending_price_id ? "Current plan" : `${sub ? "Select at renewal" : "Select Pro"}${provider.provider === "fake" ? " (simulated)" : ` via ${provider.provider}`}`}</span><ArrowUpRight size={16} aria-hidden="true" />
        </button>)}
        {!price.providers?.length && <p>Plan selection is currently unavailable.</p>}
      </div>;
    })}</div>}
  </section>;
}

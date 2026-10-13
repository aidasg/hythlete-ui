import { useAuth } from "@/features/auth/context/useAuth";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  getPortfolio,
  type CapabilityResponse,
} from "@/features/progress/services/progressApi";
import {
  formatCode,
  formatConfidence,
  formatMetric,
} from "@/features/progress/services/progressDisplay";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";
import { throwApiResponseError } from "@/services/api/errors";
import { queryKeys } from "@/services/query/queryKeys";

const roleSections = [
  { role: "push", title: "Push now", description: "Current development priorities." },
  { role: "maintain", title: "Maintain", description: "Minimum exposures worth preserving." },
  { role: "protect", title: "Protect", description: "Qualities currently limited by readiness." },
  { role: "other", title: "Other tracked qualities", description: "Observed without a current obligation." },
] as const;

function CapabilityCard({ capability }: { capability: CapabilityResponse }) {
  return (
    <article className="capability-card" data-role={capability.role}>
      <div className="capability-heading">
        <div><span>{formatCode(capability.scope_id || capability.scope_type)}</span><h3>{capability.name || formatCode(capability.code)}</h3></div>
        <span className="confidence-chip">{formatConfidence(capability.confidence)}</span>
      </div>
      <div className="capability-status-row">
        <span data-trend={capability.trend}>{formatCode(capability.trend)}</span>
        <span data-readiness={capability.readiness}>{formatCode(capability.readiness)}</span>
      </div>
      <dl className="capability-dates">
        <div><dt>Last exposure</dt><dd>{capability.last_exposure ? formatDisplayDate(capability.last_exposure) : "No evidence yet"}</dd></div>
        {capability.maintenance_due_date && <div><dt>Maintenance due</dt><dd>{formatDisplayDate(capability.maintenance_due_date)}</dd></div>}
      </dl>
      {Boolean(capability.evidence?.length) && (
        <div className="capability-evidence">
          {capability.evidence?.slice(0, 3).map((item, index) => (
            <div key={`${item.metric}-${item.date}-${index}`}><span>{formatCode(item.metric)}</span><strong>{formatMetric(item.value, item.unit)}</strong><small>{formatDisplayDate(item.date)} · {formatCode(item.source)}</small></div>
          ))}
        </div>
      )}
      {Boolean(capability.reasons?.length) && <p>{capability.reasons?.join(" ")}</p>}
    </article>
  );
}

export function PortfolioView({ date }: { date: string }) {
  const { session } = useAuth();
  const uid = session?.profile?.user_id;
  const query = useQuery({
    queryKey: [...queryKeys.progress.portfolio(date), uid],
    enabled: !!uid,
    queryFn: async () => {
      const result = await getPortfolio(date);
      if (result.error) throwApiResponseError(result, "Could not load your training overview.");
      return result.data;
    },
  });

  if (query.isLoading) return <div className="progress-loading" role="status"><Loader2 className="spin-icon" />Loading overview</div>;
  if (query.error) return <div className="inline-state inline-state-error" role="alert"><AlertCircle size={18} />{query.error.message}</div>;

  const capabilities = query.data?.capabilities || [];

  return (
    <div className="portfolio-view">
      <div className="progress-summary-line"><span>As of {formatDisplayDate(query.data?.as_of)}</span><span>{formatConfidence(query.data?.confidence)} confidence</span></div>
      {query.data?.reasons?.map((reason) => <p className="progress-context" key={reason}>{reason}</p>)}
      {roleSections.map((section) => {
        const items = capabilities.filter((item) => section.role === "other" ? !["push", "maintain", "protect"].includes(item.role || "") : item.role === section.role);
        return (
          <section className="portfolio-section" key={section.role} aria-labelledby={`portfolio-${section.role}`}>
            <div><h2 id={`portfolio-${section.role}`}>{section.title}</h2><p>{section.description}</p></div>
            {items.length ? <div className="capability-grid">{items.map((item, index) => <CapabilityCard key={`${item.code}-${item.scope_id}-${index}`} capability={item} />)}</div> : <p className="empty-copy">No capabilities in this role.</p>}
          </section>
        );
      })}
    </div>
  );
}

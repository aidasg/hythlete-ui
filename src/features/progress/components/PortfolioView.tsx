import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import {
  getPortfolio,
  type CapabilityResponse,
} from "@/features/progress/services/progressApi";
import { formatCode, formatConfidence } from "@/features/progress/services/progressDisplay";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";
import { paths } from "@/routes/paths";
import { throwApiResponseError } from "@/services/api/errors";
import { queryKeys } from "@/services/query/queryKeys";
import { PortfolioCapabilityRow } from "./PortfolioCapabilityRow";

const priorities = [
  { role: "protect", title: "Protect", description: "Areas currently limited by readiness." },
  { role: "push", title: "Build", description: "Current development priorities." },
  { role: "maintain", title: "Maintain", description: "Qualities to keep training." },
] as const;

const strengthTrends = [
  { code: "improving", label: "Improving" },
  { code: "stable", label: "Stable" },
  { code: "declining", label: "Declining" },
  { code: "insufficient_data", label: "Awaiting more evidence" },
] as const;

const inventoryGroups = [
  { scope: "movement_pattern", title: "Strength", link: { view: "strength", label: "View strength curves" } },
  { scope: "sport", title: "Sport & endurance" },
  { scope: "tissue", title: "Joints & tendons", link: { view: "body", label: "View weekly load in Body" } },
  { scope: "benchmark_variant", title: "Benchmarks", link: { view: "benchmarks", label: "View benchmark definitions" } },
  { scope: "goal", title: "Goals awaiting evidence" },
  { scope: "other", title: "Other" },
] as const;

function CapabilityRows({ items }: { items: CapabilityResponse[] }) {
  return <ul className="portfolio-rows">
    {items.map((capability, index) => (
      <li key={`${capability.scope_type}-${capability.scope_id}-${capability.code}-${index}`}><PortfolioCapabilityRow capability={capability} /></li>
    ))}
  </ul>;
}

function PriorityGroup({ group, items }: { group: typeof priorities[number]; items: CapabilityResponse[] }) {
  const [showAll, setShowAll] = useState(false);
  const rowsId = useId();
  return (
    <section className="portfolio-priority" data-role={group.role} aria-labelledby={`${rowsId}-heading`}>
      <header>
        <h3 id={`${rowsId}-heading`}>{group.title}</h3>
        <span className="portfolio-count" aria-label={`${items.length} priorities`}>{items.length}</span>
        <p>{group.description}</p>
      </header>
      <div id={rowsId}><CapabilityRows items={showAll ? items : items.slice(0, 3)} /></div>
      {items.length > 3 && <button type="button" className="portfolio-text-button" aria-expanded={showAll} aria-controls={rowsId}
        onClick={() => setShowAll(!showAll)}>{showAll ? "Show fewer" : `Show all ${items.length}`}</button>}
    </section>
  );
}

function StrengthTrends({ capabilities }: { capabilities: CapabilityResponse[] }) {
  const patterns = new Map<string, string | undefined>();
  for (const item of capabilities) {
    if (item.code === "max_strength" && item.scope_type === "movement_pattern" && item.scope_id && !patterns.has(item.scope_id)) {
      patterns.set(item.scope_id, item.trend);
    }
  }
  const counts = { improving: 0, stable: 0, declining: 0, insufficient_data: 0 };
  for (const trend of patterns.values()) {
    if (trend === "improving" || trend === "stable" || trend === "declining") counts[trend]++;
    else counts.insufficient_data++;
  }

  return (
    <section className="portfolio-section" aria-labelledby="portfolio-strength-trends">
      <h2 id="portfolio-strength-trends">Strength trends</h2>
      {patterns.size > 0 ? (
        <div className="portfolio-trends">
          <p>{patterns.size} strength movement {patterns.size === 1 ? "pattern" : "patterns"}</p>
          <div className="portfolio-trend-bar" aria-hidden="true">
            {strengthTrends.filter(({ code }) => counts[code] > 0).map(({ code }) => (
              <span key={code} data-trend={code} style={{ flexGrow: counts[code] }} />
            ))}
          </div>
          <ul className="portfolio-trend-legend" aria-label="Movement patterns by trend">
            {strengthTrends.map(({ code, label }) => (
              <li key={code} data-trend={code}><strong>{counts[code]}</strong> {label}</li>
            ))}
          </ul>
        </div>
      ) : <p className="empty-copy">Strength trends appear when you have logged loaded work sets.</p>}
    </section>
  );
}

function SportEvidence({ items }: { items: CapabilityResponse[] }) {
  const bySport = new Map<string, CapabilityResponse[]>();
  for (const item of items) {
    const sport = item.scope_id || "";
    const group = bySport.get(sport) ?? [];
    group.push(item);
    bySport.set(sport, group);
  }
  return [...bySport].sort(([a], [b]) => a.localeCompare(b)).map(([sport, capabilities]) => (
    <div className="portfolio-sport-group" key={sport}>
      <h3>{sport ? formatCode(sport) : "Activity unspecified"}</h3>
      <CapabilityRows items={capabilities} />
    </div>
  ));
}

function EvidenceInventory({ capabilities }: { capabilities: CapabilityResponse[] }) {
  const groups = new Map<string, CapabilityResponse[]>(inventoryGroups.map(({ scope }) => [scope, []]));
  const other = groups.get("other")!;
  for (const item of capabilities) (groups.get(item.scope_type ?? "") ?? other).push(item);

  return (
    <section className="portfolio-section" aria-labelledby="portfolio-evidence">
      <h2 id="portfolio-evidence">Explore the evidence</h2>
      {capabilities.length > 0 ? (
        <div className="portfolio-inventory">
          {inventoryGroups.map((group) => {
            const items = groups.get(group.scope)!;
            if (!items.length) return null;
            return <details className="portfolio-inventory-group" key={group.scope}>
              <summary>
                <strong>{group.title}</strong>
                <span className="portfolio-count">{items.length}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </summary>
              {"link" in group && <Link className="portfolio-inventory-link" to={`${paths.progress}?view=${group.link.view}`}>{group.link.label}</Link>}
              {group.scope === "sport" ? <SportEvidence items={items} /> : <CapabilityRows items={items} />}
            </details>;
          })}
        </div>
      ) : <p className="empty-copy">Your training evidence will appear here as you log workouts.</p>}
    </section>
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

  const capabilities = query.data?.capabilities ?? [];
  const priorityGroups = priorities.map(group => ({ group, items: capabilities.filter(item => item.role === group.role) }))
    .filter(({ items }) => items.length > 0);
  const snapshotDate = query.data?.as_of || date;

  return (
    <div className="portfolio-view">
      <div className="progress-summary-line"><span>As of <time dateTime={snapshotDate}>{formatDisplayDate(snapshotDate)}</time></span></div>
      <section className="portfolio-section" aria-labelledby="portfolio-priorities">
        <h2 id="portfolio-priorities">Training priorities</h2>
        {priorityGroups.length ? (
          <div className="portfolio-priorities">
            {priorityGroups.map(({ group, items }) => <PriorityGroup key={group.role} group={group} items={items} />)}
          </div>
        ) : <p className="empty-copy">No current training priorities.</p>}
      </section>
      <StrengthTrends capabilities={capabilities} />
      <EvidenceInventory capabilities={capabilities} />
      <details className="portfolio-about">
        <summary>About this overview</summary>
        {capabilities.length > 0 && query.data?.confidence !== undefined && <p><strong>{formatConfidence(query.data.confidence)}</strong> average evidence confidence</p>}
        <p>Evidence confidence describes how strongly the data supports each estimate. The overview averages confidence across the tracked qualities in this snapshot.</p>
      </details>
    </div>
  );
}

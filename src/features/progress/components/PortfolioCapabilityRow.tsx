import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import type { CapabilityResponse } from "../services/progressApi";
import { formatCode, formatConfidence, formatMetric } from "../services/progressDisplay";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";
import { paths } from "@/routes/paths";

const pageSize = 5;

const metricLabels: Record<string, string> = {
  estimated_1rm_kg: "Estimated one-rep max",
  avg_speed_mps: "Average speed",
  avg_power_watts: "Average power",
  avg_heart_rate_bpm: "Average heart rate",
  elapsed_seconds: "Elapsed time",
  fade_percent: "Fade",
  chronic_load: "Weighted long-term load (model input)",
};

const unitLabels: Record<string, string> = {
  bpm: "bpm",
  load_points: "load points",
  meters: "m",
  mps: "m/s",
  seconds: "s",
  time_seconds: "s",
  watts: "W",
};

const sourceLabels: Record<string, string> = {
  fit_lap: "FIT lap",
  fit_record: "FIT record",
  load_state: "Training load model",
  epley_rir_adjusted: "Epley estimate adjusted for reps in reserve",
};

function formatEvidenceValue(value?: number, unit?: string) {
  if (unit === "percent" && typeof value === "number") return `${formatMetric(value)}%`;
  return formatMetric(value, unit && (unitLabels[unit] ?? unit.replace(/_/g, " ")));
}

function CapabilityEvidence({ capability }: { capability: CapabilityResponse }) {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const evidence = [...(capability.evidence ?? [])].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  const remaining = evidence.length - visibleCount;
  const trend = capability.trend === "insufficient_data" ? "Awaiting more evidence" : formatCode(capability.trend);
  return (
    <div className="portfolio-row-detail">
      <dl className="portfolio-row-meta">
        {capability.confidence !== undefined && <div><dt>Evidence confidence</dt><dd>{formatConfidence(capability.confidence)}</dd></div>}
        {capability.last_exposure && <div><dt>Last exposure</dt><dd>{formatDisplayDate(capability.last_exposure)}</dd></div>}
        {capability.trend && <div><dt>{capability.scope_type === "tissue" ? "Load model trend" : "Trend"}</dt><dd>{trend}</dd></div>}
      </dl>
      {evidence.length > 0 ? (
        <ol className="portfolio-observations" aria-label="Evidence, newest first">
          {evidence.slice(0, visibleCount).map((item, index) => (
            <li key={index}>
              <span>{metricLabels[item.metric ?? ""] ?? formatCode(item.metric)}</span>
              <strong>{formatEvidenceValue(item.value, item.unit)}</strong>
              {(item.date || item.source) && <small>
                {item.date && <time dateTime={item.date}>{formatDisplayDate(item.date)}</time>}
                {item.date && item.source && " · "}
                {item.source && (sourceLabels[item.source] ?? formatCode(item.source))}
              </small>}
            </li>
          ))}
        </ol>
      ) : <p className="empty-copy">No observations available yet.</p>}
      {evidence.length > pageSize && <button type="button" className="portfolio-text-button"
        onClick={() => setVisibleCount(remaining > 0 ? visibleCount + pageSize : pageSize)}>
        {remaining > 0 ? `Show ${Math.min(pageSize, remaining)} older observations` : "Show fewer observations"}
      </button>}
      {!!capability.reasons?.length && <ul className="portfolio-evidence-notes" aria-label="Evidence notes">
        {capability.reasons.map((reason, index) => <li key={index}>{reason}</li>)}
      </ul>}
      {capability.scope_type === "tissue" && <Link to={`${paths.progress}?view=body`}>Compare weekly load in Body</Link>}
    </div>
  );
}

export function PortfolioCapabilityRow({ capability }: { capability: CapabilityResponse }) {
  const [visited, setVisited] = useState(false);
  const name = capability.name || formatCode(capability.code);
  const scope = capability.scope_type === "benchmark_variant" || !capability.scope_id ? "" : formatCode(capability.scope_id);
  const isMovement = capability.scope_type === "movement_pattern" && !!scope;
  const title = isMovement ? scope : name;
  const subtitle = isMovement ? name : scope;

  return (
    <details className="portfolio-capability-row" onToggle={(event) => { if (event.currentTarget.open) setVisited(true); }}>
      <summary>
        <span className="portfolio-row-name">
          <strong>{title}</strong>
          {subtitle && subtitle.toLowerCase() !== title.toLowerCase() && <small>{subtitle}</small>}
        </span>
        <span className="portfolio-row-status">
          {capability.readiness && <span className="portfolio-readiness" data-readiness={capability.readiness}>{formatCode(capability.readiness)}</span>}
          {capability.maintenance_due_date && <small>Due {formatDisplayDate(capability.maintenance_due_date)}</small>}
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </summary>
      {visited && <CapabilityEvidence capability={capability} />}
    </details>
  );
}

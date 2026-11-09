import type { RefObject } from "react";
import { AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { ActivityIdentity } from "./ActivityIdentity";
import type { FitBatchOutcome, WorkoutCatalogResponse, WorkoutResponse } from "../services/workoutApi";

type Props = {
  results: FitBatchOutcome[];
  activities?: WorkoutCatalogResponse["activities"];
  busy: boolean;
  headingRef: RefObject<HTMLHeadingElement>;
  onOpen: (workout: WorkoutResponse) => void;
  onRetry: () => void;
  onImportMore: () => void;
};

function outcomeLabel(item: FitBatchOutcome) {
  if (item.status === "duplicate") return "Duplicate";
  if (item.status === "failed") return "Failed";
  return item.activity?.matched_existing ? "Matched to planned workout" : "Imported";
}

export function WorkoutFitImportReview({ results, activities, busy, headingRef, onOpen, onRetry, onImportMore }: Props) {
  const imported = results.filter(item => item.status === "imported").length;
  const duplicates = results.filter(item => item.status === "duplicate").length;
  const failed = results.filter(item => item.status === "failed").length;

  return <div className="fit-import-review">
    <header className="fit-import-review-heading">
      <h3 ref={headingRef} tabIndex={-1}>Review uploaded activities</h3>
      <p role="status">{imported} imported, {duplicates} {duplicates === 1 ? "duplicate" : "duplicates"}, {failed} failed. Imported activities are saved.</p>
    </header>
    <ul className="fit-import-list">
      {results.map(item => {
        const activity = item.activity;
        const StatusIcon = item.status === "failed" ? AlertCircle : item.status === "duplicate" ? Copy : CheckCircle2;
        return <li className="fit-import-review-item" data-status={item.status} key={`${item.reference.source_index}:${item.reference.entry_index}`}>
          <div className="fit-import-review-content">
            <strong>{activity?.title || item.filename}</strong>
            {activity && <span className="fit-import-filename">{item.filename}</span>}
            {activity && <div className="fit-import-summary">
              <ActivityIdentity sport={activity.sport} activities={activities} />
              <span>{activity.date}</span>
              <span>{activity.duration_minutes} min</span>
            </div>}
            <span className="fit-import-status"><StatusIcon size={14} aria-hidden="true" />{outcomeLabel(item)}</span>
            {item.error && <p className="fit-import-review-error">{item.error}</p>}
          </div>
          {activity && <button className="secondary-button" type="button" disabled={busy} onClick={() => onOpen(activity)}>
            Open activity
          </button>}
        </li>;
      })}
    </ul>
    <footer className="fit-import-review-actions">
      {failed > 0 && <button type="button" className="primary-button" disabled={busy} onClick={onRetry}>
        {busy ? "Importing..." : "Retry failed activities"}
      </button>}
      <button type="button" className="secondary-button" disabled={busy} onClick={onImportMore}>Import more activities</button>
    </footer>
  </div>;
}

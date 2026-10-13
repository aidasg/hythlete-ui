import { useState } from "react";
import type { BaselineDraft, BaselineMetric, Sport } from "@/features/profile/services/profileModel";
import { baselineMetrics } from "@/features/profile/services/profileModel";

type BaselineEditorProps = {
  sport: Sport;
  baseline: BaselineDraft | undefined;
  onChange: (metric: BaselineMetric, value: string) => void;
  onClear: () => void;
};

export function BaselineEditor({ sport, baseline, onChange, onClear }: BaselineEditorProps) {
  const [shownMetrics, setShownMetrics] = useState<BaselineMetric[]>(() =>
    baselineMetrics.filter((metric) => Boolean(baseline?.[metric.key])).map((metric) => metric.key)
  );
  const visible = baselineMetrics.filter((metric) => Boolean(baseline?.[metric.key]) || shownMetrics.includes(metric.key));
  const remaining = baselineMetrics.filter((metric) => !visible.includes(metric));

  return (
    <div className="baseline-editor">
      <div className="profile-editor-heading">
        <div>
          <span className="eyebrow">Fitness baseline</span>
          <h3>{sport.name}</h3>
        </div>
        {baseline && visible.length > 0 && (
          <button type="button" className="text-button" onClick={() => { setShownMetrics([]); onClear(); }}>Clear baseline</button>
        )}
      </div>
      <p>Performance markers help calibrate this activity. Add only the measurements you know.</p>
      {visible.length ? (
        <div className="baseline-fields">
          {visible.map((metric) => (
            <label key={metric.key}>
              <span>{metric.label} <small>{metric.unit}</small></span>
              <input type="number" inputMode="decimal" min={metric.min} max={metric.max} step={metric.step}
                value={baseline?.[metric.key] || ""}
                onChange={(event) => onChange(metric.key, event.target.value)} />
            </label>
          ))}
        </div>
      ) : <p className="profile-empty-note">No baseline recorded yet.</p>}
      {remaining.length > 0 && (
        <label className="baseline-add-field">
          Add a metric
          <select value="" onChange={(event) => {
            const metric = event.target.value as BaselineMetric;
            if (metric) setShownMetrics((current) => [...current, metric]);
          }}>
            <option value="">Choose a metric</option>
            {remaining.map((metric) => <option value={metric.key} key={metric.key}>{metric.label}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

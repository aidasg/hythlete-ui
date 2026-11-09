import { useState } from "react";
import type { BaselineDraft, BaselineMetric, Sport, InheritedHeartRates } from "@/features/profile/services/profileModel";
import { baselineMetrics, heartRateMetrics, sportCode } from "@/features/profile/services/profileModel";

type BaselineEditorProps = {
  sport: Sport;
  inherited?: InheritedHeartRates;
  baseline: BaselineDraft | undefined;
  onChange: (metric: BaselineMetric, value: string) => void;
  onClear: () => void;
};

export function BaselineEditor({ sport, baseline, inherited = {}, onChange, onClear }: BaselineEditorProps) {
  const isDefault = sportCode(sport) === "default";
  const metrics = isDefault ? heartRateMetrics : baselineMetrics;
  const [shownMetrics, setShownMetrics] = useState<BaselineMetric[]>(() =>
    metrics.filter((metric) => Boolean(baseline?.[metric.key])).map((metric) => metric.key)
  );
  const visible = metrics.filter((metric) => Boolean(baseline?.[metric.key]) || Boolean(inherited[metric.key]) || shownMetrics.includes(metric.key));
  const remaining = metrics.filter((metric) => !visible.includes(metric));

  return (
    <div className="baseline-editor">
      <div className="profile-editor-heading">
        <div>
          <span className="eyebrow">Fitness baseline</span>
          <h3>{sport.name}</h3>
        </div>
        {baseline && metrics.some((metric) => Boolean(baseline[metric.key])) && (
          <button type="button" className="text-button" onClick={() => { setShownMetrics([]); onClear(); }}>Clear baseline</button>
        )}
      </div>
      <p>{isDefault ? "Shared heart rate values apply when an activity has no value of its own." : "Performance markers help calibrate this activity. Add only the measurements you know."}</p>
      {visible.length ? (
        <div className="baseline-fields">
          {visible.map((metric) => (
            <label key={metric.key}>
              <span>{metric.label} <small>{metric.unit}</small></span>
              <input type="number" inputMode="decimal" min={metric.min} max={metric.max} step={metric.step}
                placeholder={inherited[metric.key]?.value}
                value={baseline?.[metric.key] || ""}
                onChange={(event) => onChange(metric.key, event.target.value)} />
              {!baseline?.[metric.key] && inherited[metric.key] && <small>Inherited from {inherited[metric.key]?.source}: {inherited[metric.key]?.value} {metric.unit}</small>}
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

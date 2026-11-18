import { SpeedField } from '@/components/units/UnitFields';
import { speedPolicy, speedText, formatSpeed } from '@/services/units';
import { getApiErrorMessage } from "@/services/api/errors";
import { useEffect, useState } from "react";
import { previewZones, type ZonePreview } from "../services/profileApi";
import { matchingBaseline, setZoneBounds, sportCode, toProfileRequest, validateBaseline, type ProfileDraft, type Sport } from "../services/profileModel";
import { zoneSpeedLimit, validateZoneRanges, zoneMetrics, zoneNames } from "../services/zoneModel";

type Props = { sport: Sport; sports: Sport[]; draft: ProfileDraft; onChange: (draft: ProfileDraft) => void };
export function ZoneReview({ sport, sports, draft, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<ZonePreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewKey, setPreviewKey] = useState("");
  const [retry, setRetry] = useState(0);
  const code = sportCode(sport);
  const local = matchingBaseline(draft, sport)?.zoneRanges;
  const validationError = validateBaseline(draft, sports);
  const payload = JSON.stringify(toProfileRequest(draft).endurance_baselines);
  const requestKey = `${code}:${payload}`;
  const ready = previewKey === requestKey;

  useEffect(() => {
    if (!open || validationError) return;
    let active = true;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      previewZones(code, JSON.parse(payload), controller.signal).then((result) => {
        if (!active) return;
        if (result.error) { setError(result.error.error || "Could not review zones."); setPreview([]); }
        else { setPreview(result.data.zones || []); setPreviewKey(requestKey); }
      }).catch((requestError) => {
        if (active) { setError(getApiErrorMessage(requestError)); setPreview([]); }
      }).finally(() => { if (active) setLoading(false); });
    }, 200);
    return () => { active = false; controller.abort(); window.clearTimeout(timer); };
  }, [open, code, payload, validationError, requestKey, retry]);

  const metrics = code === "default" ? zoneMetrics.slice(0, 1) : zoneMetrics;
  return <details className="zone-review" onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Review zones</summary>
    {open && <div className="zone-review-content">
      <p>Review your zone ranges, or customize fixed boundaries for this activity. Saved changes apply to existing imports when you reanalyse them.</p>
      {validationError && <p className="form-message form-message-error" role="alert">{validationError}</p>}
      {error && <p role="alert">{error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry</button></p>}
      {(loading || (!ready && !validationError && !error)) && <p role="status">Updating zone preview...</p>}
      {metrics.map((metric) => {
        const definition = ready ? preview.find((item) => item.metric === metric.key) : undefined;
        const custom = local?.[metric.key];
        const bounds = custom?.map(Number) || definition?.upper_bounds;
        const precision = custom || definition?.custom ? 6 : definition?.boundary_precision ?? (metric.key === "speed" ? 2 : 0);
        const source = sports.find((item) => item.code === definition?.source_sport)?.name ||
          (definition?.source_sport === "default" ? "Default baseline" : definition?.source_sport);
        const localError = validateZoneRanges(custom ? { [metric.key]: custom } : undefined, code, zoneSpeedLimit(code, sports), draft.distanceUnit, sports);
        const policy = speedPolicy(code, draft.distanceUnit, sports);
        const pace = metric.key === 'speed' && policy.pace;
        const label = pace ? 'Pace' : metric.label;
        const unit = metric.key === 'speed' ? policy.unit : metric.unit;
        const boundary = (v: number | undefined) => metric.key === 'speed' ? speedText(v, code, draft.distanceUnit, sports) : formatBoundary(v, precision);
        const range = (index: number) => !bounds ? '' : index === 4 ? `${pace ? 'Faster than' : 'Above'} ${boundary(bounds[3])}` : `${index ? `${pace ? 'Faster than' : 'Above'} ${boundary(bounds[index - 1])}, ` : ''}${pace ? 'at least' : 'up to'} ${boundary(bounds[index])}`;
        return <section key={metric.key} className="zone-metric" aria-label={`${label} zones`}>
          <h4>{label} zones <small>{unit}</small></h4>
          <p>{custom ? "Custom fixed ranges for this activity" : definition?.available ?
            `${definition.custom ? "Inherited custom ranges" : "Calculated ranges"}${source ? ` from ${source}` : ""}` : "No calibrated ranges available. Add a baseline or customize ranges."}</p>
          {!custom && definition?.available && definition.model_name && <p>
            Model: {definition.model_source_url ? <a href={definition.model_source_url} target="_blank" rel="noopener noreferrer">{definition.model_name}</a> : definition.model_name}
          </p>}
          {!custom && definition?.available && definition.model_note && <p>{definition.model_note}</p>}
          {!custom && definition?.available && !definition.custom && <p>
            {metric.key === "speed" ? `Displayed in ${unit}; saved boundaries retain their original precision.` : `Calculated boundaries rounded to whole ${unit}.`}
          </p>}
          {!custom && definition?.available && !definition.custom && definition.reference_value && <p>
            Reference: {metric.key === 'speed' ? formatSpeed(definition.reference_value, code, draft.distanceUnit, sports) : `${definition.reference_value} ${unit}`} ({definition.reference_metric?.replace(/_/g, " ")})
          </p>}
          {(custom || definition?.available) && <table>
            <caption className="sr-only">{label} zone ranges</caption>
            <thead><tr><th>Zone</th><th>Range ({unit})</th></tr></thead>
            <tbody>{zoneNames.map((name, index) => <tr key={name}>
              <th scope="row">{name}</th>
              <td>{custom && index < 4 ? metric.key === 'speed' ? <><span>{pace ? 'Fastest pace in this zone' : 'Upper speed boundary'}</span><SpeedField label={`${label} ${name} boundary`} sport={code} activities={sports} distanceUnit={draft.distanceUnit} max={zoneSpeedLimit(code, sports)} value={custom[index] ? Number(custom[index]) : undefined} onChange={v => onChange(setZoneBounds(draft, sport, metric.key, custom.map((value, i) => i === index ? v === undefined ? '' : String(v) : value)))} /></> : <label>
                <span>{index ? `Above ${custom[index - 1] || "previous boundary"}, up to` : "Up to"}</span>
                <input type="number" step="any" min="0" aria-label={`${metric.label} ${name} upper boundary`}
                  value={custom[index]} onChange={(event) => onChange(setZoneBounds(draft, sport, metric.key,
                    custom.map((value, i) => i === index ? event.target.value : value)))} />
              </label> : range(index)}</td>
            </tr>)}</tbody>
          </table>}
          {localError && <p className="form-message form-message-error">{localError}</p>}
          {custom ? <button type="button" className="text-button" onClick={() => onChange(setZoneBounds(draft, sport, metric.key, undefined))}>
            Reset to inherited/calculated ranges
          </button> : <button type="button" className="secondary-button" disabled={!ready || loading || Boolean(validationError)}
            onClick={() => onChange(setZoneBounds(draft, sport, metric.key,
              definition?.available ? definition.upper_bounds!.map(String) : ["", "", "", ""]))}>Customize ranges</button>}
        </section>;
      })}
    </div>}
  </details>;
}
function formatBoundary(value: number | undefined, precision: number) { return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(precision)).toString() : "-"; }

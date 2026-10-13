import { useState } from "react";
import { MuscleBreakdownFigure, type BodyOverlay } from "./MuscleBreakdownFigure";
import { detailedMusclePaths } from "./muscleBreakdownData";
import { impactColor, impactLabel, loadBandDescriptions, loadBandLabels, loadBandOrder, tissueMarkers, type BodyLayer, type BodyRegion } from "./bodyPresentation";

type Props = { mode: "recent-load" | "session-impact"; regions: BodyRegion[] };
export function BodyVisualization({ mode, regions }: Props) {
  const [layer, setLayer] = useState<BodyLayer>("muscle");
  const [selection, setSelection] = useState<Record<BodyLayer, string>>({ muscle: "", tissue: "" });
  const shown = regions.filter(r => r.layer === layer);
  const selected = shown.find(r => r.id === selection[layer]) || shown[0];
  const max = Math.max(0, ...shown.map(r => r.value || 0));
  const status = (r: BodyRegion) => mode === "recent-load" ? loadBandLabels[r.band] : impactLabel(r.value, max);
  const color = (r: BodyRegion) => mode === "recent-load" ? `var(--state-${r.band})` : impactColor(r.value, max);
  const colors: Record<string, string> = {};
  const strokes: Record<string, string> = {};
  const labels: Record<string, string> = {};
  const paths = new Map<string, BodyRegion>();
  detailedMusclePaths.forEach(p => { colors[p.key] = "var(--state-unknown)"; });
  if (layer === "muscle") shown.forEach(r => r.pathKeys.forEach(key => {
    if (paths.has(key)) return;
    paths.set(key, r); colors[key] = color(r); labels[key] = `${r.name}: ${status(r)}${r.reports.length ? "; recent report" : ""}`;
    if (r.reports.length) strokes[key] = "#edb56a";
  }));
  const overlays: BodyOverlay[] = layer === "tissue" ? shown.flatMap((r, index) => tissueMarkers[r.id] ? [{ ...tissueMarkers[r.id]!, id: r.id, number: index + 1, name: r.name, label: status(r), color: color(r), reported: r.reports.length > 0 }] : []) : [];
  const select = (id: string) => setSelection(previous => ({ ...previous, [layer]: id }));
  return <div className="body-visualization" data-mode={mode}>
    <div className="body-layer-switch" role="group" aria-label="Body layers">
      <button type="button" aria-pressed={layer === "muscle"} onClick={() => setLayer("muscle")}>Muscles</button>
      <button type="button" aria-pressed={layer === "tissue"} onClick={() => setLayer("tissue")}>Joints &amp; tendons</button>
    </div>
    <div className="body-visual-legend" aria-label={mode === "recent-load" ? "Recent load legend" : "Session emphasis legend"}>
      {mode === "recent-load" ? loadBandOrder.map(band => <span key={band}><i style={{ background: `var(--state-${band})` }} />{loadBandLabels[band]}</span>) : <><span><i style={{ background: "#5b628b" }} />Less work</span><span className="body-emphasis-ramp" aria-hidden="true" /><span><i style={{ background: "#60dcf5" }} />More work</span></>}
    </div>
    <p className="body-context">{mode === "recent-load" ? "Estimated from your recent training compared with your usual load." : "Colours show emphasis within this session, separately for each layer. More work does not mean more fatigue or injury risk."}</p>
    {layer === "tissue" && <p className="body-context">Numbered markers match the list and show approximate joint and tendon regions.</p>}
    {regions.some(r => r.reports.length) && <p className="body-context">Outlined muscles and ! markers have a recent report. Select an area to see its date and severity.</p>}
    <div className="body-visual-layout">
      <div><MuscleBreakdownFigure muscleColors={colors} muscleStrokeColors={strokes} pathLabels={labels} selectedMuscles={selected?.pathKeys}
        onMuscleSelect={key => { const r = paths.get(key); if (r) select(r.id); }} interactiveMuscles={layer === "muscle"}
        overlays={overlays} selectedOverlay={selected?.id} onOverlaySelect={select} />
        <p className="body-context">Training data is not separated by left and right side.</p></div>
      <div className="body-region-content">
        {selected && <section className="body-region-summary" aria-label="Selected area">
          <h3>{selected.name}</h3>{mode === "recent-load" && <p>{loadBandDescriptions[selected.band]}</p>}<p className="body-region-status"><i style={{ background: color(selected) }} />{status(selected)}</p>
          {selected.reports.length > 0 && <div className="body-reports"><strong>Recent reports</strong>{selected.reports.map((r, i) => <p key={i}>{r.kind} · {r.date} · Severity {r.severity}/100</p>)}</div>}
          <details><summary>Details</summary><p>{selected.anatomy}</p>{selected.metrics.map((m, i) => <p key={i}>{m.label}: {m.value}</p>)}{[...new Set(selected.reasons)].map(reason => <p key={reason}>{reason}</p>)}</details>
        </section>}
        <ul key={layer} className="body-region-list" aria-label={layer === "muscle" ? "Muscle regions" : "Joint and tendon regions"}>
          {shown.map((r, index) => <li key={r.id}><button type="button" aria-pressed={selected?.id === r.id} onClick={() => select(r.id)}>
            {layer === "tissue" ? <span className="body-marker-number" style={{ background: color(r) }} aria-hidden="true">{index + 1}</span> : <i style={{ background: color(r) }} />}<span><strong>{r.name}</strong><small>{status(r)}{r.reports.length ? " · Recent report" : ""}{!(layer === "muscle" ? r.pathKeys.length : tissueMarkers[r.id]) ? " · Listed only" : ""}</small></span>
          </button></li>)}
        </ul>
        {!shown.length && <p>No {layer === "muscle" ? "muscle" : "joint or tendon"} impact data is available yet.</p>}
      </div>
    </div>
  </div>;
}

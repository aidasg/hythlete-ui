import type { BodyWeeklyLoad } from "./bodyPresentation";

const pointFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const percentFormat = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });

function WeeklyLoadRow({ label, value, fraction }: { label: string; value?: number; fraction?: number }) {
  const points = value === undefined ? "Unavailable" : `${value > 0 && value < .01 ? `<${pointFormat.format(.01)}` : pointFormat.format(value)} pts/week`;
  return <div className="body-load-row">
    <div className="body-load-label"><span>{label}</span><strong>{points}</strong></div>
    {fraction !== undefined && <div className="body-load-track" aria-hidden="true">
      <span style={{ width: `${Math.min(fraction, 2) * 50}%` }} />
    </div>}
  </div>;
}

function LoadComparison({ load }: { load: BodyWeeklyLoad }) {
  const { shortTerm, longTerm } = load;
  const ratio = shortTerm !== undefined && longTerm !== undefined && longTerm > 0 ? shortTerm / longTerm : undefined;
  const percent = ratio === undefined ? undefined : ratio > 0 && ratio < .001 ? `<${percentFormat.format(.001)}` : percentFormat.format(ratio);
  return <li className="body-load-comparison">
    <div className="body-load-heading">
      <h4>{load.type}</h4>
      <span>{percent === undefined ? "Comparison unavailable" : <><strong>{percent}</strong> of baseline</>}</span>
    </div>
    <WeeklyLoadRow label="Short-term load" value={shortTerm} fraction={ratio} />
    <WeeklyLoadRow label="Long-term baseline" value={longTerm} fraction={ratio === undefined ? undefined : 1} />
    {ratio !== undefined && <div className="body-load-scale" aria-hidden="true"><span>0%</span><span>100%</span><span>200%+</span></div>}
  </li>;
}

export function BodyLoadComparison({ loads }: { loads: BodyWeeklyLoad[] }) {
  if (!loads.length) return <p>No training load is available for this area.</p>;

  return <>
    <p className="body-context">Both scores are estimated load points per week. Short-term load gives more weight to recent workouts. The long-term baseline reflects a longer stretch of training.</p>
    <ul className="body-load-comparisons" aria-label="Weekly load by training type">
      {loads.map(load => <LoadComparison key={load.type} load={load} />)}
    </ul>
    <p className="body-context">100% means the short-term load matches the baseline for that type. Compare points within the same load type. The map's load band also considers how much work was done, including the last two days.</p>
  </>;
}

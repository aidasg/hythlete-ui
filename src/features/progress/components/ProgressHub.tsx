import { useMemo } from "react";
import { Activity, BarChart3, Dumbbell, Gauge, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { BenchmarksView } from "@/features/progress/components/BenchmarksView";
import { BreakthroughsView } from "@/features/progress/components/BreakthroughsView";
import { MuscleStimulusView } from "@/features/progress/components/MuscleStimulusView";
import { PortfolioView } from "@/features/progress/components/PortfolioView";
import { StrengthProgressView } from "@/features/progress/components/StrengthProgressView";
import { getTodayKey } from "@/features/workouts/services/workoutDates";

const views = [
  { key: "portfolio", label: "Portfolio", icon: Gauge },
  { key: "muscle", label: "Muscle stimulus", icon: Activity },
  { key: "strength", label: "Strength", icon: Dumbbell },
  { key: "breakthroughs", label: "Breakthroughs", icon: Sparkles },
  { key: "benchmarks", label: "Benchmarks", icon: BarChart3 },
] as const;

type ProgressViewKey = (typeof views)[number]["key"];

function isProgressView(value: string | null): value is ProgressViewKey {
  return views.some((item) => item.key === value);
}

export function ProgressHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedView = isProgressView(searchParams.get("view"))
    ? searchParams.get("view") as ProgressViewKey
    : "portfolio";
  const date = useMemo(() => getTodayKey(), []);

  function selectView(view: ProgressViewKey) {
    const next = new URLSearchParams(searchParams);
    next.set("view", view);
    setSearchParams(next, { replace: true });
  }

  return (
    <section className="progress-page" aria-labelledby="progress-page-title">
      <div className="today-page-heading">
        <div><span className="eyebrow">Training evidence</span><h1 id="progress-page-title">Progress</h1><p>See what to push, maintain, and protect without flattening it into one score.</p></div>
      </div>
      <div className="progress-tabs" role="tablist" aria-label="Progress views">
        {views.map((item) => { const Icon = item.icon; return <button type="button" role="tab" key={item.key} aria-selected={selectedView === item.key} onClick={() => selectView(item.key)}><Icon size={16} aria-hidden="true" />{item.label}</button>; })}
      </div>
      <div className="progress-view-panel" role="tabpanel">
        {selectedView === "portfolio" && <PortfolioView date={date} />}
        {selectedView === "muscle" && <MuscleStimulusView date={date} />}
        {selectedView === "strength" && <StrengthProgressView />}
        {selectedView === "breakthroughs" && <BreakthroughsView />}
        {selectedView === "benchmarks" && <BenchmarksView />}
      </div>
    </section>
  );
}

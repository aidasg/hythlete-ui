import { Activity, BarChart3, Dumbbell, Gauge, Sparkles } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { BenchmarksView } from "@/features/progress/components/BenchmarksView";
import { BreakthroughsView } from "@/features/progress/components/BreakthroughsView";
import { MuscleStimulusView } from "@/features/progress/components/MuscleStimulusView";
import { PortfolioView } from "@/features/progress/components/PortfolioView";
import { StrengthProgressView } from "@/features/progress/components/StrengthProgressView";
import { useAuth } from "@/features/auth/context/useAuth";
import { useTodayDate } from "@/features/strategy/hooks/useTodayDate";
import { BodyProgressView } from "./BodyProgressView";

const views = [
  { key: "body", label: "Body", icon: Activity },
  { key: "portfolio", label: "Overview", icon: Gauge },
  { key: "muscle", label: "Muscle training", icon: Activity },
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
    : "body";
  const { session } = useAuth();
  const date = useTodayDate(session?.profile?.timezone);

  function selectView(view: ProgressViewKey) {
    const next = new URLSearchParams(searchParams);
    next.set("view", view);
    setSearchParams(next, { replace: true });
  }

  return (
    <section className="progress-page" aria-labelledby="progress-page-title">
      <div className="today-page-heading">
        <div><span className="eyebrow">Your training</span><h1 id="progress-page-title">Progress</h1><p>See how your training adds up and which areas you have worked.</p></div>
      </div>
      <div className="progress-tabs" role="tablist" aria-label="Progress views">
        {views.map((item) => { const Icon = item.icon; return <button type="button" role="tab" key={item.key} aria-selected={selectedView === item.key} tabIndex={selectedView === item.key ? 0 : -1} onKeyDown={event => {
          const index = views.findIndex(view => view.key === item.key);
          const next = event.key === "ArrowRight" ? (index + 1) % views.length : event.key === "ArrowLeft" ? (index + views.length - 1) % views.length : event.key === "Home" ? 0 : event.key === "End" ? views.length - 1 : null;
          if (next === null) return;
          event.preventDefault();
          selectView(views[next]!.key);
          (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next])?.focus();
        }} onClick={() => selectView(item.key)}><Icon size={16} aria-hidden="true" />{item.label}</button>; })}
      </div>
      <div className="progress-view-panel" role="tabpanel" aria-label={views.find(v => v.key === selectedView)?.label} key={`${session?.profile?.user_id}:${date}`}>
        {selectedView === "body" && <BodyProgressView date={date} />}
        {selectedView === "portfolio" && <PortfolioView date={date} />}
        {selectedView === "muscle" && <MuscleStimulusView date={date} />}
        {selectedView === "strength" && <StrengthProgressView />}
        {selectedView === "breakthroughs" && <BreakthroughsView />}
        {selectedView === "benchmarks" && <BenchmarksView />}
      </div>
    </section>
  );
}

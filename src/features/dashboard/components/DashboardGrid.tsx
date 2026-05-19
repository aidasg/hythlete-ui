import { Activity, CalendarDays, Timer } from "lucide-react";
import { MuscleBreakdownCard } from "@/features/dashboard/components/MuscleBreakdownCard";

const dashboardStats = [
  {
    icon: Activity,
    label: "Training load",
    value: "Balanced",
    meta: "7 day trend",
  },
  {
    icon: Timer,
    label: "Weekly budget",
    value: "6.5h",
    meta: "Planned capacity",
  },
  {
    icon: CalendarDays,
    label: "Next focus",
    value: "Lower body",
    meta: "Recovery adjusted",
  },
];

export function DashboardGrid() {
  return (
    <section className="dashboard-content" aria-label="Dashboard overview">
      <div className="dashboard-grid">
        <MuscleBreakdownCard />

        {dashboardStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <section key={stat.label} className="dashboard-card dashboard-stat-card">
              <div className="dashboard-stat-icon">
                <Icon size={18} aria-hidden="true" />
              </div>
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.meta}</small>
            </section>
          );
        })}
      </div>
    </section>
  );
}

import { CoachPanel } from "@/features/coach/components/CoachPanel";
import { useAuth } from "@/features/auth/context/useAuth";
import { FocusBlockManager } from "@/features/strategy/components/FocusBlockManager";
import { useTodayDate } from "@/features/strategy/hooks/useTodayDate";
import { useDailyStrategy } from "@/features/strategy/hooks/useDailyStrategy";
import { getStrategyConstraints } from "@/features/strategy/services/strategyConstraints";
import { label } from "@/features/workouts/services/sessionStructure";
export function PlanView() {
  const { session } = useAuth(); const date = useTodayDate(session?.profile?.timezone);
  const daily = useDailyStrategy(date, getStrategyConstraints(date, session?.profile), !!session?.profile, session?.profile?.user_id);
  return <section className="dashboard-content"><h1>Your plan</h1><FocusBlockManager date={date} /><h2>Next seven days</h2>
    {daily.error && <p role="alert">{daily.error.message}</p>}
    <div className="strategy-week-slots">{daily.data?.week?.slots?.map(s => <article key={s.date}><strong>{s.date}</strong><p>{label(s.status)}</p><p>{label(s.capability_code)}</p></article>)}</div>
    {daily.data?.week?.unmet_obligations?.map((s, i) => <p key={i}>{s}</p>)}
  <CoachPanel date={date} /></section>;
}

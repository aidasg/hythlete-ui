import { CoachTrigger } from "@/features/coach/components/CoachTrigger";
import { useCoachPageContext } from "@/features/coach/context/coachContext";
import { useAuth } from "@/features/auth/context/useAuth";
import { FocusBlockManager } from "@/features/strategy/components/FocusBlockManager";
import { useTodayDate } from "@/features/strategy/hooks/useTodayDate";
import { useDailyStrategy } from "@/features/strategy/hooks/useDailyStrategy";
import { getStrategyConstraints } from "@/features/strategy/services/strategyConstraints";
import { label } from "@/features/workouts/services/sessionStructure";
export function PlanView() {
  const { session } = useAuth(); const date = useTodayDate(session?.profile?.timezone);
  const daily = useDailyStrategy(date, getStrategyConstraints(date, session?.profile), !!session?.profile, session?.profile?.user_id);
  useCoachPageContext({surface:"plan",date,constraints:getStrategyConstraints(date,session?.profile)});
  return <section className="dashboard-content"><h1>Your plan</h1><CoachTrigger label="Plan my training with Coach" description="Build a proposal around your goals and weekly schedule." intent={{action:"plan_training",target:{surface:"plan",date,constraints:getStrategyConstraints(date,session?.profile)}}} /><FocusBlockManager date={date} /><h2>Next seven days</h2>
    {daily.error && <p role="alert">{daily.error.message}</p>}
    <div className="strategy-week-slots">{daily.data?.week?.slots?.map(s => <article key={s.date}><strong>{s.date}</strong><p>{label(s.status)}</p><p>{label(s.capability_code)}</p></article>)}</div>
    {daily.data?.week?.unmet_obligations?.map((s, i) => <p key={i}>{s}</p>)}
</section>;
}

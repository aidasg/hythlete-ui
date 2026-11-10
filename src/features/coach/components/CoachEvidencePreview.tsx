import { throwApiResponseError } from "@/services/api/errors";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { getWorkout, getWorkoutReadiness } from "@/features/workouts/services/workoutApi";
import { getProfile } from "@/features/profile/services/profileApi";
import { SessionBlocks } from "@/features/workouts/components/SessionBlocks";
import { WorkoutTimeline } from "@/features/workouts/components/WorkoutTimeline";
import { useCoach } from "@/features/coach/context/coachContext";
import { paths } from "@/routes/paths";
import { sourceLabel, type CoachSource } from "../services/coachSources";
import type { RefObject } from "react";

const formatCode = (value: string | undefined) => value?.replace(/_/g, " ");

export function CoachEvidencePreview({ source, onBack, backRef }: {
  source: CoachSource;
  onBack: () => void;
  backRef: RefObject<HTMLButtonElement>;
}) {
  return <section className="coach-source" aria-label="Coaching source">
    <button ref={backRef} type="button" className="coach-quiet-button" onClick={onBack}>
      <ArrowLeft size={16} aria-hidden="true" /> Back to conversation
    </button>
    {source.kind === "workout" && <WorkoutSource id={source.workoutID} />}
    {source.kind === "readiness" && <ReadinessSource date={source.date} />}
    {source.kind === "profile" && <ProfileSource citedDate={source.date} />}
    {source.kind === "context" && <ContextSource source={source} />}
  </section>;
}

const contextDestinations: Record<string, { path: string; label: string }> = {
  get_training_progress: { path: paths.progress, label: "Open Progress" },
  get_training_strategy: { path: paths.plan, label: "Open Plan" },
  list_workouts: { path: paths.workouts, label: "Open Calendar" },
};

function ContextSource({ source }: { source: Extract<CoachSource, { kind: "context" }> }) {
  const coach = useCoach();
  const destination = contextDestinations[source.tool];
  return <>
    <header><span className="eyebrow">{source.date}</span><h3>{sourceLabel(source.reference)}</h3>
      <p>Source details from this reply are unavailable.</p>
    </header>
    {destination && <Link className="coach-quiet-button" to={destination.path} onClick={() => coach?.closeCoach()}>
      {destination.label} <ArrowUpRight size={15} aria-hidden="true" />
    </Link>}
  </>;
}

function SourceState({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => void }) {
  if (loading) return <p role="status">Loading source…</p>;
  if (!error) return null;
  return <div role="alert" className="coach-source-error">
    <p>{error.message || "This source could not be loaded."}</p>
    <button type="button" className="coach-quiet-button" onClick={retry}>Retry</button>
  </div>;
}

function WorkoutSource({ id }: { id: number }) {
  const coach = useCoach();
  const workout = useQuery({
    queryKey: ["coach", coach?.userID, "evidence", "workout", id],
    queryFn: async () => {
      const result = await getWorkout(id);
      if (result.error || !result.data) throwApiResponseError(result);
      return result.data;
    },
    retry: false,
  });
  return <>
    <SourceState loading={workout.isLoading} error={workout.error} retry={() => void workout.refetch()} />
    {workout.data && <>
      <header><span className="eyebrow">Workout #{id}</span><h3>{workout.data.title || "Workout"}</h3>
        <p>{[workout.data.date, workout.data.duration_minutes && `${workout.data.duration_minutes} min`, workout.data.completed ? "Completed" : "Planned"].filter(Boolean).join(" · ")}</p>
      </header>
      <SessionBlocks blocks={workout.data.blocks || []} />
      <WorkoutTimeline workout={workout.data} />
      <Link className="coach-quiet-button" to={`${paths.workouts}?workout=${id}`} onClick={() => coach?.closeCoach()}>
        Open in Calendar <ArrowUpRight size={15} aria-hidden="true" />
      </Link>
    </>}
  </>;
}

function ReadinessSource({ date }: { date: string }) {
  const coach = useCoach();
  const readiness = useQuery({
    queryKey: ["coach", coach?.userID, "evidence", "readiness", date],
    queryFn: async () => {
      const result = await getWorkoutReadiness(date);
      if (result.error || !result.data) throwApiResponseError(result);
      return result.data;
    },
    retry: false,
  });
  const data = readiness.data;
  return <>
    <header><span className="eyebrow">{date}</span><h3>Training readiness</h3>
      <p>Estimate for the cited date, calculated from saved training data.</p>
    </header>
    <SourceState loading={readiness.isLoading} error={readiness.error} retry={() => void readiness.refetch()} />
    {data && <>
      {data.recommendation && <section><h4>Recommendation</h4><p className="coach-source-status">{formatCode(data.recommendation)}</p></section>}
      {!!data.reasons?.length && <ul>{data.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
      <section><h4>Training options</h4>
        {data.training_options?.length ? <ul className="coach-source-list">{data.training_options.map((option, index) => <li key={option.key || index}>
          <strong>{[formatCode(option.sport), formatCode(option.focus)].filter(Boolean).join(" · ") || "Training option"}</strong>
          {option.recommendation && <span className="coach-source-status">{formatCode(option.recommendation)}</span>}
        </li>)}</ul> : <p>No training options recorded.</p>}
      </section>
      <section><h4>Limiters</h4>
        {data.limiters?.length ? <ul className="coach-source-list">{data.limiters.map((limiter, index) => <li key={index}>
          <strong>{limiter.name || formatCode(limiter.entity_id) || "Training limiter"}</strong>
          {limiter.label && <span className="coach-source-status">{formatCode(limiter.label)}</span>}
          {limiter.reason && <small>{limiter.reason}</small>}
        </li>)}</ul> : <p>No limiters recorded.</p>}
      </section>
    </>}
  </>;
}

function ProfileSource({ citedDate }: { citedDate: string }) {
  const coach = useCoach();
  const profile = useQuery({
    queryKey: ["coach", coach?.userID, "evidence", "profile"],
    queryFn: async () => {
      const result = await getProfile();
      if (result.error || !result.data) throwApiResponseError(result);
      return result.data;
    },
    retry: false,
    staleTime: 0,
  });
  const data = profile.data;
  const goals = data?.goal_priorities?.flatMap(item => item.goal?.name ? [[item.goal.name, item.sport?.name].filter(Boolean).join(" · ")] : []);
  return <>
    <header><span className="eyebrow">Current profile</span><h3>Athlete context</h3>
      <p>Cited on {citedDate}. Values below reflect your current saved profile.</p>
    </header>
    <SourceState loading={profile.isLoading} error={profile.error} retry={() => void profile.refetch()} />
    {data && <>
      <section><h4>Goals</h4><p>{goals?.join(", ") || "No goals saved."}</p></section>
      <section><h4>Training preferences</h4>
        <p>{data.preferred_sports?.map(sport => sport.name || formatCode(sport.code)).filter(Boolean).join(", ") || "No preferred activities saved."}</p>
        <p>{[data.weekly_time_budget_hours && `${data.weekly_time_budget_hours} hours / week`, data.preferred_training_days?.join(", "), data.timezone].filter(Boolean).join(" · ")}</p>
      </section>
      <section><h4>Endurance calibration</h4>
        {data.endurance_baselines?.length ? <ul className="coach-source-list">{data.endurance_baselines.map((baseline, index) => <li key={index}>
          <strong>{baseline.sport === "default" ? "Shared baseline" : formatCode(baseline.sport) || "Baseline"}</strong>
          <small>{[
            baseline.threshold_hr_bpm && `Threshold ${baseline.threshold_hr_bpm} bpm`,
            baseline.max_hr_bpm && `Max ${baseline.max_hr_bpm} bpm`,
            baseline.resting_hr_bpm && `Resting ${baseline.resting_hr_bpm} bpm`,
            baseline.ftp_watts && `FTP ${baseline.ftp_watts} W`,
            baseline.threshold_speed_mps && `Threshold ${baseline.threshold_speed_mps} m/s`,
          ].filter(Boolean).join(" · ") || "No baseline metrics saved."}</small>
        </li>)}</ul> : <p>No endurance baselines saved.</p>}
      </section>
    </>}
    <Link className="coach-quiet-button" to={paths.profile} onClick={() => coach?.closeCoach()}>
      Open Profile <ArrowUpRight size={15} aria-hidden="true" />
    </Link>
  </>;
}

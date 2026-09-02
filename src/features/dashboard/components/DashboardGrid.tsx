import { useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock3,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { GlobalTrainingLoadCard } from "@/features/dashboard/components/GlobalTrainingLoadCard";
import { MuscleBreakdownCard } from "@/features/dashboard/components/MuscleBreakdownCard";
import { useTodayOverview } from "@/features/dashboard/hooks/useTodayOverview";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import { WorkoutRecommendationPreview } from "@/features/workouts/components/WorkoutRecommendationPreview";
import {
  getWorkoutCatalog,
  prescribeWorkouts,
  type TrainingOptionResponse,
  type WorkoutCatalogResponse,
  type WorkoutPrescriptionResponse,
  type WorkoutResponse,
} from "@/features/workouts/services/workoutApi";
import {
  formatReadinessLabel,
  getLimiterTitle,
  getRecommendationCopy,
  getTopLimiters,
} from "@/features/workouts/services/readinessDisplay";
import { formatDisplayDate } from "@/features/workouts/services/workoutDates";
import { paths } from "@/routes/paths";

function getTrainingOptionKey(option: TrainingOptionResponse) {
  return option.key || [option.focus, option.sport].filter(Boolean).join(":");
}

function getWorkoutTitle(workout: WorkoutResponse) {
  return workout.title || workout.subtype || workout.category || "Planned workout";
}

function getWorkoutMeta(workout: WorkoutResponse) {
  return [
    formatReadinessLabel(workout.sport),
    typeof workout.duration_minutes === "number"
      ? `${Math.round(workout.duration_minutes)} min`
      : null,
    workout.completed ? "Completed" : workout.planned ? "Planned" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function DashboardGrid() {
  const { session } = useAuth();
  const overview = useTodayOverview();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedOption, setSelectedOption] =
    useState<TrainingOptionResponse | null>(null);
  const [prescription, setPrescription] =
    useState<WorkoutPrescriptionResponse | null>(null);
  const [catalog, setCatalog] = useState<WorkoutCatalogResponse | null>(null);
  const [selectedDraftIndex, setSelectedDraftIndex] = useState(0);
  const [isLoadingPrescription, setIsLoadingPrescription] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const topLimiters = getTopLimiters(overview.readiness?.limiters, 3);
  const weeklyBudget = session?.profile?.weekly_time_budget_hours;

  async function requestRecommendation(option: TrainingOptionResponse) {
    setSelectedOption(option);
    setPrescription(null);
    setPrescriptionError(null);
    setSelectedDraftIndex(0);
    setIsPreviewOpen(true);
    setIsLoadingPrescription(true);

    try {
      const [prescriptionResult, catalogResult] = await Promise.all([
        prescribeWorkouts({
          date: overview.today,
          option_key: getTrainingOptionKey(option) || undefined,
          focus: option.focus,
          sport: option.sport,
          category: option.category,
          max_duration_minutes: 45,
          count: 1,
        }),
        catalog ? Promise.resolve(null) : getWorkoutCatalog(),
      ]);

      if (catalogResult && !catalogResult.error) {
        setCatalog(catalogResult.data);
      }

      if (prescriptionResult.error) {
        setPrescriptionError("Could not build this workout. Try again.");
        return;
      }

      setPrescription(prescriptionResult.data);
    } catch {
      setPrescriptionError("Could not reach the workout service. Try again.");
    } finally {
      setIsLoadingPrescription(false);
    }
  }

  function handleWorkoutCreated(workout: WorkoutResponse) {
    setIsPreviewOpen(false);
    setSuccessMessage(`${getWorkoutTitle(workout)} was added to today.`);
    void overview.refresh();
  }

  const recommendationTitle = overview.topTrainingOption
    ? formatReadinessLabel(overview.topTrainingOption.focus) ||
      overview.topTrainingOption.category ||
      "Recommended training"
    : null;

  return (
    <section className="dashboard-content" aria-labelledby="today-page-title">
      <div className="today-page-heading">
        <div>
          <span className="eyebrow">{formatDisplayDate(overview.today)}</span>
          <h1 id="today-page-title">Today</h1>
          <p>One clear training decision, grounded in your recent load and goals.</p>
        </div>
        {overview.isRefreshing && !overview.isLoading && (
          <span className="refresh-status" role="status">
            <Loader2 className="spin-icon" size={16} aria-hidden="true" />
            Updating
          </span>
        )}
      </div>

      {successMessage && (
        <div className="toast-message" role="status">
          <Sparkles size={17} aria-hidden="true" />
          {successMessage}
          <button type="button" onClick={() => setSuccessMessage(null)}>
            Dismiss
          </button>
        </div>
      )}

      {overview.errorMessage && (
        <div className="inline-state inline-state-error" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <span>{overview.errorMessage}</span>
          <button type="button" onClick={() => void overview.refresh()}>
            <RefreshCw size={15} aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {overview.isLoading ? (
        <div className="today-layout" aria-label="Loading today's training">
          <span className="skeleton today-decision-card" />
          <span className="skeleton today-support-card" />
          <span className="skeleton today-support-card" />
        </div>
      ) : (
        <div className="today-layout">
          <section className="today-decision-card">
            <div className="today-decision-copy">
              <div className="today-status-line">
                <span className="status-dot" aria-hidden="true" />
                {getRecommendationCopy(overview.readiness?.recommendation)}
              </div>

              {overview.todayWorkout ? (
                <>
                  <span className="eyebrow">Your plan</span>
                  <h2>{getWorkoutTitle(overview.todayWorkout)}</h2>
                  <p>
                    {getWorkoutMeta(overview.todayWorkout) ||
                      "Your session is ready in the calendar."}
                  </p>
                </>
              ) : overview.topTrainingOption ? (
                <>
                  <span className="eyebrow">Best fit today</span>
                  <h2>{recommendationTitle}</h2>
                  <p>
                    {overview.topTrainingOption.reasons?.[0] ||
                      overview.readiness?.reasons?.[0] ||
                      "Selected to balance progress with your current readiness."}
                  </p>
                </>
              ) : (
                <>
                  <span className="eyebrow">Plan your session</span>
                  <h2>No recommendation yet</h2>
                  <p>Add a workout manually or update your profile and readiness inputs.</p>
                </>
              )}

              <div className="today-decision-meta">
                <span>
                  <Clock3 size={16} aria-hidden="true" />
                  {overview.todayWorkout?.duration_minutes
                    ? `${Math.round(overview.todayWorkout.duration_minutes)} min`
                    : "Up to 45 min"}
                </span>
                {typeof weeklyBudget === "number" && (
                  <span>{weeklyBudget}h weekly budget</span>
                )}
              </div>
            </div>

            <div className="today-decision-actions">
              {overview.todayWorkout ? (
                <Link className="primary-button" to={paths.workouts}>
                  View workout
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              ) : overview.topTrainingOption ? (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void requestRecommendation(overview.topTrainingOption!)}
                >
                  Preview workout
                  <ChevronRight size={17} aria-hidden="true" />
                </button>
              ) : (
                <Link className="primary-button" to={paths.workouts}>
                  Plan manually
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              )}
              <span>Review before anything is saved.</span>
            </div>
          </section>

          <section className="today-support-card" aria-labelledby="limiters-title">
            <div className="support-card-heading">
              <div>
                <span className="eyebrow">Readiness</span>
                <h2 id="limiters-title">What to respect</h2>
              </div>
              <span>{topLimiters.length}</span>
            </div>
            <div className="compact-list">
              {topLimiters.map((limiter, index) => (
                <div key={`${limiter.entity_type}-${limiter.entity_id}-${index}`}>
                  <AlertCircle size={16} aria-hidden="true" />
                  <div>
                    <strong>{getLimiterTitle(limiter)}</strong>
                    <span>{limiter.reason || formatReadinessLabel(limiter.label)}</span>
                  </div>
                </div>
              ))}
              {!topLimiters.length && (
                <p className="empty-copy">No notable limiters were returned for today.</p>
              )}
            </div>
          </section>

          <section className="today-support-card" aria-labelledby="upcoming-title">
            <div className="support-card-heading">
              <div>
                <span className="eyebrow">Next up</span>
                <h2 id="upcoming-title">Coming sessions</h2>
              </div>
              <CalendarDays size={19} aria-hidden="true" />
            </div>
            <div className="compact-list">
              {overview.upcomingWorkouts.map((workout, index) => (
                <div key={workout.id || `${workout.date}-${index}`}>
                  <span className="compact-date">{formatDisplayDate(workout.date)}</span>
                  <div>
                    <strong>{getWorkoutTitle(workout)}</strong>
                    <span>{getWorkoutMeta(workout)}</span>
                  </div>
                </div>
              ))}
              {!overview.upcomingWorkouts.length && (
                <p className="empty-copy">Your next seven days are open.</p>
              )}
            </div>
            <Link className="text-link" to={paths.workouts}>
              Open calendar <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </section>
        </div>
      )}

      <details className="dashboard-analytics-disclosure">
        <summary>
          <div>
            <span className="eyebrow">Deeper analysis</span>
            <strong>Body and training load</strong>
            <small>Explore detailed regional and acute/chronic load data.</small>
          </div>
          <ChevronRight size={20} aria-hidden="true" />
        </summary>
        <div className="dashboard-analytics-grid">
          <MuscleBreakdownCard />
          <GlobalTrainingLoadCard />
        </div>
      </details>

      {isPreviewOpen && selectedOption && (
        <WorkoutModal
          eyebrow="Today's recommendation"
          title="Review your workout"
          onClose={() => setIsPreviewOpen(false)}
        >
          <WorkoutRecommendationPreview
            option={selectedOption}
            date={overview.today}
            prescription={prescription}
            selectedDraftIndex={selectedDraftIndex}
            catalog={catalog}
            isLoading={isLoadingPrescription}
            errorMessage={prescriptionError}
            onDraftSelect={setSelectedDraftIndex}
            onRetry={() => void requestRecommendation(selectedOption)}
            onCreated={handleWorkoutCreated}
          />
        </WorkoutModal>
      )}
    </section>
  );
}

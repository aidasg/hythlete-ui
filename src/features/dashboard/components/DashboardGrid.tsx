import { useMemo, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  Clock3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/context/useAuth";
import { isProfileComplete } from "@/features/profile/services/profileModel";
import { MuscleBreakdownCard } from "@/features/dashboard/components/MuscleBreakdownCard";
import { BreakthroughOpportunityCard } from "@/features/progress/components/BreakthroughOpportunityCard";
import { FocusBlockManager } from "@/features/strategy/components/FocusBlockManager";
import { useDailyStrategy } from "@/features/strategy/hooks/useDailyStrategy";
import type {
  DailyStrategyResponse,
  RankedStrategyOption,
} from "@/features/strategy/services/strategyApi";
import {
  getProfileSportCodes,
  getStrategyConstraints,
  saveStrategyConstraints,
  type StrategyConstraints,
} from "@/features/strategy/services/strategyConstraints";
import { WorkoutModal } from "@/features/workouts/components/WorkoutModal";
import { WorkoutRecommendationPreview } from "@/features/workouts/components/WorkoutRecommendationPreview";
import {
  getWorkoutCatalog,
  prescribeWorkouts,
  type WorkoutCatalogResponse,
  type WorkoutPrescriptionResponse,
  type WorkoutResponse,
} from "@/features/workouts/services/workoutApi";
import {
  formatDisplayDate,
  getTodayKey,
} from "@/features/workouts/services/workoutDates";
import { getApiErrorMessage } from "@/services/api/errors";
import { paths } from "@/routes/paths";

function formatCode(value: string | undefined) {
  return value
    ? value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Not specified";
}

function getOptionKey(option: RankedStrategyOption) {
  return option.key || [option.focus, option.sport].filter(Boolean).join(":");
}

type StrategyBreakthrough = NonNullable<
  NonNullable<DailyStrategyResponse["today"]>["breakthrough"]
>;

function getBreakthroughOption(
  options: RankedStrategyOption[],
  breakthrough: NonNullable<StrategyBreakthrough>
) {
  return (
    options.find((option) => option.key === `benchmark:${breakthrough.scope_id}`) ||
    options.find((option) =>
      option.tradeoffs?.some(
        (tradeoff) =>
          tradeoff.effect === "advances" &&
          tradeoff.capability_code === breakthrough.capability_code &&
          (breakthrough.scope_type !== "sport" ||
            tradeoff.scope_id === breakthrough.scope_id)
      )
    ) ||
    options[0]
  );
}

function OptionCard({
  option,
  primary = false,
  onSelect,
}: {
  option: RankedStrategyOption;
  primary?: boolean;
  onSelect: (option: RankedStrategyOption) => void;
}) {
  return (
    <article
      className={primary ? "strategy-option-card is-primary" : "strategy-option-card"}
      data-recommendation={option.recommendation || "train"}
    >
      <div className="strategy-option-heading">
        <div>
          <span className="eyebrow">{primary ? "Best fit today" : "Alternative"}</span>
          <h2>{formatCode(option.focus || option.category)}</h2>
          <p>{formatCode(option.sport)}</p>
        </div>
        <span className="recommendation-score">
          {typeof option.score === "number" ? Math.round(option.score) : "—"}
        </span>
      </div>
      <span className="strategy-recommendation-chip">
        <ShieldCheck size={15} aria-hidden="true" />
        {formatCode(option.recommendation)}
      </span>
      <p className="strategy-option-reason">
        {option.reasons?.[0] || "The strategist selected this option for today's constraints."}
      </p>
      {Boolean(option.tradeoffs?.length) && (
        <div className="strategy-tradeoffs" aria-label="Training tradeoffs">
          {option.tradeoffs?.map((tradeoff, index) => (
            <span
              key={`${tradeoff.effect}-${tradeoff.capability_code}-${index}`}
              data-effect={tradeoff.effect}
              title={tradeoff.reason}
            >
              {formatCode(tradeoff.effect)} · {formatCode(tradeoff.capability_code)}
            </span>
          ))}
        </div>
      )}
      <button
        className={primary ? "primary-button" : "secondary-button"}
        type="button"
        onClick={() => onSelect(option)}
      >
        Create workout <ChevronRight size={17} aria-hidden="true" />
      </button>
    </article>
  );
}

export function DashboardGrid() {
  const { session } = useAuth();
  const today = useMemo(() => getTodayKey(), []);
  const profileSports = useMemo(
    () => getProfileSportCodes(session?.profile),
    [session?.profile]
  );
  const [appliedConstraints, setAppliedConstraints] = useState<StrategyConstraints>(
    () => getStrategyConstraints(today, session?.profile)
  );
  const [draftMinutes, setDraftMinutes] = useState(
    String(appliedConstraints.availableMinutes)
  );
  const [draftSports, setDraftSports] = useState(appliedConstraints.allowedSports);
  const strategy = useDailyStrategy(today, appliedConstraints, Boolean(session?.profile));
  const [selectedOption, setSelectedOption] = useState<RankedStrategyOption | null>(null);
  const [selectedBreakthroughId, setSelectedBreakthroughId] = useState<number | undefined>();
  const [prescription, setPrescription] = useState<WorkoutPrescriptionResponse | null>(null);
  const [catalog, setCatalog] = useState<WorkoutCatalogResponse | null>(null);
  const [selectedDraftIndex, setSelectedDraftIndex] = useState(0);
  const [isLoadingPrescription, setIsLoadingPrescription] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasOpenedMuscleOverview, setHasOpenedMuscleOverview] = useState(false);

  function applyConstraints() {
    const availableMinutes = Math.max(1, Number(draftMinutes) || 60);
    const next = { availableMinutes, allowedSports: draftSports };
    saveStrategyConstraints(today, next);
    setAppliedConstraints(next);
  }

  function toggleSport(sport: string) {
    setDraftSports((current) =>
      current.includes(sport)
        ? current.filter((item) => item !== sport)
        : [...current, sport]
    );
  }

  async function requestRecommendation(
    option: RankedStrategyOption,
    breakthroughId?: number
  ) {
    setSelectedOption(option);
    setSelectedBreakthroughId(breakthroughId);
    setPrescription(null);
    setPrescriptionError(null);
    setSelectedDraftIndex(0);
    setIsLoadingPrescription(true);

    try {
      const [prescriptionResult, catalogResult] = await Promise.all([
        prescribeWorkouts({
          date: today,
          option_key: getOptionKey(option) || undefined,
          focus: option.focus,
          sport: option.sport,
          category: option.category,
          max_duration_minutes: appliedConstraints.availableMinutes,
          count: 2,
          breakthrough_candidate_id: breakthroughId,
        }),
        catalog ? Promise.resolve(null) : getWorkoutCatalog(),
      ]);

      if (catalogResult && !catalogResult.error) {
        setCatalog(catalogResult.data);
      }
      if (prescriptionResult.error) {
        setPrescriptionError(
          getApiErrorMessage(prescriptionResult.error, "Could not build this workout.")
        );
        return;
      }

      setPrescription(prescriptionResult.data);
      const standardIndex = prescriptionResult.data.workouts?.findIndex(
        (draft) => draft.variant === "standard"
      );
      setSelectedDraftIndex(
        typeof standardIndex === "number" && standardIndex > 0 ? standardIndex : 0
      );
    } catch {
      setPrescriptionError("Could not reach the workout service.");
    } finally {
      setIsLoadingPrescription(false);
    }
  }

  function handleWorkoutCreated(workout: WorkoutResponse) {
    setSelectedOption(null);
    setSelectedBreakthroughId(undefined);
    setSuccessMessage(`${workout.title || "Workout"} was added to today.`);
    void strategy.refetch();
  }

  const daily = strategy.data;
  const primary = daily?.today?.primary;
  const alternatives = daily?.today?.alternatives || [];
  const breakthrough = daily?.today?.breakthrough;

  function createBreakthroughAttempt(item: NonNullable<typeof breakthrough>) {
    const option = getBreakthroughOption(
      [primary, ...alternatives].filter(Boolean) as RankedStrategyOption[],
      item
    );

    if (option && typeof item.id === "number") {
      void requestRecommendation(option, item.id);
    }
  }

  return (
    <section className="dashboard-content strategist-today" aria-labelledby="today-page-title">
      <div className="today-page-heading">
        <div>
          <span className="eyebrow">{formatDisplayDate(today)}</span>
          <h1 id="today-page-title">Today</h1>
          <p>What to push, what to maintain, and what to protect.</p>
        </div>
        {strategy.isFetching && !strategy.isLoading && (
          <span className="refresh-status" role="status">
            <Loader2 className="spin-icon" size={16} aria-hidden="true" /> Updating
          </span>
        )}
      </div>

      {!isProfileComplete(session?.profile) && (
        <div className="profile-setup-callout dashboard-setup-callout">
          <div>
            <strong>Make your training plan yours</strong>
            <p>Finish your profile to guide activity and goal recommendations. You can keep exploring first.</p>
          </div>
          <Link className="primary-button" to={paths.setup}>Continue setup</Link>
        </div>
      )}

      <section className="strategy-constraints" aria-label="Today's training constraints">
        <label>
          <Clock3 size={16} aria-hidden="true" /> Available minutes
          <input
            type="number"
            min="1"
            max="360"
            step="5"
            value={draftMinutes}
            onChange={(event) => setDraftMinutes(event.target.value)}
          />
        </label>
        <div className="strategy-sport-choices">
          <span>Allowed sports</span>
          {profileSports.map((sport) => (
            <label className="choice-pill" key={sport}>
              <input
                type="checkbox"
                checked={draftSports.includes(sport)}
                onChange={() => toggleSport(sport)}
              />
              {formatCode(sport)}
            </label>
          ))}
        </div>
        <button type="button" className="secondary-button" onClick={applyConstraints}>
          Apply
        </button>
      </section>

      {successMessage && (
        <div className="toast-message" role="status">
          <Sparkles size={17} aria-hidden="true" />
          {successMessage}
          <button type="button" onClick={() => setSuccessMessage(null)}>Dismiss</button>
        </div>
      )}

      <FocusBlockManager date={today} />

      {breakthrough && (
        <BreakthroughOpportunityCard
          breakthrough={breakthrough}
          onCreateAttempt={createBreakthroughAttempt}
        />
      )}
      {strategy.error && (
        <div className="inline-state inline-state-error" role="alert">
          <AlertCircle size={19} aria-hidden="true" />
          <span>{strategy.error.message}</span>
          <button type="button" onClick={() => void strategy.refetch()}>
            <RefreshCw size={15} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      {strategy.isLoading ? (
        <div className="strategy-option-grid">
          <span className="skeleton strategy-option-card is-primary" />
          <span className="skeleton strategy-option-card" />
        </div>
      ) : primary ? (
        <div className="strategy-option-grid">
          <OptionCard option={primary} primary onSelect={requestRecommendation} />
          <div className="strategy-alternatives">
            {alternatives.map((option, index) => (
              <OptionCard
                key={getOptionKey(option) || index}
                option={option}
                onSelect={requestRecommendation}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="inline-state">
          <AlertCircle size={19} aria-hidden="true" />
          <span>No eligible recommendation was returned for these constraints.</span>
        </div>
      )}

      {daily?.week && (
        <section className="strategy-week" aria-labelledby="strategy-week-title">
          <div className="support-card-heading">
            <div>
              <span className="eyebrow">Flexible guidance</span>
              <h2 id="strategy-week-title">Next seven days</h2>
            </div>
            <CalendarDays size={20} aria-hidden="true" />
          </div>
          <div className="strategy-week-slots">
            {daily.week.slots?.map((slot) => (
              <div key={slot.date} data-status={slot.status}>
                <span>{formatDisplayDate(slot.date)}</span>
                <strong>{formatCode(slot.status)}</strong>
                <small>{formatCode(slot.capability_code)}</small>
              </div>
            ))}
          </div>
          <div className="strategy-week-footer">
            <span>{daily.week.budget_minutes || 0} min weekly budget</span>
            <Link className="text-link" to={paths.workouts}>
              Open calendar <ChevronRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {Boolean(daily.week.allocations?.length) && (
            <div className="strategy-allocations">
              {daily.week.allocations?.map((allocation, index) => (
                <div key={`${allocation.capability_code}-${allocation.scope_id}-${index}`}>
                  <span>{formatCode(allocation.role)}</span>
                  <strong>{formatCode(allocation.capability_code)}</strong>
                  <small>
                    {allocation.remaining_sessions || 0} sessions · {allocation.remaining_minutes || 0} min remaining
                  </small>
                </div>
              ))}
            </div>
          )}
          {Boolean(daily.week.unmet_obligations?.length) && (
            <div className={daily.week.constrained ? "strategy-obligations is-constrained" : "strategy-obligations"}>
              <strong>{daily.week.constrained ? "Weekly budget is constrained" : "Remaining obligations"}</strong>
              {daily.week.unmet_obligations?.map((obligation) => <span key={obligation}>{obligation}</span>)}
            </div>
          )}
        </section>
      )}

      {Boolean(daily?.stimulus_highlights?.length) && (
        <section className="strategy-stimulus-highlights" aria-labelledby="stimulus-highlight-title">
          <div className="support-card-heading"><div><span className="eyebrow">Protect and maintain</span><h2 id="stimulus-highlight-title">Estimated stimulus warnings</h2></div><ShieldCheck size={20} /></div>
          <div>
            {daily?.stimulus_highlights?.map((highlight, index) => (
              <article key={`${highlight.group_name}-${highlight.status}-${index}`} data-status={highlight.status}>
                <strong>{highlight.group_name || highlight.region}</strong>
                <span>{formatCode(highlight.status)}</span>
                <small>Projected {highlight.projected_stimulus || 0} · target {highlight.target_low || 0}–{highlight.target_high || 0}</small>
                <p>{highlight.reasons?.[0]}</p>
              </article>
            ))}
          </div>
          <Link className="text-link" to={`${paths.progress}?view=muscle`}>View muscle balance <ChevronRight size={15} /></Link>
        </section>
      )}

      <details
        className="dashboard-analytics-disclosure"
        onToggle={(event) => {
          if (event.currentTarget.open) setHasOpenedMuscleOverview(true);
        }}
      >
        <summary>
          <div>
            <span className="eyebrow">Advanced</span>
            <strong>Muscle status overview</strong>
            <small>Explore your anatomical load, readiness, and calendar status.</small>
          </div>
          <ChevronRight size={20} aria-hidden="true" />
        </summary>
        {hasOpenedMuscleOverview && (
          <div className="dashboard-analytics-grid is-muscle-overview">
            <MuscleBreakdownCard />
          </div>
        )}
      </details>

      {selectedOption && (
        <WorkoutModal
          eyebrow="Today's recommendation"
          title="Review your workout"
          onClose={() => {
            setSelectedOption(null);
            setSelectedBreakthroughId(undefined);
          }}
        >
          <WorkoutRecommendationPreview
            option={selectedOption}
            date={today}
            prescription={prescription}
            selectedDraftIndex={selectedDraftIndex}
            catalog={catalog}
            isLoading={isLoadingPrescription}
            errorMessage={prescriptionError}
            onDraftSelect={setSelectedDraftIndex}
            onRetry={() =>
              void requestRecommendation(selectedOption, selectedBreakthroughId)
            }
            onCreated={handleWorkoutCreated}
          />
        </WorkoutModal>
      )}
    </section>
  );
}

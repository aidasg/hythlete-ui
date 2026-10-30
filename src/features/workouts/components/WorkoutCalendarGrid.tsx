import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, FileUp, MoreHorizontal, Plus, PanelRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarReadinessEntryResponse } from '../services/calendarReadinessApi';
import { clampMagnitude, formatCalendarReadinessValue, getCalendarReadinessBandLabel, getCalendarReadinessCssBand, isActiveCalendarReadinessEntry, sortCalendarReadinessEntries } from '../services/calendarReadiness';
import type { WorkoutResponse } from '../services/workoutApi';
import { formatMonthLabel, formatDisplayDate, getCalendarDays, getMonthKey, getTodayKey, shiftMonth } from '../services/workoutDates';
import { useCompactCalendar } from '../hooks/useCalendarLayout';
import { WorkoutCalendarCard } from './WorkoutCalendarCard';

type WorkoutCalendarGridProps = {
  monthKey: string; selectedDate: string; workouts: WorkoutResponse[];
  readinessEntriesByDate?: Record<string, CalendarReadinessEntryResponse[]>;
  isLoading: boolean;
  onDateSelect: (date: string) => void;
  onCreateWorkout: (date: string) => void;
  onCreateReadinessEntry: (date: string) => void;
  onImportFit: () => void;
  onMonthChange: (month: string) => void;
  onWorkoutSelect: (workout: WorkoutResponse) => void;
  deletingWorkoutId?: number | null;
  readinessOpen?: boolean;
  onReadinessToggle?: () => void;
};
const weekdayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function markerTitle(entry: CalendarReadinessEntryResponse) {
  return [formatCalendarReadinessValue(entry.kind), formatCalendarReadinessValue(entry.entity_id), getCalendarReadinessBandLabel(entry.magnitude), clampMagnitude(entry.magnitude)].filter(Boolean).join(' / ');
}
export function WorkoutCalendarGrid({ monthKey, selectedDate, workouts, readinessEntriesByDate = {}, isLoading, onDateSelect, onCreateWorkout, onCreateReadinessEntry, onImportFit, onMonthChange, onWorkoutSelect, deletingWorkoutId, readinessOpen = false, onReadinessToggle }: WorkoutCalendarGridProps) {
  const calendarRef = useRef<HTMLElement>(null);
  const compact = useCompactCalendar(calendarRef);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [scrollToToday, setScrollToToday] = useState(false);
  const days = useMemo(() => getCalendarDays(monthKey).filter(day => !compact || day.isCurrentMonth), [monthKey, compact]);
  const grouped = useMemo(() => {
    const result: Record<string, WorkoutResponse[]> = {};
    for (const workout of workouts) { if (workout.date) (result[workout.date] ||= []).push(workout); }
    return result;
  }, [workouts]);
  useEffect(() => {
    function outside(event: MouseEvent) { if (!(event.target instanceof Element) || !event.target.closest('[data-calendar-add-menu]')) setOpenMenu(null); }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape' && openMenu) { setOpenMenu(null); calendarRef.current?.querySelector<HTMLButtonElement>('[aria-expanded="true"][aria-haspopup="menu"]')?.focus(); } }
    document.addEventListener('click', outside); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('click', outside); document.removeEventListener('keydown', escape); };
  }, [openMenu]);
  useEffect(() => {
    if (!scrollToToday) return;
    if (compact) calendarRef.current?.querySelector(`[data-date="${getTodayKey()}"]`)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    setScrollToToday(false);
  }, [scrollToToday, compact, monthKey]);
  function changeMonth(month: string) {
    setOpenMenu(null); onMonthChange(month);
    const today = getTodayKey(); onDateSelect(getMonthKey(today) === getMonthKey(month) ? today : getMonthKey(month));
  }
  function menu(date: string, header = false) {
    const action = (callback: () => void) => { setOpenMenu(null); callback(); };
    return <div className="calendar-add-actions-menu" role="menu">
      {!header && <button type="button" role="menuitem" className="calendar-add-action" onClick={() => action(() => onCreateWorkout(date))}><Plus size={14}/>Workout</button>}
      <button type="button" role="menuitem" className="calendar-add-action" onClick={() => action(() => onCreateReadinessEntry(date))}><AlertTriangle size={14}/>Limiter / injury</button>
      {header && <button type="button" role="menuitem" className="calendar-add-action" onClick={() => action(onImportFit)}><FileUp size={14}/>Import FIT</button>}
    </div>;
  }
  return <section ref={calendarRef} className={`workout-calendar-panel calendar-responsive${compact ? ' is-agenda' : ''}`} aria-labelledby="workout-calendar-title">
    <div className="workout-calendar-header"><div><span className="eyebrow">Workout calendar</span><h1 id="workout-calendar-title">{formatMonthLabel(monthKey)}</h1></div>
      <div className="calendar-nav">
        <button type="button" className="calendar-add-button" onClick={() => onCreateWorkout(selectedDate)}><Plus size={17}/>Add workout</button>
        {onReadinessToggle && <button type="button" className="calendar-readiness-toggle" aria-expanded={readinessOpen} aria-controls={readinessOpen ? 'calendar-readiness-view' : undefined} onClick={onReadinessToggle}><PanelRight size={17}/>Readiness</button>}
        <div className="calendar-add-menu-wrap" data-calendar-add-menu><button type="button" className="icon-button" aria-label="More calendar actions" aria-haspopup="menu" aria-expanded={openMenu==='header'} onClick={() => setOpenMenu(openMenu==='header' ? null : 'header')}><MoreHorizontal size={18}/></button>{openMenu==='header' && menu(selectedDate,true)}</div>
        <div className="calendar-month-navigation"><button type="button" className="icon-button" aria-label="Previous month" onClick={() => changeMonth(shiftMonth(monthKey,-1))}><ChevronLeft size={18}/></button>
          <button type="button" className="calendar-today-button" onClick={() => { changeMonth(getMonthKey(getTodayKey())); setScrollToToday(true); }}><CalendarDays size={16}/>Today</button>
          <button type="button" className="icon-button" aria-label="Next month" onClick={() => changeMonth(shiftMonth(monthKey,1))}><ChevronRight size={18}/></button></div>
      </div>
    </div>
    {compact ? <p className="calendar-agenda-label">Month agenda</p> : <div className="calendar-weekdays" aria-hidden="true">{weekdayLabels.map(day => <span key={day}>{day}</span>)}</div>}
    <div className="calendar-grid" aria-busy={isLoading}>
      {days.map(day => {
        const daily = grouped[day.date] || [];
        const entries = sortCalendarReadinessEntries((readinessEntriesByDate[day.date] || []).filter(isActiveCalendarReadinessEntry));
        return <section key={day.date} data-date={day.date} aria-label={formatDisplayDate(day.date)} className={`calendar-day${day.isCurrentMonth ? '' : ' is-outside-month'}${day.date===selectedDate ? ' is-selected' : ''}${day.isToday ? ' is-today' : ''}${daily.length ? ' has-workouts' : ''}`}>
          <div className="calendar-day-top"><button type="button" className="calendar-day-button" aria-label={`Select ${formatDisplayDate(day.date)}`} aria-pressed={day.date===selectedDate} onClick={() => onDateSelect(day.date)}><span>{compact ? formatDisplayDate(day.date) : day.dayOfMonth}</span>{daily.length>0 && <small aria-label={`${daily.length} workouts`}>{daily.length}</small>}</button>
            <div className="calendar-add-menu-wrap" data-calendar-add-menu><button type="button" className="calendar-day-add-button" aria-label={`Add on ${day.date}`} aria-haspopup="menu" aria-expanded={openMenu===day.date} onClick={() => setOpenMenu(openMenu===day.date ? null : day.date)}><Plus size={15}/></button>{openMenu===day.date && menu(day.date)}</div>
          </div>
          {entries.length>0 && <button type="button" className="calendar-readiness-markers" aria-label={`${entries.length} readiness entries on ${day.date}`} onClick={() => onCreateReadinessEntry(day.date)}>{entries.slice(0,3).map((entry,i) => <span key={i} data-band={getCalendarReadinessCssBand(entry.magnitude)} title={markerTitle(entry)}>{formatCalendarReadinessValue(entry.kind)?.charAt(0) || 'R'}</span>)}{entries.length>3 && <small>+{entries.length-3}</small>}</button>}
          {daily.length>0 && <div className="calendar-day-workouts">{daily.map((workout,i) => <WorkoutCalendarCard key={workout.id ?? i} workout={workout} onSelect={onWorkoutSelect} disabled={!!workout.id && workout.id===deletingWorkoutId}/>)}</div>}
        </section>;
      })}
    </div>
  </section>;
}

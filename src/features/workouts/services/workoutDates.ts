export type CalendarDay = {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export type CalendarRange = {
  from: string;
  to: string;
};

const weekdayOffset = 0;

export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTodayKey() {
  return formatDateKey(new Date());
}

export function getMonthKey(dateKey: string) {
  const date = parseDateKey(dateKey);

  return formatDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function parseDateKey(dateKey: string) {
  const [yearValue, monthValue, dayValue] = dateKey.split("-").map(Number);
  const year =
    typeof yearValue === "number" && Number.isFinite(yearValue)
      ? yearValue
      : new Date().getFullYear();
  const month =
    typeof monthValue === "number" && Number.isFinite(monthValue)
      ? monthValue - 1
      : new Date().getMonth();
  const day =
    typeof dayValue === "number" && Number.isFinite(dayValue) ? dayValue : 1;

  return new Date(year, month, day);
}

export function shiftMonth(monthKey: string, amount: number) {
  const date = parseDateKey(monthKey);

  return formatDateKey(new Date(date.getFullYear(), date.getMonth() + amount, 1));
}

export function getCalendarDays(monthKey: string): CalendarDay[] {
  const today = getTodayKey();
  const monthDate = parseDateKey(monthKey);
  const firstOfMonth = new Date(
    monthDate.getFullYear(),
    monthDate.getMonth(),
    1
  );
  const startOffset = (firstOfMonth.getDay() - weekdayOffset + 7) % 7;
  const gridStart = new Date(
    firstOfMonth.getFullYear(),
    firstOfMonth.getMonth(),
    firstOfMonth.getDate() - startOffset
  );

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index
    );
    const date = formatDateKey(day);

    return {
      date,
      dayOfMonth: day.getDate(),
      isCurrentMonth: day.getMonth() === firstOfMonth.getMonth(),
      isToday: date === today,
    };
  });
}

export function getCalendarRange(monthKey: string): CalendarRange {
  const days = getCalendarDays(monthKey);
  const firstDay = days[0];
  const lastDay = days[days.length - 1];

  return {
    from: firstDay?.date || monthKey,
    to: lastDay?.date || monthKey,
  };
}

export function formatMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en", {
    month: "long",
    year: "numeric",
  }).format(parseDateKey(monthKey));
}

export function formatDisplayDate(dateKey: string | undefined) {
  if (!dateKey) {
    return "Unscheduled";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseDateKey(dateKey));
}

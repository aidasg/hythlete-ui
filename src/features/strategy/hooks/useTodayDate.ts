import { useEffect, useState } from "react";
export function dateInTimezone(timezone?: string | null, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function useTodayDate(timezone?: string | null) {
  const [date, setDate] = useState(() => dateInTimezone(timezone));
  useEffect(() => {
    const update = () => setDate(dateInTimezone(timezone));
    update();
    const timer = window.setInterval(update, 1000);
    window.addEventListener("focus", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); };
  }, [timezone]);
  return date;
}

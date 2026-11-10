import { paths } from "./paths";

export function coachReviewRedirect(state: unknown): string | undefined {
  const target = (state as { redirectTo?: unknown } | null)?.redirectTo;
  if (typeof target !== "string" || !target.startsWith(`${paths.coach}?change=`)) return undefined;
  const id = target.slice(paths.coach.length + "?change=".length);
  return /^[1-9]\d{0,8}$/.test(id) ? target : undefined;
}

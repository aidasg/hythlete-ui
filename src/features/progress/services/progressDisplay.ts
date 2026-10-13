export function formatCode(value: string | undefined) {
  return value
    ? value
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ")
    : "Not specified";
}

export function formatConfidence(value: number | undefined) {
  return typeof value === "number" ? `${Math.round(value * 100)}%` : "n/a";
}

export function formatMetric(value: number | undefined, unit?: string) {
  if (typeof value !== "number") return "—";
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${formatted}${unit ? ` ${unit}` : ""}`;
}

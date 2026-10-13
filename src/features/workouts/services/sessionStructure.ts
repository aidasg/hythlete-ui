import type { components } from "@/services/api/types";
export type SessionBlock = components["schemas"]["workout.SessionBlockDTO"];
export type SessionMovement = components["schemas"]["workout.SessionMovementDTO"];
export const sessionFormats = ["straight_sets", "steady", "intervals", "circuit", "amrap", "emom", "for_time"];
export const label = (value?: string) => ["hiit", "emom", "amrap"].includes(value || "") ? value!.toUpperCase() : (value || "").replace(/_/g, " ");

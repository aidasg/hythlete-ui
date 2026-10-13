export const queryKeys = {
  strategy: {
    all: ["strategy"] as const,
    daily: (date: string, minutes: number, sports: string[]) =>
      ["strategy", "daily", date, minutes, [...sports].sort().join(",")] as const,
    dailyAll: ["strategy", "daily"] as const,
    activeFocus: (date: string) =>
      ["strategy", "focus-blocks", "active", date] as const,
    activeFocusAll: ["strategy", "focus-blocks", "active"] as const,
  },
  progress: {
    all: ["progress"] as const,
    portfolio: (date: string) => ["progress", "portfolio", date] as const,
    portfolioAll: ["progress", "portfolio"] as const,
    muscleStimulus: (date: string) =>
      ["progress", "muscle-stimulus", date] as const,
    muscleStimulusAll: ["progress", "muscle-stimulus"] as const,
    breakthroughs: (status = "all") =>
      ["progress", "breakthroughs", status] as const,
    breakthroughsAll: ["progress", "breakthroughs"] as const,
    strength: (exerciseCode: string) =>
      ["progress", "strength", exerciseCode] as const,
    strengthAll: ["progress", "strength"] as const,
    benchmarks: ["progress", "benchmarks"] as const,
  },
  workouts: {
    all: ["workouts"] as const,
    catalog: ["workouts", "catalog"] as const,
    list: (from: string, to: string) => ["workouts", "list", from, to] as const,
    detail: (id: number) => ["workouts", "detail", id] as const,
    readiness: (date: string) => ["workouts", "readiness", date] as const,
    loadState: (date: string) => ["workouts", "load-state", date] as const,
  },
} as const;

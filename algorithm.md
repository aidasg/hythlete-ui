# Workout Load Algorithm

This document describes the workout tracking and load-state algorithm implemented in `internal/domain/workout/service.go`.

The current model is intentionally heuristic. It produces relative training-load points that are useful for comparison, planning, and UI signals. The numbers are not percentages, medical predictions, or validated injury probabilities.

## High-Level Flow

When a workout is created:

1. Normalize request values:
   - Dates are converted to date-only UTC.
   - Category, subtype, sport, component type, intensity zone, target type, and exercise code are normalized to lowercase snake case.
   - Empty `source` becomes `manual`.
   - Missing component order becomes the component index plus one.
   - Missing set order becomes the set index plus one.
   - Missing component sport inherits the workout sport.
2. Validate workout and component structure.
3. Load the workout catalog:
   - exercises
   - muscles
   - tissue regions
   - exercise-to-muscle maps
   - sport-to-muscle maps
   - exercise-to-tissue maps
   - sport-to-tissue maps
4. Estimate session global loads, muscle loads, and tissue loads.
5. Persist the workout, components, sets, and calculated loads.
6. If `completed = true`, recalculate acute/chronic load state for that workout date.

When load state is requested:

1. The requested date defaults to today when omitted.
2. Completed workout loads from the previous 84 days through the requested date are loaded.
3. Acute and chronic exponentially weighted loads are recalculated.
4. The cached `athlete_load_state` rows for that date are replaced.
5. The recalculated rows are returned.

## Core Entities

Session-level global loads:

```text
global_cardio_load
global_neuro_load
global_muscular_load
impact_tissue_load
strength_load
endurance_load
```

Muscle-level loads:

```text
endurance_load
strength_load
power_load
eccentric_load
stabilizer_load
```

Tissue-level loads:

```text
impact load
```

Load-state entity types:

```text
global
muscle
tissue
```

Load-state load types:

```text
cardio
neuro
muscular
impact
strength
endurance
power
eccentric
stabilizer
```

## Fallback Behavior

If a workout has no components, the service creates an internal fallback segment:

```text
type = steady
sport = workout.sport
duration_seconds = workout.duration_minutes * 60
intensity_zone = workout.subtype
```

This lets simple session-level workouts still produce load estimates.

## Segment Load Algorithm

Segment components are non-exercise components such as:

```text
warmup
interval_block
cooldown
steady
recovery
run
ride
row
```

### Segment Duration

```text
if duration_seconds is provided:
  duration_minutes = duration_seconds / 60
else if distance_m is provided:
  duration_minutes = (distance_m / 1000) * 5
else:
  duration_minutes = workout.duration_minutes
```

The distance fallback assumes 5 minutes per kilometer.

Repeats are applied after duration is calculated:

```text
effective_duration_minutes = duration_minutes * repeats
```

If `repeats` is omitted:

```text
repeats = 1
```

### Intensity Factor

The base intensity comes from `component.intensity_zone`.

If the component has no intensity zone, the workout subtype is used.

```text
recovery, recovery_aerobic                 = 0.5
easy, easy_aerobic, warmup, cooldown       = 0.7
steady, long_aerobic, aerobic_base         = 1.0
tempo, fartlek                             = 1.3
threshold, hill_repeats                    = 1.6
vo2, vo2max, vo2_max, anaerobic_capacity   = 2.0
sprint, sprint_neuromuscular               = 2.5
unknown/default                            = 1.0
```

If workout RPE is provided, it is blended with the zone intensity:

```text
rpe_intensity_factor = clamp(rpe / 5, 0.5, 2.5)
intensity = (zone_intensity_factor + rpe_intensity_factor) / 2
```

### Category Cardio Factor

```text
strength              = 0.35
mobility_durability   = 0.35
recovery              = 0.55
all other categories  = 1.0
```

### Category Neuro Factor

```text
competition_event     = 1.25
test_benchmark        = 1.25
mixed                 = 1.1
recovery              = 0.4
all other categories  = 1.0
```

### Segment Neuro Intensity Factor

```text
threshold, tempo, hill_repeats             = 0.45
vo2, vo2max, vo2_max, anaerobic_capacity   = 0.8
sprint, sprint_neuromuscular               = 1.2
unknown/default                            = 0.15
```

### Global Segment Loads

```text
cardio_load =
  effective_duration_minutes
  * intensity
  * category_cardio_factor

endurance_load =
  effective_duration_minutes
  * intensity
  * 0.85

neuro_load =
  effective_duration_minutes
  * neuro_intensity_factor
  * category_neuro_factor
```

These are added to:

```text
global_cardio_load += cardio_load
endurance_load += endurance_load
global_neuro_load += neuro_load
```

### Muscle Segment Loads

For each `sport_muscle_map` row matching the component sport:

```text
muscle_endurance_load =
  endurance_load
  * sport_muscle_map.endurance_factor

muscle_eccentric_load =
  endurance_load
  * sport_muscle_map.eccentric_factor
  * sport_eccentric_factor

muscle_strength_load =
  endurance_load
  * sport_muscle_map.strength_endurance_factor
  * sport_strength_endurance_factor
```

These are added to the matching muscle:

```text
muscle.endurance_load += muscle_endurance_load
muscle.eccentric_load += muscle_eccentric_load
muscle.strength_load += muscle_strength_load
```

The session-level muscular load is the sum of those local segment muscle loads:

```text
global_muscular_load +=
  muscle_endurance_load
  + muscle_eccentric_load
  + muscle_strength_load
```

### Sport Eccentric Factor

```text
base = 1.15 if sport = running
base = 1.0 otherwise

if intensity_zone is hill_repeats, sprint, or sprint_neuromuscular:
  sport_eccentric_factor = base * 1.25
else:
  sport_eccentric_factor = base
```

### Sport Strength-Endurance Factor

```text
hill_repeats, sprint, sprint_neuromuscular = 0.55
tempo, threshold, vo2, vo2max              = 0.25
unknown/default                            = 0.1
```

### Tissue Segment Loads

For each `sport_tissue_map` row matching the component sport:

```text
tissue_load =
  effective_duration_minutes
  * intensity
  * sport_tissue_map.load_factor
  * sport_impact_factor
```

This is added to:

```text
tissue_region.load += tissue_load
impact_tissue_load += tissue_load
```

### Sport Impact Factor

```text
running                       = 1.0
inline_skating                = 0.55
xc_skiing, rowing             = 0.35
cycling                       = 0.08
unknown/default               = 0.25
```

## Exercise Load Algorithm

Exercise components use:

```text
exercise_code
sets[]
```

Each set can include:

```text
reps
load_kg
duration_seconds
distance_m
rir
rpe
tempo
is_warmup
```

### Set Work Units

```text
units = 1

if reps is provided:
  units = reps

if duration_seconds is provided:
  units = max(units, duration_seconds / 20)

if distance_m is provided:
  units = max(units, distance_m / 10)
```

This allows reps, timed sets, sleds, carries, and distance-based work to share one scoring base.

### Proximity Factor

If RIR is provided:

```text
rir <= 0    = 1.3
rir <= 2    = 1.1
rir <= 4    = 0.85
rir > 4     = 0.6
```

If RIR is not provided but set RPE is provided:

```text
proximity_factor = clamp(0.35 + (set_rpe / 10), 0.5, 1.3)
```

If neither RIR nor set RPE is provided:

```text
proximity_factor = 0.8
```

### Rep Intensity Factor

```text
no reps provided   = 0.8
reps <= 3          = 1.6
reps <= 6          = 1.35
reps <= 12         = 1.0
reps > 12          = 0.7
```

Lower-rep work is treated as higher strength/neural intensity.

### Set Endurance Factor

```text
reps >= 12              = 1.2
duration_seconds >= 45  = 1.2
otherwise               = 0.55
```

### External Load Factor

```text
if load_kg is empty or <= 0:
  external_load_factor = 1.0
else:
  external_load_factor = 1 + min(load_kg / 100, 2) * 0.4
```

This caps the load multiplier at:

```text
1 + 2 * 0.4 = 1.8
```

### Warmup Factor

```text
if is_warmup = true:
  warmup_factor = 0.35
else:
  warmup_factor = 1.0
```

### Exercise Category Power Factor

```text
plyo, power, olympic_lift = 1.2
all other categories      = 0.45
```

### Exercise Category Neuro Factor

```text
if exercise category is plyo, power, or olympic_lift:
  exercise_neuro_factor = 1.0
else:
  exercise_neuro_factor = 0.35 + rep_intensity_factor * 0.25
```

### Per-Set Base Loads

```text
strength_base =
  units
  * proximity_factor
  * rep_intensity_factor
  * external_load_factor
  * warmup_factor

endurance_base =
  units
  * proximity_factor
  * set_endurance_factor
  * warmup_factor

power_base =
  strength_base
  * exercise_power_factor

neuro_base =
  strength_base
  * exercise_neuro_factor
```

### Global Exercise Loads

For each set:

```text
strength_load += strength_base
endurance_load += endurance_base * 0.35
global_neuro_load += neuro_base
```

### Muscle Exercise Loads

For each `exercise_muscle_map` row matching the exercise:

```text
muscle_strength_load =
  strength_base
  * exercise_muscle_map.strength_factor

muscle_endurance_load =
  endurance_base
  * exercise_muscle_map.endurance_factor

muscle_eccentric_load =
  strength_base
  * exercise_muscle_map.eccentric_factor

muscle_power_load =
  power_base
  * exercise_muscle_map.power_factor
```

These are added to the matching muscle:

```text
muscle.strength_load += muscle_strength_load
muscle.endurance_load += muscle_endurance_load
muscle.eccentric_load += muscle_eccentric_load
muscle.power_load += muscle_power_load
```

If the muscle role is `stabilizer`, stabilizer load is also added:

```text
muscle_stabilizer_load =
  strength_base
  * max(strength_factor, endurance_factor)
  * 0.5

muscle.stabilizer_load += muscle_stabilizer_load
```

The session-level muscular load is incremented by:

```text
global_muscular_load +=
  muscle_strength_load
  + muscle_endurance_load
  + muscle_eccentric_load
  + muscle_power_load
```

Note: stabilizer load is stored per muscle but is not separately added into `global_muscular_load`.

### Tissue Exercise Loads

For each `exercise_tissue_map` row matching the exercise:

```text
tissue_load =
  strength_base
  * exercise_tissue_map.load_factor
```

This is added to:

```text
tissue_region.load += tissue_load
impact_tissue_load += tissue_load
```

For strength work, `impact_tissue_load` should be read broadly as tissue/mechanical loading, not only ground impact.

## Rounding

After all components are processed, all load outputs are rounded to two decimals:

```text
rounded_load = round(value * 100) / 100
```

Zero or negative muscle/tissue load rows are omitted.

## Load State / Readiness Algorithm

The current readiness layer is called `athlete_load_state`.

It does not yet produce one final readiness score. Instead, it produces acute/chronic state rows per:

```text
entity_type + entity_id + load_type
```

Examples:

```text
global + global + cardio
global + global + neuro
muscle + quads + endurance
muscle + quads + strength
tissue + achilles_tendon + impact
```

Frontend/product logic can then translate these rows into readiness messages, colors, and recommendations.

### Included Workouts

Only completed workouts are included in load-state calculations:

```text
completed = true
```

The lookback window is:

```text
requested_date - 84 days through requested_date
```

### Daily Load Inputs

The storage layer expands each completed workout into daily load rows:

Global rows:

```text
global + global + cardio      = workout_loads.global_cardio_load
global + global + neuro       = workout_loads.global_neuro_load
global + global + muscular    = workout_loads.global_muscular_load
global + global + impact      = workout_loads.impact_tissue_load
global + global + strength    = workout_loads.strength_load
global + global + endurance   = workout_loads.endurance_load
```

Muscle rows:

```text
muscle + muscle_code + endurance   = workout_muscle_loads.endurance_load
muscle + muscle_code + strength    = workout_muscle_loads.strength_load
muscle + muscle_code + power       = workout_muscle_loads.power_load
muscle + muscle_code + eccentric   = workout_muscle_loads.eccentric_load
muscle + muscle_code + stabilizer  = workout_muscle_loads.stabilizer_load
```

Tissue rows:

```text
tissue + region_code + impact = workout_tissue_loads.load
```

Rows with load `<= 0` are ignored.

### Acute and Chronic EWMA

For each daily load row:

```text
age_days =
  requested_date - load_date
```

Acute load uses a 7-day exponential decay:

```text
acute_contribution =
  daily_load
  * exp(-age_days / 7)
```

Chronic load uses a 42-day exponential decay:

```text
chronic_contribution =
  daily_load
  * exp(-age_days / 42)
```

For each state key:

```text
acute_load = sum(acute_contribution)
chronic_load = sum(chronic_contribution)
```

### Ratio

```text
if chronic_load > 0:
  ratio = acute_load / chronic_load
else:
  ratio = 0
```

The ratio is context only. It should not be treated as a standalone injury prediction.

### Trend Classification

```text
if acute_load == 0 and chronic_load == 0:
  trend = none
else if ratio >= 1.5:
  trend = high_acute
else if ratio >= 1.2:
  trend = rising
else if ratio >= 0.8:
  trend = stable
else:
  trend = detraining
```

## Interpreting Load State as Readiness

The backend currently exposes state rows, not a single readiness score.

Recommended frontend interpretation:

```text
none:
  no recent load data for this entity/load type

detraining:
  acute load is low relative to chronic load
  possible opportunity to train if no other constraints exist

stable:
  acute load is broadly aligned with chronic load
  usually acceptable if the proposed workout matches priorities

rising:
  acute load is elevated relative to chronic load
  use caution, especially for hard sessions on the same entity/load type

high_acute:
  acute load is much higher than chronic load
  generally avoid adding more intense load to the same entity/load type
```

Examples:

```text
global + cardio + stable:
  global aerobic load is in a normal recent range.

global + neuro + high_acute:
  avoid VO2, sprints, heavy max-strength, and high-coordination intensity today.

muscle + quads + endurance + rising:
  prefer non-quad-dominant endurance or reduce intensity.

tissue + achilles_tendon + impact + high_acute:
  prefer bike/row/swim over run intervals or plyometrics.

muscle + upper_back + strength + detraining:
  good candidate for upper-pull strength if global neuro load is not high.
```

## Current Seeded Catalog Scope

The first seeded muscle groups are:

```text
quads
hamstrings
glute_max
glute_med
adductors
calves_soleus_gastroc
tibialis_ankle
hip_flexors
spinal_erectors
core_abs_obliques
lats
upper_back
pecs
delts
triceps
biceps
forearms_grip
```

The first seeded tissue regions are:

```text
achilles_tendon
plantar_fascia
patellar_tendon
knee_joint
hip_joint
adductor_tendon
hamstring_tendon
lumbar_spine
shoulder
elbow
wrist_hand
neck
```

The first seeded sports with mapping coverage are:

```text
running
cycling
rowing
inline_skating
xc_skiing
```

The first seeded exercises are:

```text
back_squat
front_squat
deadlift
romanian_deadlift
bench_press
overhead_press
pull_up
barbell_row
sled_push
wall_balls
kettlebell_swing
farmers_carry
```

## Important Limitations

1. The model is calibrated by heuristics, not validated lab measurements.
2. Load points should be compared within this app, not against external TSS/TRIMP scales.
3. Acute/chronic ratio is a context signal, not an injury prediction.
4. Strength load currently uses absolute load in kg, not athlete-relative 1RM.
5. Segment distance fallback assumes 5 min/km when duration is missing.
6. Terrain, elevation, cadence, pace, HR, power, sleep, soreness, HRV, and subjective readiness are not yet included.
7. The backend does not yet emit a single readiness score. It emits state rows for the frontend or future recommendation engine to interpret.

## Future Algorithm Improvements

Likely next improvements:

1. Add athlete-relative load using estimated 1RM or recent strength history.
2. Add sport-specific modifiers for terrain, elevation, surface, cadence, pace, power, and HR zones.
3. Add soreness, pain, and subjective readiness as modifiers, not replacements for load.
4. Add planned-vs-completed comparison.
5. Add a recommendation layer that scores proposed workouts against:
   - global cardio state
   - global neuro state
   - muscle endurance/strength state
   - tissue impact state
   - user goals and priorities
   - recent monotony and undertrained areas
6. Add a frontend-friendly readiness summary API that turns state rows into concise labels like:
   - `ready`
   - `productive`
   - `caution`
   - `avoid_same_load`
   - `underdosed`

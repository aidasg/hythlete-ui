# Body State Muscle Map

This file documents how backend workout load-state entities are grouped onto the current dashboard anatomy figure.

The backend exposes state rows as:

```text
entity_type + entity_id + load_type
```

The dashboard maps `muscle` and `tissue` entities to visible SVG anatomy regions in `src/features/dashboard/components/muscleBreakdownData.ts`. Tendons and tissue regions are intentionally mapped to their local attachment muscles as well as any visible tendon/fascia shapes, so tissue load can be seen directly on the body map.

## Backend Muscle Groups

| Backend muscle | Visible anatomy regions |
| --- | --- |
| `quads` | Rectus femoris, vastus lateralis, vastus medialis |
| `hamstrings` | Semitendinosus, semimembranosus, biceps femoris |
| `glute_max` | Gluteus maximus |
| `glute_med` | Gluteus medius, tensor fasciae latae |
| `adductors` | Adductor longus, adductor magnus, gracilis, pectineus |
| `calves_soleus_gastroc` | Soleus, gastrocnemius |
| `tibialis_ankle` | Tibialis anterior, fibularis/peroneus longus, extensor digitorum longus, crural/pedal complex |
| `hip_flexors` | Iliopsoas, deep hip flexor region |
| `spinal_erectors` | Latissimus dorsi, rhomboids, trapezius, side torso/lumbar-adjacent region |
| `core_abs_obliques` | Rectus abdominis, anterior abdominal wall, external oblique, lateral abdominal wall, pelvic stabilizers |
| `lats` | Latissimus dorsi |
| `upper_back` | Trapezius, rhomboid major, infraspinatus, teres major |
| `pecs` | Pectoralis major, pectoralis minor |
| `delts` | Anterior/middle/posterior deltoid regions |
| `triceps` | Triceps brachii long, lateral, and medial heads |
| `biceps` | Biceps brachii long/short heads, brachialis |
| `forearms_grip` | Flexor/extensor carpi groups, brachioradialis, pronator teres, intrinsic hand regions |

## Backend Tissue Regions

| Backend tissue | Visible tendon/attachment mapping |
| --- | --- |
| `achilles_tendon` | Calcaneal tendon/plantar aponeurosis shape, soleus, gastrocnemius |
| `plantar_fascia` | Plantar aponeurosis, crural/pedal complex, foot region |
| `patellar_tendon` | Patellar ligament/kneecap, knee stabilizers, quadriceps attachment regions |
| `knee_joint` | Anterior knee, posterior knee, popliteus, patellar ligament complex |
| `hip_joint` | Iliopsoas, pelvic stabilizers, gluteal regions, adductors, pectineus |
| `adductor_tendon` | Adductor longus/magnus, gracilis, pectineus |
| `hamstring_tendon` | Semitendinosus, semimembranosus, biceps femoris, posterior knee |
| `lumbar_spine` | Latissimus dorsi, external oblique, lateral abdominal wall, side torso |
| `shoulder` | Deltoids, infraspinatus, teres major, pectorals, trapezius |
| `elbow` | Bicipital aponeurosis/inner elbow, biceps, triceps, brachioradialis, forearm groups |
| `wrist_hand` | Intrinsic hand regions, dorsal hand fascia, flexor/extensor carpi groups, brachioradialis |
| `neck` | Sternocleidomastoid, trapezius, head/neck regions |

## Score Names Used In UI

| Backend load type | UI score name |
| --- | --- |
| `cardio` | Cardiorespiratory Load Score |
| `neuro` | Neural Fatigue Score |
| `muscular` | Muscle Load Score |
| `impact` | Tendon Impact Score |
| `strength` | Strength Stress Score |
| `endurance` | Aerobic Stress Score |
| `power` | Power Output Stress Score |
| `eccentric` | Eccentric Tissue Stress Score |
| `stabilizer` | Stabilizer Demand Score |

## Body State Interpretation

The backend does not currently return one final readiness score. The frontend derives a Body State display from acute/chronic ratio and trend:

| Trend | Body State interpretation |
| --- | --- |
| `none` | No recent mapped load |
| `detraining` | Low acute load relative to chronic load |
| `stable` | Acute load broadly aligned with chronic load |
| `rising` | Elevated acute load, use caution |
| `high_acute` | Acute load much higher than chronic load |

This mapping is intentionally product-facing and heuristic. It should be revisited when the backend exposes a dedicated readiness summary API.

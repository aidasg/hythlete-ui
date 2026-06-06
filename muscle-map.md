# Body State Muscle Map

This file documents how backend workout load-state entities are mapped onto the current dashboard anatomy figure.

The backend exposes state rows as:

```text
entity_type + entity_id + load_type
```

The dashboard maps `muscle` and `tissue` entities to visible SVG anatomy regions in `src/features/dashboard/components/muscleBreakdownData.ts`. Tendons and tissue regions are intentionally mapped to their local attachment muscles as well as any visible tendon/fascia shapes, so tissue load can be seen directly on the body map.

## Backend Muscle Regions

| Backend muscle | Visible anatomy regions |
| --- | --- |
| `rectus_femoris` | Rectus femoris |
| `vastus_lateralis` | Vastus lateralis |
| `vastus_medialis` | Vastus medialis |
| `semitendinosus` | Semitendinosus |
| `semimembranosus` | Semimembranosus |
| `biceps_femoris` | Biceps femoris |
| `glute_max` | Gluteus maximus |
| `gluteus_medius` | Gluteus medius |
| `tensor_fasciae_latae` | Tensor fasciae latae |
| `adductor_longus` | Adductor longus |
| `adductor_magnus` | Adductor magnus |
| `gracilis` | Gracilis |
| `pectineus` | Pectineus |
| `soleus` | Soleus |
| `gastrocnemius` | Gastrocnemius |
| `tibialis_anterior` | Tibialis anterior |
| `fibularis_longus` | Fibularis/peroneus longus |
| `extensor_digitorum_longus` | Extensor digitorum longus |
| `crural_pedal_complex` | Crural/pedal tendinous complex |
| `iliopsoas` | Iliopsoas |
| `deep_hip_flexor_region` | Iliopsoas/deep hip flexor drawn region |
| `spinal_erectors` | Erector spinae (bilateral dedicated back regions) |
| `rectus_abdominis` | Rectus abdominis, anterior abdominal wall |
| `external_obliques` | External abdominal oblique, lateral abdominal wall |
| `pelvic_stabilizers` | Pelvic floor and iliac fascia |
| `lats` | Latissimus dorsi |
| `trapezius` | Trapezius |
| `rhomboid_major` | Rhomboid major |
| `infraspinatus` | Infraspinatus |
| `teres_major` | Teres major |
| `pectoralis_major` | Pectoralis major |
| `pectoralis_minor` | Pectoralis minor |
| `anterior_deltoid` | Anterior deltoid |
| `lateral_deltoid` | Middle/lateral deltoid |
| `posterior_deltoid` | Posterior deltoid |
| `triceps_long_head` | Triceps brachii long head |
| `triceps_lateral_head` | Triceps brachii lateral head |
| `triceps_medial_head` | Triceps brachii medial head |
| `biceps_long_head` | Biceps brachii long head |
| `biceps_short_head` | Biceps brachii short head |
| `brachialis` | Brachialis |
| `forearm_flexors` | Flexor carpi regions |
| `forearm_extensors` | Extensor carpi and abductor pollicis longus regions |
| `brachioradialis` | Brachioradialis |
| `pronator_teres` | Pronator teres |
| `intrinsic_hand` | Intrinsic hand musculature |

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
| `lumbar_spine` | Erector spinae, latissimus dorsi, external oblique, lateral abdominal wall, side torso |
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

# Functional audit — 2026-11-13

Initial source audit against the attached COMPLETE FUNCTIONAL LOGIC brief. These statuses describe the starting working tree, not runtime verification of this release. Existing UI/audio edits are retained; no visual redesign or paid provider calls are authorized by this audit.

| Requirement | Initial status | Evidence / gap |
| --- | --- | --- |
| 1 Audit existing application | PARTIAL | Existing architecture/status and prior browser evidence; this matrix records new brief gaps. |
| 2 Onboarding | PARTIAL | Persisted age/sex/height/weight/activity/goal/experience/time/days/screening/body preferences; Gym equipment silently assumes a full gym. |
| 3 Personalized planning | PARTIAL | Shared buildWeek, bounded adaptive history and progression exist; focused sessions top up with unrelated full-body exercises; BMI affects cardio capability. |
| 4 Home/Gym inventory | PARTIAL | Strict 19 Home IDs and equipment Gym policy; removed step-up excluded. Only one actual Bird Dog file found, opposite side mirrored. Separate right clip is not present. |
| 5 Distribution | PARTIAL | Splits and difficulty constraints exist; repeated split picks identical exercises, little controlled weekly variation. |
| 6 Timing | PARTIAL | Bounded work/rest estimate, bilateral time and post-progression budget fixed; set progression and transitions not explicit. |
| 7 Unified experience | PARTIAL | GuidedPlayer shared by current entrypoints; legacy players retained. Partial current set/rest not durably restored. |
| 8 Quick | PARTIAL | UI 15/20/30, backend accepts 5–45; profile-based preview but no consistent historical load suggestions. |
| 9 Video detail | PARTIAL | Two useful intro sections, Try and Start exist; local dose/recommendation path bypasses profile constraints. |
| 10 Voice | BROKEN | Existing provider/device fallback and localized cues; stale async playback, unduck cancellation and unbounded cache risks. |
| 11 Music | PARTIAL | Local licensed tracks, shared looping audio and picker; no volume control; play resets voice duck. |
| 12 Media | PARTIAL | Existing caching/posters, no bounded next-video preparation or measured throttled transitions. |
| 13 Completion/resume | PARTIAL | Owner-scoped sets, idempotent upserts/rewards and history; player local pause/checkpoint not persisted. |
| 14 Shared contracts | PARTIAL | Plan/Exercise/Workout types exist; player/voice/progress/rest contracts incomplete. |
| 15 Verification | PARTIAL | Previous remote 84 tests/build/locales and real Gym flow pass; complete new brief journeys not yet tested. |
| 16 Deploy | MISSING | New functional release not deployed. Existing release 67e30e5 remains live. |

Implementation and verification results belong in FUNCTIONAL_RELEASE.md and evidence/functional-review/. Source inspection never counts as a runtime PASS. No user database reset is included.

## UI integration boundary

Keep existing StartBar, ExerciseDetail intro sections, GuidedPlayer markup/classes and locale catalogs. Add functional contracts/services and additive API fields; use the same authenticated origin and durable transaction boundary. Timed Home work advances automatically; Gym countdown is an estimate and requires actual Done to record reps/load. A zero countdown must never fabricate completed reps.

## Programming evidence

Use conservative product rules with explicit estimates, not medical prescriptions. Reference: [ACSM 2026 resistance-training guidance](https://acsm.org/resistance-training-guidelines-update-2026/) and [CDC adult activity guidance](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html). Consistency, recovery and ability-based progress take priority over inferred capability from body size.

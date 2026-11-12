# Visual onboarding and plan inputs

2026-11-12. User requested a white, readable fitness app with an illustrated intake, including current and desired waist/glute shape. New code and diagrams are original.

## Sources consulted

- [Workout.cool](https://github.com/Snouzy/workout-cool): MIT; exercise database, equipment selection, plans and tracking. Existing immutable project reference stays at `d52f9f62d2a5fcbb78d67a95dc8763f9a34dbf9e`. Reused product patterns, not a new code import.
- [wger](https://github.com/wger-project/wger): AGPL-3.0; routines, nutrition and measurements inform the separation of exercise prescriptions and personal measurements. Existing immutable reference stays at `c6ee8a740137c498ee7221e6cd3d8ad84b4a9304`. No AGPL source copied. Previously verified exercise media provenance is unchanged by this work.
- [CDC adult activity guidance](https://www.cdc.gov/physical-activity-basics/guidelines/adults.html/): all major muscle groups and recovery inform keeping a balanced programme rather than replacing every session with the selected body region. Starting sessions remain short and progressive; the app does not claim that the starter week meets the full adult weekly guideline.
- [ACE on spot reduction](https://www.acefitness.org/about-ace/press-room/press-releases/319/ace-lists-most-common-fitness-myths/): region exercises do not selectively remove fat. Waist/glute reduction examples therefore describe whole-body activity, not local fat burning.
- User's Fitness Online reference and attached FitnessUIUX screenshots: visual direction only. No unprovided private app screens or proprietary code inspected; no copying of its photos or body diagrams.

## Collected inputs and actual use

| Input | Actual use |
|---|---|
| Main goal, optional nickname | Profile goal; weight direction; coach address |
| Up to three priority areas | Tie-break equally suitable exercise choices within the day's existing split, respecting level and muscle coverage |
| Self-described current waist/glute build | A personal baseline, saved and shown on review/Profile; never converted to a fat percentage, diagnosis or automatic intensity |
| Desired waist/glute direction | Core/glute preference alongside a balanced programme; no target appearance or timeline guarantee |
| Optional waist and hip circumference | Saved baseline; waist also enters the existing measurement history at signup. No inferred measurements from diagrams |
| Age band, sex/prefer not to say, height, weight, target weight | Existing body/BMI/energy calculations; the age band is an estimate, not an exact age |
| Day-to-day activity | Existing energy activity factor |
| Home/gym and actual available equipment | Filter eligible exercises; no unselected equipment introduced by the generated programme or saved swaps |
| Experience, weekdays, time, session length | Existing starting step, schedule/reminder and session cap |
| Body regions to protect and individual health screening answers | Existing gentle-start cap and low-impact rule; saved structured protection preferences. Not a diagnosis or a guarantee every movement is suitable |

21 short screens include introduction, visual preferences and a final review with direct edit links. Previously collected information remains included. Optional measurements and uncertain self-descriptions can be skipped. Each body region has distinct current-build illustrations and separate desired-direction choices. Profile reuses the same controls for authenticated updates.

Persistence: new `FitnessProfile.bodyPreferences` JSON column, strict bounded schema, owner identity from the server session. `GET/POST /api/training/prefs` does not accept a caller user ID. Migration `20261115000000_body_preferences` defaults to `{}` for existing accounts and reads as balanced/maintain/unsure. Existing programme, rest and progression rules stay in force. The original multi-endpoint onboarding save sequence remains; it waits for writes before showing Home but is not one atomic cross-endpoint transaction.

All Myanmar copy is provisional until reviewed by a fluent speaker. SVG diagrams are schematic examples, not predicted before/after photographs. No AI/provider calls were used to generate user plans or images.

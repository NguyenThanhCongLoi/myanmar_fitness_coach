# Application paths

- `src/features/onboarding/{quiz,body-goal-fields,body-visual}.tsx`: illustrated intake/review. `shared/body-preferences.ts` validates choices; Profile reuses the editor.
- `src/app/solaris.css`, `DESIGN.md`: final white/orange design and semantic chart tokens; loads after earlier theme layers.
- `src/server/plan.ts`, `src/shared/{plan,program}.ts`: eligible movements, programme/day construction, balance, home/gym and stable IDs.
- `src/shared/adaptation.ts`: bounded pure decision rules. `src/server/adaptation.ts`: owner-scoped immutable baseline, daily choices, weekly review and transactional close; `AiMemory` keys `plan:v2:*`, `plan:today:*`, `plan:position:*`.
- `src/server/{services,progression,recommendation,training}.ts`: actual completion, conservative load suggestions, form feedback and idempotent session actions.
- `src/app/api/training/[...path]/route.ts`: authenticated API, including `GET plan`, `POST plan/today`, `POST plan/review`, feedback and prefs. Writes/plan initialization persist the Volume before success.
- `src/features/plan/{plan-view,adaptive-controls,guided-player,workout-audio}.tsx`: home composition, weekly review, video/timers and free device audio cues. `features/progress/progress-charts.tsx`: real calendar and strength/volume.
- `src/server/{gamification,streak}.ts`: existing transactional credit/streak/rest/protection rules; scheduler calls the web endpoint and never mounts the customer Volume.
- `src/locales/{onboarding,adaptive,training}-{en,my}.ts`: contracts checked by `scripts/check-locales.ts`.
- `prisma/migrations/20261115000000_body_preferences`, `20261116000000_adaptive_feedback`: additive schema. `prisma/exercise-media-original.json`: approved owner-produced media override, empty by default.
- `scripts/video-production.py`, `docs/VIDEO_{PRODUCTION.md,SHOT_LIST.csv}`: exhaustive creator handover. `public/audio/ATTRIBUTION.md`: local music provenance/checksum.
- `infrastructure/modal/app.py`: CPU POC, one writer, durable SQLite, pre-release backup and persistence bridge. Stop before redeploying. Secrets stay outside source.
- `tests/{adaptation,body-preferences,progression}.test.ts`, `scripts/qa/`, `evidence/adaptive-release/`: domain/runtime verification. See TESTING_GUIDE.md for limits.

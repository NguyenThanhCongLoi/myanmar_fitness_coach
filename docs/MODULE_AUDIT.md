# Integration audit before implementation

The previous runtime audit remains authoritative: `../../docs/REPO_COMPARISON.md`. New source is a selective Workout.cool-derived Next.js product, not four applications or a link dashboard. Original checkouts live in `../../references/`; no reference app is deployed in this phase.

| Module | Source | Reuse directly | Adapt | Reimplement | License | Status |
|---|---|---|---|---|---|---|
| Next/React/TypeScript foundation and API conventions | Workout.cool d52f9f6 | Framework/conventions | Smaller single application and current POC scope | No second framework | MIT | Selected |
| Prisma client singleton | Workout.cool `src/shared/lib/prisma.ts` | Pattern/code | Export path and SQLite configuration | — | MIT | Selected, notice retained |
| Server session lookup | Workout.cool `get-server-session-user.ts` | Session API usage | Ownership guards and 401 responses | — | MIT | Selected |
| Better Auth Prisma integration | Workout.cool `better-auth.ts` | Library/convention | Standard password hashing; one locale/profile | Remove unsafe custom hashing and broad origins | MIT | Selected selectively |
| WorkoutSession/WorkoutSet model and set-type constants | Workout.cool Prisma/types | Names and set concepts | Unified SQLite relations, ownership, numeric load/unit validation | Fix upstream cross-owner behavior, complete migration | MIT | Selected/adapted |
| Subscription, ads and premium modules | Workout.cool | No | No | No | MIT | Excluded by explicit free POC scope |
| Program/day/exercise and progress design | Workout.cool | Domain conventions | Small shared plan/session model and unified UI | Scoped service operations where old code unsafe | MIT | Selected/adapted |
| Agent/tool workflow | fitness-coach 8671a1b | No Python service | Translate validated plan/tool orchestration to TypeScript | Gateway adapter and approval transaction | MIT | Selected design reference; no extra backend |
| Fitness/nutrition/muscle design | wger c6ee8a7 | No code | Conceptual reference only | Optional features deferred | AGPL-3.0-or-later | Excluded implementation |
| Mobile routines/import/body tracking | openGym | No code | Conceptual reference only | Optional features deferred | AGPL-3.0 (upstream metadata/license) | Excluded implementation; no runtime claim |
| Existing exercise library | Workout.cool sample CSV | Non-media text/IDs with notices | Stable source IDs, omit unverified media | — | MIT software; media not cleared | Three core sample exercises first |
| Missing essential exercise data | exercises-dataset 7455efa | Selected MIT text fields only | Deduplicate by normalized name, source attribution | Myanmar translations provisional | MIT data/text; separate media exception | Supplement essentials only; no 1,324-item translation |
| Exercise images/GIFs | dataset/core | No | No | Original code-native placeholder | Third-party/uncleared | Excluded; dataset explicitly requires own Gym visual rights |
| UX reference | hominhduc.me | No code/media | General clean presentation only | Product-specific responsive UI | Unknown | Site inaccessible during research; do not claim detailed inspection |

Existing features overlap in identity, plans, logs and progress. Keep exactly one implementation/model for each; no separate Python AI database, wger backend or openGym runtime. Reuse compatible source patterns selectively rather than retaining their monetization, logos, media or unsafe identity shortcuts. LLM output remains unavailable until the user configures a gateway; no fake model calls.

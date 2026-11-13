# Intake save and language correction — 2026-11-13

Removed the technical captions under Home/Gym and the protected-area question. Existing stored protection preferences remain respected. Joint/back screening no longer fails intake validation for an answer that the wizard does not collect; the existing conservative workload, extra rest and low-impact filters remain active.

Errors are stored as stable codes and rendered using the current locale. English/Myanmar switches update the existing error immediately and retain answers. A single inline error above the action replaces the duplicate toast that could cover Create plan. Underweight loss-goal validation now gives a goal-specific message instead of unrelated health-screening advice.

The Modal deployment exposes a canonical and regional URL. Exact-origin validation and Better Auth now share the two explicit Fitness Modal origins when either is configured. Other deployments retain only their configured origin; unrelated Modal apps, suffix domains, null-string and HTTP origins remain rejected. No wildcard origin or caller-controlled host trust was introduced.

PASS: 82 tests/22 files, EN/MY locale contracts, production build/TypeScript in an isolated Modal sandbox with a disposable database and no customer Volume or gateway credentials. Tests cover valid joint screening without a removed area answer and exact-origin allow/reject cases.

PASS: real browser signup; numeric choices survive language changes; absent captions and removed step; simulated save failure changes language in both directions without duplicate toast; 12 EN/MY × light/dark × 320/390/1280 review/error layouts, zero overflow/page errors and no error/button overlap; real Home save200, reload persistence; Myanmar Gym retake saved correctly. Runtime script: `scripts/qa/intake-save-review.js`; sanitized evidence: `evidence/intake-save/`. No production test user created.

The matching released-source snapshot excludes pre-existing player/audio working edits. Final deployment used the established full stop-before-deploy sequence: old fitness app stopped and tasks0 verified, then redeployed CPU/max one web writer with stable auth and Volume. Secrets remain outside Git/images. This change does not repeat the previous user-data wipe or modify Docker/AI Chat.

Deployment incident: an attempted max-containers0 override was not a pause in this SDK/server combination and allowed extra web containers. The whole fitness app was immediately stopped and zero tasks verified before final deployment; both attached build sandboxes ended. The experimental path was removed from automation. Read-only checks passed database/backup integrity and the seed stamp for the exact released-source snapshot. Comparing users against the old pre-intake backup is intentionally skipped because the user explicitly wiped those accounts in the preceding task; that comparison cannot prove preservation after the reset. No claim of historical user-ID preservation is made by this check.

NOT TESTED: physical phones and fluent-speaker certification of provisional Myanmar copy. The browser's failed-save case is explicitly simulated; actual successful saves use the real API/database.

Live deployment PASS: canonical and regional landing pages200, unauthenticated bootstrap401. A POST to preferences with the regional Fitness Origin now reaches authentication401 instead of origin rejection; a foreign Modal Origin remains403. These are anonymous checks and create no production test user.

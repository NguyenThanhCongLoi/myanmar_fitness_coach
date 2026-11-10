# Unified application

`src/app/page.tsx` mounts the responsive client shell and Myanmar/English provider. Features share one authenticated bootstrap and API client. Overview, progress and history use persisted workout records. Stable exercise IDs are separate from translations, with English fallback. Noto Sans Myanmar is self-hosted. Date grouping uses Asia/Yangon; external load is stored in kg with explicit lb conversion.

`/api/auth/*` uses Better Auth's Prisma adapter and password hashing. `/api/fitness/*` obtains identity from the server-side session. Strict schemas reject caller-selected user IDs. Owned foreign keys are checked through the authenticated user's plan/session/proposal relationships. Multi-record changes use transactions. Sets use a unique session/exercise/index key; proposal approval is transactional and idempotent.

One Prisma schema contains identity, profiles/goals, exercise translations/provenance, plans/days/prescriptions, sessions/sets, measurements, conversations/messages, memory, proposals and tool audits. The POC library imports 12 text records; no accounts, workouts or fake conversations are seeded.

AI uses these same services and database. Gateway configuration is intentionally absent. When connected, bounded validated tools read actual user data and create pending plan proposals. Activation requires explicit authenticated approval. No arbitrary SQL or second AI backend.

Modal runs one Next.js process and SQLite writer. A loopback-only infrastructure bridge commits the Volume before successful write responses. See DEPLOYMENT.md for redeployment constraints. Move to PostgreSQL before multi-instance hosting.

Limits: provisional Burmese, small exercise sample, generic original artwork instead of licensed demonstrations, no email verification/recovery delivery, no real gateway evaluation, no load/physical-device/backup-restore validation. All available POC features are free.

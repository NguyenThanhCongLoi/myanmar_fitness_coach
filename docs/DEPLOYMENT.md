# Modal POC

Canonical application URL: https://avibigateway--myanmar-fitness-coach.modal.run . Use profile `lointc`, workspace `avibigateway`, environment `main`; verify them before deployment. Use this URL to match the configured authentication origin. Historical commands below using the former account URL must use this canonical origin instead.

One Next.js application exposes frontend and APIs at one HTTPS endpoint. Better Auth supplies identity; Prisma accesses one SQLite database at `/data/fitness.db` on Volume `myanmar-fitness-coach-data` (v2). App: `myanmar-fitness-coach`, environment `main`, CPU 2, memory 4096 MiB, maximum one container, one concurrent request. Idle containers scale down after 300 seconds.

After each acknowledged write the server calls an authenticated loopback-only infrastructure bridge; it commits the Volume before returning success. Migrations and idempotent seed run before the web server starts. SQLite uses DELETE journaling. The Python adapter only launches Next.js and commits storage; it is not a second product backend.

**Stop this app before redeploying it.** Never perform rolling deployments with overlapping SQLite writers. Do not increase container count. Use PostgreSQL before horizontal scaling. Volume persistence is not an independent backup; scheduled backups and restore drills remain future work.

From the workspace root, using the configured Python 3.12:

```powershell
& $pocPython -X utf8 scripts/provision-product-secret.py
& $pocPython -X utf8 -m modal deploy myanmar-fitness-coach/infrastructure/modal/app.py --env main
```

The provisioning script creates `myanmar-fitness-coach-config` only if absent. It generates a stable auth secret and sets the endpoint origin without printing values. Existing unrelated secrets and LLM keys are not used. Retain this secret across deployments to preserve sessions. The app is a temporary free-feature POC; Modal infrastructure usage still follows the workspace's billing.

Gamification deployment also requires `scripts/provision-notification-secret.py` once (already run for the current workspace). It creates the scheduler token and stable VAPID pair in `myanmar-fitness-coach-notifications`, printing no values. The same Modal app has an hourly scheduled HTTP check with no Volume mount; the web function remains the sole SQLite writer. Notification state remains in the existing SQLite database per the user's reconfirmed POC choice. Before the first gamification migration, startup saves a SQLite backup to `/data/backups/pre-gamification.db` and commits it. This backup is not an independent disaster-recovery copy.

## Google sign-in

Fill `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the same local `.env`. These are uploaded as runtime secrets alongside gateway values; neither is included in the browser bundle or image. Leave both blank to keep Google sign-in disabled. Email/password remains available. No database migration is needed: existing Account/Session/Verification models support OAuth.

In [Google Cloud Console](https://console.cloud.google.com/), configure the OAuth consent screen and create an OAuth client of type **Web application**. Set:

- Authorized JavaScript origin: `https://avibigateway--myanmar-fitness-coach.modal.run`
- Authorized redirect URI: `https://avibigateway--myanmar-fitness-coach.modal.run/api/auth/callback/google`

Choose audience **External** so other people can use their own Google accounts. For a public release, set publishing status **In production**. Google documents an exception to the testing allowlist for basic identity-only scopes (`openid`, `email`, `profile`), which are the only scopes this app requests; Workspace administrators may still restrict access. See [Google's audience rules](https://support.google.com/cloud/answer/15549945). Copy Client ID/Client Secret into `.env`, then use the stop/deploy commands below. Do not change the stable auth secret. Setup follows [Better Auth's Google provider documentation](https://better-auth.com/docs/authentication/google).

Google uses the same app identity, onboarding and workout database. Better Auth's verified-email, same-email account-linking checks remain enabled; different-email linking is disabled. The callback commits the Volume before returning its redirect. Failure returns to a localized sign-in error. OAuth authorization initiation and invalid-state rejection are testable without real credentials; successful Google token exchange requires your OAuth client and consent in a real browser.

## Gateway configuration

Fill `LLM_BASE_URL` (OpenAI-compatible API root, usually ending `/v1`), `LLM_API_KEY`, and `LLM_MODEL` in `myanmar-fitness-coach/.env`. The deployment adapter uploads only these three variables as a separate runtime Modal Secret. Local `.env` values take precedence over any older gateway values in the named config Secret; stable authentication settings remain in `myanmar-fitness-coach-config`. The `.env` file is Git-ignored and excluded from the image. Keep it for future deployments; leaving all three values blank disables the gateway. Do not put `/chat/completions` in the base URL.

After filling the file, run from `D:\workout_fitness` in PowerShell:

```powershell
$pocPython = 'C:\Users\admin\AppData\Local\Programs\Python\Python312\python.exe'
& $pocPython -X utf8 -m modal app stop myanmar-fitness-coach --env main --yes
if ($LASTEXITCODE -ne 0) { throw 'Modal stop failed; deployment cancelled.' }
& $pocPython -X utf8 -m modal deploy myanmar-fitness-coach/infrastructure/modal/app.py --env main
if ($LASTEXITCODE -ne 0) { throw 'Modal deployment failed.' }
```

Stop and redeploy to apply changes. All three values are server-only. Until configured, AI Coach truthfully shows disconnected; manual plans, workouts, progress and notes remain available.

The adapter expects `/chat/completions` with function/tool calling. It uses bounded read tools against the authenticated user's real data. Proposed plans require explicit approval before activation. Model compatibility, real conversations, safety behavior and costs must be tested after gateway configuration; no live model was called during this deployment.

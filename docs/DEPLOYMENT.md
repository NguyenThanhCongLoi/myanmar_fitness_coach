# Modal POC

Canonical application URL: https://nguyenthanhcongloi332004--myanmar-fitness-coach.modal.run . Use this URL to match the configured authentication origin.

One Next.js application exposes frontend and APIs at one HTTPS endpoint. Better Auth supplies identity; Prisma accesses one SQLite database at `/data/fitness.db` on Volume `myanmar-fitness-coach-data` (v2). App: `myanmar-fitness-coach`, environment `main`, CPU 2, memory 4096 MiB, maximum one container, one concurrent request. Idle containers scale down after 180 seconds.

After each acknowledged write the server calls an authenticated loopback-only infrastructure bridge; it commits the Volume before returning success. Migrations and idempotent seed run before the web server starts. SQLite uses DELETE journaling. The Python adapter only launches Next.js and commits storage; it is not a second product backend.

**Stop this app before redeploying it.** Never perform rolling deployments with overlapping SQLite writers. Do not increase container count. Use PostgreSQL before horizontal scaling. Volume persistence is not an independent backup; scheduled backups and restore drills remain future work.

From the workspace root, using the configured Python 3.12:

```powershell
& $pocPython -X utf8 scripts/provision-product-secret.py
& $pocPython -X utf8 -m modal deploy myanmar-fitness-coach/infrastructure/modal/app.py --env main
```

The provisioning script creates `myanmar-fitness-coach-config` only if absent. It generates a stable auth secret and sets the endpoint origin without printing values. Existing unrelated secrets and LLM keys are not used. Retain this secret across deployments to preserve sessions. The app is a temporary free-feature POC; Modal infrastructure usage still follows the workspace's billing.

## Connect a gateway later

Add `LLM_BASE_URL` (OpenAI-compatible API root, usually ending `/v1`), `LLM_API_KEY`, and `LLM_MODEL` to the same Modal Secret, preserving `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`. Stop and redeploy this app to apply changes. Do not paste credentials into source, browser settings, or chat. All three values are server-only. Until configured, AI Coach truthfully shows disconnected; manual plans, workouts, progress and notes remain available.

The adapter expects `/chat/completions` with function/tool calling. It uses bounded read tools against the authenticated user's real data. Proposed plans require explicit approval before activation. Model compatibility, real conversations, safety behavior and costs must be tested after gateway configuration; no live model was called during this deployment.

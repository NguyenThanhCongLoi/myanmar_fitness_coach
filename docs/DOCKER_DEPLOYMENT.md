# Fitness Docker deployment

Target authorized by the owner: `fitness.aibinhdan.vn` → `10.1.5.13:8100`, SSH alias `myanmar-prod` (`github-runner@43.231.65.43:2213`). This is a separate deployment from AI Chat. Do not modify its compose file, Git branch, containers or Actions runner checkout. `/home/github-runner/ai-chat-deployment` is a symlink to that checkout, not an independent directory.

## Layout and persistence

- Fitness release snapshots: `/home/github-runner/fitness-deployment/releases/<UTC release>/`.
- Private server configuration: `runtime.env` and `scheduler.env` in `/home/github-runner/fitness-deployment/`, permissions 600; directory 700. Never add these to Git or an image.
- SQLite and TTS cache: `/home/github-runner/fitness-deployment/data/` mounted at `/data`. This is local disk, not Modal Volume or network storage.
- Exactly one database-writing web container, Compose project `mingalar-fitness`. A lifetime advisory lock also rejects a second launcher sharing the same data directory. Stop the old Fitness containers before replacing the release.
- SQLite DELETE journal; the existing authenticated, loopback-only persistence bridge now fsyncs both database and directory before acknowledging a write. `PRAGMA synchronous=EXTRA` in the Python startup connection is connection-local; Prisma retains its own default synchronization. The explicit bridge provides the post-transaction file and directory sync.
- On an existing database, startup makes an integrity-checked SQLite backup under `data/backups/` before migrations. Seed only when the catalog SHA-256 changes. Backups remain on the same server: this does not provide protection from disk loss; configure off-host backup separately before relying on it for commercial service.
- HTTP-only scheduler container has no database mount and only receives its cron token. All notification writes go through the same web API. It ticks hourly, with the application's opt-in/quiet-hour/idempotency checks retained.
- The owner chose **fresh user data** on the new domain. Do not import the old Modal database, user-data backup, sessions or history. The catalog seed creates exercise content only. This choice does not imply deleting old Modal backups.

## Commands from the Windows workspace

Load the private key into Windows OpenSSH agent interactively first. Never put its passphrase in scripts.

```powershell
python scripts/docker-release.py stage
python scripts/docker-release.py build
python scripts/docker-release.py configure
python scripts/docker-release.py up
python scripts/docker-release.py status
```

This host could not reach the default Debian CDN. The verified build used `python scripts/docker-release.py build --debian-mirror http://mirrors.huaweicloud.com`; Debian signed metadata/package verification remained enabled. Docker Hub's initial TLS timeout cleared on retry. No host package sources or Docker daemon configuration were changed.

Run from the product directory. `stage` packages the current working tree, including uncommitted source and owner videos, while excluding environment files, Git, caches, runtime databases, docs and evidence. It records the release in the root `evidence/docker-deployment/release.json`. Changes after staging require another stage/build. Do not claim that a staged snapshot is identical to a Git commit when source is dirty.

`build` runs the Docker verification target (migrations, seed, tests, locale contracts) then builds the runtime target from the shared build layer. No provider credentials are available during either build. No paid provider calls are part of deployment validation.

`configure` transfers the supported server settings from the owner's local `.env` through SSH stdin. Values never appear in shell arguments or logs. It overrides authentication origin and database location, creates a stable auth secret and notification token on first installation, and generates VAPID keys when absent. Later runs preserve server-generated keys and save private configuration backups. Raw Compose env-file parsing prevents `$` in credentials from being interpolated. Google/LLM/TTS configuration is retained, but configuration alone does not prove provider availability.

`up` validates Compose, stops only the Fitness project and starts the selected release, waiting for health. It does not delete or import user records. Retain previous release images and backups for recovery. For rollback, stop Fitness first, restore the selected backup if migrations are incompatible, then start the matching previous image; never start two writers or restore over a live database.

Google OAuth needs this exact authorized redirect URI in the existing Google project:

`https://fitness.aibinhdan.vn/api/auth/callback/google`

Google Console changes cannot be inferred from local configuration. Verify the redirect registration separately. The upstream proxy must retain the public Host/forwarded scheme and support the app's streaming requests.

## Verification status

2026-11-13: deployed release `20261113T041835Z`, based on Git `bd57c1850c2450397ee684315269e8bfe7be09ea` plus the working-tree snapshot at packaging time. Source archive SHA-256 `9dde7c4ed35ae7010de65b3e0a831d394f2b9e14f584cc542f28ad621beab885`. Subsequent working-tree changes are not automatically deployed. The smoke harness was corrected after staging to derive exercise IDs from the seed sources (the current catalog is 73, whereas the historical handover recorded 62); application image was unchanged by this test-harness correction.

- **PASS:** production build/TypeScript, 76 tests in 20 files, Myanmar/English locale contracts. Temporary Docker DB: signup, durable profile/plan, owner isolation, anonymous and cron 401, duplicate-writer rejection, restart/session persistence, integrity and pre-start backup. The initial smoke attempt failed a stale hardcoded catalog-count assertion; the corrected source-based check passed.
- **PASS:** public TLS `/` 200, auth options 200 with Google configured, protected bootstrap and scheduler endpoints 401 without credentials; web healthy at `10.1.5.13:8100`, HTTP-only scheduler tick 200 and no mounts. Read-only fresh production DB check: integrity `ok`, 0 users, 73 exercises. Both private env files mode 600. No test accounts were added to production.
- **PASS:** Edge/Playwright public login at 320/390/1440 px, Myanmar and English, zero horizontal overflow, page errors and failed own-origin HTTP responses; screenshots reviewed for Myanmar shaping/wrapping and desktop layout. This is browser emulation, not physical-device evidence or fluent translation certification.
- **PASS:** AI Chat Git commit/clean status, container start times/restart counts and healthy states identical before/after. No AI Chat source/workflow/compose/service changes.
- **FAIL / OWNER CONFIGURATION REQUIRED:** actual Google entry reaches `accounts.google.com/signin/oauth/error` with `redirect_uri_mismatch`. Register the exact callback URI above in the Google OAuth client's Authorized redirect URIs. Credentials transferred successfully; that does not register a new domain with Google.
- **NOT TESTED:** completed Google account login, paid LLM/TTS responses, physical devices and off-host backup recovery. No paid provider calls made.

Evidence summary is in product `evidence/docker-deployment/`; full build logs/screenshots/SSH receipts are in root `evidence/docker-deployment/`. A source review or successful archive is not a runtime pass. Do not run synthetic account tests against the fresh public database: use a disposable container and disposable data directory.

References: [Docker Compose services](https://docs.docker.com/reference/compose-file/services/), [SQLite synchronization](https://sqlite.org/pragma.html#pragma_synchronous).

# Release verification — 2026-11-12

## Gym mechanics — local only, 2026-11-13

PASS:84 tests/23 files, locales/build/TypeScript. Existing remote helper with `FITNESS_BUILD_STATE=gym-review-build-sandbox.json`, profile `lointc`, builder `2025.06`, `PYTHONUTF8=1`; standard migrate/seed/test/locales/build commands. Source upload was scoped to code/config/tests/Prisma and the leg-press fixture video/poster; this is not full media-catalog QA.

Existing Playwright CLI: `-s=gymreview open '<disposable-preview-url>' --browser=msedge`, then `-s=gymreview --raw run-code --filename myanmar-fitness-coach/scripts/qa/gym-mechanics-review.js`. PASS: work countdown/pause/hold-at-zero, manual confirmation, rest countdown, load carryover and actual RIR/reps/load persistence with75% completion. No deployment performed. See `docs/GYM_MECHANICS_REVIEW.md`, `evidence/gym-review/`.

## Intake save / live language switching — 2026-11-13

PASS: 82 tests/22 files, locale contracts and production build/TypeScript in the isolated released-source snapshot (unrelated working player/audio changes excluded). Workspace helper accepts `FITNESS_SOURCE_DIR`; this run used `evidence/intake-save-source`, `FITNESS_BUILD_STATE=intake-save-build-sandbox.json`, `MODAL_PROFILE=lointc`, `MODAL_IMAGE_BUILDER_VERSION=2025.06`, `PYTHONUTF8=1`. Standard remote commands: `npm ci --no-audit --no-fund && npx prisma generate && npm run db:migrate && npm run db:seed && npm test && npm run check:locales && npm run build`, then helper `serve`.

Browser: existing Playwright CLI `-s=intakesave open '<disposable-preview-url>' --browser=msedge`, then `-s=intakesave --raw run-code --filename myanmar-fitness-coach/scripts/qa/intake-save-review.js`. PASS: real Home/Gym saves and reload; removed captions/step; failed-save language switches and 12 responsive/theme/language cases with no duplicate toast, overflow or page errors. The forced503 is an explicit UI test, not a backend outage. See `docs/INTAKE_SAVE_FIX.md`, `evidence/intake-save/`. No production test account or paid provider call.

## Single-question intake / video collections — 2026-11-13

PASS: 80 tests/21 files, locale contracts and production build/TypeScript in an isolated Modal sandbox. Scope `MODAL_PROFILE=lointc`, `MODAL_IMAGE_BUILDER_VERSION=2025.06`, `PYTHONUTF8=1` and `FITNESS_BUILD_STATE=intake-build-sandbox.json`. Workspace `scripts/product-remote.py`: `start`, then `exec 'npm ci --no-audit --no-fund && npx prisma generate && npm run db:migrate && npm run db:seed && npm test && npm run check:locales && npm run build'`, then `serve`. Do not stop another sandbox state.

Existing Playwright CLI: `node '<installed-playwright-cli.js>' -s=pickerqa open '<disposable-preview-url>' --browser=msedge`. Run `-s=pickerqa --raw run-code --filename` with these product scripts in order: `scripts/qa/intake-review.js`, `scripts/qa/player-preview-review.js`, `scripts/qa/intake-layout-review.js`, `scripts/qa/intake-touch-review.js`. They reject production origins; the first creates a disposable account and the others reuse it. PASS: single-question intake and exact saved measurements; Home19/Gym32; red Start; bilateral video during rest and actual seconds; 36 picker layout cases; native CDP touch pan and bounds. Handover: `evidence/intake-release/`, `docs/TRAINING_INTAKE_RELEASE.md`. Physical phones, fluent Myanmar review and clinical effectiveness NOT TESTED.

## Independent Docker deployment — 2026-11-13

From the product directory, with the SSH key unlocked in Windows OpenSSH agent:

```powershell
python scripts/docker-release.py stage
python scripts/docker-release.py build --debian-mirror http://mirrors.huaweicloud.com
python scripts/docker-release.py configure
ssh myanmar-prod "python3 /home/github-runner/fitness-deployment/releases/20261113T041835Z/infrastructure/docker/smoke.py mingalar-fitness:20261113T041835Z"
python scripts/docker-release.py up
python scripts/docker-release.py status
```

The smoke command above is the exact verified release, not a floating latest alias. Replace both identifiers with the newly staged release for subsequent deployments. **PASS:** build/TypeScript, 76 tests/20 files, locales; disposable DB signup/profile/plan, owner isolation, protected routes, duplicate writer rejection, restart/session persistence, integrity and pre-start backup. The original smoke count assertion used a historical 62; corrected harness compares source seed IDs and passes with 73 exercises. Temporary containers/data cleaned up; no production synthetic accounts.

Public verification: root HTTPS 200, auth options Google configured, anonymous bootstrap and notification POST 401. Production read-only DB integrity ok, 0 users / 73 exercises at check; env files 600; scheduler has no volume and its authenticated tick returns 200. AI Chat before/after receipts match commit/status, start times, restart counts and healthy states.

Browser (workspace root, installed Playwright CLI with Edge):

```powershell
node '<installed-playwright-cli.js>' -s=fitnessdeploy open https://fitness.aibinhdan.vn --browser=msedge
node '<installed-playwright-cli.js>' -s=fitnessdeploy --raw run-code --filename myanmar-fitness-coach/scripts/qa/docker-deployment-review.js
node '<installed-playwright-cli.js>' -s=fitnessdeploy --raw run-code --filename myanmar-fitness-coach/scripts/qa/docker-google-entry-review.js
```

**PASS:** public login MY/EN at 320/390/1440, zero overflow/page errors/failed own-origin responses; screenshots reviewed for Myanmar shaping/wrapping and desktop layout. **FAIL:** Google entry reaches provider `redirect_uri_mismatch`; owner must register `https://fitness.aibinhdan.vn/api/auth/callback/google`. No account login/consent performed. **NOT TESTED:** completed Google login, paid LLM/TTS responses, physical devices, off-host recovery. Full evidence root `evidence/docker-deployment/`; sanitized summary inside product at the same relative path. See `docs/DOCKER_DEPLOYMENT.md` for isolation, persistence and rollback limits.

## Video creator kit / credit placement — 2026-11-13

PASS: 76 tests, locale contract and remote production build after removing inline player credits. Preview-only synthetic account checks: credits absent from the guided player at 320/390/1440px, no overflow/page errors, full author attribution still reachable via Profile → Credits & licences. No synthetic production accounts were created following the requested user-data wipe.

`python scripts/video-reference-kit.py` exports 62 IDs (35 home-capable / 27 gym equipment), 90 byte-identical images for 44 exercises, and an explicit 18-image gap list. PASS: ZIP CRC, unique IDs and all image SHA-256 values. `scripts/qa/video-kit-review.js` on a localhost-only static server decoded all 90 images, checked filters 35/27/18/62 and ID search, and verified 320/390/1440px overflow=0. The CLI blocks `file://`, so runtime verification used localhost; direct file opening in other browsers is NOT TESTED. No external assets are required to render the packaged gallery. Source/reference links are explicit and optional.

Heavy checks ran in an isolated CPU Modal sandbox using profile `lointc`, workspace `avibigateway`, active environment `main`, disposable SQLite, no customer Volume or provider keys. Workspace orchestration is `../scripts/product-remote.py`: `start`, `sync`, `exec '<command>'`, then `serve` only after build completion. Do not rebuild while reviewing a running preview: restart `serve` after the build. Targeted source sync was used during iteration; final public audio was fully synchronized and decoded with ffprobe (205.139625s / 6,566,713 bytes).

In this workspace's PowerShell, set `$env:MODAL_PROFILE='lointc'` and `$env:MODAL_IMAGE_BUILDER_VERSION='2025.06'` before Modal commands. The installed client does not support the workspace's newer default image-builder version; the read-only Volume check passed after selecting the supported builder explicitly.

Verified Linux commands:

```sh
npm ci --no-audit --no-fund
npx prisma migrate deploy
npx prisma generate
npm run db:seed
npm test
npm run check:locales
npm run build
ffprobe -v error -show_entries format=duration,size -of json public/audio/carefree.mp3
```

PASS: 76 tests / 20 files. New checks cover adaptation, repeated plan reads, idempotent weekly close, owner isolation/injected identity, actual rep completion, warm-up exclusion, missing RIR, two-session load confirmation and protection/equipment filters. The expected invalid-OAuth-state test logs a rejected state; this is not a failed authentication test.

After a post-deploy cold-navigation timeout, startup seeding was batched into one transaction and gated by a persisted source hash. Fresh and repeated disposable seeds both retained 62 exercises / 36 demos (211ms / 207ms); the full 76 tests, locale contracts and production build passed again. Actual customer-Volume seed took 2594ms. Separate read-only verification confirms the persisted seed stamp matches source, both new schema columns exist, and the pre-release backup has integrity `ok`. These are seed timings, not promises about complete cold HTTP startup. Browser follow-up navigates a clean canonical URL to discard stale provider retry queries.

Browser uses the existing Playwright CLI with Microsoft Edge (no new test runner). From the workspace root:

```powershell
node '<installed-playwright-cli.js>' -s=solaris open '<disposable-preview-url>' --browser=msedge
node '<installed-playwright-cli.js>' -s=solaris --raw run-code --filename scripts/solaris-browser-onboarding-v2.js
node '<installed-playwright-cli.js>' -s=solaris --raw run-code --filename scripts/adaptive-browser-check.js
node '<installed-playwright-cli.js>' -s=solaris --raw run-code --filename scripts/solaris-browser-review.js
node '<installed-playwright-cli.js>' -s=solaris --raw run-code --filename scripts/adaptive-player-review.js
```

Copies of these browser scripts are shipped in this repository's `scripts/qa/`. They use synthetic accounts/current authenticated preview, never real customer records. Onboarding must run before adaptive checks. They reject non-preview origins. Evidence JSON and selected screenshots are in `evidence/adaptive-release/`; the full working evidence remains at workspace `../evidence/`.

PASS: complete 21-step signup/intake, review edit and reload; adjust today's minutes/lightness; explicit weekly close; 10-second countdown; countdown/rest pause behind quit sheet; actual local licensed music playback; two logged timed sets; controlled-form feedback; calendar displays actual 100%; repeated read remains at same step. Home checks wait for actual adaptive content, not skeletons. 28 tab/layout/font cases cover English/Myanmar, light/dark, 390px plus 320/1440px home; no overflow/page errors. Player has a separate video/viewport regression after fixing aspect-ratio-driven overflow.

Live deployment smoke uses workspace `scripts/product-http-smoke.py <url>`: synthetic signup, Unicode, plan/set persistence, owner isolation, idempotency, unauthorized access and no paid LLM request. `scripts/product-volume-check.py` checks committed SQLite integrity and the synthetic records from a separate read-only container. It never creates another writer. See release notes for actual live outcomes.

NOT TESTED: physical iOS/Android devices, native fullscreen support on each OS, fluent Myanmar translation/voice approval, paid LLM/TTS responses, clinical effectiveness. Device speech availability depends on installed voices. A browser clip decode is not a trainer technique approval.


## Functional workout release (2026-11-13)

Use the existing product-remote.py helper with FITNESS_BUILD_STATE=functional-build-sandbox.json and FITNESS_SOURCE_DIR pointing to the frozen release. Keep test and browser databases separate. Verified remote command:

```sh
export DATABASE_URL=file:/tmp/functional-clock-verification.db && npm run db:migrate && npm run db:seed && npm test && npm run check:locales && npm run build
```

PASS91 tests/26 files, locales, TypeScript and production build. Generate mobile variants on remote CPU only with `python scripts/prepare-mobile-video.py`; FFmpeg is needed for regeneration, not runtime. `python scripts/audit-workout-media.py` checks registered source assets/provenance/codecs.

Using the installed Playwright CLI and a disposable *.w.modal.host preview, run --raw run-code --filename for scripts/qa/{functional-onboarding,functional-gym-intake,functional-player,functional-entries,gym-mechanics-review,functional-slow-media}.js. These scripts guard against production test accounts. Slow-media uses actual CDP throttling and always restores network conditions. See evidence/functional-review/*.json and FUNCTIONAL_RELEASE.md for results/limits. Existing analytics tests aggregate the test DB, so do not run them against the browser-preview DB.

After stop-before-deploy on existing Modal profile lointc / main, run scripts/verify-functional-volume.py with FITNESS_SOURCE_DIR set to the exact deployed snapshot. It mounts the Volume read-only and checks source-matching seed, backup integrity and user/session/set/profile/measurement ID preservation without printing personal IDs.

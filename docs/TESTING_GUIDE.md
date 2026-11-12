# Release verification — 2026-11-12

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

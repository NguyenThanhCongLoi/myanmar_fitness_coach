# Functional workout release — 2026-11-13

Initial findings: [FUNCTIONAL_AUDIT.md](FUNCTIONAL_AUDIT.md). UI/API handover: [WORKOUT_INTERFACES.md](WORKOUT_INTERFACES.md). This release improves existing functionality and retains the current visual system.

Implemented: explicit Gym equipment and optional movement preferences in single-question onboarding; shared eligibility across plans/quick/recommendations/start; capability based on experience/activity/screening/feedback rather than BMI; deterministic weekly/history selection preferences; honest focus fallback; dynamic recovery and duration accounting; shared sequence order; personalized individual/recommended previews; owner-scoped interrupted playback checkpoints; idempotent start retries; observed duration and completion persistence; bounded next-video/audio preparation; cancel-safe voice with cache-only provider access; persistent music volume/mute and ducking. Low step up remains excluded from new collections/plans.

## Evidence so far

- Final frozen-source remote pass: 91 tests / 26 files, English/Myanmar locale contracts, production build and TypeScript. Tests use a separate disposable database from browser QA; an earlier shared test/preview DB polluted an analytics fixture and was corrected by isolation, without relaxing assertions.
- Actual Edge 390×900 browser: first-time Home onboarding and reload; required choices; saved height170/weight70/preferences; Home no-jumping selection; Gym retake with explicit machine-only equipment and Myanmar switching; Quick15/20/30 preview; banner/individual/recommended starts through the same player.
- Actual timed player: paired Bird Dog left/right → next plank, automatic work/rest, rest restored at10 after reload/pause; three real timed sets saved,100% completion,49 observed seconds, no duplicate reward. Local Pump MP3 decoded/looped while a synthetic WAV cue exercised music ducking. No paid provider was called.
- Media inventory records all73 catalog entries with file existence, hashes, equipment, labels and provenance. Separate right-side Bird Dog file is absent. High plank metadata correction follows observed owner footage; other technique remains unreviewed.

## Final verification

- **PASS:**91 tests/26 files, locale contracts, production build/TypeScript; asset-hash and no-paid-TTS-fetch tests included.
- **PASS:** final browser entrypoints, paired automatic player, exact rest reload/pause, Gym countdown6 to 5 and0 awaiting actual Done; real50kg/RIR2 then45kg/RIR0,75% completion; music volume/mute and load carry-over. No browser page exceptions.
- **PASS:** 19 owner-source clips have additional H.264 baseline mobile encodes (max360px width,24fps,1-second keyframes,faststart). Originals remain unchanged. Combined Home bytes27,772,869 to 3,782,885 (86.4% smaller). Use low-data/Save-Data/slow connection; high-quality originals remain the default on fast connections. All50 eligible source videos have posters and H.264 encoding.
- **PASS:** Edge/CDP at180ms latency and50,000bytes/s, cache disabled: original first playable6,616ms, two-movement journey72,977ms; low-data first playable2,341ms, journey42,094ms. Exactly the current/next two videos requested; no320px overflow;100% saved completion. This is a measured emulation, not a zero-latency or physical-device guarantee. Work counts only playable time and retains fractional seconds across buffering.
- **NOT TESTED:** fluent Myanmar/spoken-language quality, physical iOS/Android, clinical effectiveness, paid TTS/model calls, and a separate right-side Bird Dog recording. The current right-side demonstration mirrors the owner clip. MP3 looping uses the browser loop mechanism; sample-perfect gapless playback is not certified.
- **PASS:** deployed frozen source `3590471` to the existing Modal POC (`lointc` / `main`). Both canonical/regional home URLs return200 and unauthenticated `/api/fitness/bootstrap` returns401. Live mobile Bird Dog bytes/hash match the release; cache header is `public, max-age=3600, must-revalidate`. Live web statistics show one runner; static maximum remains one and the scheduler has no database mount. No data reset or Docker/AI Chat changes.
- **PASS:** separate read-only Volume check: database and pre-release backup integrity `ok`, source-matching seed stamp,73 exercises and corrected High plank mapping. All pre-release IDs preserved:1 user,1 profile,3 sessions,25 sets,1 measurement. Receipt: `evidence/functional-review/{live,volume,deployment}.json`.

## Requirement disposition

All requested software flows have implemented shared logic and recorded verification. Asset requirement4 remains PARTIAL because a separate Bird Dog side recording is absent. Voice/language quality and hardware-specific behavior retain the explicit NOT TESTED limits above. Deployment and preservation receipts are recorded. See the initial matrix for before-state findings and WORKOUT_INTERFACES for integration details.

The first deployment build passed but registration collided with a concurrent build sandbox that had claimed the same app name. Confirmed that named app had no web function, then attached the cached release without stopping the independent sandbox. The prior writer had already been stopped. Temporary release `.env` was removed after both attempts; it was excluded from Git/image. No production test accounts were created by this verification.

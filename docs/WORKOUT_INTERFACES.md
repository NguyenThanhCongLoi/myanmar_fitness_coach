# Workout integration contract

Updated 2026-11-13. Preserve existing visual classes, StartBar and the two ExerciseDetail sections. All POC features remain free. No new dependencies or external providers.

## Shared data

`src/shared/workout-contracts.ts` exports Exercise, ExerciseSet, WorkoutSession, WorkoutPlan, RestInterval, WorkoutPlayerState, VoiceCoachEvent and PlaybackProgress. Existing `shared/types.ts` and `shared/plan.ts` remain compatible. `WorkoutPlan` here means one generated training day; the existing Plan response wraps its week/schedule/decision metadata.

`workout-policy.ts` is the hard collection/equipment/recognized-restriction boundary. `plan.ts` owns bounded volume and duration; `training-profile.ts` owns conservative profile-based starting step/rest/budget; `workout-sequence.ts` owns straight-set/circuit/Bird Dog ordering; `workout-timing.ts` owns rep estimates and set/transition/round rest allowances. Stable IDs never use localized exercise names.

## Preview and start

Authenticated `POST /api/training/quick-plan`:

```json
{"focus":"all","minutes":20,"location":"home","exerciseId":"curated-bird-dog","single":false}
```

`exerciseId` and `single` are optional. Durations are exactly 15/20/30. Focus supports all/upper/legs/core/cardio; an unsupported focus returns `NO_EXERCISE_MATCH`. Explicit single exercises may include a preparation movement; automatic strength selection excludes preparation. Recommendations use muscle overlap and complementary movement patterns, filtered by actual equipment and experience. Preview uses the adaptive daily planner and historical Gym load service, without increasing load when the adaptive decision blocks it.

Response retains PlanDay/items/minutes plus seconds/requestedMinutes/location. Show actual estimated time, not the requested ceiling. A shorter conservative beginner session is valid. Empty/unsupported libraries are honest unavailable states.

Existing `POST /api/training/free` accepts preview items as prescriptions. `requestId` is an additive optional idempotency key, owner scoped and transactionally mapped to the created session. The shared client retains it across a failed start retry. Concurrent unrelated starts still return `ACTIVE_WORKOUT_EXISTS`; never create two active sessions. Home timed Bird Dog requires an even number of side blocks.

Daily plan, banner, Quick, Try and recommended sets all enter GuidedPlayer. Legacy Free/Follow screens and APIs remain for compatibility with historical/custom sessions; no new listed entrypoint builds a competing playback routine.

## Progress and completion

Authenticated owner-scoped `GET/POST /api/training/sessions/:id/playback` reads/writes a version-1 PlaybackProgress checkpoint, stored in existing AiMemory with key `playback:<session>`. Strict validation checks prescription/set membership. Increasing sequence numbers ignore older retries. Local storage is keyed by owner/session; the server commits before acknowledging a checkpoint. No database migration is required.

The player records each observed second locally and flushes every five seconds, on hidden/unmount, and before completion. Reload pauses the exact saved work/preparation/rest phase; disconnected time never fabricates exercise. Browser-local recovery is most precise on the same device; another device may lose up to the last five seconds. Completed sets remain authoritative in SQLite. Checkpoints are not completion credit. A failed finish exposes a retry instead of looping submissions.

Home timed work advances automatically. Gym timers show an estimate (three seconds per rep, both sides when indicated); zero waits for actual Done/reps/load/RIR. Never auto-log presumed Gym reps. Rest previews the next side/exercise and advances automatically. Duration includes initial preparation, actual work estimates, per-set fatigue allowances, exercise transitions and circuit-round allowances. Pauses/disconnected intervals are excluded from the recorded observed duration. This is a product estimate, not a prescribed movement tempo.

## Media/audio

Current and at most one next clip are prepared; save-data/2G uses next metadata only. The current work timer waits for playable media. Posters stay visible during buffering. Owner Home footage has19 optional mobile derivatives, selected by the existing mingalar-lowdata preference, Save-Data or a slow connection; identity and originals are preserved in video-variants.json and the mobile-video receipt. useActiveClock accumulates fractional playable time across interruptions. HTTP video caching revalidates stable asset paths; do not indiscriminately cache the entire library or persist private API responses in a service worker.

Existing TTS provider and device fallback remain. Workout cues request `cachedOnly=1`: cache misses cannot call the configured paid gateway or model-discovery endpoint, and fall back to device speech. Myanmar device speech falls back to English if the OS lacks a Myanmar voice. Request-generation guards cancel stale speech on pause, language changes, mute and unmount. Blob audio cache is bounded to 24 entries and revokes evicted URLs. Prepare only current/next names plus short shared cues. Summary/other existing voice APIs retain their separate explicit behavior; tests never contact paid providers.

One shared local music element survives transitions. Volume and selection persist locally; voice ducking multiplies the chosen volume and cancellation restores it. Music settings pause the workout while open and restore the prior pause state. A user-selected track can change; normal exercise/rest transitions never reload the track. Browser autoplay restrictions can still require a Start gesture.

## Known asset boundary

Verified local inventory: 19 Home files, 31 eligible Gym files after excluding Low step up. Only one Bird Dog owner file exists; opposite side is mirrored, always paired. A separate owner-supplied right-side file is still needed for a true separate-camera demonstration. The High plank correction retains stable ID `curated-plank` and adds `wrist-loaded`; its previous forearm label/instructions mismatched the supplied footage. All demonstrations and provisional Myanmar text still require qualified human review; metadata/codec validation is not certification of exercise technique.

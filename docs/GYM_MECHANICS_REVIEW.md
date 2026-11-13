# Gym mechanism review — local changes, 2026-11-13

Gym follows straight sets: preparation → work → user confirms actual reps/weight → planned rest/next video → next set or exercise. Home timed circuits keep their existing automatic timed-block completion.

Fixed locally:

- Gym work displays remaining estimated seconds instead of elapsed minutes. The estimate shares the planner's existing3 seconds/rep and includes both sides where applicable. It is a planning estimate, not a required lifting cadence. At0 it holds and asks the user to finish when ready; it never auto-logs a rep-based set. The action is Done rather than Next.
- Pause, hidden tab, quit sheet, edit modal and pending save stop the Gym counter. Actual reps/weight remain editable before confirmation.
- The last recorded load of the same exercise carries into the next set, including after reload. Each new exercise starts from its own prescribed/history value. RIR resets each set and is now optionally selectable in the edit modal; it is never inferred from the timer.
- Shared duration calculation counts unilateral work. After main-plan progression changes reps, duration is recalculated and sets/exercises trimmed with the same existing time-ceiling policy, so the displayed minutes and selected budget remain consistent.

Verified existing rules: Gym uses equipment/video eligibility, personal-goal reps, profile-aware rest, and straight sets. Main-plan weight suggestions use owner-scoped history. Load increases require two suitable performances, sufficient reported reps in reserve, good technique, and no pain/hard-training signal; timer expiry alone never increases load. First-time load0 is uncalibrated and must be chosen by the user. Quick workouts currently build their own session and do not apply the main plan's historical load suggestions; this source-inspected limitation is retained, not reported as fixed.

PASS:84 tests/23 files, locales, production build/TypeScript in an isolated Modal test sandbox using disposable SQLite and no customer Volume/provider credentials. Includes bilateral timing and post-progression budget regression.

PASS: real browser machine session:6→5 countdown, pause frozen,0 holds without a saved set, manual Done,10→9 rest,50 kg retained for set2, optional RIR2 then0 recorded separately. Actual sets were2 reps at50 kg and1 rep at45 kg; completion75%, not a fabricated100% from timer expiry. No page errors. Video screenshot reviewed at390×900. Runtime script `scripts/qa/gym-mechanics-review.js`; evidence `evidence/gym-review/`.

NOT TESTED: physical devices, all Gym movement videos, clinical suitability or fluent Myanmar translation certification. Source test snapshot includes existing uncommitted player/audio work; no production deployment, Git push or customer-data write was performed for this request.

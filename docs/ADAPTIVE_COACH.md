# Adaptive coach and visual system

Implemented policy is deterministic and inspectable. It is not a proprietary reproduction of another app, medical treatment or a body-shape prediction.

## Intake → training

The illustrated intake captures current/desired waist and glute shape, optional measured circumference, priority areas, goal, sex (optional), age, height, weight/target, activity, place, actual equipment, experience, schedule, available minutes, movement protections and separate health answers. Review allows editing before saving. Current shape is self-description; the app does not infer body fat from an illustration. Whole-body balance remains mandatory; priority muscles break ties between suitable choices rather than removing supporting movements. No promise of spot fat reduction.

## Decisions

Actual strength completion is logged reps / prescribed reps, capped per set; timed completion uses actual logged seconds / planned seconds. Missing sets count zero. Rest/paused time does not create completion. Warm-ups do not increase work completion. After a session the app asks difficulty, pain, form quality; gym sets can record reps in reserve (RIR).

Each programme week records an immutable base step and planned count. Re-reading the plan re-evaluates from that base and cannot compound increases. Pain, poor form, excessive difficulty, low completion, poor self-reported recovery or a break of seven days can lower the step once. A stop due to lack of time is not treated as inability. The user can shorten or lighten today's routine without rewriting previous logs.

An increase requires at least two sessions ≥90% with explicit controlled-form feedback, ≥75% of planned sessions completed, a request for harder work/easy feedback, and no recovery/pain/screening blocker. Maximum one step per week assessment. Logged low intake/hydration can block increases; absent logs never count as low intake and overeating never earns punishment exercise. The 70%-of-estimate food and 750ml logged-water gates are conservative product heuristics about incomplete self-reported data, not physiological thresholds. They should be calibrated in POC review.

Weekly check-in captures energy, sleep, soreness (1–5, labelled low/high), preference and minutes. Explicitly closing a week can include missed sessions, preserves history and advances once using an optimistic transaction. Repeating the same close is idempotent. All queries and writes use authenticated owner identity. Changing programmes retains each programme's position.

Gym double progression requires two same-load top-range performances, explicit RIR≥2 and controlled-form/no-pain feedback before adding the smallest available increment. If that increment exceeds 10%, hold the load. Avoid increasing programme dose and load together; recovery blockers hold load increases. Suggestions remain editable. New users start unloaded/light rather than inventing a safe personal weight. Existing step tables and exercise restrictions still apply.

## Placement and charts

Reference: author's FitnessUIUX demo and stakeholder screenshots; see SOLARIS_UI_REFERENCE.md for REA evidence. White canvas, hairline cards, SUSE/Open Sans with Noto Sans Myanmar, larger controls, orange primary action. Home: greeting/streak → daily and recorded-week average rings → today's workout and week → adjustments/check-in → coach → training shortcuts → activity/nutrition/hydration breakdown and seven-day history. Progress has an interactive 12-week calendar, weekly sets/volume, strength estimates, records, muscle balance/recovery and existing photos. Missing records are not fabricated observations.

Series: training green `#08A54C`, water cyan `#08B6D5`, food orange `#FC7A1E`, strength indigo `#5261A1`, photos violet. Dark-mode tokens are separate. Status colours are accompanied by numbers/text. History uses an orange area with thin line; volume uses indigo bars. This adapts visual patterns; no paid template source or demo photographs are copied. Rest/recovery preserve the training streak; existing optional protections remain enabled as user-configured.

## Sources reviewed

- [Freeletics session adaptation](https://help.freeletics.com/hc/en-us/articles/360003933780-Adapt-your-Bodyweight-training-session): practical adjustments for time, equipment and difficulty.
- [Freeletics feedback](https://www.freeletics.com/en/blog/posts/coach-feedback/): performance and technique feedback as distinct inputs.
- [Fitbod sets, reps and weights](https://help.fitbod.me/hc/en-us/articles/43489869175063-How-does-Fitbod-decide-my-sets-reps-and-weight): history/RIR-informed programming. Our rules are original and bounded, not its undisclosed algorithm.
- [Nike Training Club](https://www.nike.com/help/a/ntc-info/app): guided trainer video, programmes and recovery content.
- [Apple Fitness+ audio controls](https://support.apple.com/guide/fitness-plus/customize-experience-a-workout-meditation-apd12f665e17/ios): trainer/music balance and cues.
- [ACSM progression position stand](https://pubmed.ncbi.nlm.nih.gov/19204579/): gradual progression after demonstrated capacity. Product-specific weekly thresholds above are implementation choices, not a validated clinical model.
- [Incompetech Carefree](https://wwww.incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1400037): creator identifies 96 BPM and CC BY 4.0. Attribution is shown when music plays; MP3 hosted locally. Existing original procedural calm/focus/energy tracks remain available in other players.

No claim that any app is ranked number one. No AGPL source incorporated. Existing immutable source/license audit remains in MODULE_AUDIT.md. No paid model/TTS call is needed for these deterministic features. Guided speech uses device voices and shows an unavailable message when Myanmar speech is absent. Live server coach/voice configuration remains a separate user-controlled integration. Fluent Myanmar translation and spoken quality still need review.

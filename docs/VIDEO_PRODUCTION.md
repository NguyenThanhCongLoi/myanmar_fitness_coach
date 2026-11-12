# Creator handover

Run `python scripts/video-production.py` to regenerate `VIDEO_SHOT_LIST.csv`. It lists every current exercise using stable IDs, home/gym equipment, muscles, side handling, setup instructions and common mistakes. P1 means no existing demo; P2 replaces a licensed, unreviewed demo. This is a production backlog, not a claim that all clips already exist.

For each ID deliver:

- `ID-loop.mp4`: 8–15 seconds, 2–3 controlled repetitions, neutral start/end pose for looping. Hold exercises show correct static positioning. No burned-in timer or background music.
- `ID-follow.mp4`: 30–60 seconds, trainer follows a steady sustainable pace. For unilateral movements, create a version for each side and an explicit switch cue; never double the prescribed dose silently.
- `ID-poster.webp`: clean start pose, same framing, 1200px longest edge. Two extra WebP stills show setup and end position.
- Shoot a 9:16 master at 1080×1920, plus 16:9 wide where possible. Keep the entire body/equipment and floor contact visible in the centre safe area. Export H.264 MP4, yuv420p, faststart, 24–30fps. No quick cuts, camera moves or excessive retouching.
- Gym: show seat height, pin/plate loading, safety stops, grip, entry and exit. Home: show stable chair/bench/mat and available floor space. Add regressions for beginners only after trainer review.
- Record clean instructions separately, English and native Myanmar. Countdown 10–1, begin, side switch, rest, next movement, stop if pain, finish. Include transcript, voice/performer rights and pronunciation review. Device speech currently supplies free cues where the browser has a matching language voice; missing Myanmar voices are shown honestly.

Have a qualified trainer review breathing, range, joint alignment, tempo and common mistakes for every clip before marking it reviewed. A generated video can look plausible while demonstrating unsafe technique. Obtain performer/model release and ownership or suitable commercial permissions. Do not use the ThemeForest demo assets.

## Wiring approved assets

Place approved files in `public/exercises/original/`. Add entries to `prisma/exercise-media-original.json`:

```json
{
  "dataset-3013": {
    "videoUrl": "/exercises/original/dataset-3013-loop.mp4",
    "thumbnailUrl": "/exercises/original/dataset-3013-poster.webp",
    "mediaSource": "Owner-produced; performer release and trainer approval DATE",
    "license": "Owner-owned",
    "page": "internal production record ID",
    "steps": {}
  }
}
```

Seed merges these entries last, retaining stable IDs and existing exercise labels. The guided player currently consumes the loop URL; longer follow files are a deliverable for subsequent synchronized trainer playback, not an automatic replacement with a fixed duration. Actual set timers and reps remain controlled by the app. Do not invent URLs for missing videos.

## Movement combinations

Balance squat/lunge (quads/glutes), hinge/bridge (posterior chain), push (chest/triceps), pull (back/biceps), core stability and low-impact conditioning. Home example: squat + bridge + push-up regression + available row + dead bug; gym: leg press + reviewed hinge + chest press + seated row + core. Alternate lower/upper and harder/easier work; do not put every glute exercise together just because glutes are a goal. A waist goal does not guarantee local fat loss. Existing movement-pattern and muscle-balance rules choose compatible eligible exercises, preserve equipment/level/protection constraints and flag excessive arm/abs concentration.

Volume, time and substitutions are estimates. Review real completion, form, RIR, pain and recovery before progressing; rest days preserve training streaks. Review the CSV instructions against each actual video before release.

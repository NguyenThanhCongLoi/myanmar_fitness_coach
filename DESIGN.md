# Mingalar Fit — DESIGN.md

Single source of truth for colour, type, spacing, components and motion. Tokens live in
`src/app/polish.css` (CSS variables, light + dark) and are exposed to Tailwind/shadcn in
`src/app/tailwind.css` (`@theme inline`). Change a value here and in `polish.css` together.

Direction: **Stone & Lime** (2026-11-12, after the Stride / Block / Fitera references) — a warm
stone canvas, white cards that float on it, forest-black ink, and ONE accent: lime, reserved for the
primary action, the active tab, today and completion. Each screen has exactly one dark "stage"
element (the today card, the gym guide banner, the current plan tile); everything else stays quiet.
Premium and calm, never neon, Myanmar-first.

## 1. Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#F3F2EC` | `#0E1311` | page background (`bg-background`) — stone, so white cards lift |
| `--surface` | `#FFFFFF` | `#161C19` | cards, sheets (`bg-card`) |
| `--surface-2` | `#ECEBE4` | `#1F2622` | wells, chat lines, segmented controls (`bg-muted`) |
| `--ink` | `#0F1F1A` | `#F1F4F0` | text, current-day dot, selected chips (`text-foreground`) |
| `--muted` | `#6B7770` | `#97A39C` | secondary text, date line (`text-muted-foreground`) |
| `--line` | `#E3E2DA` | `#273029` | hairline borders, tracks (`border-border`) |
| `--forest` / `--forest-deep` | `#163D35` / `#0C2420` | `#1B2B26` / `#0A1512` | the stage: today card, gym tile, banner, current plan (`bg-brand`) |
| `--lime` | `#C9F46D` | `#C9F46D` | primary CTA, active tab pill, completed day, current-plan tag (`bg-primary`) |
| `--on-lime` | `#0F1F1A` | `#0F1F1A` | text on lime (contrast ≈ 11:1) |
| `--sun` | `#F4CF5A` | `#F4CF5A` | milestones only |
| `--sky` `--coral-soft` `--lavender` `--mint` | muted tints | — | legacy only (icon wells); not for card backgrounds |

**Icons**: an icon never floats bare on a card — it sits on a 40–44 px disc tinted ~10 % of its own
colour (forest for choices and navigation, the data colour for water / food / training / photos),
with a 1 px border of the same tint. Selected or primary = lime disc with ink icon. On dark tiles the
disc is white 16 % glass. **Backgrounds**: stone canvas, white→ivory gradient cards (`--card-bg`)
with a 1 px top highlight and one soft shadow; dark "stage" surfaces use a top-left radial sheen +
a diagonal gradient + a bottom vignette (`.train-card`, `.today-hero`, `.feature-banner`).

Training tiles are tonal dark surfaces (`#1F3F4A` home, forest gym, `#2D3A26` quick, `#232A33`
build) with a bottom gradient, ready for a photo (`background-image` on the tile).

**Data colours** (charts, streak grids, rings) — validated with the dataviz palette validator
(lightness band, chroma, CVD separation, contrast: 5/5 PASS in both modes). Never invent new ones;
a 5th series folds into "other".

| Token | Light | Dark | Meaning |
|---|---|---|---|
| `--c-train` | `#1E8A5A` | `#27A36A` | training |
| `--c-water` | `#2F7FD1` | `#4A95E0` | water |
| `--c-meal` | `#D9573F` | `#E06A52` | food / calories |
| `--c-photo` | `#8A63D2` | `#A07DDC` | meal photos |

**Status / completion %** (always with the number or an icon, never colour alone):
`--st-great` ≥100 %, `--st-good` 80–99 %, `--st-warn` 50–79 %, `--st-low` <50 %, `--line` = no data.
Rest days are never shown as failure.

Rules: lime is for the ONE primary action per view and for "done/selected"; forest for brand
surfaces; tints only to separate activity types. No purple/blue glow gradients, no neon, no pure
black, no glassmorphism. Gradients only as a subtle sheen on lime buttons and forest cards.

## 2. Typography

- Headings: **Plus Jakarta Sans** 700/800 (`font-heading`), letter-spacing −0.02 to −0.03 em.
- Body, numbers, UI: **Inter** 400/600 (`font-sans`), `tabular-nums` for timers, counts, weights.
- Burmese: **Noto Sans Myanmar** (fallback in both stacks). Burmese line-height ≥ 1.6, no negative
  letter-spacing (`:lang(my)` resets it); never clip stacked diacritics; check wrapping in a browser.

| Role | Size / weight |
|---|---|
| Hero / screen title | 28–32 px / 800 |
| Section title | 20–22 px / 800 |
| Card title | 16–18 px / 700 |
| Body | 14–16 px / 400 (inputs ≥ 16 px on mobile) |
| Supporting | 12–14 px / 400 |
| Small label | 11–12 px / 600 (sentence case; no all-caps labels except the existing overline) |

## 3. Spacing, radius, elevation

- 4 px grid: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48. Use `gap`, not stacked margins.
- Screen gutter 16–18 px on mobile; content max-width 760 px mobile/tablet, 1040 px ≥ 1100 px.
- Radius tiers encode hierarchy: `md 14` inputs · `lg 18` tiles (stat, quick, media) · `xl 24` cards · `stage 28` the hero card and sheets · pill `999` buttons, chips, tabs.
- Elevation: cards are flat with a hairline (`--line`); only the stage card (`--sh-stage`) and the lime CTA (`--sh-lime`) cast a shadow.
- No all-caps labels, no "A · B · C" meta strings (use chips), no gradient washes on the canvas.

## 4. Components

Use **shadcn/ui** (`src/components/ui/*`, style new-york, Tailwind v4). Do not hand-write base
components (button, card, dialog, sheet, tabs, progress, input, label, badge, separator, skeleton).
Add more with `npx shadcn@4.23.0 add <name>` in the remote build sandbox, then fix the import to
`@/lib/utils` and adjust sizes to these rules.

- **Button** — pill. `default` = lime + ink text (primary), `outline` = white + hairline
  (secondary), `ghost` = tertiary, `destructive` only for deleting. Heights: `sm` 44, `default` 48,
  `lg` 56 px; press scale .97; focus ring = water blue. One primary button per view.
- **Score card** — big numeral (56 px, Plus Jakarta 800) + 6 px bar, then three flat stat tiles
  (icon dot + label + number) and the 7-day strip. Rings only in the water and rest screens.
- **Today stage** — dark forest card (28 px radius, the only shadow), photo bleeds under a bottom
  gradient, small day label, 32 px title, meta chips, lime pill Start.
- **Training tiles** — 2 × 2 on mobile, 4 across on desktop; tonal dark, oversized faded line icon
  top-right, big title + one-line subtitle; drop a photo in later.
- **Coach card** — white card, bee (assets only from `mascot-manifest.ts`) at the left, greeting as a
  heading, grey chat lines, warnings with a coral left rule, actions in a full-width row below.
- **Week days** — circles: completed = status colour + check/%, current = ink filled, upcoming =
  outline; rest never red.
- **Bottom tab bar** — 5 tabs, lime pill on the active tab, safe-area padding; hidden during a workout.

Legacy screens still use the plain CSS classes in `globals.css`, `training.css`, `ux.css` and
`polish.css`. Migrate a screen to shadcn when it is touched; never mix both systems on one element.
Tailwind runs without the global preflight (scoped to `[data-slot]`) and skips the legacy class
names `overline ring filter transition`; keep it that way so old screens do not change.

## 5. Motion

- Ease `cubic-bezier(.23,1,.32,1)`; UI motion 120–300 ms; exits ≈ 0.7 × entrances; animate only
  transform/opacity.
- Tab change: soft fade-rise (tabs are peers, no sideways slide). Lists: stagger ≤ 8 items, 40 ms.
- Celebrate only rare moments (session result ring pop, milestone). Frequent actions: no flourish.
- Every animation is disabled under `prefers-reduced-motion`.

## 6. Accessibility & localisation

- Touch targets ≥ 44 × 44 px; visible keyboard focus; contrast AA for text, 3:1 for data marks.
- Myanmar (`my-MM`) default, English fallback; stable IDs separate from labels; translations are
  provisional until reviewed by a fluent speaker.
- Zero horizontal overflow at 320, 390 and 1440 px, in light and dark.

## 7. Review loop (required after any UI change)

Screenshot with Playwright at **1440 px and 390 px** (light + dark, Myanmar + English), compare with
this file, fix, repeat until clean. Report PASS / FAIL / NOT TESTED with the screenshot paths.

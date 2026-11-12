# Mingalar Fit visual system

Current direction (2026-11-12): **white, clear and readable**, adapted from the user's FitnessUIUX screenshots with a later explicit request for less background colour and larger type/icons. This supersedes Stone & Lime.

`src/app/solaris.css` loads after `polish.css` and generated `dark.css` and owns the final tokens and visual refinements. Legacy token names remain for component compatibility: `--lime` now means the orange CTA; `--forest` means indigo secondary emphasis. Tailwind/shadcn tokens map to these variables.

| Token | Light | Dark | Purpose |
|---|---|---|---|
| paper / surface | #ffffff | #080808 / #141416 | page / cards |
| ink | #292d32 | #f5f5f7 | primary text |
| muted | #718098 | #a4aabc | secondary text |
| line | #e0e1e5 | #303035 | thin outlines |
| lime | #fc7a1e | #fc7a1e | selected outlines and primary CTA |
| accent | #b84900 | #ffad71 | readable text links |
| forest | #5261a1 | #5261a1 | secondary brand emphasis |
| c-train / c-water | #08a54c / #08b6d5 | #20c976 / #16c3e1 | training / water data |
| c-meal / c-photo | #fc7a1e / #6531c7 | #ff8c38 / #a174f0 | food / photo data |

Use white cards with a 1px border and 22–28px corners. Keep background colour out of training cards, profile panels, navigation and selections. Reserve one compact pink→orange gradient for the current workout. No decorative glass, glows or dark green panels. Light is the default; saved dark/system preferences remain available.

SUSE 600/700 headings; Open Sans 400/600 body; Noto Sans Myanmar 400/700 for Burmese. All fonts are self-hosted, OFL-1.1. Body 17px, secondary 15px, main heading 32px, section heading 23px, actions 18px. Burmese headings 28px with 1.7 line height; body 1.75–1.85 where needed. Keep syllables intact. Data numbers use tabular figures. Icons generally 24–29px with touch targets ≥44px. Tab icons 25px, labels 12–13px.

Home: greeting → daily/7-day-average ring cards → current plan/week → coach → other ways to train → activity breakdown/history → meal photo. Put the workout action above optional statistics. All charts use real data. Missing history stays missing; weekly averages include recorded days only. Rest remains valid training credit under the existing product rules.

Onboarding: one subject per screen; illustrated current and desired body preferences; equipment/experience/body/schedule/health inputs; review with edit links before saving. Hide unrelated mobile tabs and header actions during intake, retaining language and appearance controls. Body diagrams are original vectors: never use them to estimate fat percentage or promise a physical result. Same choices are editable in Profile.

Mobile first: review 390px, 320px and 1440px in English/Myanmar and light/dark. Zero horizontal overflow; never solve wrapping by hiding page overflow. Respect reduced motion. Use existing Playwright CLI and record runtime evidence in root `evidence/`; see root `docs/TESTING_GUIDE.md`. References and input behaviour: `docs/SOLARIS_UI_REFERENCE.md` and `docs/ONBOARDING_RESEARCH.md` at workspace root.

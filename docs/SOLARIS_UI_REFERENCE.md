# FitnessUIUX visual adaptation — 2026-11-12

User requested the linked ThemeForest template and supplied six screenshots as the visual target.

REA controlled browser capture reached Cloudflare on ThemeForest (evidence `ev_a519a404eaa5c65789486149d913d520fe0dcd53ce5bd95e6689952a64ff1c5d`). The author's public page linked the working demo at https://adminuiux.com/adminuiux/fitness-mobile-uiux/fitness-dashboard.html . REA reached that dashboard at 390 × 844 (Chromium 157; evidence `ev_bf6aa6494050f17daacf87e6dc76ad239206b4d8ed82187ebe507eb5b21a3034`). Provider-owned browsers were terminated after capture.

Observed DOM: white background, `theme-orange`, rounded UI, transparent header and filled sidebar. Font stylesheet requests SUSE and Open Sans. Public demo CSS inspected separately: orange #fc7a1e, secondary #ce6a85, accent #5261a1. These are reference observations, not a pixel equality measurement. Screenshot proportions guide rounded white cards, hairline outlines, green progress rings, cyan activity, violet secondary data, orange history area, and orange/pink current-session card.

Implementation is original React/CSS in `src/app/solaris.css` and `src/features/plan/plan-view.tsx`. Existing functionality/authentication/ownership remain in place. Rings and history plot use real day-score responses; missing scores leave gaps. Existing exercise images retain their existing provenance and attribution. No commercial template source, logo or demo photos incorporated into the product. SUSE and Open Sans are self-hosted through Fontsource (OFL-1.1); Myanmar continues using Noto Sans Myanmar. Fonts and image content can differ from the screenshots; no pixel-perfect claim.

The new layer loads after `polish.css` and generated `dark.css`; both theme token sets are explicitly owned there. `--lime` and `--forest` remain compatibility names but now map to orange CTA and indigo secondary colors.

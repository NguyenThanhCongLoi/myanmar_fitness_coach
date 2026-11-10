# Reuse audit — 2026-11-10

Exact reference commits are recorded in workspace `evidence/gamification-references.json`. No code or character assets from these six repositories were copied.

| Candidate | License inspected | Evaluation / decision |
| --- | --- | --- |
| [Trophy UI](https://ui.trophy.so/docs), [source license](https://github.com/trophyso/ui/blob/main/LICENSE.md) | MIT | Useful streak calendar, XP and achievement presentation reference. Requires shadcn/Tailwind conventions unlike the existing app; build small native components using existing CSS/React instead of adding a second UI stack. No hosted Trophy service. |
| [furqan-labs/streak](https://github.com/furqan-labs/streak) | No license file or package license found in inspected root | Full Vite habit app with browser-oriented check-ins; unsuitable as authoritative workout ledger. Reference only, no code copied. |
| [Kabi](https://github.com/bryllim/kabi-mascot/blob/main/LICENSE) | CC BY 4.0 | Reusable animated mascot with attribution requirements, but the user will provide their own artwork. Import no Kabi art; provide ten original replaceable SVG placeholders and an asset manifest. |
| [Rive React](https://github.com/rive-app/rive-react/blob/main/LICENSE) | MIT | Suitable when original `.riv` assets arrive; defer runtime dependency. Manifest supports Rive metadata plus optional renderer adapter and static fallback. Actual Rive playback is not claimed. |
| [Novu](https://github.com/novuhq/novu) | MIT portions plus proprietary/enterprise package licenses | Multi-service notification platform is unnecessary for this POC. Not installed or copied; existing DB/jobs and Modal schedule suffice. |
| [ntfy](https://github.com/binwiederhier/ntfy/blob/main/LICENSE) | Apache 2.0 at inspected root | Useful standalone pub/sub service but adds another deployment/provider. Not installed; browser Push API with VAPID is sufficient. |

Only new runtime dependency: [`web-push` 4.0.0](https://github.com/web-push-libs/web-push) (MPL-2.0), used unmodified for standards-based encryption and VAPID delivery. Development types: `@types/web-push` 3.6.4. React, Prisma, Zod, lucide and existing fonts are reused. The package and its license remain in the deployment; no MPL source is copied into product modules.

No Duolingo assets, branding, sounds or proprietary UI artwork were used. Mascot placeholders are original code-drawn SVG seed companions; they are illustrations, not generated via an image API. No image-generation call occurs at runtime.

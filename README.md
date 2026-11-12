# Mingalar Fit

Myanmar-first fitness POC: one Next.js/TypeScript app, Better Auth, Prisma/SQLite and one HTTPS entrypoint. All authenticated features are free. English is the secondary language. Myanmar translations are provisional.

POC: https://avibigateway--myanmar-fitness-coach.modal.run

Current release adds a white/orange visual system, illustrated intake/body goals, home/gym plans, actual completion feedback, bounded adaptive weekly reviews, large guided video/timers, free device speech, licensed music and interactive progress history.

- [Adaptive rules, research and chart placement](docs/ADAPTIVE_COACH.md)
- [Video production instructions](docs/VIDEO_PRODUCTION.md) and [62-exercise shot list](docs/VIDEO_SHOT_LIST.csv)
- [UI reference and REA evidence](docs/SOLARIS_UI_REFERENCE.md)
- [Testing and limits](docs/TESTING_GUIDE.md)
- [Deployment constraints](docs/DEPLOYMENT.md)
- [Licenses and attribution](THIRD_PARTY_NOTICES.md)

For local development, copy `.env.example` to `.env`, supply a local-only auth secret/origin and SQLite URL, then run `npm ci`, `npm run db:migrate`, `npm run db:seed`, and `npx next dev --hostname 127.0.0.1`. Keep `.env` and databases outside Git. Heavy validation for this workspace runs remotely as documented.

Modal deployment is a temporary CPU-only POC with one database-writing container and a durable Volume. Stop the old app before redeploying. Do not horizontally scale SQLite. Model/TTS gateways are server-only, optional and configured by the owner; new guided countdown speech uses installed device voices without paid generation. No medical diagnosis or guaranteed body transformation is provided.

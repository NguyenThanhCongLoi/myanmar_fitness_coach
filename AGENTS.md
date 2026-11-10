# Unified Myanmar AI Fitness Coach POC

- One responsive Next.js/TypeScript application, one Better Auth identity, one Prisma/SQLite database, one Modal HTTPS endpoint.
- Myanmar (`my-MM`) is default; English fallback and explicit language switching. Translations are provisional.
- All POC features free. No advertisements, Premium model, checkout, subscription, entitlement checks or upgrade UI.
- Reference sources remain outside this product. No AGPL code/media imported. Retain third-party notices.
- One Modal instance only; SQLite on durable Volume. Acknowledge writes only after persistence commit.
- Scope every user-owned lookup/mutation to the authenticated server-side identity; never trust a request userId.
- LLM gateway is user-configured later. No existing key usage, provider calls, fake chat, or fake generated plans.
- AI read tools access real user data; plan changes are proposals requiring explicit authenticated approval. No arbitrary SQL.
- Build and heavy tests remotely. Run `npm test`, `npm run check:locales`, `npm run build` in the prepared remote environment.
- Read root `docs/CURRENT_STATUS.md` first; detailed product decisions and licenses are under this product's `docs/`.

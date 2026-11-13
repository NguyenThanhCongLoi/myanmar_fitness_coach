FROM node:22-bookworm-slim AS build
ARG DEBIAN_MIRROR=http://deb.debian.org
RUN sed -i "s|http://deb.debian.org|${DEBIAN_MIRROR}|g" /etc/apt/sources.list.d/debian.sources && \
    apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl python3 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 VOICE_WARMUP=0
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN DATABASE_URL=file:/tmp/build.db BETTER_AUTH_URL=http://localhost:3000 BETTER_AUTH_SECRET=build-only-placeholder-secret-not-for-runtime NODE_OPTIONS=--max-old-space-size=2048 nice -n 10 npm run build

FROM build AS verification
RUN DATABASE_URL=file:/tmp/fitness-tests.db PERSISTENCE_MODE=test npm run db:migrate && \
    DATABASE_URL=file:/tmp/fitness-tests.db PERSISTENCE_MODE=test npm run db:seed && \
    DATABASE_URL=file:/tmp/fitness-tests.db PERSISTENCE_MODE=test npm test && npm run check:locales

FROM build AS runtime
ENV NODE_ENV=production DATABASE_URL=file:/data/fitness.db
USER node
EXPOSE 3000
CMD ["python3", "infrastructure/docker/start.py"]

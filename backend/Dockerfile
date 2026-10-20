# Production image for the Flowboard API.
#   docker build -t flowboard-api backend
#   docker run --env-file .env -p 4000:4000 flowboard-api           # start the API
#   docker run --env-file .env flowboard-api migrate                # prisma migrate deploy
#   docker run --env-file .env flowboard-api reset                  # nightly demo reset (wipes data)

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
COPY prisma7.config.ts ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod --ignore-scripts

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=4000 \
    NODE_OPTIONS=--max-old-space-size=128
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/prisma7.config.ts ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/src/generated ./src/generated
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node docker-entrypoint.sh ./
USER node
EXPOSE 4000
ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
CMD ["start"]

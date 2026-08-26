# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Marquee on Cloud Run.
#
# Three stages so the shipped image carries neither the build toolchain nor the
# dev dependencies. `output: 'standalone'` in next.config.ts traces the modules
# the server actually imports, which is the difference between a ~180 MB image
# and a ~1.2 GB one — and on a scale-to-zero service, image size is cold-start
# time, which is most of what the service costs.
#
# Only NEXT_PUBLIC_* values are build arguments. Next inlines those into the
# browser bundle, so they are public by definition and nothing secret can be
# baked into a layer. Every real secret arrives at runtime from Secret Manager.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` from the lockfile: a deploy must build the dependency tree that was
# tested, not whatever is newest today.
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_GOOGLE_SIGN_IN=false
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_GOOGLE_SIGN_IN=$NEXT_PUBLIC_GOOGLE_SIGN_IN \
    NEXT_PUBLIC_USE_EMULATORS=false \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0

# Cloud Run does not require a non-root user, but a container that never needs
# to write to its own filesystem should not be able to.
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S marquee -G nodejs

COPY --from=builder --chown=marquee:nodejs /app/public ./public
COPY --from=builder --chown=marquee:nodejs /app/.next/standalone ./
COPY --from=builder --chown=marquee:nodejs /app/.next/static ./.next/static

USER marquee
EXPOSE 8080

# The standalone server, not `next start` — the latter would need the full Next
# CLI and the dev dependencies that come with it.
CMD ["node", "server.js"]

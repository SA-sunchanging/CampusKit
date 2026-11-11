# One image per service. compose.yaml passes the service name as APP, for example:
#   docker build --build-arg APP=identity -t campuskit-identity .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm install, not npm ci: a lockfile made on Windows can miss Linux-only optional packages.
# --ignore-scripts: the prepare script runs husky, which needs a .git folder.
RUN --mount=type=cache,target=/root/.npm npm install --ignore-scripts --no-audit --no-fund
COPY . .
ARG APP
RUN npx nest build ${APP}
# Keep only the files this service loads at runtime (its own slice of node_modules).
RUN node scripts/trace-runtime.mjs ${APP} /out \
  && cp package.json /out/ \
  && mkdir -p /out/libs/contracts \
  && cp -r libs/contracts/proto /out/libs/contracts/

# Plain Alpine with only the node binary: no npm, npx, yarn, or corepack in the runtime image.
# Keep the Alpine version in step with the one node:24-alpine is built on.
FROM node:24-alpine AS node

FROM alpine:3.24
RUN apk add --no-cache libstdc++
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production
ARG APP
ENV APP=${APP}
COPY --from=build /out ./
CMD node dist/apps/${APP}/main.js

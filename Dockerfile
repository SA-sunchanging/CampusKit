# One image per service. compose.yaml passes the service name as APP, for example:
#   docker build --build-arg APP=identity -t campuskit-identity .
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm install, not npm ci: a lockfile made on Windows can miss Linux-only optional packages.
RUN npm install --no-audit --no-fund
COPY . .
ARG APP
RUN npx nest build ${APP}

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm install --omit=dev --no-audit --no-fund
ARG APP
ENV APP=${APP}
COPY --from=build /app/dist/apps/${APP} ./dist/apps/${APP}
COPY libs/contracts/proto ./libs/contracts/proto
CMD node dist/apps/${APP}/main.js

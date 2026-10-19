FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# npm install, not npm ci: a lockfile made on Windows can miss Linux-only optional packages.
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.29-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

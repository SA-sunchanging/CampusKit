FROM node:22-bookworm-slim AS frontend
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build
FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY shared ./shared
COPY rest ./rest
COPY grpc ./grpc
COPY services ./services
COPY gateway ./gateway
COPY --from=frontend /app/web/dist ./web/dist
CMD ["node", "gateway/server.js"]

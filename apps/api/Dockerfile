FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache su-exec \
  && addgroup -S orbe \
  && adduser -S orbe -G orbe
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 4000
CMD ["sh", "-c", "mkdir -p /data/uploads && chown -R orbe:orbe /data/uploads && exec su-exec orbe node dist/index.js"]

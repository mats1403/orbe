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
RUN addgroup -S orbe && adduser -S orbe -G orbe
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
USER orbe
EXPOSE 4000
CMD ["node", "dist/index.js"]

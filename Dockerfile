FROM node:22-alpine AS build

WORKDIR /app
ENV DISABLE_PWA=true
ENV VITE_DISABLE_PWA=true

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts

EXPOSE 3000

CMD ["node", "dist/server.cjs"]

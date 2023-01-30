FROM node:18-alpine AS build

WORKDIR /build/
COPY tsconfig.json package.json package-lock.json /build/
RUN npm ci

COPY src /build/src
RUN npm run build

FROM node:18-alpine

WORKDIR /app/
COPY package.json /app/
RUN npm install --omit=dev --cache /tmp/empty-cache && rm -rf /tmp/empty-cache

COPY --from=build /build/dist /app/dist
ENTRYPOINT [ "npm", "start" ]

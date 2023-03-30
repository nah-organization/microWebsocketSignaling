FROM node:18-alpine AS build

WORKDIR /build/

ARG NODE_AUTH_TOKEN
COPY tsconfig.json package.json package-lock.json /build/
RUN echo $NODE_AUTH_TOKEN && npm ci

COPY src /build/src
RUN npm run build

FROM node:18-alpine

WORKDIR /app/

ARG NODE_AUTH_TOKEN
COPY package.json /app/
RUN echo $NODE_AUTH_TOKEN && npm install --omit=dev --cache /tmp/empty-cache && rm -rf /tmp/empty-cache

COPY --from=build /build/dist /app/dist
ENTRYPOINT [ "npm", "start" ]

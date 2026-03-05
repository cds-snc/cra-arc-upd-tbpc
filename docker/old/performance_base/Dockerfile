# syntax=docker/dockerfile:1.3
FROM node:24.11.0-bookworm-slim AS builder
WORKDIR /builder
VOLUME ["/builder"]
COPY ["package.json", "package-lock.json", "./"]
RUN --mount=type=cache,target=/root/.npm npm ci
COPY ./nx.json /tsconfig.base.json /tsconfig.json /.eslintrc.json ./
COPY ./apps/ ./apps
COPY ./libs/ ./libs
RUN npx nx daemon --start
RUN npx nx run-many --target=build --projects=api,upd,db-updater --prod --parallel
RUN npx nx daemon --stop
RUN rm -r /builder/node_modules && rm -r /builder/tmp


FROM debian:bookworm-20250407-slim AS apps
WORKDIR /apps
COPY --from=builder /builder/dist/apps/ .


FROM node:24.11.0-bookworm-slim AS node_base
RUN apt-get update && apt-get install -y tzdata curl
ENV TZ=America/Toronto


FROM node_base AS web
WORKDIR /app
RUN chown node:node ./
COPY --from=apps ["apps/api/package.json", "apps/api/package-lock.json", "./"]
RUN --mount=type=cache,target=/root/.npm npm ci --only-production
COPY --from=apps apps/api/ .
RUN curl -o /etc/ssl/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
EXPOSE 9000
USER node
CMD ["node", "main.js"]


FROM node_base AS web-dev-base
WORKDIR /app
COPY ["dist/apps/api/package.json", "dist/apps/api/package-lock.json", "./"]
RUN --mount=type=cache,target=/root/.npm npm ci --only-production


FROM node_base AS web-dev
WORKDIR /app
RUN chown node:node ./
COPY --from=web-dev-base /app/ .
COPY dist/apps/api/ .
RUN curl -o /etc/ssl/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
EXPOSE 9000
USER node
CMD ["node", "main.js"]


FROM node_base AS db-updater
WORKDIR /app
RUN chown node:node ./
COPY --from=apps ["apps/db-updater/package.json", "apps/db-updater/package-lock.json", "./"]
RUN --mount=type=cache,target=/root/.npm npm ci --only-production
COPY --from=apps apps/db-updater/ .
EXPOSE 9001
USER node
CMD ["node", "main.js"]


FROM node_base AS db-updater-dev-base
WORKDIR /app
COPY ["dist/apps/db-updater/package.json", "dist/apps/db-updater/package-lock.json", "./"]
RUN --mount=type=cache,target=/root/.npm npm ci --only-production


FROM node_base AS db-updater-dev
WORKDIR /app
RUN chown node:node ./
COPY --from=db-updater-dev-base /app/ .
COPY dist/apps/db-updater/main.js .
USER node
CMD ["node", "main.js"]


FROM nginx:alpine AS nginx
RUN apk update && apk add tzdata
ENV TZ=America/Toronto
COPY --from=apps apps/upd/ /var/www/html/
COPY docker/performance_nginx/nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
EXPOSE 443


FROM nginx:alpine AS nginx-dev
RUN apk update && apk add tzdata
ENV TZ=America/Toronto
COPY ../dist/apps/upd/ /var/www/html/
COPY docker/performance_nginx/nginx.dev.conf /etc/nginx/nginx.conf
EXPOSE 8080

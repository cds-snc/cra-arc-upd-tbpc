# syntax=docker/dockerfile:1
FROM nginx:alpine

RUN apk update && apk add tzdata

ENV TZ=America/Toronto

COPY docker/performance_nginx/nginx.conf /etc/nginx/nginx.conf

COPY dist/apps/upd/ /var/www/html/

EXPOSE 80

EXPOSE 443

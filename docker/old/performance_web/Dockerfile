# syntax=docker/dockerfile:1
FROM node:16-alpine3.17

RUN apk update && apk add tzdata

ENV TZ=America/Toronto

RUN npm install pm2 -g

USER node

ENV NODE_ENV=production

COPY dist/apps/api/ .

COPY .env .

EXPOSE 9000

CMD ["pm2-runtime", "main.js"]

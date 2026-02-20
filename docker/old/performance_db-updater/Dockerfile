# syntax=docker/dockerfile:1
FROM node:16-alpine3.17

RUN apk update && apk add tzdata

ENV TZ=America/Toronto

RUN npm install pm2 -g

RUN echo -e '#!/bin/sh\nnode db-cli/main.js "$@"' >> /bin/db-cli && \
    chmod +x /bin/db-cli

USER node

ENV NODE_ENV=production

COPY dist/apps/db-updater/ .

COPY dist/apps/db-cli/ db-cli/

COPY .env .

COPY keys keys/

COPY .env db-cli/

COPY keys db-cli/keys/

EXPOSE 9001

CMD ["pm2-runtime", "main.js"]

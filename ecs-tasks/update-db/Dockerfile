FROM node:24.11.0-bookworm-slim AS base
RUN apt-get update && apt-get install -y tzdata curl
ENV TZ=America/Toronto

# "node" is a pre-configured user from the node image
ARG USER=node

RUN curl -o /etc/ssl/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  && mkdir -p /home/$USER/.local/bin \
  && chown -R $USER:$USER /home/$USER && \
  echo 'export PATH="/home/'${USER}'/.local/bin:${PATH}"' >> /home/${USER}/.bashrc

USER $USER

ENV PATH="/home/${USER}/.local/bin:${PATH}"

# Install uv + python
RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
  && (uv python install 3.12.9)

USER root


# Build stage for node app
FROM node:24.11.0-bookworm-slim AS node-builder
WORKDIR /builder
VOLUME ["/builder"]
COPY ["package.json", "package-lock.json", "./"]
RUN --mount=type=cache,target=/root/.npm npm ci
COPY ./nx.json /tsconfig.base.json /tsconfig.json /.eslintrc.json ./
COPY ./apps/update-db-task ./apps/update-db-task
COPY ./libs/ ./libs
RUN npx nx daemon --start
RUN npx nx run-many --target=build --projects=update-db-task --prod --parallel
RUN npx nx daemon --stop
RUN rm -r /builder/node_modules && rm -r /builder/tmp


# Build stage for python script
FROM base AS python-builder
ARG USER=node
WORKDIR /builder
VOLUME ["/python"]
COPY [ \
  "python/mongo-parquet/uv.lock", \
  "python/mongo-parquet/pyproject.toml", \
  "python/mongo-parquet/.python-version", \
  "python/mongo-parquet/README.md", \
  "./" \
  ]
RUN mkdir .venv && chown $USER:$USER ./ uv.lock pyproject.toml .venv && su $USER -c "uv sync --no-cache"
COPY ["python/mongo-parquet/", "./"]

# Build stage for final image
FROM base
ARG USER=node
WORKDIR /app

COPY --link --from=node-builder ["/builder/dist/apps/update-db-task/package.json", "/builder/dist/apps/update-db-task/package-lock.json", "./update-db/"]

RUN --mount=type=cache,target=/root/.npm cd update-db && npm ci --omit=dev

COPY --link --from=node-builder ["/builder/dist/apps/update-db-task", "./update-db/"]

COPY --link --from=python-builder ["/builder/", "./mongo-parquet/"]

COPY --link ["ecs-tasks/update-db/run-task.sh", "./"]

RUN chown -R $USER:$USER ./mongo-parquet/src ./mongo-parquet/.venv/bin && chmod +x run-task.sh

USER $USER

CMD ["./run-task.sh"]
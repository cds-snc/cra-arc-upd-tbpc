# "node" is a pre-configured user from the node image,
#  so we'll use that everywhere for consistency
ARG USER=node

## Stage for pinned node image
FROM node:24.13.1-trixie-slim AS node-image


## Build stage for node base
FROM node-image AS node-base
WORKDIR /builder
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY ./nx.json ./tsconfig.base.json ./tsconfig.json ./.eslintrc.json ./
COPY ./libs/ ./libs


## Build stage for update-db build
FROM node-base AS update-db-build
WORKDIR /builder
COPY ./apps/update-db-task ./apps/update-db-task
RUN npx nx run-many --target=build --projects=update-db-task --prod --parallel
RUN rm -r /builder/node_modules && rm -r /builder/tmp


FROM node-image AS update-db-deps
WORKDIR /builder
COPY --from=update-db-build /builder/dist/apps/update-db-task/package.json /builder/dist/apps/update-db-task/package-lock.json /builder/
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev


## Build stage for python builder
FROM ghcr.io/astral-sh/uv:0.10.4-trixie-slim@sha256:b852203fd7831954c58bfa1fec1166295adcfcfa50f4de7fdd0e684c8bd784eb AS python-builder
WORKDIR /builder
ARG USER=node

# Enable bytecode compilation
ENV UV_COMPILE_BYTECODE=1
# Copy from the cache instead of linking since it's a mounted volume
ENV UV_LINK_MODE=copy
# Omit development dependencies
ENV UV_NO_DEV=1
# Ensure installed tools can be executed out of the box
ENV UV_TOOL_BIN_DIR=/usr/local/bin
# Configure the Python directory so it is consistent
ENV UV_PYTHON_INSTALL_DIR=/python
# Only use the managed Python version
ENV UV_PYTHON_PREFERENCE=only-managed

# Install Python before the project for caching
RUN uv python install 3.12

# Install the project's dependencies using the lockfile and settings
RUN --mount=type=cache,target=/root/.cache/uv \
  --mount=type=bind,source=python/mongo-parquet/uv.lock,target=uv.lock \
  --mount=type=bind,source=python/mongo-parquet/pyproject.toml,target=pyproject.toml \
  --mount=type=bind,source=python/mongo-parquet/.python-version,target=.python-version \
  uv sync --locked --no-install-project

# Then, add the rest of the project source code and install it
# Installing separately from its dependencies allows optimal layer caching
COPY python/mongo-parquet/ ./
RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --locked

## Build stage for final (python-only) image base
FROM debian:trixie-slim AS python-final-base

ARG USER=node

RUN groupadd --gid 1000 $USER \
  && useradd --uid 1000 --gid $USER --shell /bin/bash --create-home $USER

# Copy Python
COPY --from=python-builder --chown=$USER:$USER --link /python/ /python/

# Copy the application from the builder
COPY --from=python-builder --chown=$USER:$USER --link /builder/ /app/

# Place executables in the environment at the front of the path
ENV PATH="/app/.venv/bin:$PATH"


## Build stage for final (node) image base
FROM node-image AS node-final-base

# Set up apt caching and install necessary packages
RUN mkdir -p /etc/apt/apt.conf.d && rm -f /etc/apt/apt.conf.d/docker-clean; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt-get update && apt-get install -y --no-install-recommends tzdata curl ca-certificates

ADD --link https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/
ENV TZ=America/Toronto


## Build stage for final (node+python) image base
FROM node-final-base AS node-python-final-base

ARG USER=node

WORKDIR /app

RUN mkdir -p /app/mongo-parquet && chown -R $USER:$USER /app

# Need to use user and group ids instead of names when using --link for some reason
COPY --chown=1000:1000 --from=python-builder --link /python/ /python/
COPY --chown=1000:1000 --from=python-builder --link /builder/ ./mongo-parquet/

# Place mongo-parquet executables in the environment at the front of the path
ENV PATH="/app/mongo-parquet/.venv/bin:$PATH"


## Build stage for final update-db image
FROM node-python-final-base AS update-db-task

COPY --chown=1000:1000 --from=update-db-deps --link /builder/node_modules/ ./update-db/node_modules/
COPY --chown=1000:1000 --from=update-db-build --link /builder/dist/apps/update-db-task/ ./update-db/
COPY --chown=1000:1000 --chmod=755 --link ecs-tasks/update-db/run-task.sh ./

USER $USER
CMD ["./run-task.sh"]


## Build stage for final data-import image
FROM python-final-base AS data-import-task

WORKDIR /app
USER $USER

COPY --chown=1000:1000 --chmod=755 --link ecs-tasks/data-import/run-task.sh ./

CMD ["./run-task.sh"]
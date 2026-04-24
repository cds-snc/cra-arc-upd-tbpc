FROM mcr.microsoft.com/devcontainers/javascript-node:4.0.10-24-trixie@sha256:e66ed141c99e4190bf9dbf56db59f46f98cf172a341dfdd601ae6a78b23abbb3

# Install MongoDB command line tools - though mongo-database-tools not available on arm64
ARG MONGO_TOOLS_VERSION=8.0
# MongoDB currently doesn't have a trixie (debian 13) release of their tools, so we use the bookworm (debian 12) release which is compatible with trixie
ENV MONGO_TOOLS_VERSION_CODENAME=bookworm

RUN mkdir -p /etc/apt/apt.conf.d && rm -f /etc/apt/apt.conf.d/docker-clean; echo 'Binary::apt::APT::Keep-Downloaded-Packages "true";' > /etc/apt/apt.conf.d/keep-cache
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  . /etc/os-release \
  && curl -sSL "https://www.mongodb.org/static/pgp/server-${MONGO_TOOLS_VERSION}.asc" | gpg --dearmor > /usr/share/keyrings/mongodb-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/mongodb-archive-keyring.gpg] http://repo.mongodb.org/apt/debian ${MONGO_TOOLS_VERSION_CODENAME}/mongodb-org/${MONGO_TOOLS_VERSION} main" \
    | tee /etc/apt/sources.list.d/mongodb-org-${MONGO_TOOLS_VERSION}.list \
  && apt-get update && export DEBIAN_FRONTEND=noninteractive \
  && apt-get install -y --no-install-recommends tzdata mongodb-mongosh \
  && if [ "$(dpkg --print-architecture)" = "amd64" ]; then apt-get install -y mongodb-database-tools; fi

ADD --link --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /etc/ssl/

# Default timezone to Toronto
ENV TZ=America/Toronto

# Update npm, install bun & uv
RUN su node -c "(curl -fsSL https://bun.sh/install | bash) && (curl -LsSf https://astral.sh/uv/install.sh | sh)"

# Set shell to bash so that we can use bash functions
SHELL ["/bin/bash", "-c"]
# functions for appending to both .bashrc and .zshrc to avoid having to repeat for both shells
RUN function append_to_shell_rc() { local line="$1"; echo "$line" >> /home/node/.bashrc; echo "$line" >> /home/node/.zshrc; }; \
  function append_alias() { local alias_name="$1"; local alias_cmd="$2"; append_to_shell_rc "alias $alias_name='$alias_cmd'"; }; \
  # Add bun to PATH, add shell completion for uv and uvx, and add aliases
  append_to_shell_rc 'export BUN_INSTALL="/home/node/.bun"' \
  && append_to_shell_rc 'export PATH="$BUN_INSTALL/bin:$PATH"' \
  && echo 'eval "$(uv generate-shell-completion bash)"' >> /home/node/.bashrc \
  && echo 'eval "$(uvx --generate-shell-completion bash)"' >> /home/node/.bashrc \
  && echo 'eval "$(uv generate-shell-completion zsh)"' >> /home/node/.zshrc \
  && echo 'eval "$(uvx --generate-shell-completion zsh)"' >> /home/node/.zshrc \
  # Aliases:
  && append_alias awslogin scripts/shell/aws-sso-init.sh \
  && append_alias buns "bun bun-script"

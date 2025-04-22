FROM mcr.microsoft.com/devcontainers/javascript-node:1-22-bookworm

# Install MongoDB command line tools - though mongo-database-tools not available on arm64
ARG MONGO_TOOLS_VERSION=6.0
RUN . /etc/os-release \
  && curl -sSL "https://www.mongodb.org/static/pgp/server-${MONGO_TOOLS_VERSION}.asc" | gpg --dearmor > /usr/share/keyrings/mongodb-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/mongodb-archive-keyring.gpg] http://repo.mongodb.org/apt/debian ${VERSION_CODENAME}/mongodb-org/${MONGO_TOOLS_VERSION} main" | tee /etc/apt/sources.list.d/mongodb-org-${MONGO_TOOLS_VERSION}.list \
  && apt-get update && export DEBIAN_FRONTEND=noninteractive \
  && apt-get install -y mongodb-mongosh \
  && if [ "$(dpkg --print-architecture)" = "amd64" ]; then apt-get install -y mongodb-database-tools; fi \
  && apt-get install -y tzdata \
  # Install AWS cert bundle
  && curl -o /etc/ssl/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem \
  # && apt-get -y install --no-install-recommends <your-package-list-here>
  && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Default timezone to Toronto
ENV TZ=America/Toronto

# Update npm, install bun & uv
RUN su node -c "npm install -g npm@latest && npm cache clean --force && (curl -fsSL https://bun.sh/install | bash) && (curl -LsSf https://astral.sh/uv/install.sh | sh)"

# Add bun to PATH, add "buns" alias for bun-script, and add shell completion for uv and uvx
# Note: The following lines are added to both .bashrc and .zshrc to ensure compatibility with both shells
RUN echo 'export BUN_INSTALL="/home/node/.bun"' >> /home/node/.bashrc \
  && echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /home/node/.bashrc \
  && echo 'export BUN_INSTALL="/home/node/.bun"' >> /home/node/.zshrc \
  && echo 'export PATH="$BUN_INSTALL/bin:$PATH"' >> /home/node/.zshrc \
  && echo 'alias buns="bun bun-script"' >> /home/node/.bashrc \
  && echo 'alias buns="bun bun-script"' >> /home/node/.zshrc \
  && echo 'eval "$(uv generate-shell-completion bash)"' >> /home/node/.bashrc \
  && echo 'eval "$(uvx --generate-shell-completion bash)"' >> /home/node/.bashrc \
  && echo 'eval "$(uv generate-shell-completion zsh)"' >> /home/node/.zshrc \
  && echo 'eval "$(uvx --generate-shell-completion zsh)"' >> /home/node/.zshrc

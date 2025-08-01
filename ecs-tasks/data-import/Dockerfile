FROM debian:bookworm-slim

RUN apt update && export DEBIAN_FRONTEND=noninteractive \
  && (apt install -y curl) \
  && (curl -o /etc/ssl/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem)

ARG USER=python

WORKDIR /home/${USER}

COPY . .

RUN useradd -ms /bin/bash $USER \
  && mkdir -p /home/$USER/.local/bin \
  && chown -R $USER:$USER /home/$USER

USER $USER

ENV PATH="/home/${USER}/.local/bin:${PATH}"

RUN curl -LsSf https://astral.sh/uv/install.sh | sh \
  && (uv python install 3.12) \
  && (uv sync --no-dev)

CMD [ \
  "uv", \
  "run", \
    "--no-sync", \
    "--directory=src", \
  "mongo_parquet", \
    "--import-to-mongo", \
    "--from-remote", \
    "--storage=s3", \
]
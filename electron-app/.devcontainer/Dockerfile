FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

# Electron dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get install -y --no-install-recommends \
        libgtk-3-0 \
        libgdk-pixbuf2.0-0 \
        libnotify4 \
        libnss3 \
        libxss1 \
        libxtst6 \
        xdg-utils \
        libatspi2.0-0 \
        libdrm2 \
        libgbm1 \
        libxcb-dri3-0 \
        libasound2 \
        libxkbfile1 \
        libxrandr2 \
        libsecret-1-0 \
        mesa-utils \
        x11-xserver-utils \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash

# Add bun to PATH for all users
ENV BUN_INSTALL="/root/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

# Verify
RUN bun --version

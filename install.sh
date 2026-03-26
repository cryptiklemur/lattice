#!/usr/bin/env bash
set -euo pipefail

REPO="cryptiklemur/lattice"
INSTALL_DIR="${LATTICE_INSTALL_DIR:-/usr/local/bin}"

main() {
  local platform arch asset_name version download_url

  platform="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$platform" in
    linux)  platform="linux" ;;
    darwin) platform="darwin" ;;
    *)
      echo "Error: Unsupported platform: $platform"
      exit 1
      ;;
  esac

  case "$arch" in
    x86_64|amd64)  arch="x64" ;;
    aarch64|arm64) arch="arm64" ;;
    *)
      echo "Error: Unsupported architecture: $arch"
      exit 1
      ;;
  esac

  asset_name="lattice-${platform}-${arch}"
  echo "Detected: ${platform}-${arch}"

  echo "Fetching latest release..."
  local release_json
  release_json="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"

  version="$(echo "$release_json" | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')"
  if [ -z "$version" ]; then
    echo "Error: Could not determine latest version"
    exit 1
  fi
  echo "Latest version: ${version}"

  download_url="$(echo "$release_json" | grep "browser_download_url.*${asset_name}" | head -1 | sed 's/.*"browser_download_url": *"//;s/".*//')"
  if [ -z "$download_url" ]; then
    echo "Error: No binary found for ${asset_name} in ${version}"
    echo "Available at: https://github.com/${REPO}/releases/tag/${version}"
    exit 1
  fi

  local tmp_file
  tmp_file="$(mktemp)"
  echo "Downloading ${asset_name}..."
  curl -fsSL "$download_url" -o "$tmp_file"
  chmod +x "$tmp_file"

  if [ -w "$INSTALL_DIR" ]; then
    mv "$tmp_file" "${INSTALL_DIR}/lattice"
  else
    echo "Installing to ${INSTALL_DIR} (requires sudo)..."
    sudo mv "$tmp_file" "${INSTALL_DIR}/lattice"
  fi

  echo ""
  echo "Lattice ${version} installed to ${INSTALL_DIR}/lattice"
  echo ""
  echo "Run:  lattice"
}

main

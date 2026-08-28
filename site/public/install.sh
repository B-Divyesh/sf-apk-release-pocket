#!/bin/sh
set -eu

MANIFEST_URL="${ARP_MANIFEST_URL:-https://github.com/B-Divyesh/sf-apk-release-pocket/releases/latest/download/latest.json}"
INSTALL_DIR="${ARP_INSTALL_DIR:-${HOME}/.local/bin}"
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT INT TERM

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) PLATFORM="linux-x86_64" ;;
  Linux-aarch64|Linux-arm64) PLATFORM="linux-aarch64" ;;
  Darwin-x86_64) PLATFORM="macos-x86_64" ;;
  Darwin-arm64) PLATFORM="macos-aarch64" ;;
  *) echo "Unsupported platform: $(uname -s) $(uname -m)" >&2; exit 2 ;;
esac

curl -fsSL "$MANIFEST_URL" -o "$TEMP_DIR/latest.json"
asset_field() {
  awk -v platform="\"$PLATFORM\"" -v field="\"$1\"" '
    $0 ~ platform { active=1 }
    active && $0 ~ field { line=$0; sub(/^[^:]*:[[:space:]]*"/, "", line); sub(/"[,[:space:]]*$/, "", line); print line; exit }
  ' "$TEMP_DIR/latest.json"
}
URL=$(asset_field url)
EXPECTED=$(asset_field sha256)
[ -n "$URL" ] && [ -n "$EXPECTED" ] || { echo "Release manifest has no $PLATFORM asset" >&2; exit 3; }

curl -fL "$URL" -o "$TEMP_DIR/arp.tar.gz"
if command -v sha256sum >/dev/null 2>&1; then ACTUAL=$(sha256sum "$TEMP_DIR/arp.tar.gz" | awk '{print $1}'); else ACTUAL=$(shasum -a 256 "$TEMP_DIR/arp.tar.gz" | awk '{print $1}'); fi
[ "$ACTUAL" = "$EXPECTED" ] || { echo "SHA-256 mismatch; refusing to install" >&2; exit 4; }
tar -xzf "$TEMP_DIR/arp.tar.gz" -C "$TEMP_DIR"
mkdir -p "$INSTALL_DIR"
install -m 755 "$TEMP_DIR/arp" "$INSTALL_DIR/arp"
echo "Installed verified arp to $INSTALL_DIR/arp"
echo "Run: arp --help"

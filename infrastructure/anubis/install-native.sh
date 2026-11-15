#!/usr/bin/env bash
# Install Anubis natif (sans Docker) sur Ubuntu — même esprit que Redis/Postgres locaux.
# Usage (sur le VPS) :
#   cd /var/www/shop/shipshop/infrastructure/anubis   # ou chemin du repo
#   sudo bash install-native.sh
set -euo pipefail

VERSION="${ANUBIS_VERSION:-1.28.2}"
ARCH="$(dpkg --print-architecture 2>/dev/null || uname -m)"
case "$ARCH" in
  x86_64|amd64) ARCH=amd64 ;;
  aarch64|arm64) ARCH=arm64 ;;
  *) echo "Architecture non supportée: $ARCH"; exit 1 ;;
esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cd "$TMP"
DEB="anubis_${VERSION}_${ARCH}.deb"
URL="https://github.com/TecharoHQ/anubis/releases/download/v${VERSION}/${DEB}"

echo "==> Téléchargement $URL"
curl -fsSL -o "$DEB" "$URL"

echo "==> Installation paquet .deb"
sudo apt-get update -qq
sudo apt-get install -y "./$DEB"

echo "==> Config ShipShop"
sudo mkdir -p /etc/anubis
sudo cp "$SCRIPT_DIR/shipshop.env" /etc/anubis/shipshop.env
sudo cp "$SCRIPT_DIR/shipshop.botPolicies.yaml" /etc/anubis/shipshop.botPolicies.yaml
sudo chmod 644 /etc/anubis/shipshop.env /etc/anubis/shipshop.botPolicies.yaml

echo "==> systemd anubis@shipshop"
sudo systemctl daemon-reload
sudo systemctl enable --now anubis@shipshop.service
sudo systemctl --no-pager --full status anubis@shipshop.service || true

echo "==> Smoke test local"
sleep 1
if curl -fsS -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8923/" | grep -Eq '^[0-9]+$'; then
  echo "Anubis répond sur 127.0.0.1:8923"
else
  echo "Attention: pas de réponse sur :8923 — vérifier journalctl -u anubis@shipshop"
fi

echo
echo "Suite : appliquer le snippet Nginx (voir STAGING.md), puis :"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo "Retour arrière : location / → proxy_pass http://127.0.0.1:3000;"

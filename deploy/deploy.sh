#!/usr/bin/env bash
# Build locally and publish to vanblue.online.
# Usage: bash deploy/deploy.sh
set -euo pipefail

SITE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-vanblue}"
KEEP="${KEEP:-5}"
ZOLA="${ZOLA:-$SITE_DIR/../.tools/zola.exe}"
SITE_URL="${SITE_URL:-https://vanblue.online/}"

cd "$SITE_DIR"
"$ZOLA" build

REL="$(date +%Y%m%d-%H%M%S)"
echo "==> publishing release $REL"

ssh "$HOST" "mkdir -p /var/www/vanblue/releases/$REL"
tar czf - -C public . |
  ssh "$HOST" "tar xzf - -C /var/www/vanblue/releases/$REL && chmod -R a+rX /var/www/vanblue/releases/$REL"

PRUNE_AFTER=$((KEEP + 1))
ssh "$HOST" "set -e; ln -sfn /var/www/vanblue/releases/$REL /var/www/vanblue/current; ls -1dt /var/www/vanblue/releases/*/ | tail -n +$PRUNE_AFTER | xargs -r rm -rf"

echo "==> current -> $(ssh "$HOST" 'readlink /var/www/vanblue/current')"

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "$SITE_URL")
echo "==> smoke test $SITE_URL -> $code"
[ "$code" = "200" ] || { echo "!! smoke test failed"; exit 1; }

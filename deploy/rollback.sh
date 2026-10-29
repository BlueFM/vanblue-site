#!/usr/bin/env bash
# Point the site back at the newest release that is not the current one.
# Usage: bash deploy/rollback.sh
set -euo pipefail
HOST="${HOST:-vanblue}"

ssh "$HOST" '
set -e
cur=$(readlink /var/www/vanblue/current)
prev=
for d in $(ls -1dt /var/www/vanblue/releases/*/); do
  d=${d%/}
  if [ "$d" != "$cur" ]; then prev=$d; break; fi
done
[ -n "$prev" ] || { echo "no other release available"; exit 1; }
ln -sfn "$prev" /var/www/vanblue/current
echo "switched: $cur"
echo "      -> $prev"
'
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${SITE_URL:-https://vanblue.online/}")
echo "smoke test -> $code"
[ "$code" = "200" ] || exit 1

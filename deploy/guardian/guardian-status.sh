#!/usr/bin/env bash
# Write the site guardian status snapshot.
#
# Runs once a minute from guardian-status.timer and drops a small JSON file
# that nginx serves verbatim at /guardian/status.json. Nothing here listens on
# a port; the site stays a pile of static files.
#
# Inputs:
#   /proc/loadavg                 1-minute load average
#   /var/log/nginx/...access.log  today's unique visitors and request count
#   /var/www/vanblue/current      symlink mtime = time of the last release swap
set -euo pipefail

OUT="${GUARDIAN_OUT:-/var/www/vanblue/guardian/status.json}"
ACCESS_LOG="${GUARDIAN_ACCESS_LOG:-/var/log/nginx/vanblue.access.log}"
CURRENT="${GUARDIAN_CURRENT:-/var/www/vanblue/current}"

BUSY_RATIO="${GUARDIAN_BUSY_RATIO:-0.7}"   # load per core that counts as busy
BUSY_VISITORS="${GUARDIAN_BUSY_VISITORS:-20}"
DEPLOY_WINDOW="${GUARDIAN_DEPLOY_WINDOW:-120}"

now=$(date +%s)
cores=$(nproc)
load=$(cut -d' ' -f1 /proc/loadavg)

visitors=null
hits=0
if [[ -r "$ACCESS_LOG" ]]; then
  today=$(date '+%d/%b/%Y')
  # Field 4 of the combined log format is "[05/Nov/2026:20:00:59". A visitor is
  # an address that received both a document and one of its assets: scanners
  # spray paths and rarely come back for the stylesheet, browsers always do.
  read -r visitors hits < <(awk -v d="[$today" '
    index($4, d) == 1 {
      hits++
      ip = $1
      path = $7
      code = $9; gsub(/"/, "", code)
      p = path; sub(/\?.*/, "", p)
      if (code == 200) {
        if (p ~ /\.(css|js|mjs|svg|png|jpe?g|webp|avif|ico|woff2?|ttf)$/) asset[ip] = 1
        else if (p !~ /\.[a-z0-9]+$/) page[ip] = 1
      }
    }
    END {
      v = 0
      for (ip in page) if (ip in asset) v++
      printf "%d %d", v, hits
    }' "$ACCESS_LOG") || true
fi

deploy_age=null
if [[ -L "$CURRENT" ]]; then
  swapped=$(stat -c %Y "$CURRENT")
  age=$((now - swapped))
  if ((age >= 0 && age < 3600)); then
    deploy_age=$age
  fi
fi

ratio=$(awk -v l="$load" -v c="$cores" 'BEGIN { printf "%.2f", l / c }')
hour=$((10#$(date +%H)))

mood=idle
if [[ "$deploy_age" != null ]] && ((deploy_age <= DEPLOY_WINDOW)); then
  mood=deploy
elif awk -v r="$ratio" -v m="$BUSY_RATIO" 'BEGIN { exit !(r >= m) }'; then
  mood=busy
elif [[ "$visitors" != null ]] && ((visitors >= BUSY_VISITORS)); then
  mood=busy
elif ((hour >= 1 && hour < 7)); then
  mood=sleep
fi

dir=$(dirname "$OUT")
mkdir -p "$dir"
tmp="$OUT.$$"
cat >"$tmp" <<EOF
{"v":1,"ts":$now,"mood":"$mood","load":$load,"cores":$cores,"load_ratio":$ratio,"visitors":$visitors,"hits":$hits,"deploy_age":$deploy_age}
EOF
chmod 0644 "$tmp"
mv -f "$tmp" "$OUT"

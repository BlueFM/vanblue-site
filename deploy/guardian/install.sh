#!/usr/bin/env bash
# Install the site guardian snapshot job on the server. Run as root:
#
#   scp -r deploy/guardian vanblue:/tmp/
#   ssh vanblue 'bash /tmp/guardian/install.sh'
#
# Idempotent: re-running upgrades the script and units in place.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "install.sh must run as root" >&2
  exit 1
fi

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
lib=/usr/local/lib/vanblue
units=/etc/systemd/system
state=/var/www/vanblue/guardian

if [[ ! -r /var/log/nginx/vanblue.access.log ]]; then
  echo "warning: /var/log/nginx/vanblue.access.log is not readable; visitors will be null" >&2
fi

install -d -m 0755 "$lib" "$state"
install -m 0755 "$here/guardian-status.sh" "$lib/guardian-status.sh"
install -m 0644 "$here/guardian-status.service" "$units/guardian-status.service"
install -m 0644 "$here/guardian-status.timer" "$units/guardian-status.timer"

systemctl daemon-reload
systemctl enable --now guardian-status.timer
systemctl start guardian-status.service

sleep 1
json="$state/status.json"
if [[ ! -s "$json" ]]; then
  echo "status.json was not written; check: journalctl -u guardian-status.service" >&2
  exit 1
fi

if command -v python3 >/dev/null 2>&1; then
  python3 -m json.tool "$json" >/dev/null || { echo "invalid JSON in $json" >&2; exit 1; }
fi

echo "==> $json"
cat "$json"
echo
echo "==> timer"
systemctl list-timers guardian-status.timer --no-pager || true
echo
echo "Next: nginx must expose /var/www/vanblue/guardian/ at /guardian/status.json."
echo "Copy the location block from deploy/nginx-vanblue.conf, then: nginx -t && systemctl reload nginx"

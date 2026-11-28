# guardian

The wizard cat in the site's bottom corner. Mood is read from
`/guardian/status.json`, a static file that a systemd timer rewrites once a
minute. No daemon, no port, no database — the site stays flat files on nginx.

```
loadavg + cores ─┐
today's nginx log├─> guardian-status.sh ─> /var/www/vanblue/guardian/status.json ─> browser
release symlink ─┘        (every 60s)              (nginx, exact location)
```

## Moods

| mood     | when                                                      | on screen            |
|----------|-----------------------------------------------------------|----------------------|
| `idle`   | default                                                   | blinks, short strolls |
| `sleep`  | 01:00–07:00 local                                         | curled up, breathing, floating `Z` |
| `busy`   | load per core ≥ 0.7, or ≥ 20 visitors today                | stays nearby         |
| `deploy` | less than 120 s since `/var/www/vanblue/current` changed   | awake, short strolls |

Thresholds are env overrides in the unit: `GUARDIAN_BUSY_RATIO`,
`GUARDIAN_BUSY_VISITORS`, `GUARDIAN_DEPLOY_WINDOW`.

`idle` and `deploy` allow short desktop strolls near the cat's chosen spot;
`busy` and `sleep` stay still. Clicking conjures a little fish, including when
waking a sleeping cat. Dragging, gentle drop physics, hiding, and reduced-motion
handling are all client-side (`static/js/guardian.js`) — nothing on this side
knows about the pointer, and no server or timer changes are needed for the art.

## Install

```sh
scp -r deploy/guardian vanblue:/tmp/
ssh vanblue 'bash /tmp/guardian/install.sh'
```

Then expose the file. The location block lives in `deploy/nginx-vanblue.conf`:

```nginx
location = /guardian/status.json {
    root /var/www/vanblue;
    default_type application/json;
    expires -1;
    access_log off;
}
```

Copy that file over, then `nginx -t && systemctl reload nginx`.

## Why the snapshot lives outside `releases/`

`deploy.sh` swaps `/var/www/vanblue/current` to a fresh timestamped release and
prunes old ones. Anything written inside a release is replaced on the next
deploy, so the snapshot lives in `/var/www/vanblue/guardian/` and is served by
an exact-match location instead.

The `deploy` mood needs no hook: `ln -sfn` gives the `current` symlink a fresh
mtime, and the script compares that with the clock.

## Checks

```sh
systemctl list-timers guardian-status.timer
journalctl -u guardian-status.service -n 20
curl -s https://vanblue.online/guardian/status.json
```

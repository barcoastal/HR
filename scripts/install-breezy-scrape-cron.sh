#!/bin/bash
# Install + load the Breezy resume scrape as a launchd cron job on macOS.
# Runs every 5 minutes in the background once installed.
#
# Usage:
#   BREEZY_EMAIL='bar@coastaldebt.com' \
#   BREEZY_PASSWORD='your-breezy-password' \
#   CRON_SECRET='...' \
#   bash scripts/install-breezy-scrape-cron.sh

set -e

if [ -z "$BREEZY_EMAIL" ] || [ -z "$BREEZY_PASSWORD" ] || [ -z "$CRON_SECRET" ]; then
  echo "Need BREEZY_EMAIL, BREEZY_PASSWORD, CRON_SECRET in the env. Aborting."
  exit 1
fi

PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/com.coastaldebt.calatrava.breezy-scrape.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.coastaldebt.calatrava.breezy-scrape.plist"

if [ ! -f "$PLIST_SRC" ]; then
  echo "Template plist not found at $PLIST_SRC"
  exit 1
fi

mkdir -p "$(dirname "$PLIST_DST")"

# Substitute env vars into the plist template.
sed \
  -e "s|REPLACE_WITH_YOUR_BREEZY_EMAIL|$BREEZY_EMAIL|" \
  -e "s|REPLACE_WITH_YOUR_BREEZY_PASSWORD|$BREEZY_PASSWORD|" \
  -e "s|REPLACE_WITH_YOUR_CRON_SECRET|$CRON_SECRET|" \
  "$PLIST_SRC" > "$PLIST_DST"

# Unload any previous instance, then load the new one.
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

echo "Installed → $PLIST_DST"
echo "It runs immediately and then every 5 minutes."
echo
echo "Watch logs with:"
echo "  tail -f /tmp/calatrava-breezy-scrape.log"
echo
echo "Uninstall later with:"
echo "  launchctl unload $PLIST_DST && rm $PLIST_DST"

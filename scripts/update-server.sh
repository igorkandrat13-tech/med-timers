#!/bin/bash
set -e

TARGET_DIR="/opt/med-timers"
SERVICE_NAME="med-timers"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/update-server.sh"
  exit 1
fi

echo "Updating project in $TARGET_DIR..."
cd "$TARGET_DIR"

# Check if it is a git repo
if [ -d ".git" ]; then
  echo "Git repository detected. Pulling latest changes..."
  # Fix permissions if needed
  chown -R medtimers:medtimers .git
  sudo -u medtimers git pull
else
  echo "Not a git repository. Please deploy via rsync or clone first."
  exit 1
fi

echo "Installing dependencies..."
sudo -u medtimers npm install --omit=dev

echo "Restarting service..."
systemctl restart "$SERVICE_NAME"

echo "Done! Status:"
systemctl status "$SERVICE_NAME" --no-pager

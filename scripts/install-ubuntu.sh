#!/usr/bin/env bash
set -euo pipefail

DOMAIN=""
EMAIL=""
TARGET_DIR=""
SERVICE_NAME="med-timers"
USER_NAME="medtimers"
ENABLE_HTTPS="no"
GIT_REPO=""

usage() {
  echo "Usage: sudo bash scripts/install-ubuntu.sh [--domain your-domain] [--email admin@example.com] [--user your-user] [--target-dir /path/to/app] [--enable-https yes|no] [--git-repo https://github.com/user/repo.git]"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --user) USER_NAME="$2"; shift 2 ;;
    --target-dir) TARGET_DIR="$2"; shift 2 ;;
    --enable-https) ENABLE_HTTPS="$2"; shift 2 ;;
    --git-repo) GIT_REPO="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash scripts/install-ubuntu.sh ..."
  exit 1
fi

# Устанавливаем TARGET_DIR по умолчанию в зависимости от пользователя
if [[ -z "$TARGET_DIR" ]]; then
  if [[ "$USER_NAME" == "root" ]]; then
    TARGET_DIR="/opt/med-timers"
  else
    # Если пользователь существует, используем его домашнюю папку
    if id "$USER_NAME" &>/dev/null; then
      USER_HOME=$(eval echo "~$USER_NAME")
      TARGET_DIR="$USER_HOME/med-timers"
    else
      # Если пользователя нет, будем создавать в /opt (если это medtimers) или в home
      if [[ "$USER_NAME" == "medtimers" ]]; then
         TARGET_DIR="/opt/med-timers"
      else
         TARGET_DIR="/home/$USER_NAME/med-timers"
      fi
    fi
  fi
fi

echo "Deploying to: $TARGET_DIR"
echo "Running as user: $USER_NAME"
apt-get update -y
apt-get install -y curl ca-certificates gnupg rsync nginx ufw git

echo "[2/8] Install Node.js LTS"
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs

echo "[3/8] Create user and target dir"
if ! id -u "$USER_NAME" >/dev/null 2>&1; then
  # -m создает домашнюю директорию /home/medtimers, чтобы у npm был кэш
  useradd -r -s /usr/sbin/nologin -m "$USER_NAME"
fi
mkdir -p "$TARGET_DIR"

echo "[4/8] Deploy project files"
if [[ -n "$GIT_REPO" ]]; then
  if [ -d "$TARGET_DIR/.git" ]; then
    echo "Updating existing repo in $TARGET_DIR..."
    cd "$TARGET_DIR"
    git pull
  elif [ -d "$TARGET_DIR" ]; then
    echo "Directory $TARGET_DIR exists but is not a git repo. Backing up..."
    BACKUP_DIR="${TARGET_DIR}_backup_$(date +%s)"
    mv "$TARGET_DIR" "$BACKUP_DIR"
    git clone "$GIT_REPO" "$TARGET_DIR"
    
    # Restore data files if they exist
    echo "Restoring data files from backup..."
    [ -f "$BACKUP_DIR/timers_log.csv" ] && cp "$BACKUP_DIR/timers_log.csv" "$TARGET_DIR/"
    [ -f "$BACKUP_DIR/procedures.json" ] && cp "$BACKUP_DIR/procedures.json" "$TARGET_DIR/"
  else
    echo "Cloning $GIT_REPO into $TARGET_DIR..."
    mkdir -p "$(dirname "$TARGET_DIR")"
    git clone "$GIT_REPO" "$TARGET_DIR"
  fi
else
  SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  rsync -a --delete --exclude "node_modules" --exclude ".git" "$SRC_DIR"/ "$TARGET_DIR"/
fi

# Исправление прав доступа (рекурсивно, включая .git)
echo "Fixing permissions..."
chown -R "$USER_NAME":"$USER_NAME" "$TARGET_DIR"
# Отмечаем директорию как безопасную для git
if command -v git &> /dev/null; then
  sudo -u "$USER_NAME" git config --global --add safe.directory "$TARGET_DIR" || true
fi

echo "[5/8] Install Node dependencies"
# Убеждаемся, что домашняя папка существует и принадлежит пользователю
if [[ ! -d "/home/$USER_NAME" ]]; then
  mkdir -p "/home/$USER_NAME"
  chown -R "$USER_NAME":"$USER_NAME" "/home/$USER_NAME"
fi

sudo -u "$USER_NAME" bash -lc "cd '$TARGET_DIR' && npm init -y >/dev/null 2>&1 || true"
sudo -u "$USER_NAME" bash -lc "cd '$TARGET_DIR' && npm install express ws --omit=dev"

echo "[6/8] Create systemd service"
cat >/etc/systemd/system/${SERVICE_NAME}.service <<EOF
[Unit]
Description=Med Timers Server
After=network.target

[Service]
Type=simple
User=${USER_NAME}
Group=${USER_NAME}
WorkingDirectory=${TARGET_DIR}
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${SERVICE_NAME}"

echo "[7/8] Configure Nginx (HTTP)"
NGX_CONF="/etc/nginx/sites-available/${SERVICE_NAME}.conf"
cat >"$NGX_CONF" <<'EOF'
server {
    listen 80 default_server;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400; # Увеличиваем таймаут для WebSocket
    }
}
EOF
ln -sf "$NGX_CONF" "/etc/nginx/sites-enabled/${SERVICE_NAME}.conf"
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl reload nginx

# Если задан DOMAIN — подставим его в server_name, чтобы certbot смог корректно найти сервер-блок
if [[ -n "$DOMAIN" ]]; then
  sed -i "s/server_name _;/server_name ${DOMAIN};/" "$NGX_CONF"
  nginx -t && systemctl reload nginx || true
fi

echo "[7.1/8] Configure firewall"
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
echo "y" | ufw enable || true

if [[ "$ENABLE_HTTPS" == "yes" && -n "$DOMAIN" && -n "$EMAIL" ]]; then
  echo "[8/8] Enable HTTPS via Let's Encrypt for ${DOMAIN}"
  snap list core >/dev/null 2>&1 || (snap install core && snap refresh core)
  snap install --classic certbot
  ln -sf /snap/bin/certbot /usr/bin/certbot
  certbot --nginx --non-interactive --agree-tos -m "$EMAIL" -d "$DOMAIN" || true
  systemctl reload nginx
else
  echo "[8/8] HTTPS skipped (set --enable-https yes --domain DOMAIN --email EMAIL to enable)"
fi

echo "Done."
echo "Admin:  http://${DOMAIN:-<server-ip>}/admin"
echo "Doctor: http://${DOMAIN:-<server-ip>}/doctor"
echo "Service: systemctl status ${SERVICE_NAME}"
  echo "Fix command (if fails): sudo bash scripts/install-ubuntu.sh --fix-perms --user $USER_NAME --target-dir $TARGET_DIR"
fi

if [[ "$1" == "--fix-perms" ]]; then
  echo "Fixing permissions only..."
  chown -R "$USER_NAME":"$USER_NAME" "$TARGET_DIR"
  sudo -u "$USER_NAME" git config --global --add safe.directory "$TARGET_DIR" || true
  systemctl restart "$SERVICE_NAME"
  echo "Done."
  exit 0
fi
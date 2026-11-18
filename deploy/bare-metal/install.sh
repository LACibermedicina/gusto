#!/usr/bin/env bash
# GUSTO · instalador para Debian/Ubuntu · by m3d.pro
set -Eeuo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR=/opt/gusto; ENV_FILE=/etc/gusto/gusto.env; DB=gusto
DOMAIN=""; PORT=3000; PUBLIC_PORT=443; EMAIL=""; ROOTPW="${GUSTO_ROOT_PASSWORD:-}"; TLS=1
log(){ printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die(){ printf '\033[1;31mErro:\033[0m %s\n' "$*" >&2; exit 1; }
trap 'die "falhou na linha $LINENO (veja a mensagem acima)"' ERR
usage(){ cat <<'EOF'
Uso: sudo ./install.sh --domain SUBDOMINIO [opções]
  --domain D         subdomínio de acesso, ex.: gusto.seudominio.com   (obrigatório)
  --port N           porta interna do app, ouvindo só em 127.0.0.1     (padrão 3000)
  --public-port N    porta pública do nginx para o subdomínio          (padrão 443)
  --email E          e-mail para avisos do Let's Encrypt
  --no-tls           sem HTTPS (apenas testes; o login do app exige HTTPS ou localhost)
A senha inicial do root é pedida na instalação (ou defina GUSTO_ROOT_PASSWORD).
EOF
}
while [[ $# -gt 0 ]]; do case "$1" in
  --domain) [[ $# -ge 2 ]] || die "faltou valor"; DOMAIN="$2"; shift 2;;
  --port) [[ $# -ge 2 ]] || die "faltou valor"; PORT="$2"; shift 2;;
  --public-port) [[ $# -ge 2 ]] || die "faltou valor"; PUBLIC_PORT="$2"; shift 2;;
  --email) [[ $# -ge 2 ]] || die "faltou valor"; EMAIL="$2"; shift 2;;
  --no-tls) TLS=0; shift;;
  -h|--help) usage; exit 0;;
  *) usage; die "opção desconhecida: $1";; esac; done

# ---- verificações ----
[[ $EUID -eq 0 ]] || die "execute como root (sudo)."
. /etc/os-release; [[ "${ID:-}" =~ ^(debian|ubuntu)$ || "${ID_LIKE:-}" == *debian* ]] || die "suportado apenas em Debian/Ubuntu."
[[ "$DOMAIN" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]] || { usage; die "informe --domain em minúsculas, ex.: gusto.seudominio.com"; }
for p in "$PORT" "$PUBLIC_PORT"; do [[ "$p" =~ ^[0-9]+$ && "$p" -ge 1 && "$p" -le 65535 ]] || die "porta inválida: $p"; done
[[ "$PORT" -ge 1024 ]] || die "use --port >= 1024 (o app roda sem privilégios)."
[[ "$TLS" == 0 || "$PUBLIC_PORT" != 80 ]] || die "com HTTPS a porta 80 fica reservada ao certificado; escolha outra --public-port."
[[ "$PORT" != "$PUBLIC_PORT" ]] || die "--port e --public-port devem ser diferentes."
if ss -ltnH "sport = :$PORT" | grep -q . && ! systemctl is-active --quiet gusto; then die "a porta interna $PORT já está em uso."; fi
if ss -ltnpH "sport = :$PUBLIC_PORT" | grep -q . && ! ss -ltnpH "sport = :$PUBLIC_PORT" | grep -q nginx; then die "a porta pública $PUBLIC_PORT está em uso por outro serviço."; fi
if [[ "$TLS" == 1 ]]; then getent hosts "$DOMAIN" >/dev/null || die "o DNS de $DOMAIN não resolve. Crie o registro A apontando para este servidor e tente de novo."; fi
if [[ -z "$ROOTPW" ]]; then
  [[ -t 0 ]] || die "defina GUSTO_ROOT_PASSWORD ou rode em um terminal."
  read -rsp "Senha inicial do root (mín. 6; será trocada no primeiro acesso): " ROOTPW; echo
  read -rsp "Repita a senha: " R2; echo; [[ "$ROOTPW" == "$R2" ]] || die "as senhas não conferem."
fi
[[ ${#ROOTPW} -ge 6 ]] || die "senha do root com pelo menos 6 caracteres."
SUFFIX=""; if [[ "$PUBLIC_PORT" != 443 && "$TLS" == 1 ]] || [[ "$PUBLIC_PORT" != 80 && "$TLS" == 0 ]]; then SUFFIX=":$PUBLIC_PORT"; fi
SCHEME=https; [[ "$TLS" == 1 ]] || SCHEME=http
URL="$SCHEME://$DOMAIN$SUFFIX"

# ---- pacotes ----
log "Instalando pacotes (nginx, PostgreSQL/PostGIS, certbot)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq nginx postgresql postgresql-contrib postgis certbot curl ca-certificates openssl >/dev/null
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]]; then
  log "Instalando Node.js 20 (repositório NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
NODE_BIN="$(command -v node)"

# ---- usuário e arquivos ----
id gusto &>/dev/null || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin gusto
install -d -o gusto -g gusto "$APP_DIR/app"
cp -a "$HERE/app/." "$APP_DIR/app/"; chown -R gusto:gusto "$APP_DIR"
log "Instalando dependências do app"
(cd "$APP_DIR/app" && runuser -u gusto -- env HOME="$APP_DIR" npm install --omit=dev --no-audit --no-fund --loglevel=error)

# ---- segredos e configuração ----
install -d -m 750 -o root -g gusto /etc/gusto
if [[ -f "$ENV_FILE" ]]; then
  DBPW="$(sed -n 's|^DATABASE_URL=postgres://gusto:\([^@]*\)@.*|\1|p' "$ENV_FILE")"
else
  DBPW="$(openssl rand -hex 16)"
  cat > "$ENV_FILE" <<EOF
DATABASE_URL=postgres://gusto:$DBPW@127.0.0.1:5432/$DB
CODE_SECRET=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 32)
HOST=127.0.0.1
NODE_ENV=production
PAYMENTS_PROVIDER=mock
EOF
fi
setenv(){ if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"; else echo "$1=$2" >> "$ENV_FILE"; fi; }
setenv PORT "$PORT"; setenv PUBLIC_URL "$URL"; setenv COOKIE_SECURE "$([[ "$TLS" == 1 ]] && echo 1 || echo 0)"
chown root:gusto "$ENV_FILE"; chmod 640 "$ENV_FILE"

# ---- banco de dados ----
pq(){ runuser -u postgres -- psql -v ON_ERROR_STOP=1 -qtA "$@"; }
log "Preparando o PostgreSQL"
systemctl enable --now postgresql >/dev/null
if [[ -z "$(pq -c "SELECT 1 FROM pg_roles WHERE rolname='gusto'")" ]]; then pq -c "CREATE ROLE gusto LOGIN PASSWORD '$DBPW'"; else pq -c "ALTER ROLE gusto PASSWORD '$DBPW'"; fi
if [[ -z "$(pq -c "SELECT 1 FROM pg_database WHERE datname='$DB'")" ]]; then pq -c "CREATE DATABASE $DB OWNER gusto"; fi
pq -d "$DB" -c "CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY, applied_at timestamptz DEFAULT now())"
Q="'"; ESC="${ROOTPW//$Q/$Q$Q}"
for f in "$HERE"/sql/*.sql; do n="$(basename "$f")"
  if [[ -z "$(pq -d "$DB" -c "SELECT 1 FROM schema_migrations WHERE name='$n'")" ]]; then
    log "Aplicando migração $n"
    { printf "SET app.root_initial_password = '%s';\n" "$ESC"; cat "$f"; printf "\nINSERT INTO schema_migrations(name) VALUES ('%s');\n" "$n"; } \
      | runuser -u postgres -- psql -v ON_ERROR_STOP=1 -q -1 -d "$DB" -f -
  fi
done
unset ROOTPW ESC
pq -d "$DB" -c "GRANT USAGE ON SCHEMA public TO gusto; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO gusto; GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO gusto; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO gusto; REVOKE ALL ON schema_migrations FROM gusto"

# ---- serviço systemd ----
log "Criando o serviço gusto"
cat > /etc/systemd/system/gusto.service <<EOF
[Unit]
Description=Gusto (app e API)
After=network.target postgresql.service
Requires=postgresql.service
[Service]
User=gusto
Group=gusto
WorkingDirectory=$APP_DIR/app
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN server.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload; systemctl enable gusto >/dev/null; systemctl restart gusto

# ---- nginx e HTTPS ----
SITE="/etc/nginx/sites-available/gusto-$DOMAIN.conf"
render(){ sed -e "s|@DOMAIN@|$DOMAIN|g" -e "s|@PORT@|$PORT|g" -e "s|@PUBLIC_PORT@|$PUBLIC_PORT|g" -e "s|@SUFFIX@|$SUFFIX|g"; }
PROXY='    client_max_body_size 1m;
    location / {
        proxy_pass http://127.0.0.1:@PORT@;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }'
install -d /var/www/certbot
if [[ "$TLS" == 0 ]]; then
  printf 'server {\n    listen @PUBLIC_PORT@;\n    listen [::]:@PUBLIC_PORT@;\n    server_name @DOMAIN@;\n%s\n}\n' "$PROXY" | render > "$SITE"
else
  if [[ ! -d "/etc/letsencrypt/live/$DOMAIN" ]]; then
    log "Obtendo certificado Let's Encrypt para $DOMAIN"
    printf 'server {\n    listen 80;\n    listen [::]:80;\n    server_name @DOMAIN@;\n    location /.well-known/acme-challenge/ { root /var/www/certbot; }\n    location / { return 404; }\n}\n' | render > "$SITE"
    ln -sf "$SITE" "/etc/nginx/sites-enabled/gusto-$DOMAIN.conf"; nginx -t; systemctl reload nginx
    MAIL=(--register-unsafely-without-email); [[ -z "$EMAIL" ]] || MAIL=(-m "$EMAIL")
    certbot certonly --webroot -w /var/www/certbot -d "$DOMAIN" --non-interactive --agree-tos "${MAIL[@]}" --deploy-hook "systemctl reload nginx"
  fi
  {
    printf 'server {\n    listen 80;\n    listen [::]:80;\n    server_name @DOMAIN@;\n    location /.well-known/acme-challenge/ { root /var/www/certbot; }\n    location / { return 301 https://@DOMAIN@@SUFFIX@$request_uri; }\n}\n'
    printf 'server {\n    listen @PUBLIC_PORT@ ssl http2;\n    listen [::]:@PUBLIC_PORT@ ssl http2;\n    server_name @DOMAIN@;\n    ssl_certificate /etc/letsencrypt/live/@DOMAIN@/fullchain.pem;\n    ssl_certificate_key /etc/letsencrypt/live/@DOMAIN@/privkey.pem;\n    ssl_protocols TLSv1.2 TLSv1.3;\n    add_header Strict-Transport-Security "max-age=31536000" always;\n%s\n}\n' "$PROXY"
  } | render > "$SITE"
fi
ln -sf "$SITE" "/etc/nginx/sites-enabled/gusto-$DOMAIN.conf"
nginx -t; systemctl enable nginx >/dev/null; systemctl reload nginx
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then ufw allow 80/tcp >/dev/null; ufw allow "$PUBLIC_PORT"/tcp >/dev/null; fi

# ---- backup diário ----
cat > /etc/cron.daily/gusto-backup <<'EOF'
#!/bin/sh
d=/var/backups/gusto; mkdir -p "$d"; chmod 700 "$d"
runuser -u postgres -- pg_dump gusto | gzip > "$d/gusto-$(date +%F).sql.gz"
find "$d" -name 'gusto-*.sql.gz' -mtime +14 -delete
EOF
chmod 755 /etc/cron.daily/gusto-backup

# ---- verificação ----
log "Verificando o serviço"
for i in $(seq 25); do curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null 2>&1 && OK=1 && break; sleep 1; done
[[ "${OK:-0}" == 1 ]] || { journalctl -u gusto -n 30 --no-pager; die "o serviço não respondeu em /health."; }
printf '\n\033[1;32mGusto instalado.\033[0m\n  Endereço:  %s\n  Serviço:   systemctl status gusto  ·  journalctl -u gusto -f\n  Config:    %s\n  Backups:   /var/backups/gusto (diário, 14 dias)\n  Login root na API: usuário "root" e a senha informada (troca obrigatória no 1º acesso).\n' "$URL" "$ENV_FILE"

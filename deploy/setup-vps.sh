#!/usr/bin/env bash
# GUSTO · preparação inicial e idempotente da VPS (Ubuntu/Debian) · by m3d.pro
# Instala/confere Docker, Nginx, Certbot e UFW; cria /opt/gusto (produção) e /opt/gusto-teste (homologação);
# gera segredos locais (nunca passam pelo GitHub); publica gusto.m3d.pro e gusto.m3d.pro/teste/ com HTTPS.
#
# Uso (na VPS, como root):
#   sudo bash setup-vps.sh --dominio gusto.m3d.pro --email voce@exemplo.com [--porta-prod 3301] [--porta-teste 3302] [--turn]
# Pode rodar de novo a qualquer momento: não apaga dados nem troca segredos existentes.
set -Eeuo pipefail
DOMINIO=""; EMAIL=""; PORTA_PROD=3301; PORTA_TESTE=3302; TURN=0
log(){ printf '\033[1;32m==>\033[0m %s\n' "$*"; }
aviso(){ printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die(){ printf '\033[1;31mErro:\033[0m %s\n' "$*" >&2; exit 1; }
trap 'die "falhou na linha $LINENO"' ERR

while [[ $# -gt 0 ]]; do case "$1" in
  --dominio) DOMINIO="${2:-}"; shift 2;;
  --email) EMAIL="${2:-}"; shift 2;;
  --porta-prod) PORTA_PROD="${2:-}"; shift 2;;
  --porta-teste) PORTA_TESTE="${2:-}"; shift 2;;
  --turn) TURN=1; shift;;
  -h|--help) sed -n '2,9p' "$0"; exit 0;;
  *) die "opção desconhecida: $1";; esac; done

[[ $EUID -eq 0 ]] || die "execute como root (sudo)."
. /etc/os-release; [[ "${ID:-}" =~ ^(debian|ubuntu)$ || "${ID_LIKE:-}" == *debian* ]] || die "suportado apenas em Debian/Ubuntu."
[[ "$DOMINIO" =~ ^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$ ]] || die "informe --dominio (ex.: gusto.m3d.pro)"
for p in "$PORTA_PROD" "$PORTA_TESTE"; do [[ "$p" =~ ^[0-9]+$ && "$p" -ge 1024 && "$p" -le 65535 ]] || die "porta inválida: $p"; done
[[ "$PORTA_PROD" != "$PORTA_TESTE" ]] || die "portas de produção e teste devem ser diferentes."
# Livre = ninguém escuta, ou quem escuta é um container do próprio Gusto (re-execução).
porta_livre(){ [[ -z "$(ss -ltnH "sport = :$1" || true)" ]] && return 0; docker ps --filter name=gusto --format '{{.Ports}}' 2>/dev/null | grep -F "127.0.0.1:$1->" >/dev/null; }

# ---------- pacotes ----------
log "Conferindo pacotes (Docker, Nginx, Certbot, UFW)"
export DEBIAN_FRONTEND=noninteractive
FALTA=(); for b in nginx certbot ufw rsync curl openssl; do command -v "$b" >/dev/null || FALTA+=("$b"); done
if ((${#FALTA[@]})); then apt-get update -qq; apt-get install -y -qq "${FALTA[@]}" >/dev/null; fi
if ! command -v docker >/dev/null; then
  log "Instalando Docker Engine (repositório oficial)"
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && sh /tmp/get-docker.sh >/dev/null && rm -f /tmp/get-docker.sh
fi
docker compose version >/dev/null 2>&1 || die "o plugin 'docker compose' não está disponível."
systemctl enable --now docker nginx >/dev/null

for p in "$PORTA_PROD" "$PORTA_TESTE"; do
  if ! porta_livre "$p"; then
    ss -ltnpH "sport = :$p" || true
    die "a porta $p já está em uso por outro serviço (a VPS hospeda outros apps). Escolha outra com --porta-prod/--porta-teste."
  fi
done

# ---------- firewall ----------
# Não reseta regras existentes (VPS compartilhada). Docker só publica em 127.0.0.1, então o UFW não é contornado.
log "Configurando UFW"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
if [[ "$TURN" == 1 ]]; then ufw allow 3478 >/dev/null; ufw allow 49160:49200/udp >/dev/null; fi
# (sem grep -q nos pipes: com pipefail o SIGPIPE derrubaria o script)
if ! ufw status | grep "Status: active" >/dev/null; then aviso "UFW estava inativo; ativando com SSH liberado."; ufw --force enable >/dev/null; fi

# ---------- diretórios e segredos ----------
gerar_env(){ # $1=ambiente $2=raiz $3=porta $4=base $5=cookie $6=projeto
  local amb="$1" raiz="$2" porta="$3" base="$4" cookie="$5" proj="$6" arq="$2/.env.gerado"
  install -d -m 750 "$raiz" "$raiz/codigo" "$raiz/backups"
  if [[ ! -f "$arq" ]]; then
    log "Gerando segredos de $amb em $arq"
    local rootpw; rootpw="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
    umask 077
    cat > "$arq" <<EOF
# Gerado por setup-vps.sh em $(date -Is). NÃO versionar. Segredos extras (IA, PSP) vêm do GitHub em .env.segredos.
POSTGRES_SUPERUSER_PASSWORD=$(openssl rand -hex 24)
GUSTO_DB_PASSWORD=$(openssl rand -hex 24)
GUSTO_ROOT_PASSWORD=$rootpw
CODE_SECRET=$(openssl rand -hex 32)
WEBHOOK_SECRET=$(openssl rand -hex 32)
TURN_SECRET=$(openssl rand -hex 24)
EOF
    umask 022
    printf '\n\033[1;36mSenha inicial do root (%s): %s\033[0m  (troca obrigatória no 1º acesso; fica em %s)\n\n' "$amb" "$rootpw" "$arq"
  fi
  # Parâmetros não secretos: sempre reescritos para refletir os argumentos atuais.
  sed -i '/^# --- ambiente ---$/,$d' "$arq"
  cat >> "$arq" <<EOF
# --- ambiente ---
COMPOSE_PROJECT_NAME=$proj
APP_IMAGE=$proj-app
AMBIENTE=$amb
DOMINIO=$DOMINIO
PORTA=$porta
BASE_PATH=$base
COOKIE_NAME=$cookie
PUBLIC_URL=https://$DOMINIO$base
COOKIE_SECURE=1
BACKUP_DIR=$raiz/backups
EOF
  [[ "$TURN" == 1 ]] && echo "TURN_URL=turn:$DOMINIO:3478?transport=udp,turn:$DOMINIO:3478?transport=tcp" >> "$arq"
  chmod 600 "$arq"
}
gerar_env producao /opt/gusto "$PORTA_PROD" "" gusto_sid gusto
gerar_env teste /opt/gusto-teste "$PORTA_TESTE" "/teste" gusto_sid_teste gusto-teste

# ---------- Nginx + HTTPS ----------
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TPL="$HERE/nginx/gusto.conf.tpl"; [[ -f "$TPL" ]] || TPL="/opt/gusto/codigo/deploy/nginx/gusto.conf.tpl"
[[ -f "$TPL" ]] || die "modelo do Nginx não encontrado (deploy/nginx/gusto.conf.tpl)."
SITE="/etc/nginx/sites-available/$DOMINIO.conf"
# Instalação antiga (deploy/bare-metal/install.sh) publica o mesmo domínio em gusto-$DOMINIO.conf:
# dois server_name iguais fazem o Nginx servir o primeiro que carregar. Desativa o antigo (com cópia).
for antigo in "/etc/nginx/sites-enabled/gusto-$DOMINIO.conf" /etc/nginx/sites-enabled/default; do
  [[ -e "$antigo" ]] || continue
  if [[ "$antigo" == */default ]]; then
    grep -E "server_name[^;]*\b$DOMINIO\b" "$antigo" >/dev/null || continue
  fi
  aviso "desativando site Nginx antigo para $DOMINIO: $antigo (cópia em /root/nginx-antigo-$(basename "$antigo").bak)"
  cp -L "$antigo" "/root/nginx-antigo-$(basename "$antigo").bak"; rm -f "$antigo"
done
if systemctl is-active --quiet gusto 2>/dev/null; then
  aviso "o serviço 'gusto' da instalação antiga (sem Docker) continua rodando na porta interna dele; ele não atende mais o domínio."
  aviso "  para desligar: systemctl disable --now gusto   (o banco antigo do host é mantido)"
fi
cat > /etc/nginx/conf.d/gusto-websocket-map.conf <<'EOF'
# GUSTO · cabeçalho Connection para WebSocket (nome próprio para não colidir com outros sites)
map $http_upgrade $gusto_connection_upgrade { default upgrade; '' close; }
EOF
install -d /var/www/certbot
if [[ ! -s "/etc/letsencrypt/live/$DOMINIO/fullchain.pem" ]]; then
  IP_DNS="$(getent ahostsv4 "$DOMINIO" | awk 'NR==1{print $1}')"
  [[ -n "$IP_DNS" ]] || die "o DNS de $DOMINIO ainda não resolve. Crie o registro A apontando para este servidor e rode de novo."
  MEUS_IPS=" $(hostname -I) $(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || true) "
  [[ "$MEUS_IPS" == *" $IP_DNS "* ]] || die "o DNS de $DOMINIO aponta para $IP_DNS, mas este servidor é$(echo "$MEUS_IPS" | tr -s ' ' | sed 's/ $//'). Corrija o registro A e rode de novo (o certificado falharia)."
  log "Emitindo certificado Let's Encrypt para $DOMINIO"
  printf 'server {\n  listen 80;\n  listen [::]:80;\n  server_name %s;\n  location /.well-known/acme-challenge/ { root /var/www/certbot; }\n  location / { return 404; }\n}\n' "$DOMINIO" > "$SITE"
  ln -sf "$SITE" "/etc/nginx/sites-enabled/$DOMINIO.conf"; nginx -t; systemctl reload nginx
  MAIL=(--register-unsafely-without-email); [[ -z "$EMAIL" ]] || MAIL=(-m "$EMAIL")
  certbot certonly --webroot -w /var/www/certbot -d "$DOMINIO" --non-interactive --agree-tos "${MAIL[@]}" --deploy-hook "systemctl reload nginx"
fi
sed -e "s|@DOMINIO@|$DOMINIO|g" -e "s|@PORTA_PROD@|$PORTA_PROD|g" -e "s|@PORTA_TESTE@|$PORTA_TESTE|g" "$TPL" > "$SITE"
ln -sf "$SITE" "/etc/nginx/sites-enabled/$DOMINIO.conf"
nginx -t && systemctl reload nginx
systemctl list-timers --all 2>/dev/null | grep certbot >/dev/null || aviso "timer de renovação do certbot não encontrado; confira 'systemctl list-timers'."

# ---------- automação (chave de deploy, atualizações de segurança, manutenção semanal) ----------
if [[ -f "$HERE/automatizar-vps.sh" ]]; then bash "$HERE/automatizar-vps.sh"; fi

log "VPS pronta."
cat <<EOF

  Produção:     https://$DOMINIO           → 127.0.0.1:$PORTA_PROD   (/opt/gusto, branch main)
  Homologação:  https://$DOMINIO/teste/    → 127.0.0.1:$PORTA_TESTE  (/opt/gusto-teste, branch teste)

  Secrets do GitHub: veja acima (cadastrados sozinhos se o gh estiver logado nesta VPS).
  Opcional: SERVIDOR_ENV com chaves de IA/PSP/LGPD, uma VAR=valor por linha (ver .env.example).
  Depois: git push origin teste   → publica em /teste/
EOF

#!/usr/bin/env bash
# GUSTO · automação da VPS (rodar uma vez, como root; idempotente) · by m3d.pro
#  1. Chave SSH exclusiva para o GitHub Actions publicar (e cadastro automático dos secrets se o gh estiver logado)
#  2. Atualizações de segurança do sistema sem reinício automático (VPS compartilhada)
#  3. Manutenção semanal local: limpeza do Docker, alerta de disco, renovação de certificados, conferência de backups
# Uso: sudo bash automatizar-vps.sh [--host 159.223.22.82] [--repo LACibermedicina/gusto]
set -Eeuo pipefail
HOST="$(hostname -I | awk '{print $1}')"; REPO="LACibermedicina/gusto"
while [[ $# -gt 0 ]]; do case "$1" in --host) HOST="${2:-}"; shift 2;; --repo) REPO="${2:-}"; shift 2;; *) echo "opção desconhecida: $1" >&2; exit 2;; esac; done
log(){ printf '\033[1;32m==>\033[0m %s\n' "$*"; }
[[ $EUID -eq 0 ]] || { echo "execute como root (sudo)" >&2; exit 1; }

# ---------- 1. chave de deploy ----------
K=/root/.ssh/gusto_deploy
install -d -m 700 /root/.ssh; touch /root/.ssh/authorized_keys; chmod 600 /root/.ssh/authorized_keys
if [[ ! -f "$K" ]]; then log "Gerando chave de deploy $K"; ssh-keygen -q -t ed25519 -N "" -C "github-actions@$REPO" -f "$K"; fi
grep -qxF "$(cat "$K.pub")" /root/.ssh/authorized_keys || cat "$K.pub" >> /root/.ssh/authorized_keys
KNOWN="$(for f in /etc/ssh/ssh_host_ed25519_key.pub /etc/ssh/ssh_host_ecdsa_key.pub; do if [[ -f "$f" ]]; then awk -v h="$HOST" '{print h" "$1" "$2}' "$f"; fi; done)"

SECRETS_OK=0
if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  log "Cadastrando secrets no GitHub ($REPO) com o gh"
  gh secret set VPS_HOST -R "$REPO" -b "$HOST"
  gh secret set VPS_USER -R "$REPO" -b "root"
  gh secret set VPS_SSH_KEY -R "$REPO" < "$K"
  printf '%s\n' "$KNOWN" | gh secret set VPS_KNOWN_HOSTS -R "$REPO"
  SECRETS_OK=1
fi

# ---------- 2. atualizações de segurança ----------
log "Ativando atualizações automáticas de segurança (sem reinício automático)"
export DEBIAN_FRONTEND=noninteractive
dpkg -s unattended-upgrades >/dev/null 2>&1 || { apt-get update -qq; apt-get install -y -qq unattended-upgrades >/dev/null; }
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
cat > /etc/apt/apt.conf.d/52gusto-unattended <<'CONF'
// GUSTO: só segurança; nunca reinicia sozinho (outros apps rodam nesta VPS). Reinício pendente aparece no relatório semanal.
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Package-Blacklist { "docker-ce"; "docker-ce-cli"; "containerd.io"; };  // reiniciar o Docker derrubaria todos os apps
CONF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true

# ---------- 3. manutenção semanal ----------
log "Instalando manutenção semanal (gusto-manutencao.timer)"
cat > /usr/local/sbin/gusto-manutencao <<'SH'
#!/usr/bin/env bash
# GUSTO · manutenção semanal da VPS (journalctl -t gusto-manutencao)
set -uo pipefail
L(){ logger -t gusto-manutencao "$*"; echo "$*"; }
docker builder prune -f --filter until=168h >/dev/null 2>&1 && L "cache de build do Docker limpo"
docker image prune -f >/dev/null 2>&1 && L "imagens órfãs removidas"
certbot renew --quiet && L "certificados conferidos/renovados"
USO="$(df --output=pcent / | tail -1 | tr -dc '0-9')"
if (( USO >= 85 )); then L "ALERTA: disco em ${USO}%"; else L "disco em ${USO}%"; fi
for d in /opt/gusto/backups /opt/gusto-teste/backups; do
  [[ -d "$d" ]] || continue
  if [[ -n "$(find "$d" -name 'gusto-*.sql.gz' -mtime -2 -size +1k -print -quit)" ]]; then L "backup recente ok em $d"; else L "ALERTA: sem backup recente em $d"; fi
done
[[ -f /var/run/reboot-required ]] && L "AVISO: atualização de segurança pede reinício (agende manualmente)"
exit 0
SH
chmod 755 /usr/local/sbin/gusto-manutencao
cat > /etc/systemd/system/gusto-manutencao.service <<'UNIT'
[Unit]
Description=Gusto - manutenção semanal da VPS
After=docker.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/gusto-manutencao
UNIT
cat > /etc/systemd/system/gusto-manutencao.timer <<'UNIT'
[Unit]
Description=Gusto - manutenção semanal (domingo, depois do rebuild do GitHub)
[Timer]
OnCalendar=Sun *-*-* 09:30:00 UTC
Persistent=true
RandomizedDelaySec=10m
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now gusto-manutencao.timer >/dev/null

log "Automação da VPS pronta."
systemctl list-timers gusto-manutencao.timer --no-pager | sed -n '1,2p'
if [[ "$SECRETS_OK" == 1 ]]; then
  echo; echo "Secrets VPS_HOST, VPS_USER, VPS_SSH_KEY e VPS_KNOWN_HOSTS cadastrados em $REPO."
else
  cat <<TXT

Cadastre no GitHub ($REPO → Settings → Secrets and variables → Actions → New repository secret):
  VPS_HOST         = $HOST
  VPS_USER         = root
  VPS_KNOWN_HOSTS  = (as linhas abaixo)
$KNOWN
  VPS_SSH_KEY      = conteúdo de:  cat $K
                     (copie tudo, de -----BEGIN até -----END; depois rode 'clear')
TXT
fi

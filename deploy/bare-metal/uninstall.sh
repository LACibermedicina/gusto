#!/usr/bin/env bash
# GUSTO · desinstalador. Use --purge para apagar também o banco, a configuração e os backups.
set -Eeuo pipefail
[[ $EUID -eq 0 ]] || { echo "execute como root"; exit 1; }
PURGE=0; [[ "${1:-}" == "--purge" ]] && PURGE=1
systemctl disable --now gusto 2>/dev/null || true
rm -f /etc/systemd/system/gusto.service /etc/cron.daily/gusto-backup /etc/nginx/sites-enabled/gusto-*.conf /etc/nginx/sites-available/gusto-*.conf
systemctl daemon-reload; nginx -t && systemctl reload nginx || true
if [[ $PURGE == 1 ]]; then
  read -rp 'Isto APAGA banco, configuração e backups. Digite APAGAR para confirmar: ' c; [[ "$c" == APAGAR ]] || { echo "cancelado"; exit 1; }
  runuser -u postgres -- psql -qc "DROP DATABASE IF EXISTS gusto" -c "DROP ROLE IF EXISTS gusto" || true
  rm -rf /opt/gusto /etc/gusto /var/backups/gusto; userdel gusto 2>/dev/null || true
  echo "Removido por completo. Certificados em /etc/letsencrypt foram mantidos."
else echo "Serviço e nginx removidos. Dados mantidos (banco, /etc/gusto, /opt/gusto). Use --purge para apagar tudo."; fi

#!/usr/bin/env bash
# GUSTO · publicação na VPS (chamado pelo GitHub Actions depois do rsync) · by m3d.pro
# Uso: bash remote-deploy.sh --ambiente producao|teste
# Faz: monta .env (gerado + segredos do GitHub) → guarda imagem anterior → build → migrações → sobe → checa /health → rollback se falhar.
set -Eeuo pipefail
AMB=""
while [[ $# -gt 0 ]]; do case "$1" in --ambiente) AMB="${2:-}"; shift 2;; *) echo "opção desconhecida: $1" >&2; exit 2;; esac; done
case "$AMB" in producao) RAIZ=/opt/gusto;; teste) RAIZ=/opt/gusto-teste;; *) echo "use --ambiente producao|teste" >&2; exit 2;; esac
log(){ printf '[deploy:%s] %s\n' "$AMB" "$*"; }
[[ -f "$RAIZ/.env.gerado" ]] || { log "falta $RAIZ/.env.gerado — rode deploy/setup-vps.sh antes"; exit 1; }

# .env final: segredos do GitHub primeiro, gerados por último (os parâmetros de ambiente sempre vencem).
umask 077
{ [[ -f "$RAIZ/.env.segredos" ]] && cat "$RAIZ/.env.segredos"; echo; cat "$RAIZ/.env.gerado"; } > "$RAIZ/.env.novo"
mv "$RAIZ/.env.novo" "$RAIZ/.env"; chmod 600 "$RAIZ/.env"
umask 022
set -a; . "$RAIZ/.env"; set +a

cd "$RAIZ/codigo"
DC=(docker compose --env-file "$RAIZ/.env" -p "$COMPOSE_PROJECT_NAME")
IMG="${APP_IMAGE}:latest"; ANT="${APP_IMAGE}:previous"

if docker image inspect "$IMG" >/dev/null 2>&1; then docker image tag "$IMG" "$ANT"; log "imagem anterior guardada como $ANT"; fi
log "build da imagem"
"${DC[@]}" build --pull app
log "subindo serviços (migrações rodam antes da app)"
if ! "${DC[@]}" up -d --remove-orphans; then
  "${DC[@]}" logs --tail=60 migrate app || true
  FALHOU=1
fi

saudavel(){ for _ in $(seq 40); do curl -fsS "http://127.0.0.1:$PORTA/health" >/dev/null 2>&1 && return 0; sleep 2; done; return 1; }
if [[ -z "${FALHOU:-}" ]] && saudavel; then
  log "ok: http://127.0.0.1:$PORTA/health respondeu ($(cat "$RAIZ/codigo/VERSION" 2>/dev/null || echo '?'))"
  docker image prune -f >/dev/null || true
  docker builder prune -f --filter until=72h >/dev/null || true
  exit 0
fi

log "FALHA na verificação de saúde"
"${DC[@]}" logs --tail=80 app || true
if docker image inspect "$ANT" >/dev/null 2>&1; then
  log "rollback para $ANT (migrações não são revertidas: elas são sempre aditivas)"
  docker image tag "$ANT" "$IMG"
  "${DC[@]}" up -d --no-build app || true
  saudavel && log "rollback concluído; versão anterior no ar" || log "rollback também falhou — intervenção manual"
fi
exit 1

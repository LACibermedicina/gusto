#!/bin/bash
# GUSTO · publica automaticamente os pacotes (git bundle) entregues pelo Claude · by m3d.pro
# Roda pelo launchd sempre que algo muda em ~/m3d/entregas (e a cada 10 min). Também pode ser chamado à mão.
# Para cada gusto-*.bundle novo: confere → avança a branch "teste" (só fast-forward) → git push → notifica.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
REPO="${GUSTO_REPO:-$HOME/m3d/gusto}"
ENTREGAS="${GUSTO_ENTREGAS:-$HOME/m3d/entregas}"
FEITOS="$ENTREGAS/aplicados"
LOG="$HOME/Library/Logs/gusto-publicar.log"
TRAVA="/tmp/gusto-publicar.lock"

log(){ printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$LOG"; }
avisar(){ osascript -e "display notification \"$2\" with title \"Gusto\" subtitle \"$1\"" >/dev/null 2>&1 || true; log "$1: $2"; }

mkdir "$TRAVA" 2>/dev/null || exit 0          # já tem uma publicação em andamento
trap 'rmdir "$TRAVA"' EXIT
mkdir -p "$FEITOS" "$(dirname "$LOG")"
shopt -s nullglob
PACOTES=("$ENTREGAS"/gusto-*.bundle)
((${#PACOTES[@]})) || exit 0

cd "$REPO" || { avisar "Erro" "repositório não encontrado em $REPO"; exit 1; }
if [[ -n "$(git status --porcelain --untracked-files=no)" ]]; then avisar "Publicação pausada" "há alterações locais não salvas em $REPO"; exit 1; fi

# Mais novo primeiro: se ele já contém os anteriores, um único push basta; os antigos viram "nada novo".
# Pacote que depende de outro ainda não aplicado é pulado nesta volta e tentado na próxima.
for volta in 1 2 3 4 5 6 7 8; do
PACOTES=("$ENTREGAS"/gusto-*.bundle); ((${#PACOTES[@]})) || break
IFS=$'\n' ORDEM=($(ls -t "${PACOTES[@]}")); unset IFS
progresso=0
for b in "${ORDEM[@]}"; do
  nome="$(basename "$b")"
  git fetch -q origin teste main --tags 2>>"$LOG" || { avisar "Sem conexão" "não consegui falar com o GitHub; tento de novo depois"; exit 1; }
  git checkout -q teste 2>>"$LOG" || git checkout -q -b teste origin/teste
  git merge -q --ff-only origin/teste 2>>"$LOG" || { avisar "Erro" "a branch teste local divergiu do GitHub"; exit 1; }
  if ! git bundle verify -q "$b" >>"$LOG" 2>&1; then avisar "Pacote incompleto" "$nome depende de um pacote anterior que não está aqui"; continue; fi
  antes="$(git rev-parse HEAD)"
  git fetch -q "$b" teste >>"$LOG" 2>&1 || { avisar "Erro" "não consegui ler $nome"; continue; }
  if ! git merge -q --ff-only FETCH_HEAD >>"$LOG" 2>&1; then
    # O GitHub recebeu outra coisa no meio (ex.: PR do Dependabot): junta sem conflito ou para e avisa.
    NOME="$(git config user.name || echo "Gusto (publicação automática)")"; EMAIL="$(git config user.email || echo "noreply@m3d.pro")"
    if ! git -c user.name="$NOME" -c user.email="$EMAIL" merge -q --no-edit -m "Junta $nome com a branch teste" FETCH_HEAD >>"$LOG" 2>&1; then
      git merge --abort >/dev/null 2>&1; avisar "Conflito" "$nome conflita com mudanças novas na branch teste; peça ao Claude um pacote atualizado"; continue
    fi
  fi
  git fetch -q "$b" 'refs/tags/*:refs/tags/*' >>"$LOG" 2>&1 || true
  if [[ "$(git rev-parse HEAD)" == "$antes" ]]; then log "$nome: nada novo"; mv "$b" "$FEITOS/"; progresso=1; continue; fi
  if git push -q origin teste --tags >>"$LOG" 2>&1; then
    versao="$(cat VERSION 2>/dev/null || git log -1 --format=%s)"
    mv "$b" "$FEITOS/"
    avisar "Enviado para homologação" "v$versao → gusto.m3d.pro/teste/ (deploy automático em andamento)"
    progresso=1; break
  else
    avisar "Push recusado" "confira o login do GitHub no Terminal (git push) — detalhes em $LOG"; exit 1
  fi
done
((progresso)) || break
done

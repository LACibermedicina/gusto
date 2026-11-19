#!/bin/bash
# GUSTO · instala a publicação automática no Mac (rodar uma vez no Terminal) · by m3d.pro
#   bash instalar.sh            instala/atualiza
#   bash instalar.sh --remover  desinstala
set -euo pipefail
ROTULO="pro.m3d.gusto-publicar"
BASE="$HOME/m3d"; REPO="$BASE/gusto"; ENTREGAS="$BASE/entregas"
APP="$HOME/Library/Application Support/gusto"; PLIST="$HOME/Library/LaunchAgents/$ROTULO.plist"
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "--remover" ]]; then
  launchctl bootout "gui/$(id -u)/$ROTULO" 2>/dev/null || true
  rm -f "$PLIST" "$APP/publicar-bundle.sh"; echo "Publicação automática removida (repositório e pacotes mantidos)."; exit 0
fi

command -v git >/dev/null || { echo "Instale o git (xcode-select --install) e rode de novo."; exit 1; }
mkdir -p "$ENTREGAS/aplicados" "$APP" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"

# Cópia de trabalho fora de Downloads/Documentos/Mesa (pastas protegidas pelo macOS para tarefas em segundo plano).
if [[ ! -d "$REPO/.git" ]]; then
  if [[ -d "$HOME/Downloads/gusto/.git" ]]; then git clone -q "$HOME/Downloads/gusto" "$REPO"; git -C "$REPO" remote set-url origin https://github.com/LACibermedicina/gusto.git
  else git clone -q https://github.com/LACibermedicina/gusto.git "$REPO"; fi
fi
git -C "$REPO" fetch -q origin
git -C "$REPO" checkout -q teste 2>/dev/null || git -C "$REPO" checkout -q -b teste origin/teste
git -C "$REPO" config credential.helper osxkeychain

# Pacotes que já estavam em Downloads vão para a pasta de entregas.
for b in "$HOME"/Downloads/gusto-*.bundle; do [[ -e "$b" ]] && mv -n "$b" "$ENTREGAS/"; done

SCRIPT="$AQUI/publicar-bundle.sh"; [[ -f "$SCRIPT" ]] || SCRIPT="$REPO/deploy/mac/publicar-bundle.sh"
install -m 755 "$SCRIPT" "$APP/publicar-bundle.sh"

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$ROTULO</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$APP/publicar-bundle.sh</string></array>
  <key>WatchPaths</key><array><string>$ENTREGAS</string></array>
  <key>StartInterval</key><integer>600</integer>
  <key>ThrottleInterval</key><integer>20</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/gusto-publicar.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/gusto-publicar.log</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$ROTULO" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Testando acesso ao GitHub (se pedir usuário/token, informe uma vez; fica no Keychain)…"
git -C "$REPO" push --dry-run origin teste >/dev/null && echo "GitHub ok."
cat <<TXT

Pronto. A partir de agora:
  • pacotes do Claude chegam em  $ENTREGAS
  • são enviados sozinhos para a branch teste → gusto.m3d.pro/teste/
  • você recebe uma notificação do macOS a cada envio
  • histórico: $HOME/Library/Logs/gusto-publicar.log
Desinstalar: bash "$AQUI/instalar.sh" --remover
TXT

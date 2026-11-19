# Gusto · by m3d.pro

Plataforma para trocar receitas, pedir preparo, alugar espaços e itens e entregar com rastreio por código — agora com a **camada Gusto OS**: janelas estilo macOS, ícones 3D, tradução por IA em 5 idiomas, grafo de funcionalidades, notas da agenda, comunidade com vídeo e um mascote 3D assistente.

**Versão:** `0.4.0-alpha` · [CHANGELOG](CHANGELOG.md) · [Arquitetura](docs/ARQUITETURA.md) · [LGPD](docs/LGPD.md) · Manuais da app base em [`docs/manuais/`](docs/manuais/)

| Ambiente | Branch | Endereço | Na VPS |
|---|---|---|---|
| Homologação | `teste` | https://gusto.m3d.pro/teste/ | `/opt/gusto-teste` · porta 3302 |
| Produção | `main` | https://gusto.m3d.pro | `/opt/gusto` · porta 3301 |

Toda mudança vai primeiro para `teste`. Depois de testar, promova com o workflow **promover** (digite `PROMOVER`) ou um PR `teste → main`.

## Estrutura
```
app/                 Node 22 + Express: server.js (API base) · os/ (camada OS: rotas, IA, LGPD, WebSocket) · public/ (index.html base + os/)
db/migrations/       001–003 da base · 004_os_layer.sql
deploy/              setup-vps.sh · remote-deploy.sh · migrate.sh · nginx/ · bare-metal/ (instalador antigo, sem Docker)
.github/workflows/   deploy.yml (testes → deploy) · promover.yml
test/                testes unitários (node --test)
```

## Primeira publicação
1. **DNS (Hostinger):** registro `A` `gusto` → IP da VPS.
2. **VPS:** `make setup-vps VPS=root@SEU_IP EMAIL=seu@email` (ou copie `deploy/` e rode `sudo bash setup-vps.sh --dominio gusto.m3d.pro --email ...`). Anote a senha inicial do root impressa no final.
3. **GitHub → Settings → Secrets → Actions:** `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (opcional `VPS_KNOWN_HOSTS`) e, se quiser IA, `SERVIDOR_ENV` com linhas `VAR=valor` (ver `.env.example`).
4. `git push origin teste` → abre em `/teste/`. Testou? Rode **promover**.

## O que é automático
| Quando | O quê |
|---|---|
| push em `teste` / `main` | testes → publicação em `/teste/` / produção, com rollback se `/health` falhar |
| domingo 04:17 | rebuild semanal com imagens base atualizadas (teste → produção) |
| segunda 06:00 | Dependabot abre PRs de dependências contra `teste` |
| diário | backup do banco (14 dias) e atualizações de segurança do Ubuntu |
| domingo 06:30 | manutenção da VPS: limpeza do Docker, disco, certificados, backups (`journalctl -t gusto-manutencao`) |

Pacotes entregues pelo Claude em `~/m3d/entregas` são publicados sozinhos em `/teste/` pelo agente instalado com `bash deploy/mac/instalar.sh`.

O que continua manual, de propósito: promover `teste → main` e reiniciar a VPS quando uma atualização pedir.

## Desenvolvimento local
```bash
make env && make up        # http://localhost:3301 (precisa de Docker)
make test                  # testes unitários
```
Primeiro acesso: abra **Conta** (ícone à direita), entre como `root` com `GUSTO_ROOT_PASSWORD` e troque a senha.

## Limites atuais
- A interface base ainda guarda seus dados no navegador (modo local); os módulos da camada OS já usam a API real. Unificar o login é o próximo passo.
- Sem chaves de IA, a tradução cobre só os menus do Gusto OS e o assistente usa busca local.

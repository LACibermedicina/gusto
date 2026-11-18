# Gusto · Arquitetura (v0.1.0-alpha)

## 1. Visão geral
```
Navegador ── index.html base (modo local) + camada OS injetada (/os/*.js, ES modules, sem build)
   │  HTTPS / WSS
Nginx do host (TLS Let's Encrypt; / → 3301 produção; /teste/ → 3302 homologação)
   │  http://127.0.0.1:PORTA
Container app  (Node 22: Express API base + /os-api + WebSocket /os-ws)
   │  rede interna Docker
Container db   (PostgreSQL 16 + PostGIS)      migrate (one-shot)  ·  backup (diário)  ·  turn (opcional)
```
A VPS é compartilhada com outros apps (Pratica, Revalida), por isso o proxy é o Nginx do host e nada publica fora de `127.0.0.1`.

## 2. Camada OS sem tocar na base
`app/os/index.js` lê `public/index.html` e injeta `<meta>` de ambiente, `os.css` e `boot.js`. Em homologação injeta também um isolador de `localStorage` (prefixo `teste:`), porque produção e teste compartilham a origem `gusto.m3d.pro`.

## 3. Front-end (`app/public/os/`)
| Arquivo | Papel |
|---|---|
| `boot.js` | Barra superior, bandeiras, mesa de ícones, menu lateral, registro de módulos |
| `wm.js` | Gerenciador de janelas (arrastar, 8 bordas, foco, minimizar/maximizar, duplo clique fora, Esc) |
| `i18n.js` | Dicionários estáticos + tradutor de tela por IA (TreeWalker + MutationObserver, originais restauráveis) |
| `icones.js` | Glifos SVG volumétricos estilo Pixar |
| `sessao.js` | Sessão da API e permissões por funcionalidade |
| `mods/*.js` | grafo, notas, comunidade (chat + WebRTC), avatar (Three.js), privacidade, sobre, conta |

## 4. Back-end (`app/os/`)
| Rota | Acesso | Função |
|---|---|---|
| `GET /os-api/info` | público | versão, ambiente, IA ativa, LGPD, ICE (TURN só logado) |
| `GET /os-api/permissoes` | sessão | funcionalidades liberadas (`can_use`) |
| `POST /os-api/traduzir` | público + consentimento + limite por IP | tradução contextual em lote, com cache |
| `GET/PUT /os-api/grafo` | `os_graph` | grafo do usuário (validado) |
| `/os-api/notas…` | `notes` | CRUD, busca e ligações cruzadas |
| `/os-api/chat/salas…` + `WS /os-ws` | `chat` / `video` | histórico, tempo real e sinalização WebRTC |
| `/os-api/avatar/*` | `avatar` (+`ai`) | estado (XP, mudo) e perguntas |
| `/os-api/lgpd/*` | sessão | consentimentos, exportar, excluir |

## 5. IA
`os/ia.js`: ordem `IA_ORDEM`, várias chaves por provedor, quarentena (401/403: 6 h; 429: 10 min; outros: 2 min), timeout de 25 s. Todo texto passa por `mascarar()` antes e `restaurar()` depois.

## 6. Segurança
CSP (helmet), cookies `HttpOnly`/`SameSite=Lax`/`Secure`, JSON obrigatório em escritas (CSRF), WebSocket com checagem de `Origin` + sessão + permissão, limites de taxa (login, tradução, avatar, chat), contêineres sem privilégios, segredos fora do Git.

## 7. Operação
`remote-deploy.sh` guarda `:previous`, aplica migrações (sempre aditivas), checa `/health` e faz rollback da imagem se falhar. Backups em `/opt/gusto*/backups`. Restaurar: `zcat backup.sql.gz | docker compose exec -T db psql -U postgres gusto`.

## 8. Próximas iterações (backlog)
1. Ligar a interface base à API (seção 10.3 do Manual Técnico) e unificar login.
2. Testes de integração com PostGIS no CI.
3. TURN em produção (`--turn`) e teste de vídeo entre redes.
4. Painel do root para liberar funcionalidades da camada OS por usuário.
5. PDF ilustrado e hotsite de documentação — **somente quando solicitados**.

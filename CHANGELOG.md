# Changelog — Gusto

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · versionamento [SemVer](https://semver.org/lang/pt-BR/).
Fluxo: toda mudança entra pela branch `teste` (https://gusto.m3d.pro/teste/) e só vai para `main` (produção) depois de testada.

## [Não lançado]
Próxima iteração (sugestão, ver `docs/ARQUITETURA.md` §8): ligar a interface base à API (login único), testes de integração com PostGIS no CI, TURN em produção.

## [0.1.1-alpha] — 2026-11-18
Automação das atualizações (GitHub → VPS e manutenção da própria VPS).

### Adicionado
- `deploy/automatizar-vps.sh` (rodar uma vez na VPS): chave SSH exclusiva de deploy e cadastro automático dos secrets (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`) quando o `gh` está logado; atualizações automáticas de segurança do Ubuntu **sem reinício automático** e sem atualizar o Docker sozinho; timer semanal `gusto-manutencao` (limpeza do Docker, alerta de disco ≥ 85%, renovação de certificados, conferência dos backups, aviso de reinício pendente).
- `.github/workflows/manutencao.yml`: todo domingo 04:17 (Brasília) reconstrói **teste** com as imagens base atualizadas e, só se ela passar na saúde, **produção**.
- `.github/dependabot.yml`: PRs semanais de dependências npm, imagem Docker e Actions, sempre contra a branch `teste`.
- `make automatizar-vps` e `make manutencao`.

### Alterado
- `deploy.yml` reutilizável (`workflow_call`) e com escolha manual do ambiente; não roda para mudanças só em `*.md`/`docs/`.
- `remote-deploy.sh` também atualiza as imagens do PostGIS (`db`, `migrate`, `backup`) a cada publicação.

## [0.1.0-alpha] — 2026-11-18
Primeira iteração sobre a app base **Gusto 1.0** (pacote `gusto-pacote-completo`), aplicando o padrão de prompt M3D (Regra de Arte).

### Adicionado
- **Infra/DevOps**
  - `docker-compose.yml`: app (web + API + WebSocket/WebRTC + IA), PostGIS 16, serviço `migrate` (roda antes da app), `backup` diário (14 dias) e `turn` (coturn, perfil opcional). Rede do banco interna; app só em `127.0.0.1`; contêineres sem privilégios, `read_only`, `cap_drop: ALL`.
  - `app/Dockerfile` multi-stage (Node 22, usuário `node`, healthcheck em `/health`).
  - `deploy/setup-vps.sh` idempotente: Docker, Nginx do host, Certbot (webroot), UFW sem resetar regras existentes, `/opt/gusto` e `/opt/gusto-teste`, segredos gerados na própria VPS.
  - `deploy/nginx/gusto.conf.tpl`: produção em `/`, homologação em `/teste/` (prefixo removido), WebSocket, HSTS, `noindex` no teste.
  - `deploy/remote-deploy.sh`: monta `.env`, guarda imagem `:previous`, build, migrações, checagem de saúde e **rollback automático**.
  - `deploy/migrate.sh`: migrações versionadas em `schema_migrations`, papel `gusto` de privilégio mínimo.
  - GitHub Actions: `deploy.yml` (testes → rsync/SSH; `teste`→homologação, `main`→produção) e `promover.yml` (digitar PROMOVER).
  - `Makefile`, `.env.example`, `VERSION`.
- **Camada OS** (injetada pelo servidor; `public/index.html` da base continua intacto)
  - Janelas estilo macOS: arrastar, redimensionar por 8 bordas, minimizar/maximizar, foco, posição lembrada, **fechar com duplo clique fora** ou Esc; folhas em tela cheia no celular.
  - Mesa com **ícones 3D estilo Pixar** (SVG volumétrico, respiração, quique com squash & stretch, inclinação 3D seguindo o ponteiro) e **menu lateral** dinâmico com cadeados conforme permissão.
  - **Seletor de idiomas com bandeiras** (中文, Español, English, हिन्दी, Português) — dicionário estático da camada OS + **tradução contextual por IA de toda a tela** (textos, placeholders, títulos), reaplicada quando a base redesenha; cache no servidor sem dado pessoal.
  - **Grafo de funcionalidades** (arrastar blocos, conectar por portas, zoom/pan, nós que abrem módulos), salvo por usuário.
  - **Notas da agenda**: calendário mensal, notas por dia e **ligações cruzadas** entre notas de dias diferentes.
  - **Comunidade**: salas de chat em tempo real (WebSocket) e **videochamada WebRTC** em malha (até ~4 pessoas), STUN + TURN com credenciais efêmeras.
  - **Avatar 3D** (Three.js) gamificado: chef de "massinha" que segue o cursor, pisca, pula; arrastável; silenciável (voz + sons); XP e nível; responde com os dados do próprio usuário (IA com consentimento, senão busca local).
  - **Conta do servidor**: login na API real e troca obrigatória da senha inicial.
- **Back-end** (`app/os/`): rotas `/os-api/*` (info, permissões, tradução, grafo, notas, chat, avatar, LGPD), WebSocket `/os-ws` com verificação de origem, sessão e permissão; IA com failsafe Gemini → Anthropic → OpenAI e quarentena de chaves.
- **RBAC**: novas funcionalidades autorizáveis por usuário (`os_graph`, `notes`, `chat`, `video`, `avatar`, `i18n_ai`) no mesmo modelo `features`/`can_use` da base.
- **LGPD**: consentimentos versionados por finalidade; exportação (portabilidade) em JSON; eliminação com anonimização do que a lei obriga a manter; mascaramento de e-mail/telefone/CPF/CNPJ/cartão/CEP antes de qualquer IA; retenção do chat (30 dias, configurável); preferências locais sem dado pessoal.
- Migração `004_os_layer.sql`; 11 testes unitários (`npm test`).

### Alterado
- `server.js`: suporte a `BASE_PATH` e `COOKIE_NAME` (homologação em `/teste/` com cookie próprio), CSP com WebSocket/mídia, `Permissions-Policy` com câmera/microfone, encerramento gracioso.
- Repositório reorganizado: `app/`, `db/migrations/`, `deploy/`, `docs/`. O instalador sem Docker foi mantido em `deploy/bare-metal/` (caminhos ajustados).

### Corrigido
- `001_gusto_schema.sql` não aplicava num PostgreSQL real: `EXCLUDE USING gist` com `uuid` exige a extensão `btree_gist` (adicionada).
- `/os/vendor/three.module.min.js` servido a partir do pacote `three`.

### Segurança
- Segredos de infraestrutura gerados e mantidos só na VPS (`.env.gerado`, 600); o GitHub carrega apenas chaves de aplicação (`SERVIDOR_ENV`).
- A app não recebe a senha de superusuário do banco (lista explícita de variáveis no compose).

### Não verificado nesta iteração
- Deploy real na VPS (scripts validados por sintaxe; stack validada com PostgreSQL 16 + PostGIS local, sem Docker Hub).
- Videochamada entre dois navegadores reais e TURN.
- Tradução e assistente com provedores de IA reais (validados com servidor simulado compatível com OpenAI).

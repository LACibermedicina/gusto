# Changelog — Gusto

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) · versionamento [SemVer](https://semver.org/lang/pt-BR/).
Fluxo: toda mudança entra pela branch `teste` (https://gusto.m3d.pro/teste/) e só vai para `main` (produção) depois de testada.

## [Não lançado]
Próxima iteração (sugestão, ver `docs/ARQUITETURA.md` §8): ligar a interface base à API (login único), testes de integração com PostGIS no CI, TURN em produção.

## [0.5.0-alpha] — 2026-11-19
### Adicionado
- **Apresentação ilustrada da receita:** ao abrir um card, a primeira tela mostra uma ilustração 3D estilizada (estilo animação, vetorial e original) do prato pronto com os ingredientes ao redor, a lista de ingredientes com quantidades, tempo, rendimento, nível, a descrição resumida e a **história do prato**.
- **Detalhes avançados** agora reúnem, como cards extras, o modo de preparo passo a passo com a lista de mise en place e a ficha técnica de 4 quadrantes.
- Biblioteca de cenas (`public/os/cena.js`): 6 pratos (risoto, molheira, magret, folhada, fundo, genérico) e 25 ingredientes desenhados; as fichas descrevem a cena com `{ prato, ingredientes }` e o agente de IA escolhe dessa lista.
- Cards do portal com a ilustração e o tempo em destaque; destaque com trecho da história.
- As 5 fichas semeadas ganharam história (com "segundo a tradição" para lendas) e cena; fichas já gravadas recebem só os blocos que faltam.

## [0.4.0-alpha] — 2026-11-19
### Adicionado
- **Painel simplificado de entrada nas receitas:** ao abrir um card, aparece primeiro a receita direta — cabeçalho com categoria, nome, resumo, tempo, rendimento e nível; **Ingredientes** com quantidades (lista de mise en place com marcação) e **Modo de preparo** em passos numerados, com o ponto de atenção crítico em destaque. O botão **Detalhes avançados** abre a ficha técnica de 4 quadrantes (e "Voltar ao modo simples" retorna). Vale no portal público e na janela Fichas.
- As 5 fichas semeadas ganharam ingredientes e modo de preparo; fichas já gravadas recebem só esse bloco no próximo início (edições preservadas).
- O agente de IA passa a gerar também o bloco `simples` (obrigatório para novos rascunhos). Os cards do portal indicam "Ingredientes e modo de preparo · Detalhes avançados".

## [0.3.1-alpha] — 2026-11-19
### Adicionado
- **Publicação automática no Mac** (`deploy/mac/`): agente do `launchd` que observa `~/m3d/entregas`; cada pacote `gusto-*.bundle` que chega é conferido, aplicado na branch `teste` (fast-forward, ou junção sem conflito quando o GitHub recebeu outra mudança, como um PR do Dependabot) e enviado com `git push`, com notificação do macOS e histórico em `~/Library/Logs/gusto-publicar.log`. Instalação única: `bash deploy/mac/instalar.sh` (cria a cópia de trabalho em `~/m3d/gusto`, fora das pastas protegidas do macOS).

## [0.3.0-alpha] — 2026-11-19
Reorganização da interface no padrão macOS.

### Alterado
- **Antes do login:** a barra superior mostra só as 5 bandeiras de idioma, pequenas e semitransparentes no canto; abaixo, apenas a tela de login e as fichas públicas.
- **Depois do login:** barra de menus no topo (Gusto · Cozinha · Estudo · Comunidade · Administração · Conta) com papel em uso, créditos, modo detalhado, acessibilidade, bandeiras, relógio e usuário; o cabeçalho antigo da base some.
- **Menu lateral → dock inferior:** a barra de ícones da base passou a ser a única dock, no estilo macOS (ampliação ao passar o mouse), agrupada com divisores: Cozinha (Início, Cartas, Pedidos, Agenda, Carteira, Mapa, Mais, Guardados, Avisos) | Estudo (Fichas, Notas) | Comunidade (Comunidade, Assistente) | Administração (Grafo, Usuários) | Conta (Conta, Privacidade, Sobre). Ponto embaixo do ícone indica janela aberta. A coluna de ícones à direita e o menu lateral foram removidos.
- **Mesa vazia:** logado, a área de trabalho mostra só as fichas públicas para consulta; o conteúdo da base abre na janela **Cozinha** ao escolher um item do grupo.
- **Quadros explicativos ao passar o mouse** em todos os itens da dock e dos menus (grupo, nome e o que faz), nas 5 línguas.
- **Grafo só para o administrador:** migração `006_grafo_admin.sql` desliga `os_graph` globalmente (o root continua com acesso); o grupo Administração só aparece para o root.

## [0.2.0-alpha] — 2026-11-18
Portal público e portão de login.

### Adicionado
- **Portão de login:** antes de entrar, nada do Gusto OS aparece (barra, ícones, menu, avatar, janelas, dock e controles do mapa da base ficam ocultos). Só a tela de login e, abaixo, o portal público. Ao recarregar a página com a sessão válida, a interface base é reaberta sem pedir senha; ao sair da base, a sessão da API também é encerrada e as janelas são fechadas.
- **Portal de fichas técnicas** em estilo portal de notícias (destaque + grade), sem login: cada card mostra a faixa escura com o nome em caixa alta e "| FICHA COGNITIVA DE EXECUÇÃO E TÉCNICA CLÁSSICA", os 4 quadrantes, categoria, resumo e metadados; abre a ficha completa.
- **Infográfico em 4 quadrantes** (padrão alta gastronomia): A cabeçalho escuro; B físico-química com linha do tempo de 4 etapas + alerta crítico; C apoio de praça (perfil sensorial, insumos/proporções, defeitos, ação corretiva); D fluxograma com bifurcação, testes confirmatórios e emplatamento; E segredos do chef, referências e glossário. 18 ícones 3D semânticos (termômetro, chama, balança, gota, faca, molécula, colher…).
- 5 fichas originais semeadas: Molho Béarnaise (destaque), Risotto alla Milanese, Magret de Pato Sous-Vide, Massa Folhada Clássica, Fundo Escuro de Vitela.
- **Agente gerador** (`app/os/prompt-infografico.js`): prompt de Chef Executivo/ciência dos alimentos com saída JSON validada (`infografico-esquema.js`); gera **rascunho** que o admin revisa, publica e destaca na janela **Fichas** (funcionalidade `infograficos`).
- Migração `005_infograficos.sql`; rotas públicas `/os-api/publico/infograficos` (só publicados, sem autoria); 3 testes novos (14 no total).

## [0.1.3-alpha] — 2026-11-18
### Corrigido
- **Login único (ponte):** a tela "Entrar no Gusto" da interface base agora aceita a conta do servidor. O root da base tinha uma senha embutida desconhecida; com a ponte, `root` + `GUSTO_ROOT_PASSWORD` entra na interface base e no Gusto OS ao mesmo tempo, e a janela **Conta** abre pedindo a troca da senha inicial.
- `/os-api/info` reconhece a sessão de quem ainda precisa trocar a senha (antes aparecia como deslogado).
- Formulários das janelas: campos com largura total e alinhamento correto sob o CSS da base.

## [0.1.2-alpha] — 2026-11-18
### Corrigido
- `setup-vps.sh` desativa o site Nginx da instalação antiga sem Docker (`gusto-<domínio>.conf`), que disputava o mesmo `server_name`, e avisa se o serviço `gusto` antigo ainda estiver rodando.
- Diagnóstico registrado: o registro A de `gusto.m3d.pro` apontava para `159.223.22.8` (faltava o último dígito); o correto é `159.223.22.82`.

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

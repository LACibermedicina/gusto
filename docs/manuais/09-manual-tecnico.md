# Gusto · Manual Técnico

Versão 1.0 · novembro de 2026 · by m3d.pro

## 1. Visão geral
O Gusto é uma plataforma para trocar receitas, pedir preparo, alugar espaços e itens, e entregar o resultado com rastreio por código. Reúne créditos em carteira com custódia, mercado de créditos, pagamentos por link, calendário, mapa de proximidade e um assistente de receitas com IA.

### 1.1 Arquitetura
```
Navegador (interface em um único HTML, JavaScript puro)
        |  HTTPS
      nginx  (TLS, subdomínio, porta pública)
        |  http://127.0.0.1:PORTA
   Node.js + Express  (API, sessões, regras de negócio)
        |
   PostgreSQL + PostGIS  (dados, funções, gatilhos)
```

### 1.2 Estado atual da entrega
| Camada | Situação |
|---|---|
| Interface | Completa e funcional em **modo local**: guarda usuários e dados no navegador (`localStorage`) |
| API | Completa para os fluxos descritos, com login real e permissões; **não está ligada à interface** |
| Banco | Esquema com cerca de 50 tabelas e 3 migrações |
| Instalador | Script para Debian e Ubuntu; **ainda não executado em servidor real** |

O passo seguinte é trocar o armazenamento local da interface por chamadas à API (seção 10.3).

## 2. Estrutura de arquivos
| Caminho | Função |
|---|---|
| `aplicativo/gusto.html` | Interface completa em um arquivo |
| `servidor/gusto-install/install.sh` | Instalador interativo (pacotes, banco, serviço, nginx, TLS) |
| `servidor/gusto-install/uninstall.sh` | Remoção; `--purge` apaga dados |
| `servidor/gusto-install/app/server.js` | API Express e servidor dos arquivos estáticos |
| `servidor/gusto-install/app/public/index.html` | Interface servida pelo servidor |
| `servidor/gusto-install/app/package.json` | Dependências Node |
| `banco/001_gusto_schema.sql` | Esquema base, funções e sementes |
| `banco/002_payment_links.sql` | Pagamentos por link |
| `banco/003_ai_proof_calendar.sql` | Receitas por IA, prova de conceito e calendário |

## 3. Interface (front-end)

### 3.1 Estrutura
Um único arquivo HTML com CSS e um bloco de JavaScript sem frameworks. As partes principais do script:
- **Estado `S`**: objeto único, gravado em `localStorage` (chave `gusto1`) por `sv()`.
- **Autenticação local**: hash SHA-256 com sal (`crypto.subtle`), bloqueio após 5 tentativas, papéis e permissões por usuário.
- **Renderização**: cada aba é uma função que devolve HTML (`dsh`, `deckv`, `ord`, `cal`, `wal`, `me`, `adm`, `mapv`); `draw()` escolhe a função e atualiza a tela.
- **Barra (dock)**: `nav()` monta os ícones; `pop()` abre os menus Mais, Guardados e Avisos.
- **Painéis**: registro `PN`; estados aberto, guardado (`m`) e fechado (`x`) em `S.pn`.
- **Cartas**: `deckv()` com filtros, relação receita, preparo, entrega e feedback.
- **Calendário**: arrastar e soltar com eventos de ponteiro (`dragInit`), horário da solicitação quando não informado.
- **Mapa**: canvas em tela cheia (`bgdraw`, `mapstat`), limpo por padrão (papel, ruas, água, parques e pontos); decorações opcionais (🎲) com estilo de carta náutica; dados reais via Overpass quando a rede permite.
- **Grafo 3D**: projeção própria em canvas (`gbuild`, `grender`) e carrossel com CSS 3D.
- **Guia de primeiro acesso**: `wzopen` e funções `wz*`.

### 3.2 Chaves principais do estado
| Chave | Conteúdo |
|---|---|
| `users`, `ft`, `audit` | Usuários, funcionalidades globais e auditoria |
| `W` | Carteira por papel: créditos e saldo em R$ |
| `orders`, `fb`, `tut`, `cal` | Pedidos, feedbacks, tutoriais e agenda |
| `recipes` | Receitas criadas na interface; as de exemplo ficam no código |
| `reg` | Registros de preparador e entregador com checklist |
| `pl`, `mk`, `pr` | Links de pagamento, ofertas do mercado e tabela de preços |
| `pn`, `nt`, `ac`, `wz` | Painéis, avisos, acessibilidade e guia de primeiro acesso |

### 3.3 Dependências externas
- `qrcode-generator` 1.4.4, carregada de `cdnjs.cloudflare.com` (QR codes).
- Overpass API (`overpass-api.de`), apenas para o mapa real, com consentimento de localização.
- Assistente de IA: usa a capacidade de amostragem do claude.ai; fora dele, a interface usa busca local.

### 3.4 Acessibilidade
Rótulos ARIA em botões de ícone, diálogos com `role="dialog"`, região de anúncios (`aria-live`), foco visível, link “pular para o conteúdo”, alto contraste, escala de texto, redução de movimento e navegação por teclado no mapa e nas cartas.

## 4. API (back-end)

### 4.1 Variáveis de ambiente
| Variável | Função |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL |
| `CODE_SECRET` | Segredo (32+ caracteres) que deriva os códigos de coleta e entrega |
| `WEBHOOK_SECRET` | Chave HMAC dos webhooks de pagamento |
| `PORT`, `HOST` | Porta e endereço de escuta (padrão `127.0.0.1`) |
| `PUBLIC_URL` | Endereço público, usado nos links de pagamento |
| `COOKIE_SECURE` | `0` desliga o atributo Secure (somente testes sem HTTPS) |
| `NODE_ENV` | `production` desativa a rota de simulação de pagamento |
| `PAYMENTS_PROVIDER`, `PSP_API_URL`, `PSP_API_KEY` | Provedor de pagamento (`mock` ou `http`) |

### 4.2 Middleware e proteções
- `helmet` com CSP própria; `express-rate-limit` no login e nas páginas públicas.
- Exige `Content-Type: application/json` em requisições que alteram dados (proteção CSRF junto com cookie `SameSite=Lax`).
- Sessão por cookie `HttpOnly`; no banco fica só o hash do token (8 horas).
- Permissões: `need(papel)` para papéis e `feat(funcionalidade)` para chaves ligáveis, via função `can_use` do banco.

### 4.3 Regras de negócio
- **Autorização operacional**: preparador e entregador só aceitam pedidos com registro aprovado e válido.
- **Preço**: definido por quem aceita. O valor sai da carteira do cliente para **custódia** (`escrow_holds`).
- **Códigos**: derivados por HMAC de `pedido|tipo`; o banco guarda apenas o hash. Tentativas são contadas fora da transação e travam em 5.
- **Liquidação**: na entrega confirmada, libera a custódia, desconta a taxa da corretora (`price_table.broker_fee`) e lança no extrato.
- **Prova de conceito**: gatilhos recalculam o status da receita (`experiment`, `in_proof`, `proven`) a cada feedback ou tutorial.
- **Fiscal**: o papel `inspector` não é concedido ao root; só o administrador o atribui a outros usuários, e ninguém aprova o próprio registro.

### 4.4 Pagamentos por link
1. O usuário cria o link (`topup`, `charge` ou `credits`); o token aparece uma só vez.
2. A página pública `/pay/:token` mostra o valor e inicia a cobrança no provedor.
3. O provedor chama `POST /webhooks/:provider`, assinado com HMAC-SHA256 em `x-signature`.
4. O evento é gravado em `webhook_events` (idempotência) e liquidado em transação.
5. Valor divergente ou link cancelado grava o pagamento como `refund_needed`.

## 5. Banco de dados
Domínios e principais tabelas:
| Domínio | Tabelas |
|---|---|
| Identidade e permissões | `users`, `user_roles`, `features`, `user_feature_overrides`, `sessions`, `audit_log` |
| Perfil | `profiles`, `diets`, `user_diets`, `menu_plan` |
| Receitas | `recipes`, `ingredients`, `recipe_ingredients`, `recipe_variations`, `recipe_edges`, `tutorials`, `recipe_feedback` |
| Compras | `stores`, `store_items`, `shopping_items` |
| Registros e inspeção | `kitchens`, `registrations`, `checklist_items`, `registration_checks` |
| Pedidos | `orders`, `order_status_history`, `order_packaging`, `packaging_slots`, `order_checklist`, `order_media`, `handoff_codes`, `route_plans`, `courier_positions` |
| Dinheiro | `wallets`, `ledger`, `escrow_holds`, `price_table`, `market_offers`, `market_trades`, `payment_links`, `payments`, `webhook_events` |
| Recursos | `lendable_items`, `loans`, `kitchen_rentals` |
| Comunidade e agenda | `posts`, `comments`, `notifications`, `calendar_entries` |

Funções e gatilhos: `can_use(usuário, funcionalidade)`, `refresh_recipe_status(receita)` e os gatilhos de feedback e tutorial. Restrições notáveis: um único root, intervalos de locação sem sobreposição (`EXCLUDE ... gist`) e um feedback por pedido.

O instalador registra cada migração em `schema_migrations`; reexecutar aplica só as novas.

## 6. Referência da API
| Método e rota | Acesso | Função |
|---|---|---|
| `POST /auth/login`, `/auth/logout`, `/auth/password` · `GET /me` | público/sessão | Sessão e troca de senha |
| `GET/POST /admin/users` · `PATCH /admin/users/:id` | root | Listar, criar, ativar ou desativar |
| `PUT /admin/users/:id/roles` · `POST .../reset-password` | root | Papéis e senha |
| `PUT /admin/users/:id/features/:code` · `PUT /admin/features/:code` | root | Autorizar por usuário ou global |
| `PUT /admin/prices/:code` · `GET /admin/audit` | root | Preços e auditoria |
| `GET /recipes`, `/recipes/:id`, `/recipes/:id/feedback` | sessão | Consulta |
| `POST /recipes`, `/recipes/experiment`, `/recipes/:id/tutorials` | funcionalidades rec_new, ai, tut | Criação |
| `POST /registrations` | preparador, entregador | Solicitar autorização |
| `GET /inspections` · `POST /inspections/:id/review` | fiscal | Fila e decisão |
| `POST /orders` · `GET /orders?as=` | cliente e demais | Criar e listar |
| `POST /orders/:id/accept-cook`, `accept-courier` | preparador, entregador | Aceitar com preço |
| `PUT /orders/:id/packaging` · `POST .../ready` | cliente, preparador | Embalagem e pronto |
| `GET /orders/:id/codes` · `POST .../scan` | por etapa | Códigos e validação |
| `POST /orders/:id/feedback` | cliente | Nota, comentário e prova |
| `GET /wallet` · `GET/POST /market...` | sessão, mk | Carteira e mercado |
| `GET/POST /posts` · `POST /posts/:id/comments` | feed | Comunidade |
| `POST/GET /payment-links` · `POST .../cancel` | paylink | Links de pagamento |
| `GET /pay/:token`, `/pay/:token/go` · `POST /webhooks/:provider` | público | Página e confirmação |
| `POST/GET/PATCH/DELETE /calendar` | calendar | Agenda |
| `GET /health` | público | Verificação |

## 7. Segurança
- Senhas com bcrypt (custo 12) no servidor; hash SHA-256 com sal na interface local.
- Bloqueio de conta após 5 falhas; limite de requisições no login e nas páginas públicas.
- Sessões revogáveis; troca de senha invalida as demais sessões.
- Segredos em `/etc/gusto/gusto.env` (permissão 640); serviço sem privilégios, com `NoNewPrivileges`, `ProtectSystem=strict` e `PrivateTmp`.
- Entradas validadas; saídas escapadas; links de mídia aceitos só com `http` ou `https`.
- Auditoria de ações administrativas e financeiras.

### 7.1 Privacidade e LGPD
A localização é pedida só por ação do usuário e enviada ao Overpass com coordenadas arredondadas. Convém definir base legal, aviso de privacidade, retenção e canal do titular antes de operar com pessoas reais.

## 8. Implantação
Veja o Manual de Instalação. Resumo: o `install.sh` instala nginx, PostgreSQL com PostGIS, Node.js e certbot; cria o usuário `gusto`, o banco e o serviço systemd; gera os segredos; emite o certificado e agenda o backup diário.

## 9. Verificação realizada e pendências
**Verificado**: sintaxe de todos os scripts; renderização simulada de todas as telas e fluxos da interface; geração das configurações do nginx.
**Não verificado**: execução do instalador em servidor real; API contra um PostgreSQL real; provedor de pagamento real; desempenho com muitos usuários.

### 9.1 Roteiro de homologação sugerido
1. Instalar em um servidor de teste e conferir `/health`.
2. Entrar como root, trocar a senha e criar um usuário de cada papel.
3. Executar o fluxo completo: pedido, aceite, preparo, coleta, entrega, feedback.
4. Conferir carteira, custódia, taxa e extrato.
5. Criar e pagar um link com o provedor em modo de teste.
6. Testar backup e restauração.

## 10. Extensão

### 10.1 Novo provedor de pagamento
Em `server.js`, adicione uma entrada em `providers` com `verify(raw, headers)` (assinatura do provedor) e `charge(link)` (cria a cobrança e devolve `ref`, `pay_url` ou `pix_code`). Ajuste o formato do evento em `applyEvent` se necessário.

### 10.2 Nova funcionalidade com chave de autorização
Insira a chave em `features`, proteja a rota com `feat("chave")` e, na interface, inclua-a na lista `FT` e verifique com `can("chave")`.

### 10.3 Ligar a interface à API
1. Criar uma camada `api()` com `fetch` (cookies incluídos, JSON).
2. Trocar o login local por `POST /auth/login` e `GET /me`.
3. Mapear cada função que altera `S` para a rota equivalente (pedidos, carteira, registros, agenda, feed).
4. Manter o armazenamento local apenas para preferências (painéis, acessibilidade).
5. Atualizar a CSP se novos domínios forem usados.

## 11. Limitações conhecidas
- Interface e API ainda não conversam; os dados da interface são locais.
- Posição do preparador e do entregador no mapa é simulada.
- Rotas e tempos usam estimativas; não há integração com serviço de mapas para trânsito.
- Fotos e vídeos são aceitos apenas como links.
- Formas dos continentes no mapa-múndi são simplificadas.

# Entrar com Google, Apple, Microsoft e X

Cada provedor só aparece no menu de acesso quando suas variáveis estão preenchidas. Em `/teste/` os que ainda não
foram configurados aparecem apagados, com o aviso "ainda não configurado"; em produção ficam ocultos.

As variáveis vão no secret **SERVIDOR_ENV** do GitHub (uma `VAR=valor` por linha). O próximo deploy as grava no VPS.
Podem ser as mesmas credenciais para produção e homologação, desde que as duas URLs de retorno estejam cadastradas.

## URLs de retorno (cadastrar as duas em cada provedor)

```
https://gusto.m3d.pro/os-api/oauth/<provedor>/retorno
https://gusto.m3d.pro/teste/os-api/oauth/<provedor>/retorno
```
`<provedor>` = `google`, `apple`, `microsoft` ou `x`.

## Google
1. https://console.cloud.google.com → APIs e serviços → **Tela de permissão OAuth**: tipo Externo, nome "Gusto", domínio autorizado `m3d.pro`, escopos `openid`, `email`, `profile`. Publicar o app para sair do modo "teste".
2. **Credenciais → Criar ID do cliente OAuth** → Aplicativo da Web → colar as 2 URLs de retorno.
3. `OAUTH_GOOGLE_ID` = ID do cliente · `OAUTH_GOOGLE_SECRET` = chave secreta.

## Microsoft (contas pessoais e corporativas)
1. https://entra.microsoft.com → Aplicativos → **Registros de aplicativo → Novo registro**. Tipos de conta: "Contas em qualquer diretório organizacional e contas Microsoft pessoais". Plataforma **Web** com as 2 URLs de retorno.
2. **Certificados e segredos → Novo segredo do cliente** (anote o *valor*, não o ID).
3. `OAUTH_MICROSOFT_ID` = ID do aplicativo (cliente) · `OAUTH_MICROSOFT_SECRET` = valor do segredo · `OAUTH_MICROSOFT_TENANT=common`. O segredo expira (máx. 24 meses): renovar antes.

## Apple (exige Apple Developer Program)
1. https://developer.apple.com/account → Identifiers: um **App ID** com "Sign in with Apple" e um **Services ID** (ex.: `pro.m3d.gusto.web`) com Sign in with Apple → Configure: domínio `gusto.m3d.pro` e as 2 URLs de retorno.
2. Keys → nova chave com "Sign in with Apple" ligada ao App ID → baixar o `.p8` (só pode ser baixado uma vez).
3. `OAUTH_APPLE_ID` = Services ID · `OAUTH_APPLE_TEAM_ID` = Team ID (canto superior direito) · `OAUTH_APPLE_KEY_ID` = Key ID ·
   `OAUTH_APPLE_KEY` = conteúdo do `.p8` numa linha só: `awk 'NF{printf "%s\\n",$0}' AuthKey_XXXX.p8`.
4. A Apple só envia nome e e-mail no **primeiro** acesso; depois manda só o identificador.

## X
1. https://developer.x.com → Projects & Apps → app → **User authentication settings**: OAuth 2.0, tipo **Web App (confidential client)**, permissão Read, as 2 URLs de retorno, site `https://gusto.m3d.pro`.
2. Keys and tokens → **OAuth 2.0 Client ID and Client Secret**.
3. `OAUTH_X_ID` · `OAUTH_X_SECRET`. O X não fornece e-mail: a conta é criada só com o nome e o @ do perfil.

## Como funciona (segurança)
- Fluxo *authorization code* com **PKCE (S256)**, `state` de uso único guardado no banco (10 min) e `nonce` conferido no `id_token`.
- O token é trocado servidor ↔ provedor; o navegador nunca vê tokens. Nada do provedor é guardado além do identificador (`sub`), do nome e, se houver, do e-mail.
- Conta nova recebe só o papel **cliente**. Não há vínculo automático por e-mail (evita tomada de conta): quem já tem conta liga um provedor estando logado.
- Contas criadas por provedor não têm senha conhecida; para apagar a conta (LGPD) o usuário confirma digitando o próprio nome de usuário.
- `REGISTRO_ABERTO=0` fecha o cadastro (senha e provedores); contas já vinculadas continuam entrando.

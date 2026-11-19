// GUSTO · camada OS · cadastro aberto e entrada com Google, X, Apple ou Microsoft (OAuth 2.0 / OpenID Connect) · by m3d.pro
// Segurança: state + PKCE (S256) + nonce em todos os provedores; o estado fica no banco (10 min, uso único), porque o
// retorno da Apple é um POST entre sites e não leva cookie SameSite=Lax. O id_token é lido da resposta do endpoint de
// token (canal TLS direto com o provedor, OIDC Core §3.1.3.7), nunca do navegador. Contas novas recebem só o papel
// "client"; não há vínculo automático por e-mail (evita tomada de conta) — vincular só estando logado.
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import express from "express";

const b64url = b => Buffer.from(b).toString("base64url");
const aleatorio = (n = 32) => crypto.randomBytes(n).toString("base64url");
const decodificarJWT = t => { try { return JSON.parse(Buffer.from(String(t).split(".")[1], "base64url").toString("utf8")); } catch { return null; } };
const RESERVADOS = new Set(["root", "admin", "administrador", "gusto", "m3d", "suporte", "sistema"]);
export const USUARIO_RE = /^[a-z0-9._-]{3,20}$/;

/** Gera o client_secret da Apple: JWT ES256 assinado com a chave .p8 (válido por 5 min). */
function segredoApple(env) {
  const agora = Math.floor(Date.now() / 1000);
  const cab = b64url(JSON.stringify({ alg: "ES256", kid: env.OAUTH_APPLE_KEY_ID }));
  const corpo = b64url(JSON.stringify({ iss: env.OAUTH_APPLE_TEAM_ID, iat: agora, exp: agora + 300, aud: "https://appleid.apple.com", sub: env.OAUTH_APPLE_ID }));
  const chave = String(env.OAUTH_APPLE_KEY || "").replace(/\\n/g, "\n");
  const ass = crypto.sign("sha256", Buffer.from(`${cab}.${corpo}`), { key: chave, dsaEncoding: "ieee-p1363" });
  return `${cab}.${corpo}.${b64url(ass)}`;
}

/** Catálogo de provedores. Cada um só fica ativo se as variáveis de ambiente estiverem preenchidas. */
export function provedores(env = process.env) {
  const ms = env.OAUTH_MICROSOFT_TENANT || "common";
  return {
    google: {
      nome: "Google", ativo: !!(env.OAUTH_GOOGLE_ID && env.OAUTH_GOOGLE_SECRET),
      auth: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token",
      escopo: "openid email profile", id: env.OAUTH_GOOGLE_ID, segredo: () => env.OAUTH_GOOGLE_SECRET, oidc: true
    },
    microsoft: {
      nome: "Microsoft", ativo: !!(env.OAUTH_MICROSOFT_ID && env.OAUTH_MICROSOFT_SECRET),
      auth: `https://login.microsoftonline.com/${ms}/oauth2/v2.0/authorize`, token: `https://login.microsoftonline.com/${ms}/oauth2/v2.0/token`,
      escopo: "openid email profile", id: env.OAUTH_MICROSOFT_ID, segredo: () => env.OAUTH_MICROSOFT_SECRET, oidc: true
    },
    apple: {
      nome: "Apple", ativo: !!(env.OAUTH_APPLE_ID && env.OAUTH_APPLE_TEAM_ID && env.OAUTH_APPLE_KEY_ID && env.OAUTH_APPLE_KEY),
      auth: "https://appleid.apple.com/auth/authorize", token: "https://appleid.apple.com/auth/token",
      escopo: "name email", id: env.OAUTH_APPLE_ID, segredo: () => segredoApple(env), oidc: true, formPost: true
    },
    x: {
      nome: "X", ativo: !!(env.OAUTH_X_ID && env.OAUTH_X_SECRET),
      auth: "https://x.com/i/oauth2/authorize", token: "https://api.x.com/2/oauth2/token",
      escopo: "users.read tweet.read", id: env.OAUTH_X_ID, segredo: () => env.OAUTH_X_SECRET, basic: true,
      perfil: "https://api.x.com/2/users/me"
    }
  };
}

/** Normaliza o perfil do provedor em {sujeito, nome, email, sugestao}. */
export function perfilDe(prov, tokens, extra = {}) {
  if (prov === "x") {
    const d = extra.perfil?.data || {};
    return { sujeito: String(d.id || ""), nome: d.name || d.username || "", email: null, sugestao: d.username || d.name || "" };
  }
  const c = decodificarJWT(tokens.id_token) || {};
  let nome = c.name || [c.given_name, c.family_name].filter(Boolean).join(" ");
  if (prov === "apple" && extra.usuarioApple?.name) nome = [extra.usuarioApple.name.firstName, extra.usuarioApple.name.lastName].filter(Boolean).join(" ");
  const email = c.email || c.preferred_username || null;
  return { sujeito: String(c.sub || ""), nome: nome || "", email, sugestao: (email || nome || "").split("@")[0], nonce: c.nonce, aud: c.aud, iss: c.iss };
}

/** Converte um texto livre num nome de usuário válido (a-z0-9._-, 3–20). */
export function sugerirUsuario(txt) {
  let s = String(txt || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9._-]+/g, ".").replace(/^[._-]+|[._-]+$/g, "").slice(0, 16);
  if (s.length < 3 || RESERVADOS.has(s)) s = "chef";
  return s;
}

export function montarContas(app, ctx) {
  const { q, tx, one, E, ah, au, sha, BP, CK, talvez } = ctx;
  const P = "/os-api";
  const env = process.env;
  const registroAberto = env.REGISTRO_ABERTO !== "0";
  const origem = (env.PUBLIC_URL || "").replace(/\/+$/, "");
  const retornoDe = (req, p) => `${origem || `${req.protocol}://${req.get("host")}${BP}`}${P}/oauth/${p}/retorno`;
  const seguro = env.COOKIE_SECURE === "0" ? "" : "; Secure";
  const limite = rateLimit({ windowMs: 15 * 60000, max: 10, standardHeaders: true, legacyHeaders: false, message: { error: "Muitas tentativas. Tente de novo em alguns minutos." } });

  async function abrirSessao(req, res, uid) {
    const t = crypto.randomBytes(32).toString("hex");
    await q("insert into sessions(user_id,token_hash,ip,user_agent,expires_at) values($1,$2,$3,$4,now()+interval '8 hours')", [uid, sha(t), req.ip, req.get("user-agent")]);
    res.append("Set-Cookie", `${CK}=${t}; HttpOnly; SameSite=Lax; Path=${BP || "/"}; Max-Age=28800${seguro}`);
  }

  async function usuarioLivre(c, base) {
    for (let i = 0; i < 20; i++) {
      const u = i === 0 ? base : `${base.slice(0, 15)}${crypto.randomInt(10, 99999)}`.slice(0, 20);
      if (!one(await c.query("select 1 from users where username=$1", [u]))) return u;
    }
    throw new E(409, "Não foi possível gerar um nome de usuário");
  }

  async function criarConta(c, { username, nome, senha, origemConta }) {
    const hash = await bcrypt.hash(senha || aleatorio(32), 12);
    const u = one(await c.query("insert into users(username,display_name,password_hash,senha_local) values($1,$2,$3,$4) returning id", [username, (nome || username).slice(0, 80), hash, !!senha]));
    await c.query("insert into user_roles(user_id,role) values($1,'client')", [u.id]);
    await c.query("insert into wallets(user_id) values($1) on conflict do nothing", [u.id]);
    await au(c, u.id, "registro", "user", u.id, { origem: origemConta });
    return u.id;
  }

  // ---------- quais formas de entrar existem ----------
  app.get(P + "/contas/opcoes", (req, res) => {
    const pv = provedores(env);
    res.json({ registro: registroAberto, provedores: Object.entries(pv).map(([cod, p]) => ({ cod, nome: p.nome, ativo: p.ativo })) });
  });

  app.get(P + "/contas/disponivel", limite, ah(async (req, res) => {
    const u = String(req.query.u || "").toLowerCase();
    if (!USUARIO_RE.test(u) || RESERVADOS.has(u)) return res.json({ ok: false, motivo: "formato" });
    res.json({ ok: !one(await q("select 1 from users where username=$1", [u])) });
  }));

  // ---------- cadastro com usuário e senha ----------
  app.post(P + "/registro", limite, ah(async (req, res) => {
    if (!registroAberto) throw new E(403, "Cadastro fechado");
    const username = String(req.body.username || "").trim().toLowerCase();
    const nome = String(req.body.nome || "").trim().replace(/\s+/g, " ");
    const senha = String(req.body.senha || "");
    if (req.body.aceite !== true) throw new E(400, "É preciso aceitar a política de privacidade");
    if (!USUARIO_RE.test(username) || RESERVADOS.has(username)) throw new E(400, "Usuário inválido (3–20: letras minúsculas, números, . _ -)");
    if (nome.length < 2 || nome.length > 80) throw new E(400, "Informe seu nome");
    if (senha.length < 8 || senha.length > 200) throw new E(400, "Senha com 8 ou mais caracteres");
    if (senha.toLowerCase().includes(username)) throw new E(400, "A senha não pode conter o usuário");
    const uid = await tx(async c => {
      if (one(await c.query("select 1 from users where username=$1", [username]))) throw new E(409, "Este usuário já existe");
      return criarConta(c, { username, nome, senha, origemConta: "senha" });
    });
    await abrirSessao(req, res, uid);
    res.status(201).json({ ok: true, username });
  }));

  // ---------- OAuth: início ----------
  app.get(P + "/oauth/:prov/inicio", limite, talvez, ah(async (req, res) => {
    const cod = req.params.prov, p = provedores(env)[cod];
    if (!p) throw new E(404, "Provedor desconhecido");
    if (!p.ativo) return res.redirect(`${BP}/?oauth=indisponivel`);
    if (!req.u && !registroAberto) return res.redirect(`${BP}/?oauth=fechado`);
    const state = aleatorio(), verificador = aleatorio(48), nonce = aleatorio(16);
    await q("delete from os_oauth_estados where criado < now() - interval '10 minutes'");
    await q("insert into os_oauth_estados(state,provedor,verificador,nonce,vincular) values($1,$2,$3,$4,$5)", [sha(state), cod, verificador, nonce, req.u?.id || null]);
    const u = new URL(p.auth);
    const par = { response_type: "code", client_id: p.id, redirect_uri: retornoDe(req, cod), scope: p.escopo, state,
      code_challenge: b64url(crypto.createHash("sha256").update(verificador).digest()), code_challenge_method: "S256" };
    if (p.oidc) par.nonce = nonce;
    if (p.formPost) par.response_mode = "form_post";
    if (cod === "google") par.prompt = "select_account";
    for (const [k, v] of Object.entries(par)) u.searchParams.set(k, v);
    res.setHeader("Cache-Control", "no-store");
    res.redirect(u.toString());
  }));

  // ---------- OAuth: retorno (GET; Apple usa POST form_post) ----------
  const retorno = ah(async (req, res) => {
    const cod = req.params.prov, p = provedores(env)[cod];
    const dados = req.method === "POST" ? req.body : req.query;
    const falha = motivo => res.redirect(`${BP}/?oauth=${encodeURIComponent(motivo)}`);
    if (!p?.ativo) return falha("indisponivel");
    if (dados.error) return falha(dados.error === "access_denied" ? "cancelado" : "erro");
    const st = one(await q("delete from os_oauth_estados where state=$1 and provedor=$2 and criado > now() - interval '10 minutes' returning *", [sha(String(dados.state || "")), cod]));
    if (!st || !dados.code) return falha("expirado");

    const corpo = new URLSearchParams({ grant_type: "authorization_code", code: String(dados.code), redirect_uri: retornoDe(req, cod), code_verifier: st.verificador });
    const cab = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" };
    corpo.set("client_id", p.id);
    if (p.basic) cab.Authorization = "Basic " + Buffer.from(`${encodeURIComponent(p.id)}:${encodeURIComponent(p.segredo())}`).toString("base64");
    else corpo.set("client_secret", p.segredo());
    const r = await fetch(p.token, { method: "POST", headers: cab, body: corpo, signal: AbortSignal.timeout(10000) });
    const tokens = await r.json().catch(() => ({}));
    if (!r.ok || !(tokens.id_token || tokens.access_token)) return falha("erro");

    const extra = {};
    if (p.perfil) {
      const pr = await fetch(p.perfil, { headers: { Authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(10000) });
      extra.perfil = await pr.json().catch(() => ({}));
    }
    if (cod === "apple" && dados.user) { try { extra.usuarioApple = JSON.parse(dados.user); } catch { /* */ } }
    const perfil = perfilDe(cod, tokens, extra);
    if (!perfil.sujeito) return falha("erro");
    if (p.oidc) {
      const aud = Array.isArray(perfil.aud) ? perfil.aud : [perfil.aud];
      if (perfil.nonce !== st.nonce || !aud.includes(p.id)) return falha("erro");
    }

    const resultado = await tx(async c => {
      const ja = one(await c.query("select i.user_id, u.is_active from os_identidades i join users u on u.id=i.user_id where i.provedor=$1 and i.sujeito=$2", [cod, perfil.sujeito]));
      if (ja) {
        if (!ja.is_active) return { erro: "inativo" };
        await c.query("update os_identidades set email=coalesce($3,email), ultimo_uso=now() where provedor=$1 and sujeito=$2", [cod, perfil.sujeito, perfil.email]);
        if (st.vincular && st.vincular !== ja.user_id) return { erro: "outra-conta" };
        return { uid: ja.user_id, novo: false };
      }
      let uid = st.vincular;
      if (!uid) {
        if (!registroAberto) return { erro: "fechado" };
        const username = await usuarioLivre(c, sugerirUsuario(perfil.sugestao));
        uid = await criarConta(c, { username, nome: perfil.nome, origemConta: cod });
      }
      await c.query("insert into os_identidades(provedor,sujeito,user_id,email) values($1,$2,$3,$4)", [cod, perfil.sujeito, uid, perfil.email]);
      await au(c, uid, "oauth.vinculo", "user", uid, { provedor: cod });
      return { uid, novo: !st.vincular };
    });
    if (resultado.erro) return falha(resultado.erro);
    await abrirSessao(req, res, resultado.uid);
    await au(ctx.pool, resultado.uid, "login", "user", resultado.uid, { provedor: cod }).catch(() => {});
    res.setHeader("Cache-Control", "no-store");
    res.redirect(`${BP}/?entrou=${cod}${resultado.novo ? "&novo=1" : ""}`);
  });
  app.get(P + "/oauth/:prov/retorno", retorno);
  app.post(P + "/oauth/:prov/retorno", express.urlencoded({ extended: false, limit: "20kb" }), retorno);

  // Contas vinculadas (para a janela Conta).
  app.get(P + "/contas/vinculos", ctx.A, ah(async (req, res) => {
    res.json((await q("select provedor, email, criado from os_identidades where user_id=$1 order by criado", [req.u.id])).rows);
  }));
}

// GUSTO · camada OS v0.1.0-alpha · rotas /os-api, injeção da interface e WebSocket · by m3d.pro
// A interface base (public/index.html) não é alterada: o servidor injeta a camada OS ao servir "/".
import { montarContas } from "./contas.js";
import { montarVideos } from "./videos.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { gerar, iaDisponivel, iaStatus, extrairJSON } from "./ia.js";
import { mascarar, restaurar, hashTexto, consentimentos, temConsentimento, exportar, eliminar, VERSAO_TERMOS, FINALIDADES } from "./privacidade.js";
import { anexarWS } from "./ws.js";
import { montarInfograficos, semearInfograficos } from "./infograficos.js";

export { anexarWS };

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(DIR, "..", "public");
const require = createRequire(import.meta.url);
export const VERSAO = JSON.parse(fs.readFileSync(path.join(DIR, "..", "package.json"), "utf8")).version;
export const IDIOMAS = { pt: "português do Brasil", en: "English", es: "español", zh: "简体中文 (Mandarim)", hi: "हिन्दी (Hindi)" };
export const PERMISSIONS_POLICY = "geolocation=(self), camera=(self), microphone=(self), display-capture=(self)";

// CSP: WebSocket do próprio host (explícito para navegadores sem CSP3 em connect-src 'self').
const host = (() => { try { return new URL(process.env.PUBLIC_URL || "").host; } catch { return ""; } })();
export const cspOS = { connectSrc: host ? [`wss://${host}`] : [], frameSrc: ["https://www.youtube-nocookie.com", "https://player.vimeo.com"] };

/** Insere a camada OS no index.html base. Exportada para teste. */
export function injetar(html, { base = "", ambiente = "producao", versao = VERSAO } = {}) {
  const b = base.replace(/\/+$/, "");
  const v = encodeURIComponent(versao);
  // Em homologação, isola o localStorage da interface base (mesma origem que a produção).
  const isolar = ambiente === "teste"
    ? `<script>(()=>{const P="teste:",S=Storage.prototype,g=S.getItem,s=S.setItem,r=S.removeItem;S.getItem=function(k){return g.call(this,P+k)};S.setItem=function(k,x){return s.call(this,P+k,x)};S.removeItem=function(k){return r.call(this,P+k)}})()</script>`
    : "";
  const meta = `<meta name="gusto-base" content="${b}"><meta name="gusto-ambiente" content="${ambiente}"><meta name="gusto-versao" content="${versao}">` +
    (ambiente === "teste" ? `<meta name="robots" content="noindex,nofollow">` : "");
  const cabeca = `${meta}${isolar}<link rel="stylesheet" href="${b}/os/os.css?v=${v}">`;
  const corpo = `<script type="module" src="${b}/os/boot.js?v=${v}"></script>`;
  let out = html.replace(/<head([^>]*)>/i, m => m + cabeca);
  out = out.includes("</body>") ? out.replace("</body>", corpo + "</body>") : out + corpo;
  return out;
}

/** Credenciais TURN efêmeras (coturn use-auth-secret / RFC 7635-like). */
export function credenciaisTurn(segredo, usuarioId, ttl = 6 * 3600) {
  const username = `${Math.floor(Date.now() / 1000) + ttl}:${hashTexto(usuarioId).slice(0, 12)}`;
  const credential = crypto.createHmac("sha1", segredo).update(username).digest("base64");
  return { username, credential };
}

// Validação do grafo: só a estrutura esperada é gravada.
const ID = /^[a-z0-9_-]{1,40}$/i;
export function validarGrafo(g) {
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.edges)) throw Object.assign(new Error("Grafo inválido"), { s: 400 });
  if (g.nodes.length > 200 || g.edges.length > 400) throw Object.assign(new Error("Grafo grande demais (200 nós / 400 conexões)"), { s: 400 });
  const nodes = g.nodes.map(n => {
    if (!ID.test(n.id || "")) throw Object.assign(new Error("Nó com id inválido"), { s: 400 });
    return {
      id: n.id, tipo: String(n.tipo || "dado").slice(0, 24), rotulo: String(n.rotulo || "").slice(0, 60),
      x: Math.round(Math.max(-5000, Math.min(5000, +n.x || 0))), y: Math.round(Math.max(-5000, Math.min(5000, +n.y || 0)))
    };
  });
  const ids = new Set(nodes.map(n => n.id));
  const vistos = new Set();
  const edges = g.edges.filter(e => ids.has(e.de) && ids.has(e.para) && e.de !== e.para).filter(e => {
    const k = e.de + ">" + e.para; if (vistos.has(k)) return false; vistos.add(k); return true;
  }).map(e => ({ de: e.de, para: e.para }));
  return { nodes, edges };
}

export function montarOS(app, ctx) {
  const { q, tx, A, E, ah, au, one } = ctx;
  const AMBIENTE = process.env.AMBIENTE || "producao";
  const BASE = ctx.BP || "";
  const indexBase = fs.readFileSync(path.join(PUB, "index.html"), "utf8");
  const indexOS = injetar(indexBase, { base: BASE, ambiente: AMBIENTE });

  const can = async (uid, f) => !!one(await q("select can_use($1,$2) ok", [uid, f])).ok;
  const feat = f => ah(async (req, res, next) => { if (!(await can(req.u.id, f))) throw new E(403, "Funcionalidade não autorizada"); next(); });
  const ganharXP = (uid, n) => q("insert into os_xp(user_id,xp) values($1,$2) on conflict(user_id) do update set xp=os_xp.xp+$2,updated_at=now()", [uid, n]).catch(() => {});

  // Sessão opcional (rotas públicas). Ao contrário de A, aceita quem ainda precisa trocar a senha inicial,
  // para a interface saber que deve abrir a troca de senha.
  const talvez = ah(async (req, res, next) => {
    const m = ctx.CKRE.exec(req.headers.cookie || "");
    req.u = m ? one(await q(`select u.id,u.username,u.display_name,u.is_root,u.must_change_password,coalesce((to_jsonb(u)->>'senha_local')::boolean,true) senha_local,array(select role::text from user_roles where user_id=u.id) roles
      from sessions s join users u on u.id=s.user_id where s.token_hash=$1 and not s.revoked and s.expires_at>now() and u.is_active`, [ctx.sha(m[1])])) || null : null;
    next();
  });

  // ---- cadastro aberto e entrada com Google, X, Apple ou Microsoft ----
  montarContas(app, { ...ctx, talvez });
  // ---- vídeos dos pratos (reels, stories, lives/tutoriais) ----
  montarVideos(app, { ...ctx, talvez, feat });

  // ---- interface: index com a camada OS ----
  const servirIndex = (req, res) => { res.setHeader("Cache-Control", "no-cache"); res.type("html").send(indexOS); };
  app.get(["/", "/index.html"], servirIndex);
  // Camada OS: revalida sempre (ETag) para que um deploy nunca sirva dicionário/módulo antigo do cache.
  app.use("/os", (req, res, next) => { if (!req.path.startsWith("/vendor/")) res.setHeader("Cache-Control", "no-cache"); next(); });
  app.get("/os/vendor/three.module.min.js", (req, res) =>
    res.sendFile(path.join(path.dirname(require.resolve("three")), "three.module.min.js"), { maxAge: "7d", headers: { "Content-Type": "text/javascript" } }));

  const P = "/os-api";

  // ---- informações públicas ----
  app.get(P + "/info", talvez, ah(async (req, res) => {
    const ice = [{ urls: (process.env.STUN_URLS || "stun:stun.l.google.com:19302").split(",").map(s => s.trim()) }];
    if (req.u && process.env.TURN_URL && process.env.TURN_SECRET) ice.push({ urls: process.env.TURN_URL.split(","), ...credenciaisTurn(process.env.TURN_SECRET, req.u.id) });
    res.json({
      versao: VERSAO, ambiente: AMBIENTE, base: BASE, idiomas: IDIOMAS, ia: iaDisponivel(), termos: VERSAO_TERMOS,
      lgpd: { controlador: process.env.LGPD_CONTROLADOR || "M3D.pro", contato: process.env.LGPD_DPO_CONTATO || null, retencaoChatDias: +(process.env.CHAT_RETENTION_DAYS || 30) },
      usuario: req.u ? { id: req.u.id, username: req.u.username, nome: req.u.display_name, root: req.u.is_root, trocarSenha: req.u.must_change_password, senhaLocal: req.u.senha_local } : null,
      ice
    });
  }));

  app.get(P + "/permissoes", A, ah(async (req, res) => {
    const fs_ = (await q("select code from features order by code")).rows.map(x => x.code);
    const out = {};
    for (const f of fs_) out[f] = await can(req.u.id, f);
    res.json({ papeis: req.u.roles, root: req.u.is_root, funcionalidades: out });
  }));

  app.get(P + "/ia/status", A, ctx.root, (req, res) => res.json(iaStatus()));

  // ---- infográficos: portal público + geração/publicação ----
  montarInfograficos(app, { q, A, E, ah, au, one, P, can });
  semearInfograficos(q).catch(e => console.error("semente de infográficos:", e.message));

  // ---- tradução contextual por IA ----
  // Pública (a tela de login também é traduzida), com limite por IP e consentimento explícito do cliente.
  const limTrad = rateLimit({ windowMs: 10 * 60e3, max: 60, standardHeaders: true, legacyHeaders: false });
  app.post(P + "/traduzir", limTrad, talvez, ah(async (req, res) => {
    const { lang, textos } = req.body || {};
    if (!IDIOMAS[lang]) throw new E(400, "Idioma não suportado");
    if (!Array.isArray(textos) || textos.length > 120) throw new E(400, "Envie até 120 textos");
    if (req.headers["x-os-consent"] !== "ai_processing") throw new E(428, "Consentimento para processamento por IA necessário");
    if (req.u && !(await can(req.u.id, "i18n_ai"))) throw new E(403, "Tradução por IA não autorizada para este usuário");
    const fontes = textos.map(t => String(t ?? "").slice(0, 600));
    if (lang === "pt" || !iaDisponivel()) return res.json({ traducoes: fontes, ia: false });

    // Mascara identificadores e consulta o cache (o cache nunca guarda dado pessoal: guarda a versão mascarada).
    const itens = fontes.map(t => { const m = mascarar(t); return { ...m, h: hashTexto(m.texto) }; });
    const cache = new Map((await q("select src_hash,translated from ai_translation_cache where lang=$1 and src_hash=any($2)", [lang, itens.map(i => i.h)])).rows.map(x => [x.src_hash, x.translated]));
    const faltam = [...new Map(itens.filter(i => !cache.has(i.h) && /\p{L}/u.test(i.texto)).map(i => [i.h, i])).values()];
    if (faltam.length) {
      try {
        const { texto } = await gerar({
          json: true, maxTokens: 4000,
          sistema: `Você é o motor de tradução de interface do Gusto, plataforma de receitas, preparo e entrega de comida com carteira de créditos e pagamentos.
Traduza cada item para ${IDIOMAS[lang]} mantendo o contexto técnico (culinária, nutrição, logística, finanças) e o tom de interface.
Regras: preserve exatamente marcadores ⟦n⟧, emojis, números, unidades, moedas (R$), códigos, nomes próprios e a marca "Gusto".
Mantenha textos curtos curtos. Não explique. Responda SOMENTE um JSON {"t":[...]} com o mesmo número de itens e na mesma ordem.`,
          usuario: JSON.stringify({ itens: faltam.map(i => i.texto) })
        });
        const j = extrairJSON(texto);
        const arr = Array.isArray(j) ? j : j.t;
        if (Array.isArray(arr) && arr.length === faltam.length) {
          for (let k = 0; k < faltam.length; k++) {
            const tr = String(arr[k] ?? "").slice(0, 1200);
            if (!tr) continue;
            cache.set(faltam[k].h, tr);
            await q("insert into ai_translation_cache(lang,src_hash,translated) values($1,$2,$3) on conflict do nothing", [lang, faltam[k].h, tr]);
          }
        }
      } catch (e) {
        if (e.s !== 503) console.error("traduzir:", e.message);
        return res.json({ traducoes: fontes, ia: false, aviso: "IA indisponível; mantido o original" });
      }
    }
    res.json({ traducoes: itens.map((i, k) => (cache.has(i.h) ? restaurar(cache.get(i.h), i.mapa) : fontes[k])), ia: true });
  }));

  // ---- grafo de funcionalidades ----
  app.get(P + "/grafo", A, feat("os_graph"), ah(async (req, res) => {
    const g = one(await q("select name,data,updated_at from os_graphs where owner_id=$1 order by updated_at desc limit 1", [req.u.id]));
    res.json(g || { name: "Meu grafo", data: null });
  }));
  app.put(P + "/grafo", A, feat("os_graph"), ah(async (req, res) => {
    const data = validarGrafo(req.body?.data);
    const name = String(req.body?.name || "Meu grafo").slice(0, 80) || "Meu grafo";
    await q("insert into os_graphs(owner_id,name,data) values($1,$2,$3) on conflict(owner_id,name) do update set data=$3,updated_at=now()", [req.u.id, name, data]);
    ganharXP(req.u.id, 1);
    res.json({ ok: true, nos: data.nodes.length, conexoes: data.edges.length });
  }));

  // ---- notas cruzadas da agenda ----
  const DIA = /^\d{4}-\d{2}-\d{2}$/;
  app.get(P + "/notas", A, feat("notes"), ah(async (req, res) => {
    const { de, ate } = req.query;
    if (!DIA.test(de || "") || !DIA.test(ate || "")) throw new E(400, "Informe de= e ate= (AAAA-MM-DD)");
    const notas = (await q("select id,to_char(day,'YYYY-MM-DD') dia,title titulo,body corpo,updated_at from os_notes where owner_id=$1 and day between $2 and $3 order by day,created_at", [req.u.id, de, ate])).rows;
    const links = (await q(`select l.a,l.b from os_note_links l join os_notes n on n.id=l.a where n.owner_id=$1`, [req.u.id])).rows;
    res.json({ notas, links });
  }));
  app.get(P + "/notas/busca", A, feat("notes"), ah(async (req, res) => {
    const t = String(req.query.q || "").slice(0, 60);
    res.json((await q("select id,to_char(day,'YYYY-MM-DD') dia,title titulo from os_notes where owner_id=$1 and ($2='' or title ilike '%'||$2||'%') order by updated_at desc limit 30", [req.u.id, t])).rows);
  }));
  app.post(P + "/notas", A, feat("notes"), ah(async (req, res) => {
    const { dia, titulo, corpo } = req.body || {};
    if (!DIA.test(dia || "") || !String(titulo || "").trim()) throw new E(400, "Dia e título obrigatórios");
    const n = one(await q("insert into os_notes(owner_id,day,title,body) values($1,$2,$3,$4) returning id", [req.u.id, dia, String(titulo).trim().slice(0, 120), String(corpo || "").slice(0, 10000)]));
    ganharXP(req.u.id, 2);
    res.status(201).json(n);
  }));
  app.patch(P + "/notas/:id", A, feat("notes"), ah(async (req, res) => {
    const { dia, titulo, corpo } = req.body || {};
    if (dia !== undefined && !DIA.test(dia)) throw new E(400, "Dia inválido");
    const r_ = await q(`update os_notes set day=coalesce($3,day),title=coalesce(nullif($4,''),title),body=coalesce($5,body),updated_at=now() where id=$1 and owner_id=$2`,
      [req.params.id, req.u.id, dia ?? null, titulo !== undefined ? String(titulo).trim().slice(0, 120) : null, corpo !== undefined ? String(corpo).slice(0, 10000) : null]);
    if (!r_.rowCount) throw new E(404, "Nota não encontrada");
    res.json({ ok: true });
  }));
  app.delete(P + "/notas/:id", A, feat("notes"), ah(async (req, res) => {
    const r_ = await q("delete from os_notes where id=$1 and owner_id=$2", [req.params.id, req.u.id]);
    if (!r_.rowCount) throw new E(404, "Nota não encontrada");
    res.json({ ok: true });
  }));
  app.post(P + "/notas/:id/links", A, feat("notes"), ah(async (req, res) => {
    const outra = String(req.body?.com || "");
    const ok = (await q("select count(*)::int n from os_notes where owner_id=$1 and id = any($2::uuid[])", [req.u.id, [req.params.id, outra]])).rows[0].n;
    if (ok !== 2 || outra === req.params.id) throw new E(400, "Notas inválidas");
    const [a, b] = [req.params.id, outra].sort();
    const remover = req.body?.remover === true;
    await q(remover ? "delete from os_note_links where a=$1 and b=$2" : "insert into os_note_links(a,b) values($1,$2) on conflict do nothing", [a, b]);
    res.json({ ok: true });
  }));

  // ---- comunidade (histórico via HTTP; tempo real via /os-ws) ----
  app.get(P + "/chat/salas", A, feat("chat"), ah(async (req, res) => res.json((await q("select slug,title titulo from chat_rooms order by created_at")).rows)));
  app.get(P + "/chat/salas/:slug/mensagens", A, feat("chat"), ah(async (req, res) => {
    const rows = (await q(`select m.id,m.body texto,m.at em,u.display_name autor,(m.author_id=$2) minha from chat_messages m join chat_rooms r on r.id=m.room_id
      left join users u on u.id=m.author_id where r.slug=$1 order by m.at desc limit 80`, [req.params.slug, req.u.id])).rows.reverse();
    res.json(rows);
  }));

  // ---- avatar / assistente técnico ----
  app.get(P + "/avatar/estado", A, ah(async (req, res) => {
    const x = one(await q("select xp,muted from os_xp where user_id=$1", [req.u.id])) || { xp: 0, muted: false };
    res.json({ ...x, nivel: 1 + Math.floor(Math.sqrt(x.xp / 10)) });
  }));
  app.put(P + "/avatar/estado", A, ah(async (req, res) => {
    await q("insert into os_xp(user_id,muted) values($1,$2) on conflict(user_id) do update set muted=$2,updated_at=now()", [req.u.id, !!req.body?.muted]);
    res.json({ ok: true });
  }));
  const limAvatar = rateLimit({ windowMs: 60e3, max: 12, standardHeaders: true, legacyHeaders: false });
  app.post(P + "/avatar/perguntar", limAvatar, A, feat("avatar"), ah(async (req, res) => {
    const pergunta = String(req.body?.pergunta || "").trim().slice(0, 500);
    const lang = IDIOMAS[req.body?.lang] ? req.body.lang : "pt";
    if (!pergunta) throw new E(400, "Escreva uma pergunta");
    // Contexto: apenas dados do próprio usuário e o catálogo de receitas (minimização).
    const notas = (await q("select to_char(day,'YYYY-MM-DD') dia,title,left(body,400) body from os_notes where owner_id=$1 order by updated_at desc limit 25", [req.u.id])).rows;
    const receitas = (await q("select title,status::text from recipes order by created_at desc limit 60").catch(() => ({ rows: [] }))).rows;
    ganharXP(req.u.id, 2);

    const usarIA = iaDisponivel() && (await temConsentimento(q, req.u.id, "ai_processing")) && (await can(req.u.id, "ai"));
    if (usarIA) {
      const mapa = [];
      const ctxTexto = mascarar(JSON.stringify({ notas, receitas }), mapa).texto;
      const perg = mascarar(pergunta, mapa).texto;
      try {
        const { texto, provedor } = await gerar({
          maxTokens: 600,
          sistema: `Você é o Gusto, mascote e assistente técnico do app Gusto (receitas, preparo, entrega, agenda e carteira).
Responda em ${IDIOMAS[lang]}, em até 6 frases, de forma didática e amigável. Use SOMENTE o contexto fornecido e conhecimento geral de culinária e do app.
Se faltar dado, diga isso. Não dê diagnóstico nem prescrição de saúde ou nutrição. Preserve marcadores ⟦n⟧ sem tentar adivinhá-los.`,
          usuario: `CONTEXTO (dados do próprio usuário): ${ctxTexto}\n\nPERGUNTA: ${perg}`
        });
        return res.json({ resposta: restaurar(texto, mapa), modo: "ia", provedor });
      } catch (e) { /* cai para a busca local */ }
    }
    const termos = pergunta.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/\W+/).filter(w => w.length > 2);
    const pont = t => termos.reduce((s, w) => s + (t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(w) ? 1 : 0), 0);
    const achados = [
      ...notas.map(n => ({ s: pont(n.title + " " + n.body), t: `📝 ${n.dia}: ${n.title}` })),
      ...receitas.map(r_ => ({ s: pont(r_.title), t: `🍲 ${r_.title} (${r_.status})` }))
    ].filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 5);
    res.json({
      modo: "local",
      resposta: achados.length ? "Encontrei isto nos seus dados:\n" + achados.map(a => "• " + a.t).join("\n")
        : "Não encontrei nada sobre isso nas suas notas nem nas receitas. Com a IA ativada (Privacidade → processamento por IA) posso responder com mais contexto."
    });
  }));

  // ---- LGPD: consentimentos, portabilidade, eliminação ----
  app.get(P + "/lgpd/consentimentos", A, ah(async (req, res) => res.json({ versao: VERSAO_TERMOS, consentimentos: await consentimentos(q, req.u.id) })));
  app.put(P + "/lgpd/consentimentos/:finalidade", A, ah(async (req, res) => {
    const f = req.params.finalidade;
    if (!FINALIDADES.includes(f)) throw new E(400, "Finalidade desconhecida");
    const g = req.body?.concedido === true;
    await q("insert into lgpd_consents(user_id,purpose,granted,version) values($1,$2,$3,$4) on conflict(user_id,purpose) do update set granted=$3,version=$4,at=now()", [req.u.id, f, g, VERSAO_TERMOS]);
    await au({ query: q }, req.u.id, "lgpd.consent", "lgpd_consents", f, { concedido: g });
    res.json({ ok: true });
  }));
  app.get(P + "/lgpd/exportar", A, ah(async (req, res) => {
    const d = await exportar(q, req.u.id);
    res.setHeader("Content-Disposition", `attachment; filename="gusto-meus-dados-${new Date().toISOString().slice(0, 10)}.json"`);
    res.setHeader("Cache-Control", "no-store");
    res.json(d);
  }));
  app.post(P + "/lgpd/excluir", A, ah(async (req, res) => {
    if (req.body?.confirmar !== "EXCLUIR") throw new E(400, 'Digite EXCLUIR para confirmar');
    try { await eliminar({ tx, q }, req.u.id, req.body?.senha); }
    catch (e) { throw new E(e.s || 500, e.message); }
    res.setHeader("Set-Cookie", `${process.env.COOKIE_NAME || "gusto_sid"}=; Max-Age=0; Path=${BASE || "/"}`);
    res.json({ ok: true });
  }));
}

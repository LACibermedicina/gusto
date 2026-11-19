// GUSTO · rotas dos infográficos: portal público (antes do login) + geração por IA e publicação (admin) · by m3d.pro
import rateLimit from "express-rate-limit";
import { validarInfografico, slugificar } from "./infografico-esquema.js";
import { SISTEMA_INFOGRAFICO, pedidoInfografico } from "./prompt-infografico.js";
import { SEMENTE } from "./infograficos-semente.js";
import { gerar, iaDisponivel, extrairJSON } from "./ia.js";

/** Semeia os infográficos da equipe uma única vez (não sobrescreve edições). */
export async function semearInfograficos(q) {
  for (const s of SEMENTE) {
    const c = validarInfografico(s);
    await q(`insert into infograficos(slug,titulo,categoria,conteudo,publicado,destaque,origem) values($1,$2,$3,$4,true,$5,'equipe')
             on conflict(slug) do nothing`, [s.slug, c.titulo, c.categoria, c, !!s.destaque]);
  }
}

export function montarInfograficos(app, { q, A, E, ah, au, one, P, can }) {
  const lim = rateLimit({ windowMs: 60e3, max: 120, standardHeaders: true, legacyHeaders: false });
  const cartao = r => ({ slug: r.slug, titulo: r.titulo, categoria: r.categoria, destaque: r.destaque, resumo: r.conteudo.resumo,
    tempo: r.conteudo.tempo, nivel: r.conteudo.nivel, contextoAlvo: r.conteudo.contextoAlvo, atualizado: r.atualizado_em,
    etapas: r.conteudo.fisicoQuimica.etapas.map(e => ({ titulo: e.titulo, icone: e.icone })), alerta: r.conteudo.fisicoQuimica.alerta.titulo, sensorial: r.conteudo.praca.sensorial.slice(0, 3), dica: r.conteudo.segredos.dicas[0] });

  // ---- público (sem login): só o que está publicado, sem dados de autoria ----
  app.get(P + "/publico/infograficos", lim, ah(async (req, res) => {
    const r = await q("select slug,titulo,categoria,destaque,conteudo,atualizado_em from infograficos where publicado order by destaque desc, atualizado_em desc limit 60");
    res.setHeader("Cache-Control", "public, max-age=120");
    res.json(r.rows.map(cartao));
  }));
  app.get(P + "/publico/infograficos/:slug", lim, ah(async (req, res) => {
    const r = one(await q("select slug,conteudo from infograficos where publicado and slug=$1", [req.params.slug]));
    if (!r) throw new E(404, "Infográfico não encontrado");
    res.setHeader("Cache-Control", "public, max-age=120");
    res.json({ slug: r.slug, ...r.conteudo });
  }));

  // ---- gestão (funcionalidade "infograficos"; root sempre pode) ----
  const pode = ah(async (req, res, next) => { if (!(await can(req.u.id, "infograficos"))) throw new E(403, "Funcionalidade não autorizada"); next(); });
  app.get(P + "/infograficos", A, pode, ah(async (req, res) => {
    const r = await q("select slug,titulo,categoria,publicado,destaque,origem,conteudo,atualizado_em from infograficos order by atualizado_em desc limit 200");
    res.json(r.rows.map(x => ({ ...cartao(x), publicado: x.publicado, origem: x.origem })));
  }));
  app.get(P + "/infograficos/:slug", A, pode, ah(async (req, res) => {
    const r = one(await q("select slug,publicado,destaque,conteudo from infograficos where slug=$1", [req.params.slug]));
    if (!r) throw new E(404, "Infográfico não encontrado");
    res.json({ slug: r.slug, publicado: r.publicado, destaque: r.destaque, ...r.conteudo });
  }));

  const limIA = rateLimit({ windowMs: 60 * 60e3, max: 20, standardHeaders: true, legacyHeaders: false });
  app.post(P + "/infograficos/gerar", limIA, A, pode, ah(async (req, res) => {
    const prato = String(req.body?.prato || "").trim().slice(0, 120);
    const contexto = String(req.body?.contexto || "").trim().slice(0, 160);
    const referencias = String(req.body?.referencias || "").trim().slice(0, 400);
    if (!prato || !contexto) throw new E(400, "Informe o prato/técnica e o contexto-alvo");
    if (!iaDisponivel()) throw new E(503, "IA não configurada no servidor (SERVIDOR_ENV)");
    let dados;
    try {
      const { texto } = await gerar({ sistema: SISTEMA_INFOGRAFICO, usuario: pedidoInfografico({ prato, contexto, referencias }), json: true, maxTokens: 4000 });
      dados = validarInfografico({ ...extrairJSON(texto), contextoAlvo: contexto });
    } catch (e) {
      throw new E(e.s === 400 ? 422 : e.s || 502, e.s === 400 ? "A IA devolveu um infográfico incompleto: " + e.message + ". Tente de novo." : e.message);
    }
    let slug = slugificar(dados.titulo);
    if (one(await q("select 1 x from infograficos where slug=$1", [slug]))) slug = (slug.slice(0, 52) + "-" + Date.now().toString(36).slice(-6));
    await q("insert into infograficos(slug,titulo,categoria,conteudo,publicado,origem,criado_por) values($1,$2,$3,$4,false,'ia',$5)", [slug, dados.titulo, dados.categoria, dados, req.u.id]);
    await au({ query: q }, req.u.id, "infografico.gerar", "infograficos", slug, { prato });
    res.status(201).json({ slug, ...dados, publicado: false });
  }));

  app.put(P + "/infograficos/:slug", A, pode, ah(async (req, res) => {
    const atual = one(await q("select conteudo from infograficos where slug=$1", [req.params.slug]));
    if (!atual) throw new E(404, "Infográfico não encontrado");
    const conteudo = req.body?.conteudo ? validarInfografico(req.body.conteudo) : atual.conteudo;
    const r = await q(`update infograficos set conteudo=$2,titulo=$3,categoria=$4,publicado=coalesce($5,publicado),destaque=coalesce($6,destaque),atualizado_em=now() where slug=$1`,
      [req.params.slug, conteudo, conteudo.titulo, conteudo.categoria, typeof req.body?.publicado === "boolean" ? req.body.publicado : null, typeof req.body?.destaque === "boolean" ? req.body.destaque : null]);
    await au({ query: q }, req.u.id, "infografico.editar", "infograficos", req.params.slug, { publicado: req.body?.publicado });
    res.json({ ok: r.rowCount === 1 });
  }));
  app.delete(P + "/infograficos/:slug", A, pode, ah(async (req, res) => {
    await q("delete from infograficos where slug=$1", [req.params.slug]);
    await au({ query: q }, req.u.id, "infografico.excluir", "infograficos", req.params.slug);
    res.json({ ok: true });
  }));
}

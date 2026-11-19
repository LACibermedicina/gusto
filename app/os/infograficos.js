// GUSTO · rotas dos infográficos: portal público (antes do login) + geração por IA e publicação (admin) · by m3d.pro
import rateLimit from "express-rate-limit";
import { validarInfografico, validarSimples, slugificar } from "./infografico-esquema.js";
import { SISTEMA_INFOGRAFICO, pedidoInfografico } from "./prompt-infografico.js";
import { SEMENTE } from "./infograficos-semente.js";
import { gerar, iaDisponivel, extrairJSON } from "./ia.js";

/** Semeia os infográficos da equipe uma única vez (não sobrescreve edições). */
export async function semearInfograficos(q) {
  for (const s of SEMENTE) {
    const c = validarInfografico(s);
    await q(`insert into infograficos(slug,titulo,categoria,conteudo,publicado,destaque,origem) values($1,$2,$3,$4,true,$5,'equipe')
             on conflict(slug) do nothing`, [s.slug, c.titulo, c.categoria, c, !!s.destaque]);
    // Fichas criadas antes do painel simplificado recebem só esse bloco (o resto, se editado, é preservado).
    // Blocos que surgiram depois da criação da ficha entram só se faltarem (edições do admin são preservadas).
    for (const k of ["simples", "historia", "cena", "origem"]) {
      const v = c[k]; if (!v || (k === "cena" && !v.ingredientes.length)) continue;
      await q(`update infograficos set conteudo = jsonb_set(conteudo, $2, $3::jsonb, true)
               where slug=$1 and (coalesce(conteudo->$4,'null'::jsonb) in ('null'::jsonb, '""'::jsonb) or ($4='cena' and coalesce(jsonb_array_length(conteudo->'cena'->'ingredientes'),0)=0))`,
        [s.slug, `{${k}}`, JSON.stringify(v), k]);
    }
  }
}

export function montarInfograficos(app, { q, A, E, ah, au, one, P, can }) {
  const lim = rateLimit({ windowMs: 60e3, max: 120, standardHeaders: true, legacyHeaders: false });
  const cartao = r => ({ slug: r.slug, titulo: r.titulo, categoria: r.categoria, destaque: r.destaque, resumo: r.conteudo.resumo,
    tempo: r.conteudo.tempo, nivel: r.conteudo.nivel, contextoAlvo: r.conteudo.contextoAlvo, atualizado: r.atualizado_em, cena: r.conteudo.cena, historia: r.conteudo.historia,
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
    q("insert into infografico_visitas(slug,n) values($1,1) on conflict(slug,dia) do update set n=infografico_visitas.n+1", [r.slug]).catch(() => {});
    res.setHeader("Cache-Control", "no-store");
    res.json({ slug: r.slug, ...r.conteudo });
  }));

  // ---- radar público: origem histórica, onde é feita, onde é consumida, popularidade ----
  // Locais de preparo/consumo saem agregados em grade de ~5 km e só com 3+ registros (anonimato).
  let cacheRadar = { em: 0, dados: null };
  app.get(P + "/publico/radar", lim, ah(async (req, res) => {
    if (Date.now() - cacheRadar.em > 5 * 60e3) {
      const fichas = (await q(`select i.slug, i.titulo, i.conteudo->'origem' origem, i.receita_id,
          coalesce((select sum(n) from infografico_visitas v where v.slug=i.slug and v.dia > current_date - 90),0)::int visitas,
          coalesce((select count(*) from orders o where o.recipe_id=i.receita_id and o.status<>'cancelled'),0)::int pedidos
        from infograficos i where i.publicado order by i.destaque desc, i.atualizado_em desc limit 60`)).rows;
      const grade = async (sql, id) => id ? (await q(sql, [id]).catch(() => ({ rows: [] }))).rows.map(r => ({ lat: +r.lat, lon: +r.lon, n: +r.n })) : [];
      for (const f of fichas) {
        f.feita = await grade(`select round(st_y(k.location::geometry)::numeric*20)/20 lat, round(st_x(k.location::geometry)::numeric*20)/20 lon, count(*) n
          from orders o join kitchens k on k.owner_id=o.cook_id where o.recipe_id=$1 and k.location is not null and o.status<>'cancelled'
          group by 1,2 having count(*)>=3`, f.receita_id);
        f.consumida = await grade(`select round(st_y(delivery_to::geometry)::numeric*20)/20 lat, round(st_x(delivery_to::geometry)::numeric*20)/20 lon, count(*) n
          from orders where recipe_id=$1 and delivery_to is not null and status<>'cancelled' group by 1,2 having count(*)>=3`, f.receita_id);
        delete f.receita_id;
      }
      cacheRadar = { em: Date.now(), dados: { referencia: { lugar: "São Paulo", lat: -23.55, lon: -46.633 }, fichas } };
    }
    res.setHeader("Cache-Control", "public, max-age=120");
    res.json(cacheRadar.dados);
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
      if (!dados.simples) validarSimples(null, true);
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
  app.put(P + "/infograficos/:slug/receita", A, pode, ah(async (req, res) => {
    const id = req.body?.receita_id || null;
    if (id && !one(await q("select 1 x from recipes where id=$1", [id]))) throw new E(400, "Receita inexistente");
    await q("update infograficos set receita_id=$2 where slug=$1", [req.params.slug, id]);
    cacheRadar.em = 0; res.json({ ok: true });
  }));
  app.delete(P + "/infograficos/:slug", A, pode, ah(async (req, res) => {
    await q("delete from infograficos where slug=$1", [req.params.slug]);
    await au({ query: q }, req.u.id, "infografico.excluir", "infograficos", req.params.slug);
    res.json({ ok: true });
  }));
}

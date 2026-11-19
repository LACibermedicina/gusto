// GUSTO · camada OS · vídeos dos pratos: reels, stories (24 h) e lives/tutoriais · by m3d.pro
// Envio em partes de até 768 KB (o Nginx do VPS aceita 1 MB por requisição): sem mexer no proxy e com retomada simples.
// O tipo do arquivo é decidido pelos bytes iniciais (MP4/MOV ou WebM), nunca pelo que o navegador declara.
// Vídeo curto (≤ 90 s) vira reel ou story; acima disso é classificado como live/tutorial e aparece como referência
// extra da receita. Vídeos muito longos (> 10 min) devem ir como link externo (YouTube, Vimeo…).
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import express from "express";
import rateLimit from "express-rate-limit";

export const CURTO_S = 90;            // até aqui: reel/story
export const MAX_UPLOAD_S = 600;      // envio direto até 10 min; acima, só link
export const PARTE = 768 * 1024;
const MB = 1024 * 1024;

/** Detecta o contêiner pelos bytes iniciais. */
export function detectarTipo(buf) {
  if (buf.length >= 12 && buf.toString("latin1", 4, 8) === "ftyp") {
    const marca = buf.toString("latin1", 8, 12);
    return marca === "qt  " ? "video/quicktime" : "video/mp4";
  }
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  return null;
}

/** Duração (s) de MP4/MOV lendo moov › mvhd; null se não achar. Lê só cabeçalhos de caixas. */
export async function duracaoMP4(arquivo) {
  const fh = await fsp.open(arquivo, "r");
  try {
    const { size } = await fh.stat();
    const ler = async (pos, n) => { const b = Buffer.alloc(n); const { bytesRead } = await fh.read(b, 0, n, pos); return b.subarray(0, bytesRead); };
    async function caixas(ini, fim, alvo) {
      let p = ini;
      while (p + 8 <= fim) {
        const c = await ler(p, 16); if (c.length < 8) return null;
        let tam = c.readUInt32BE(0); const tipo = c.toString("latin1", 4, 8); let cab = 8;
        if (tam === 1) { tam = Number(c.readBigUInt64BE(8)); cab = 16; } else if (tam === 0) tam = fim - p;
        if (tam < cab) return null;
        if (tipo === alvo[0]) {
          if (alvo.length === 1) return { pos: p + cab, fim: p + tam };
          return caixas(p + cab, p + tam, alvo.slice(1));
        }
        p += tam;
      }
      return null;
    }
    const mvhd = await caixas(0, size, ["moov", "mvhd"]); if (!mvhd) return null;
    const b = await ler(mvhd.pos, 32); const v = b[0];
    const escala = v === 1 ? b.readUInt32BE(20) : b.readUInt32BE(12);
    const dur = v === 1 ? Number(b.readBigUInt64BE(24)) : b.readUInt32BE(16);
    return escala ? Math.round((dur / escala) * 10) / 10 : null;
  } finally { await fh.close(); }
}

/** Reconhece links de vídeo; só YouTube e Vimeo são incorporados (players sem cookies de rastreio). */
export function analisarLink(texto) {
  let u; try { u = new URL(String(texto || "").trim()); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const host = u.hostname.replace(/^(www|m)\./, "");
  const idYT = /^[\w-]{11}$/;
  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    let id = null, tipo = "tutorial";
    if (host === "youtu.be") id = u.pathname.slice(1);
    else if (u.pathname === "/watch") id = u.searchParams.get("v");
    else { const m = u.pathname.match(/^\/(shorts|live|embed)\/([\w-]{11})/); if (m) { id = m[2]; tipo = m[1] === "shorts" ? "reel" : m[1] === "live" ? "live" : "tutorial"; } }
    if (!id || !idYT.test(id)) return null;
    return { plataforma: "youtube", url: `https://www.youtube.com/watch?v=${id}`, incorporar: `https://www.youtube-nocookie.com/embed/${id}`, tipo };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const m = u.pathname.match(/(?:^|\/)(\d{5,12})(?:$|\/)/); if (!m) return null;
    return { plataforma: "vimeo", url: `https://vimeo.com/${m[1]}`, incorporar: `https://player.vimeo.com/video/${m[1]}`, tipo: "tutorial" };
  }
  const plat = { "instagram.com": "instagram", "tiktok.com": "tiktok", "x.com": "x", "twitter.com": "x", "facebook.com": "facebook", "fb.watch": "facebook", "twitch.tv": "twitch", "kwai.com": "kwai" }[host] || "outro";
  const tipo = plat === "tiktok" || plat === "kwai" || /\/(reel|reels)\//.test(u.pathname) ? "reel" : plat === "twitch" || /\/live/.test(u.pathname) ? "live" : "tutorial";
  return { plataforma: plat, url: u.toString(), incorporar: null, tipo };
}

/** Tipo final: vídeo enviado acima de 90 s é sempre live/tutorial. */
export function classificar(pedido, duracao) {
  if (duracao != null && duracao > CURTO_S) return pedido === "live" ? "live" : "tutorial";
  return ["reel", "story", "tutorial", "live"].includes(pedido) ? pedido : "reel";
}

export function montarVideos(app, ctx) {
  const { q, one, E, ah, A, talvez, feat, au } = ctx;
  const P = "/os-api";
  const DIR = process.env.VIDEOS_DIR || "/dados/videos";
  const MAX_MB = Number(process.env.VIDEO_MAX_MB || 100);
  const COTA_MB = Number(process.env.VIDEO_COTA_MB || 600);       // por usuário
  const LIVRE_MIN_MB = Number(process.env.VIDEO_DISCO_MIN_MB || 2048);
  let pronto = false;
  fsp.mkdir(DIR, { recursive: true }).then(() => { pronto = true; }).catch(e => console.error("[videos] sem pasta", DIR, e.message));
  const arq = id => path.join(DIR, `${id}.bin`);
  const limEnvio = rateLimit({ windowMs: 60 * 60000, max: 30, standardHeaders: true, legacyHeaders: false, message: { error: "Limite de envios por hora atingido." } });
  const exigeCabecalho = (req, res, next) => req.get("x-gusto-upload") === "1" ? next() : next(new E(400, "Cabeçalho de envio ausente"));
  const publico = v => ({ id: v.id, slug: v.slug, tipo: v.tipo, origem: v.origem, legenda: v.legenda, plataforma: v.plataforma,
    url: v.url_externa, incorporar: v.incorporar, duracao: v.duracao_s == null ? null : Number(v.duracao_s), vistas: v.vistas,
    autor: v.autor_nome, autorId: v.autor, publicado: v.publicado, expira: v.expira_em, mime: v.mime });
  const VISIVEL = "v.status='publicado' and (v.expira_em is null or v.expira_em > now())";
  const SELECT = "select v.*, u.display_name autor_nome from os_videos v join users u on u.id=v.autor";

  // ---------- público ----------
  app.get(P + "/publico/videos/:slug", ah(async (req, res) => {
    const r = await q(`${SELECT} where v.slug=$1 and ${VISIVEL} order by v.publicado desc limit 60`, [req.params.slug]);
    res.setHeader("Cache-Control", "no-cache");
    res.json(r.rows.map(publico));
  }));
  app.get(P + "/publico/stories", ah(async (req, res) => {
    const r = await q(`${SELECT} where v.tipo='story' and ${VISIVEL} order by v.publicado desc limit 40`);
    res.setHeader("Cache-Control", "no-cache");
    res.json(r.rows.map(publico));
  }));
  app.get(P + "/videos/:id/arquivo", talvez, ah(async (req, res) => {
    if (!/^[0-9a-f-]{36}$/.test(req.params.id)) throw new E(404, "Vídeo não encontrado");
    const v = one(await q("select * from os_videos where id=$1 and origem<>'link'", [req.params.id]));
    const dono = req.u && (req.u.id === v?.autor || req.u.is_root);
    if (!v || !(v.status === "publicado" && (!v.expira_em || v.expira_em > new Date()) || dono)) throw new E(404, "Vídeo não encontrado");
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("Content-Disposition", "inline");
    res.sendFile(arq(v.id), { headers: { "Content-Type": v.mime || "application/octet-stream" }, acceptRanges: true, dotfiles: "deny" });
  }));
  app.post(P + "/videos/:id/vista", ah(async (req, res) => {
    if (/^[0-9a-f-]{36}$/.test(req.params.id)) await q("update os_videos set vistas=vistas+1 where id=$1 and status='publicado'", [req.params.id]);
    res.json({ ok: true });
  }));

  // ---------- envio ----------
  app.post(P + "/videos", limEnvio, A, feat("os_videos"), ah(async (req, res) => {
    const b = req.body || {};
    if (b.aceite !== true) throw new E(400, "Confirme que você tem direito de uso das imagens");
    const slug = String(b.slug || "");
    if (!one(await q("select 1 from infograficos where slug=$1", [slug]))) throw new E(404, "Receita não encontrada");
    const legenda = String(b.legenda || "").trim().slice(0, 300);
    if (b.origem === "link") {
      const l = analisarLink(b.url); if (!l) throw new E(400, "Link inválido (use https://… de YouTube, Vimeo, Instagram, TikTok…)");
      const tipo = ["reel", "story", "tutorial", "live"].includes(b.tipo) ? b.tipo : l.tipo;
      const v = one(await q(`insert into os_videos(autor,slug,tipo,origem,status,legenda,url_externa,plataforma,incorporar,publicado,expira_em)
        values($1,$2,$3,'link','publicado',$4,$5,$6,$7,now(),case when $3='story' then now()+interval '24 hours' end) returning id`,
        [req.u.id, slug, tipo, legenda, l.url, l.plataforma, l.incorporar]));
      await au(ctx.pool, req.u.id, "video.link", "os_videos", v.id, { slug, plataforma: l.plataforma });
      return res.status(201).json({ id: v.id, tipo, status: "publicado" });
    }
    if (!pronto) throw new E(503, "Armazenamento de vídeos indisponível");
    const tamanho = Math.floor(Number(b.tamanho));
    if (!(tamanho > 1000) || tamanho > MAX_MB * MB) throw new E(413, `Arquivo acima de ${MAX_MB} MB: publique como link externo`);
    const dur = Number(b.duracao);
    if (Number.isFinite(dur) && dur > MAX_UPLOAD_S) throw new E(413, "Vídeo com mais de 10 minutos: publique como link (YouTube, Vimeo…) — ele entra em Lives e tutoriais");
    const usado = Number(one(await q("select coalesce(sum(coalesce(tamanho,0)),0) s from os_videos where autor=$1 and origem<>'link'", [req.u.id])).s);
    if (usado + tamanho > COTA_MB * MB) throw new E(413, `Sua cota de ${COTA_MB} MB de vídeos acabou; apague vídeos antigos ou use links`);
    try { const st = await fsp.statfs(DIR); if ((st.bavail * st.bsize) / MB - tamanho / MB < LIVRE_MIN_MB) throw new E(507, "Servidor sem espaço para vídeos agora"); }
    catch (e) { if (e instanceof E) throw e; }
    const origem = b.origem === "gravacao" ? "gravacao" : "upload";
    const tipo = classificar(b.tipo, Number.isFinite(dur) ? dur : null);
    const v = one(await q(`insert into os_videos(autor,slug,tipo,origem,legenda,tamanho,duracao_s) values($1,$2,$3,$4,$5,$6,$7) returning id`,
      [req.u.id, slug, tipo, origem, legenda, tamanho, Number.isFinite(dur) ? dur : null]));
    await fsp.writeFile(arq(v.id), Buffer.alloc(0), { flag: "w", mode: 0o600 });
    res.status(201).json({ id: v.id, tipo, parte: PARTE, status: "enviando" });
  }));

  app.put(P + "/videos/:id/parte", exigeCabecalho, A, express.raw({ type: "application/octet-stream", limit: PARTE + 1024 }), ah(async (req, res) => {
    const n = Number(req.query.n);
    const v = one(await q("select * from os_videos where id=$1 and autor=$2 and status='enviando'", [req.params.id, req.u.id]));
    if (!v) throw new E(404, "Envio não encontrado");
    if (!Buffer.isBuffer(req.body) || !req.body.length || req.body.length > PARTE) throw new E(400, "Parte inválida");
    if (n !== v.partes) return res.status(409).json({ error: "Parte fora de ordem", esperado: v.partes });
    if (Number(v.recebidos) + req.body.length > Number(v.tamanho)) throw new E(413, "Mais dados que o declarado");
    if (n === 0 && !detectarTipo(req.body)) { await descartar(v.id); throw new E(415, "Formato não aceito: envie MP4, MOV ou WebM"); }
    await fsp.appendFile(arq(v.id), req.body);
    await q("update os_videos set partes=partes+1, recebidos=recebidos+$2 where id=$1", [v.id, req.body.length]);
    res.json({ ok: true, proxima: n + 1 });
  }));

  app.post(P + "/videos/:id/concluir", A, ah(async (req, res) => {
    const v = one(await q("select * from os_videos where id=$1 and autor=$2 and status='enviando'", [req.params.id, req.u.id]));
    if (!v) throw new E(404, "Envio não encontrado");
    const st = await fsp.stat(arq(v.id)).catch(() => null);
    if (!st || st.size !== Number(v.tamanho)) throw new E(400, "Envio incompleto");
    const cab = Buffer.alloc(16); const fh = await fsp.open(arq(v.id), "r"); await fh.read(cab, 0, 16, 0); await fh.close();
    const mime = detectarTipo(cab);
    if (!mime) { await descartar(v.id); throw new E(415, "Formato não aceito"); }
    let dur = v.duracao_s == null ? null : Number(v.duracao_s);
    if (mime !== "video/webm") { const d = await duracaoMP4(arq(v.id)).catch(() => null); if (d) dur = d; } // MP4 fragmentado (gravação do navegador) traz 0 no cabeçalho
    if (dur != null && dur > MAX_UPLOAD_S) { await descartar(v.id); throw new E(413, "Vídeo com mais de 10 minutos: publique como link"); }
    const tipo = classificar(v.tipo, dur);
    await q(`update os_videos set status='publicado', mime=$2, duracao_s=$3, tipo=$4, publicado=now(),
      expira_em=case when $4='story' then now()+interval '24 hours' end where id=$1`, [v.id, mime, dur, tipo]);
    await au(ctx.pool, req.u.id, "video.envio", "os_videos", v.id, { slug: v.slug, tipo, bytes: st.size });
    res.json({ ok: true, id: v.id, tipo, reclassificado: tipo !== v.tipo });
  }));

  async function descartar(id) {
    await fsp.rm(arq(id), { force: true }).catch(() => {});
    await q("delete from os_videos where id=$1", [id]);
  }

  // ---------- meus vídeos / moderação ----------
  app.get(P + "/videos/meus", A, ah(async (req, res) => {
    const r = await q(`${SELECT} where v.autor=$1 and v.status<>'enviando' order by v.criado desc limit 200`, [req.u.id]);
    res.json(r.rows.map(v => ({ ...publico(v), status: v.status, tamanho: v.tamanho })));
  }));
  app.delete(P + "/videos/:id", A, ah(async (req, res) => {
    const v = one(await q("select id, autor from os_videos where id=$1", [req.params.id]));
    if (!v || (v.autor !== req.u.id && !req.u.is_root)) throw new E(404, "Vídeo não encontrado");
    await descartar(v.id);
    await au(ctx.pool, req.u.id, "video.apagar", "os_videos", v.id, { moderacao: v.autor !== req.u.id });
    res.json({ ok: true });
  }));

  // ---------- limpeza: envios abandonados (2 h) e stories vencidos ----------
  async function limpar() {
    const r = await q("select id from os_videos where (status='enviando' and criado < now()-interval '2 hours') or (tipo='story' and expira_em < now())").catch(() => ({ rows: [] }));
    for (const { id } of r.rows) await descartar(id).catch(() => {});
  }
  const t = setInterval(limpar, 30 * 60000); t.unref?.(); setTimeout(limpar, 20000).unref?.();
  return { DIR, limpar };
}

/** Para a eliminação de conta (LGPD): apaga os arquivos dos vídeos do usuário. */
export async function apagarArquivosDoUsuario(q, uid) {
  const DIR = process.env.VIDEOS_DIR || "/dados/videos";
  const r = await q("select id from os_videos where autor=$1", [uid]).catch(() => ({ rows: [] }));
  for (const { id } of r.rows) await fsp.rm(path.join(DIR, `${id}.bin`), { force: true }).catch(() => {});
  void fs;
}

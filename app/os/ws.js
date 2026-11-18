// GUSTO · camada OS · WebSocket: chat da comunidade e sinalização WebRTC · by m3d.pro
import crypto from "crypto";
import { WebSocketServer } from "ws";

const MAX_MSG = 2000;
const salas = new Map(); // slug -> Set<conexão>

function enviar(ws, obj) { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); }
function presenca(slug) {
  const s = salas.get(slug); if (!s) return;
  const usuarios = [...s].map(c => ({ par: c.par, nome: c.nome, video: c.video }));
  for (const c of s) enviar(c, { t: "presenca", usuarios, eu: c.par });
}
function sair(c) {
  if (!c.sala) return;
  const s = salas.get(c.sala);
  if (s) { s.delete(c); if (!s.size) salas.delete(c.sala); else presenca(c.sala); }
  c.sala = null;
}

export function anexarWS(servidor, { q, one, sha, CKRE }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  const origemOk = (() => { try { return new URL(process.env.PUBLIC_URL).origin; } catch { return null; } })();
  const retencao = Math.max(1, +(process.env.CHAT_RETENTION_DAYS || 30));

  // Retenção mínima (LGPD art. 15/16): apaga mensagens antigas de hora em hora.
  const limpar = () => q("delete from chat_messages where at < now() - make_interval(days => $1)", [retencao]).catch(() => {});
  setInterval(limpar, 3600e3).unref(); setTimeout(limpar, 10e3).unref();

  servidor.on("upgrade", async (req, socket, head) => {
    try {
      const url = new URL(req.url, "http://x");
      if (url.pathname !== "/os-ws") return socket.destroy();
      if (origemOk && req.headers.origin && req.headers.origin !== origemOk) return socket.destroy(); // anti CSWSH
      const m = CKRE.exec(req.headers.cookie || "");
      if (!m) return socket.destroy();
      const u = one(await q(`select u.id,u.display_name,u.must_change_password from sessions s join users u on u.id=s.user_id
        where s.token_hash=$1 and not s.revoked and s.expires_at>now() and u.is_active`, [sha(m[1])]));
      if (!u || u.must_change_password) return socket.destroy();
      const chat = one(await q("select can_use($1,'chat') ok", [u.id])).ok;
      if (!chat) return socket.destroy();
      const video = one(await q("select can_use($1,'video') ok", [u.id])).ok;
      wss.handleUpgrade(req, socket, head, ws => {
        Object.assign(ws, { uid: u.id, nome: u.display_name, podeVideo: video, par: crypto.randomBytes(6).toString("hex"), sala: null, video: false, janela: [] });
        wss.emit("connection", ws);
      });
    } catch { socket.destroy(); }
  });

  wss.on("connection", ws => {
    ws.vivo = true;
    ws.on("pong", () => (ws.vivo = true));
    ws.on("close", () => sair(ws));
    ws.on("message", async raw => {
      // Limite: 15 mensagens por 10 s por conexão.
      const agora = Date.now();
      ws.janela = ws.janela.filter(t => agora - t < 10e3); ws.janela.push(agora);
      if (ws.janela.length > 15 && !String(raw).includes('"rtc"')) return enviar(ws, { t: "erro", msg: "Devagar: muitas mensagens." });
      let m; try { m = JSON.parse(raw); } catch { return; }
      try {
        if (m.t === "entrar") {
          const slug = String(m.sala || "");
          const sala = one(await q("select id from chat_rooms where slug=$1", [slug]));
          if (!sala) return enviar(ws, { t: "erro", msg: "Sala inexistente" });
          sair(ws); ws.sala = slug; ws.salaId = sala.id; ws.video = false;
          if (!salas.has(slug)) salas.set(slug, new Set());
          salas.get(slug).add(ws); presenca(slug);
        } else if (m.t === "msg" && ws.sala) {
          const texto = String(m.texto || "").trim().slice(0, MAX_MSG);
          if (!texto) return;
          const r = one(await q("insert into chat_messages(room_id,author_id,body) values($1,$2,$3) returning id,at", [ws.salaId, ws.uid, texto]));
          for (const c of salas.get(ws.sala) || []) enviar(c, { t: "msg", id: r.id, em: r.at, autor: ws.nome, texto, minha: c === ws });
        } else if (m.t === "video" && ws.sala) {
          if (!ws.podeVideo) return enviar(ws, { t: "erro", msg: "Videochamada não autorizada para você." });
          ws.video = !!m.on; presenca(ws.sala);
        } else if (m.t === "rtc" && ws.sala && ws.podeVideo) {
          // Sinalização ponto a ponto apenas dentro da mesma sala e entre quem está com vídeo.
          const alvo = [...(salas.get(ws.sala) || [])].find(c => c.par === m.para);
          if (alvo && alvo.podeVideo) enviar(alvo, { t: "rtc", de: ws.par, nome: ws.nome, dados: m.dados });
        }
      } catch (e) { enviar(ws, { t: "erro", msg: "Falha ao processar" }); }
    });
  });

  const ping = setInterval(() => { for (const ws of wss.clients) { if (!ws.vivo) { ws.terminate(); continue; } ws.vivo = false; ws.ping(); } }, 30e3);
  ping.unref();
  return wss;
}

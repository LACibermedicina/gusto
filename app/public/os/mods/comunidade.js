// GUSTO · módulo Comunidade: chat em tempo real + videochamada WebRTC (malha P2P, até 4 pessoas) · by m3d.pro
import { api, h, wsURL } from "../api.js";
import { t, aplicarEstatico } from "../i18n.js";
import { sessao, exigir, pode } from "../sessao.js";

export const comunidade = ({ abrirConta }) => ({
  id: "comunidade", titulo: "app.comunidade", icone: "comunidade", largura: 780, altura: 540,
  montar(corpo) {
    let ws = null, sala = "geral", eu = null, usuarios = [], tentativa = 0, vivo = true;
    let local = null; const pares = new Map(); // par -> RTCPeerConnection

    const enviar = o => ws?.readyState === 1 && ws.send(JSON.stringify(o));
    const listaMsgs = () => corpo.querySelector(".os-msgs");
    const addMsg = m => {
      const l = listaMsgs(); if (!l) return;
      l.insertAdjacentHTML("beforeend", `<div class="os-msg${m.minha ? " os-minha" : ""}"><b>${h(m.autor || "?")}</b><p>${h(m.texto)}</p><time>${new Date(m.em).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div>`);
      l.scrollTop = l.scrollHeight;
    };

    function conectar() {
      if (!vivo) return;
      const st = corpo.querySelector(".os-st"); if (st) st.textContent = t("chat.conectando");
      ws = new WebSocket(wsURL("/os-ws"));
      ws.onopen = () => { tentativa = 0; enviar({ t: "entrar", sala }); if (st) st.textContent = ""; };
      ws.onclose = () => { if (!vivo) return; const s = corpo.querySelector(".os-st"); if (s) s.textContent = t("chat.desconectado"); setTimeout(conectar, Math.min(15000, 1000 * 2 ** tentativa++)); };
      ws.onmessage = ev => {
        const m = JSON.parse(ev.data);
        if (m.t === "msg") addMsg(m);
        else if (m.t === "presenca") { eu = m.eu; usuarios = m.usuarios; desenharPresenca(); sincronizarVideo(); }
        else if (m.t === "rtc") sinal(m);
        else if (m.t === "erro") { const s = corpo.querySelector(".os-st"); if (s) s.textContent = "⚠ " + m.msg; }
      };
    }

    async function entrarSala(slug) {
      sala = slug; await sairVideo();
      corpo.querySelectorAll(".os-sala").forEach(b => b.classList.toggle("os-sel", b.dataset.s === slug));
      listaMsgs().innerHTML = "";
      (await api(`/os-api/chat/salas/${slug}/mensagens`).catch(() => [])).forEach(addMsg);
      enviar({ t: "entrar", sala: slug });
    }

    function desenharPresenca() {
      const p = corpo.querySelector(".os-pres"); if (!p) return;
      p.innerHTML = usuarios.map(u => `<span class="os-chip">${u.video ? "🎥" : "🟢"} ${h(u.nome)}${u.par === eu ? " ★" : ""}</span>`).join("");
    }

    // ---------- WebRTC ----------
    const ice = () => ({ iceServers: sessao.info?.ice || [{ urls: "stun:stun.l.google.com:19302" }] });
    function novoPar(par, nome) {
      const pc = new RTCPeerConnection(ice());
      pares.set(par, pc);
      local?.getTracks().forEach(tr => pc.addTrack(tr, local));
      pc.onicecandidate = e => e.candidate && enviar({ t: "rtc", para: par, dados: { c: e.candidate } });
      pc.ontrack = e => {
        let v = corpo.querySelector(`video[data-par="${par}"]`);
        if (!v) { corpo.querySelector(".os-grade-v").insertAdjacentHTML("beforeend", `<figure><video data-par="${par}" autoplay playsinline></video><figcaption>${h(nome || "")}</figcaption></figure>`); v = corpo.querySelector(`video[data-par="${par}"]`); }
        v.srcObject = e.streams[0];
      };
      pc.onconnectionstatechange = () => { if (["failed", "closed"].includes(pc.connectionState)) fecharPar(par); };
      return pc;
    }
    function fecharPar(par) { pares.get(par)?.close(); pares.delete(par); corpo.querySelector(`video[data-par="${par}"]`)?.closest("figure")?.remove(); }
    async function sinal(m) {
      if (!local) return;
      let pc = pares.get(m.de) || novoPar(m.de, m.nome);
      const d = m.dados;
      try {
        if (d.sdp) {
          await pc.setRemoteDescription(d.sdp);
          if (d.sdp.type === "offer") { await pc.setLocalDescription(await pc.createAnswer()); enviar({ t: "rtc", para: m.de, dados: { sdp: pc.localDescription } }); }
        } else if (d.c) await pc.addIceCandidate(d.c);
      } catch (e) { console.warn("rtc", e); }
    }
    // Regra para evitar ofertas cruzadas: quem tem o identificador menor oferece.
    async function sincronizarVideo() {
      if (!local) return;
      const comVideo = usuarios.filter(u => u.video && u.par !== eu);
      for (const u of comVideo) if (!pares.has(u.par) && eu < u.par) {
        const pc = novoPar(u.par, u.nome);
        await pc.setLocalDescription(await pc.createOffer());
        enviar({ t: "rtc", para: u.par, dados: { sdp: pc.localDescription } });
      }
      for (const par of [...pares.keys()]) if (!comVideo.some(u => u.par === par)) fecharPar(par);
    }
    async function entrarVideo() {
      try { local = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 360 }, audio: true }); }
      catch (e) { const s = corpo.querySelector(".os-st"); if (s) s.textContent = "⚠ " + e.message; return; }
      const g = corpo.querySelector(".os-grade-v");
      g.hidden = false;
      g.innerHTML = `<figure class="os-eu"><video autoplay playsinline muted></video><figcaption>${h(sessao.usuario?.nome || "")}</figcaption></figure>`;
      g.querySelector("video").srcObject = local;
      corpo.querySelector(".os-vbar").hidden = false; corpo.querySelector(".os-entrar-v").hidden = true;
      enviar({ t: "video", on: true });
    }
    async function sairVideo() {
      for (const par of [...pares.keys()]) fecharPar(par);
      local?.getTracks().forEach(tr => tr.stop()); local = null;
      const g = corpo.querySelector(".os-grade-v"); if (g) { g.hidden = true; g.innerHTML = ""; }
      const vb = corpo.querySelector(".os-vbar"); if (vb) vb.hidden = true;
      const ev = corpo.querySelector(".os-entrar-v"); if (ev) ev.hidden = !pode("video");
      enviar({ t: "video", on: false });
    }

    this._limpar = () => { vivo = false; sairVideo(); ws?.close(); };

    exigir(corpo, "chat", async () => {
      const salas = await api("/os-api/chat/salas").catch(() => []);
      corpo.innerHTML = `<div class="os-com">
        <aside><h3 data-t="chat.salas"></h3>${salas.map(s => `<button class="os-sala" data-s="${h(s.slug)}"># ${h(s.titulo)}</button>`).join("")}
          <p class="os-mu os-peq" data-t="chat.retencao" data-tv='${JSON.stringify({ dias: sessao.info?.lgpd?.retencaoChatDias || 30 })}'></p></aside>
        <section>
          <div class="os-pres"></div>
          <div class="os-grade-v" hidden></div>
          <div class="os-vbar" hidden><button class="os-btn os-mic" data-t="chat.mic"></button><button class="os-btn os-cam" data-t="chat.cam"></button><button class="os-btn os-btn-r os-sairv" data-t="chat.sairVideo"></button></div>
          <div class="os-msgs" aria-live="polite"></div>
          <form class="os-enviar"><input maxlength="2000" data-t-ph="chat.escreva" required><button class="os-btn os-btn-p" data-t="chat.enviar"></button>
            <button type="button" class="os-btn os-entrar-v" data-t="chat.video" ${pode("video") ? "" : "hidden"}></button></form>
          <p class="os-st os-mu os-peq"></p>
        </section></div>`;
      aplicarEstatico(corpo);
      corpo.querySelectorAll(".os-sala").forEach(b => (b.onclick = () => entrarSala(b.dataset.s)));
      const f = corpo.querySelector(".os-enviar");
      f.onsubmit = e => { e.preventDefault(); const i = f.querySelector("input"); if (i.value.trim()) { enviar({ t: "msg", texto: i.value }); i.value = ""; } };
      corpo.querySelector(".os-entrar-v").onclick = entrarVideo;
      corpo.querySelector(".os-sairv").onclick = sairVideo;
      corpo.querySelector(".os-mic").onclick = e => { const a = local?.getAudioTracks()[0]; if (a) { a.enabled = !a.enabled; e.target.classList.toggle("os-off", !a.enabled); } };
      corpo.querySelector(".os-cam").onclick = e => { const v = local?.getVideoTracks()[0]; if (v) { v.enabled = !v.enabled; e.target.classList.toggle("os-off", !v.enabled); } };
      conectar();
      if (salas.length) entrarSala(salas[0].slug);
    }, abrirConta)();
  },
  aoFechar() { this._limpar?.(); }
});

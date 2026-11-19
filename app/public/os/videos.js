// GUSTO · camada OS · vídeos dos pratos: stories na página inicial, reels na receita, lives/tutoriais nos detalhes · by m3d.pro
import { api, url, h, on } from "./api.js";
import { t } from "./i18n.js";
import { sessao } from "./sessao.js";

const CURTO_S = 90, MAX_UPLOAD_S = 600;
const PLAT = { youtube: "YouTube", vimeo: "Vimeo", instagram: "Instagram", tiktok: "TikTok", x: "X", facebook: "Facebook", twitch: "Twitch", kwai: "Kwai", outro: "Link" };
const logado = () => { try { return !!(sessao.usuario && !sessao.usuario.trocarSenha && ME); } catch { return false; } }; // eslint-disable-line no-undef
const fmtDur = s => s == null ? "" : s >= 60 ? `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}` : `${Math.round(s)} s`;
const srcArquivo = v => url(`/os-api/videos/${v.id}/arquivo`);

/** Miniatura: vídeo próprio mostra o 1º quadro; link mostra o selo da plataforma. */
function miniatura(v) {
  if (v.origem !== "link") return `<video src="${srcArquivo(v)}#t=0.5" preload="metadata" muted playsinline aria-hidden="true"></video>`;
  return `<span class="vd-plat vd-plat-${h(v.plataforma)}">${h(PLAT[v.plataforma] || "Link")}</span>`;
}

// ---------------- Stories (página inicial, antes e depois do login) ----------------
export async function mostrarStories(alvo) {
  const lista = await api("/os-api/publico/stories").catch(() => []);
  alvo.hidden = !lista.length;
  if (!lista.length) { alvo.innerHTML = ""; return; }
  alvo.innerHTML = `<p class="vd-rot">${t("vd.stories")}</p><div class="vd-stories" role="list">${lista.map((v, i) =>
    `<button class="vd-story" role="listitem" data-i="${i}" aria-label="${h(t("vd.verStory", { a: v.autor }))}"><span class="vd-anel">${miniatura(v)}</span><small>${h(v.autor.split(" ")[0])}</small></button>`).join("")}</div>`;
  alvo.querySelectorAll(".vd-story").forEach(b => b.addEventListener("click", () => abrirPlayer(lista, +b.dataset.i, { stories: true })));
}

// ---------------- Na ficha da receita ----------------
export async function ligarVideos(caixa, slug) {
  const entrada = caixa.querySelector(".fx-entrada .fe-txt"), av = caixa.querySelector(".fx-avancado") || caixa;
  const secR = document.createElement("section"); secR.className = "vd-sec vd-reels";
  const secT = document.createElement("section"); secT.className = "vd-sec vd-tuts";
  const ref = entrada?.querySelector(".fx-alternar");
  if (entrada && ref) entrada.insertBefore(secR, ref); else caixa.appendChild(secR);
  const tit = av.querySelector(".fx-titulo-av"); tit ? tit.after(secT) : av.appendChild(secT);
  async function desenhar(nota = "") {
    const lista = await api(`/os-api/publico/videos/${encodeURIComponent(slug)}`).catch(() => []);
    const curtos = lista.filter(v => v.tipo === "reel" || v.tipo === "story"), longos = lista.filter(v => v.tipo === "tutorial" || v.tipo === "live");
    const botao = logado() ? `<button class="vd-add" type="button">＋ ${t("vd.adicionar")}</button>` : `<span class="vd-entre">${t("vd.entre")}</span>`;
    secR.innerHTML = `<div class="vd-cab"><h3>${t("vd.reels")}</h3>${botao}</div>` + (curtos.length
      ? `<div class="vd-reels-faixa">${curtos.map((v, i) => `<button class="vd-reel" data-i="${i}" aria-label="${h(v.legenda || t("vd.reel"))}">${miniatura(v)}
          <span class="vd-tag">${v.tipo === "story" ? t("vd.story") : "▶ " + fmtDur(v.duracao)}</span>${v.legenda ? `<span class="vd-leg">${h(v.legenda)}</span>` : ""}</button>`).join("")}</div>`
      : `<p class="vd-vazio">${t("vd.semReels")}</p>`) + (nota ? `<p class="vd-nota" role="status">${h(nota)}</p>` : "");
    secT.innerHTML = `<div class="vd-cab"><h3>${t("vd.tutoriais")}</h3>${logado() ? `<button class="vd-add" data-tipo="tutorial" type="button">＋ ${t("vd.adicionar")}</button>` : ""}</div>` + (longos.length
      ? `<ul class="vd-lista">${longos.map((v, i) => `<li><button class="vd-tut" data-i="${i}">${miniatura(v)}<span><b>${h(v.legenda || (v.tipo === "live" ? t("vd.live") : t("vd.tutorial")))}</b>
          <small>${v.tipo === "live" ? "● " + t("vd.live") : t("vd.tutorial")} · ${h(v.autor)}${v.duracao ? " · " + fmtDur(v.duracao) : ""}${v.origem === "link" ? " · " + h(PLAT[v.plataforma] || "") : ""}</small></span></button></li>`).join("")}</ul>`
      : `<p class="vd-vazio">${t("vd.semTutoriais")}</p>`);
    secR.querySelectorAll(".vd-reel").forEach(b => b.addEventListener("click", () => abrirPlayer(curtos, +b.dataset.i)));
    secT.querySelectorAll(".vd-tut").forEach(b => b.addEventListener("click", () => abrirPlayer(longos, +b.dataset.i, { horizontal: true })));
    caixa.querySelectorAll(".vd-add").forEach(b => b.addEventListener("click", () => abrirEnvio(slug, { tipo: b.dataset.tipo, aoConcluir: n => { desenhar(n); mostrarStories(document.querySelector(".pt-stories") || document.createElement("div")); } })));
  }
  await desenhar();
}

// ---------------- Player (vertical para reels/stories, horizontal para tutoriais) ----------------
export function abrirPlayer(lista, i, { stories = false, horizontal = false } = {}) {
  const m = document.createElement("div");
  m.className = `vd-player${horizontal ? " vd-h" : ""}`; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
  document.body.appendChild(m);
  let atual = i, timer = 0;
  const fechar = () => { clearTimeout(timer); m.remove(); document.removeEventListener("keydown", tecla); };
  const ir = d => { const n = atual + d; if (n < 0 || n >= lista.length) return fechar(); atual = n; desenhar(); };
  function tecla(e) { if (e.key === "Escape") fechar(); if (e.key === "ArrowRight") ir(1); if (e.key === "ArrowLeft") ir(-1); }
  document.addEventListener("keydown", tecla);
  function desenhar() {
    clearTimeout(timer);
    const v = lista[atual];
    const podeApagar = sessao.usuario && (sessao.usuario.id === v.autorId || sessao.usuario.root);
    let midia;
    if (v.origem !== "link") midia = `<video src="${srcArquivo(v)}" playsinline ${stories ? "autoplay" : "autoplay controls"} ${stories ? "" : "loop"}></video>`;
    else if (v.incorporar) midia = `<iframe src="${h(v.incorporar)}?autoplay=1" title="${h(v.legenda || "Vídeo")}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    else midia = `<a class="vd-externo" href="${h(v.url)}" target="_blank" rel="noopener noreferrer nofollow"><span class="vd-plat vd-plat-${h(v.plataforma)}">${h(PLAT[v.plataforma] || "Link")}</span><b>${t("vd.abrirEm", { p: PLAT[v.plataforma] || "site" })} ↗</b><small>${h(new URL(v.url).hostname)}</small></a>`;
    m.innerHTML = `<div class="vd-palco">
      ${stories ? `<div class="vd-barras">${lista.map((_, k) => `<i class="${k < atual ? "vd-ok" : k === atual ? "vd-ag" : ""}"><b></b></i>`).join("")}</div>` : ""}
      <div class="vd-midia">${midia}</div>
      <div class="vd-info"><b>${h(v.autor)}</b>${v.legenda ? `<p>${h(v.legenda)}</p>` : ""}
        ${v.origem === "link" && v.incorporar ? `<a href="${h(v.url)}" target="_blank" rel="noopener noreferrer nofollow">${t("vd.abrirEm", { p: PLAT[v.plataforma] })} ↗</a>` : ""}
        ${podeApagar ? `<button class="vd-apagar" type="button">${t("vd.apagar")}</button>` : ""}</div>
      <button class="vd-fechar" aria-label="${h(t("pub.fechar"))}">×</button>
      ${lista.length > 1 ? `<button class="vd-ant" aria-label="‹">‹</button><button class="vd-prox" aria-label="›">›</button>` : ""}</div>`;
    m.querySelector(".vd-fechar").onclick = fechar;
    m.querySelector(".vd-ant")?.addEventListener("click", () => ir(-1));
    m.querySelector(".vd-prox")?.addEventListener("click", () => ir(1));
    m.onclick = e => { if (e.target === m) fechar(); };
    m.querySelector(".vd-apagar")?.addEventListener("click", async () => {
      if (!confirmarNaTela(m, t("vd.confirmaApagar"))) return;
    });
    fetch(url(`/os-api/videos/${v.id}/vista`), { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    const vid = m.querySelector("video");
    if (stories) {
      const barra = m.querySelector(".vd-ag b");
      if (vid) {
        vid.addEventListener("timeupdate", () => { if (vid.duration) barra.style.width = `${(vid.currentTime / vid.duration) * 100}%`; });
        vid.addEventListener("ended", () => ir(1));
      } else { barra.style.transition = "width 6s linear"; requestAnimationFrame(() => { barra.style.width = "100%"; }); timer = setTimeout(() => ir(1), 6000); }
    }
  }
  // Apagar sem diálogo do navegador: segundo clique confirma.
  function confirmarNaTela(raiz, texto) {
    const b = raiz.querySelector(".vd-apagar");
    if (!b.dataset.conf) { b.dataset.conf = "1"; b.textContent = texto; setTimeout(() => { if (b.isConnected) { delete b.dataset.conf; b.textContent = t("vd.apagar"); } }, 4000); return false; }
    api(`/os-api/videos/${lista[atual].id}`, { metodo: "DELETE", corpo: {} }).then(() => { lista.splice(atual, 1); if (!lista.length) fechar(); else { atual = Math.min(atual, lista.length - 1); desenhar(); } })
      .catch(e => { b.textContent = e.message; });
    return true;
  }
  desenhar();
  m.querySelector(".vd-fechar").focus();
}

// ---------------- Envio: arquivo, gravação ao vivo ou link ----------------
function duracaoArquivo(file) {
  return new Promise(res => {
    const v = document.createElement("video"); v.preload = "metadata"; v.muted = true;
    const u = URL.createObjectURL(file);
    const fim = d => { URL.revokeObjectURL(u); res(Number.isFinite(d) ? d : null); };
    v.onloadedmetadata = () => {
      if (v.duration === Infinity) { v.currentTime = 1e7; v.ontimeupdate = () => { v.ontimeupdate = null; fim(v.duration); }; } // WebM sem duração no cabeçalho
      else fim(v.duration);
    };
    v.onerror = () => fim(null); v.src = u; setTimeout(() => fim(null), 8000);
  });
}

export function abrirEnvio(slug, { tipo, aoConcluir } = {}) {
  const m = document.createElement("div");
  m.className = "vd-envio-fundo"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
  m.innerHTML = `<form class="vd-envio">
    <h3>${t("vd.novo")}</h3>
    <div class="vd-modos" role="tablist">
      <button type="button" role="tab" data-modo="upload" aria-selected="true">⬆ ${t("vd.arquivo")}</button>
      <button type="button" role="tab" data-modo="gravacao">● ${t("vd.gravar")}</button>
      <button type="button" role="tab" data-modo="link">🔗 ${t("vd.link")}</button>
    </div>
    <div class="vd-modo" data-modo="upload"><label class="vd-arquivo"><input type="file" accept="video/mp4,video/quicktime,video/webm" name="arq"><span>${t("vd.escolher")}</span></label></div>
    <div class="vd-modo" data-modo="gravacao" hidden>
      <div class="vd-camera"><video muted playsinline></video><span class="vd-cron"></span></div>
      <div class="vd-gravar-bts"><button type="button" class="vd-cam">${t("vd.ligarCamera")}</button><button type="button" class="vd-rec" disabled>● ${t("vd.iniciar")}</button><button type="button" class="vd-virar" hidden>⟲</button></div>
      <small>${t("vd.gravarDica", { s: CURTO_S })}</small>
    </div>
    <div class="vd-modo" data-modo="link" hidden><input name="url" type="url" inputmode="url" placeholder="https://youtube.com/…  ·  instagram.com/reel/…  ·  tiktok.com/…"><small>${t("vd.linkDica")}</small></div>
    <div class="vd-previa" hidden></div>
    <fieldset class="vd-tipos"><legend>${t("vd.tipo")}</legend>
      <label><input type="radio" name="tipo" value="reel" checked> ${t("vd.reel")}</label>
      <label><input type="radio" name="tipo" value="story"> ${t("vd.story")}</label>
      <label><input type="radio" name="tipo" value="tutorial"> ${t("vd.tutorial")}</label>
      <label><input type="radio" name="tipo" value="live"> ${t("vd.live")}</label>
    </fieldset>
    <p class="vd-regra">${t("vd.regra", { s: CURTO_S })}</p>
    <input name="legenda" maxlength="300" placeholder="${h(t("vd.legenda"))}">
    <label class="vd-aceite"><input type="checkbox" name="aceite" required> ${t("vd.aceite")}</label>
    <div class="vd-prog" hidden><b></b></div>
    <p class="vd-erro" role="alert"></p>
    <div class="vd-acoes"><button type="button" class="vd-cancelar">${t("vd.cancelar")}</button><button class="vd-enviar">${t("vd.publicar")}</button></div>
  </form>`;
  document.body.appendChild(m);
  const f = m.querySelector("form"), erro = f.querySelector(".vd-erro"), previa = f.querySelector(".vd-previa");
  if (tipo) f.querySelector(`input[name=tipo][value=${tipo}]`).checked = true;
  let modo = "upload", arquivo = null, duracao = null, stream = null, gravador = null, frente = false, cronT = 0;
  const pararCamera = () => { stream?.getTracks().forEach(tr => tr.stop()); stream = null; };
  const fechar = () => { pararCamera(); clearInterval(cronT); m.remove(); };
  m.addEventListener("click", e => { if (e.target === m) fechar(); });
  f.querySelector(".vd-cancelar").onclick = fechar;
  document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { fechar(); document.removeEventListener("keydown", esc); } });

  function tipoEscolhido() { return f.querySelector("input[name=tipo]:checked").value; }
  function ajustarTipoPorDuracao() {
    const longo = duracao != null && duracao > CURTO_S;
    f.querySelectorAll("input[name=tipo]").forEach(r => { if (r.value === "reel" || r.value === "story") r.disabled = longo; });
    if (longo && (tipoEscolhido() === "reel" || tipoEscolhido() === "story")) f.querySelector("input[name=tipo][value=tutorial]").checked = true;
    f.querySelector(".vd-regra").classList.toggle("vd-destaque", longo);
  }
  function mostrarPrevia(blob, dur) {
    arquivo = blob; duracao = dur;
    const u = URL.createObjectURL(blob);
    previa.hidden = false;
    previa.innerHTML = `<video src="${u}" controls playsinline></video><small>${fmtDur(dur)} · ${(blob.size / 1048576).toFixed(1)} MB</small>`;
    ajustarTipoPorDuracao();
    if (dur != null && dur > MAX_UPLOAD_S) erro.textContent = t("vd.muitoLongo");
  }

  f.querySelectorAll("[role=tab]").forEach(b => b.addEventListener("click", () => {
    modo = b.dataset.modo; erro.textContent = "";
    f.querySelectorAll("[role=tab]").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    f.querySelectorAll(".vd-modo").forEach(x => { x.hidden = x.dataset.modo !== modo; });
    previa.hidden = modo === "link" || !arquivo;
    if (modo !== "gravacao") pararCamera();
    f.querySelectorAll("input[name=tipo]").forEach(r => { r.disabled = false; });
    if (modo !== "link") ajustarTipoPorDuracao();
  }));

  f.arq.addEventListener("change", async () => {
    erro.textContent = ""; const file = f.arq.files[0]; if (!file) return;
    if (file.size > 100 * 1048576) { erro.textContent = t("vd.grande"); return; }
    mostrarPrevia(file, await duracaoArquivo(file));
  });

  // Gravação: até 90 s, câmera traseira por padrão (o prato), com áudio.
  const camVideo = f.querySelector(".vd-camera video"), cron = f.querySelector(".vd-cron");
  async function ligarCamera() {
    pararCamera(); erro.textContent = "";
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: frente ? "user" : "environment", width: { ideal: 720 }, height: { ideal: 1280 } }, audio: true });
      camVideo.srcObject = stream; await camVideo.play();
      f.querySelector(".vd-rec").disabled = false; f.querySelector(".vd-virar").hidden = false;
    } catch { erro.textContent = t("vd.semCamera"); }
  }
  f.querySelector(".vd-cam").onclick = ligarCamera;
  f.querySelector(".vd-virar").onclick = () => { frente = !frente; ligarCamera(); };
  f.querySelector(".vd-rec").onclick = () => {
    const bt = f.querySelector(".vd-rec");
    if (gravador?.state === "recording") { gravador.stop(); return; }
    if (!stream || typeof MediaRecorder === "undefined") { erro.textContent = t("vd.semGravador"); return; }
    const tipos = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const mime = tipos.find(x => MediaRecorder.isTypeSupported(x)) || "";
    const partes = []; const ini = Date.now();
    gravador = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 2_500_000 });
    gravador.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
    gravador.onstop = () => {
      clearInterval(cronT); bt.textContent = "● " + t("vd.regravar"); cron.textContent = "";
      const dur = Math.round((Date.now() - ini) / 100) / 10;
      mostrarPrevia(new Blob(partes, { type: (mime || "video/webm").split(";")[0] }), dur);
    };
    gravador.start(1000); bt.textContent = "■ " + t("vd.parar");
    cronT = setInterval(() => {
      const s = Math.floor((Date.now() - ini) / 1000); cron.textContent = `● ${s}s / ${CURTO_S}s`;
      if (s >= CURTO_S) gravador.stop();
    }, 250);
  };

  f.addEventListener("submit", async e => {
    e.preventDefault(); erro.textContent = "";
    if (!f.aceite.checked) { erro.textContent = t("vd.aceiteFalta"); return; }
    const bt = f.querySelector(".vd-enviar"); bt.disabled = true;
    const prog = f.querySelector(".vd-prog"), barra = prog.querySelector("b");
    try {
      const base = { slug, tipo: tipoEscolhido(), legenda: f.legenda.value, aceite: true };
      if (modo === "link") {
        if (!f.url.value.trim()) throw new Error(t("vd.linkFalta"));
        await api("/os-api/videos", { metodo: "POST", corpo: { ...base, origem: "link", url: f.url.value.trim() } });
      } else {
        if (!arquivo) throw new Error(t("vd.arquivoFalta"));
        if (duracao != null && duracao > MAX_UPLOAD_S) throw new Error(t("vd.muitoLongo"));
        const ini = await api("/os-api/videos", { metodo: "POST", corpo: { ...base, origem: modo, tamanho: arquivo.size, duracao } });
        prog.hidden = false;
        for (let n = 0, pos = 0; pos < arquivo.size; n++, pos += ini.parte) {
          const pedaco = arquivo.slice(pos, pos + ini.parte);
          let tentativa = 0;
          for (;;) {
            const r = await fetch(url(`/os-api/videos/${ini.id}/parte?n=${n}`), { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/octet-stream", "X-Gusto-Upload": "1" }, body: pedaco });
            if (r.ok) break;
            const j = await r.json().catch(() => ({}));
            if (r.status >= 500 && tentativa++ < 3) { await new Promise(s => setTimeout(s, 1500 * tentativa)); continue; }
            throw new Error(j.error || `Erro ${r.status}`);
          }
          barra.style.width = `${Math.min(100, ((pos + pedaco.size) / arquivo.size) * 100)}%`;
        }
        const fim = await api(`/os-api/videos/${ini.id}/concluir`, { metodo: "POST", corpo: {} });
        fechar(); aoConcluir?.(fim.reclassificado ? t("vd.reclassificado") : t("vd.publicado"));
        return;
      }
      fechar(); aoConcluir?.(t("vd.publicado"));
    } catch (err) { erro.textContent = err.message; prog.hidden = true; }
    finally { bt.disabled = false; }
  });
}

on("sessao:mudou", () => { document.querySelectorAll(".vd-envio-fundo").forEach(x => { if (!logado()) x.remove(); }); });

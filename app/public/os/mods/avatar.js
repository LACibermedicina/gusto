// GUSTO · Avatar 3D gamificado (Three.js): mascote móvel, silenciável, ligado aos dados do usuário · by m3d.pro
// LGPD: só responde com dados do próprio usuário; IA externa apenas com consentimento "ai_processing".
import { api, h, url, pref, on } from "../api.js";
import { t, aplicarEstatico, idiomaAtual } from "../i18n.js";
import { sessao } from "../sessao.js";

let raiz = null, cena = null, mudo = pref.get("avatarMudo", false), xp = 0, nivel = 1;
const LOCALES = { pt: "pt-BR", en: "en-GB", es: "es-ES", zh: "zh-CN", hi: "hi-IN" };

export const avatarVisivel = () => !!raiz && !raiz.hidden;

export function alternarAvatar(ctx) {
  if (!raiz) return criar(ctx);
  raiz.hidden = !raiz.hidden;
  pref.set("avatarOculto", raiz.hidden);
  if (!raiz.hidden) falar(t("av.ola"));
}

export function iniciarAvatar(ctx) { if (!pref.get("avatarOculto", false)) criar(ctx); }

function bip(freq = 660) {
  if (mudo) return;
  try {
    const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain();
    o.type = "sine"; o.frequency.value = freq; g.gain.setValueAtTime(.08, a.currentTime); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + .18);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + .2); setTimeout(() => a.close(), 400);
  } catch { /* sem áudio */ }
}

function falar(texto, { voz = true } = {}) {
  const b = raiz?.querySelector(".os-av-balao p"); if (!b) return;
  b.textContent = texto;
  raiz.querySelector(".os-av-balao").hidden = false;
  cena?.pular();
  if (voz && !mudo && "speechSynthesis" in window && texto.length < 400) {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(texto); u.lang = LOCALES[idiomaAtual()] || "pt-BR"; u.rate = 1.05; u.pitch = 1.3;
    speechSynthesis.speak(u);
  }
}

function atualizarNivel() {
  const n = raiz?.querySelector(".os-av-nivel"); if (!n) return;
  n.textContent = t("av.nivel", { n: nivel });
  n.style.setProperty("--p", `${Math.round(((Math.sqrt(xp / 10) % 1) * 100))}%`);
}

async function criar({ abrirConta }) {
  raiz = document.createElement("div");
  raiz.id = "os-avatar"; raiz.className = "os-chrome";
  const pos = pref.get("avatarPos", null);
  if (pos) Object.assign(raiz.style, { left: pos.x + "px", top: pos.y + "px", right: "auto", bottom: "auto" });
  raiz.innerHTML = `
    <div class="os-av-balao" hidden><p></p>
      <form><input maxlength="500" data-t-ph="av.pergunte" aria-label="${h(t("av.pergunte"))}"><button class="os-btn os-btn-p" aria-label="OK">➤</button></form></div>
    <div class="os-av-palco"><canvas id="os-avatar-canvas" width="180" height="190" aria-hidden="true"></canvas><div class="os-av-2d" hidden>🧑‍🍳</div></div>
    <div class="os-av-ctrl"><span class="os-av-nivel os-notr"></span>
      <button class="os-av-som" data-t-title="${mudo ? "av.som" : "av.mudo"}">${mudo ? "🔇" : "🔊"}</button>
      <button class="os-av-x" data-t-title="av.esconder">✕</button></div>`;
  document.body.appendChild(raiz);
  aplicarEstatico(raiz);

  // Arrastar o mascote pela tela.
  const palco = raiz.querySelector(".os-av-palco");
  let arr = null, moveu = false;
  palco.addEventListener("pointerdown", e => { arr = { x: e.clientX, y: e.clientY, r: raiz.getBoundingClientRect() }; moveu = false; palco.setPointerCapture(e.pointerId); });
  palco.addEventListener("pointermove", e => {
    cena?.olhar(e.clientX, e.clientY);
    if (!arr) return;
    const dx = e.clientX - arr.x, dy = e.clientY - arr.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) moveu = true;
    if (!moveu) return;
    const x = Math.max(0, Math.min(innerWidth - arr.r.width, arr.r.left + dx)), y = Math.max(40, Math.min(innerHeight - arr.r.height, arr.r.top + dy));
    Object.assign(raiz.style, { left: x + "px", top: y + "px", right: "auto", bottom: "auto" });
  });
  palco.addEventListener("pointerup", () => {
    if (arr && moveu) { const r = raiz.getBoundingClientRect(); pref.set("avatarPos", { x: Math.round(r.left), y: Math.round(r.top) }); }
    else if (arr) { const b = raiz.querySelector(".os-av-balao"); b.hidden = !b.hidden; if (!b.hidden) { falar(sessao.usuario ? t("av.ola") : t("conta.precisa"), { voz: false }); bip(880); } }
    arr = null;
  });
  addEventListener("pointermove", e => cena?.olhar(e.clientX, e.clientY), { passive: true });

  raiz.querySelector(".os-av-som").onclick = e => {
    mudo = !mudo; pref.set("avatarMudo", mudo);
    e.currentTarget.textContent = mudo ? "🔇" : "🔊"; e.currentTarget.dataset.tTitle = mudo ? "av.som" : "av.mudo"; aplicarEstatico(raiz);
    if (mudo) speechSynthesis?.cancel();
    if (sessao.usuario) api("/os-api/avatar/estado", { metodo: "PUT", corpo: { muted: mudo } }).catch(() => {});
  };
  raiz.querySelector(".os-av-x").onclick = () => { raiz.hidden = true; pref.set("avatarOculto", true); speechSynthesis?.cancel(); };

  const f = raiz.querySelector("form");
  f.onsubmit = async e => {
    e.preventDefault();
    const i = f.querySelector("input"), p = i.value.trim(); if (!p) return;
    if (!sessao.usuario) { falar(t("conta.precisa"), { voz: false }); abrirConta(); return; }
    i.value = ""; falar(t("av.pensando"), { voz: false }); cena?.pensar(true);
    try {
      const r = await api("/os-api/avatar/perguntar", { metodo: "POST", corpo: { pergunta: p, lang: idiomaAtual() } });
      falar(r.resposta); bip(990); xp += 2; nivel = 1 + Math.floor(Math.sqrt(xp / 10)); atualizarNivel();
    } catch (err) { falar("⚠ " + err.message, { voz: false }); }
    finally { cena?.pensar(false); }
  };

  if (sessao.usuario && !sessao.usuario.trocarSenha) {
    api("/os-api/avatar/estado").then(s => { xp = s.xp; nivel = s.nivel; atualizarNivel(); }).catch(() => {});
  }
  atualizarNivel();
  on("i18n:idioma", () => { atualizarNivel(); aplicarEstatico(raiz); });

  try { cena = await montarCena(raiz.querySelector("canvas")); }
  catch (e) { console.warn("avatar 3D indisponível, usando 2D:", e.message); raiz.querySelector("canvas").hidden = true; raiz.querySelector(".os-av-2d").hidden = false; }
}

// ---------------- Cena Three.js: chef de massinha com olhos que seguem o cursor ----------------
async function montarCena(canvas) {
  const THREE = await import(url("/os/vendor/three.module.min.js"));
  const reduzir = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("rm");
  const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(180, 190, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 180 / 190, .1, 50);
  cam.position.set(0, .35, 6.2);
  sc.add(new THREE.HemisphereLight(0xfff4e6, 0x8a5a3c, 1.4));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6); sol.position.set(2.5, 4, 5); sc.add(sol);
  const contra = new THREE.DirectionalLight(0xffc9a0, .7); contra.position.set(-3, 1, -2); sc.add(contra);

  const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: 0, ...o });
  const S = (rad, m, seg = 40) => new THREE.Mesh(new THREE.SphereGeometry(rad, seg, seg), m);
  const boneco = new THREE.Group(); sc.add(boneco);

  const pele = mat(0xffb878), branco = mat(0xffffff, { roughness: .35 }), preto = mat(0x2b2118, { roughness: .2 });
  const corpo = S(1.05, mat(0xf76707)); corpo.scale.set(1, .92, .9); corpo.position.y = -.95; boneco.add(corpo);
  const avental = S(1.06, branco); avental.scale.set(.78, .7, .86); avental.position.set(0, -1.02, .12); boneco.add(avental);
  const cabeca = new THREE.Group(); cabeca.position.y = .55; boneco.add(cabeca);
  const rosto = S(1.0, pele); rosto.scale.set(1.08, .98, .95); cabeca.add(rosto);
  // Chapéu de chef: base + três "nuvens".
  const chapeu = new THREE.Group(); chapeu.position.y = .82; cabeca.add(chapeu);
  const faixa = new THREE.Mesh(new THREE.CylinderGeometry(.72, .78, .38, 40), branco); chapeu.add(faixa);
  [[-.38, .45, .45], [0, .62, .55], [.38, .45, .45]].forEach(([x, y, rr]) => { const n = S(rr, branco); n.position.set(x, y, 0); chapeu.add(n); });
  // Olhos (brancos + pupilas que seguem o cursor) e bochechas.
  const olhos = [];
  [-.36, .36].forEach(x => {
    const o = S(.27, branco); o.scale.set(.9, 1.1, .6); o.position.set(x, .08, .82); cabeca.add(o);
    const p = S(.14, preto); p.position.set(x, .08, 1.0); cabeca.add(p);
    const b = S(.045, branco); b.position.set(x + .05, .14, 1.12); cabeca.add(b);
    olhos.push({ o, p, b, x });
  });
  [-.62, .62].forEach(x => { const c = S(.16, mat(0xff8787, { transparent: true, opacity: .55 })); c.scale.set(1, .6, .3); c.position.set(x, -.25, .78); cabeca.add(c); });
  const boca = new THREE.Mesh(new THREE.TorusGeometry(.2, .045, 12, 30, Math.PI), mat(0x7a3b10)); boca.rotation.z = Math.PI; boca.position.set(0, -.3, .93); cabeca.add(boca);
  [-1.05, 1.05].forEach(x => { const m = S(.28, pele); m.position.set(x, -.85, .25); boneco.add(m); });

  let alvo = { x: 0, y: 0 }, pulo = 0, pensando = false, piscar = 0;
  const api_ = {
    olhar(cx, cy) { const rc = canvas.getBoundingClientRect(); alvo.x = Math.max(-1, Math.min(1, (cx - (rc.left + rc.width / 2)) / 400)); alvo.y = Math.max(-1, Math.min(1, (cy - (rc.top + rc.height / 2)) / 400)); },
    pular() { pulo = 1; }, pensar(v) { pensando = v; }
  };
  const relogio = new THREE.Clock();
  (function loop() {
    if (!canvas.isConnected) return;
    requestAnimationFrame(loop);
    if (canvas.closest("[hidden]")) return;
    const dt = Math.min(.05, relogio.getDelta()), tt = relogio.elapsedTime;
    const resp = reduzir ? 0 : Math.sin(tt * 2.2) * .05;
    pulo = Math.max(0, pulo - dt * 2.2);
    const salto = reduzir ? 0 : Math.sin(pulo * Math.PI) * .45;
    boneco.position.y = resp + salto;
    boneco.scale.set(1 + salto * .12 - resp * .2, 1 - salto * .1 + resp * .3, 1);   // squash & stretch
    cabeca.rotation.y += ((alvo.x * .5) - cabeca.rotation.y) * .08;
    cabeca.rotation.x += ((alvo.y * .3) - cabeca.rotation.x) * .08;
    cabeca.rotation.z = pensando && !reduzir ? Math.sin(tt * 6) * .12 : cabeca.rotation.z * .9;
    olhos.forEach(({ p, b, x }) => { p.position.x = x + alvo.x * .08; p.position.y = .08 - alvo.y * .07; b.position.x = p.position.x + .05; b.position.y = p.position.y + .06; });
    piscar -= dt; const fech = piscar < .12 && piscar > 0 ? .1 : 1; if (piscar < -3 - Math.random() * 3) piscar = .14;
    olhos.forEach(({ o, p }) => { o.scale.y = 1.1 * fech; p.scale.y = fech; });
    r.render(sc, cam);
  })();
  return api_;
}

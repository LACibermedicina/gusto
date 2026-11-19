// GUSTO · camada OS · gerenciador de janelas estilo macOS · by m3d.pro
// Arrastar (barra de título), redimensionar (bordas), minimizar/maximizar, foco, persistência de posição,
// fechar com duplo clique fora da janela ativa e com Esc. Em telas estreitas as janelas viram folhas.
import { pref, emit } from "./api.js";
import { t, aplicarEstatico } from "./i18n.js";
import { glifo } from "./icones.js";

const camada = () => document.getElementById("os-janelas");
const janelas = new Map();       // id -> {el, def, minimizada}
let zTopo = 9100, ativa = null;
const MIN_W = 300, MIN_H = 200;
const estreita = () => matchMedia("(max-width: 720px)").matches;

export const abertas = () => [...janelas.values()].map(j => ({ id: j.def.id, titulo: j.def.titulo, minimizada: j.minimizada }));
export const estaAberta = id => janelas.has(id);

function limitar(g) {
  const W = innerWidth, H = innerHeight;
  g.w = Math.max(MIN_W, Math.min(g.w, W - 16));
  g.h = Math.max(MIN_H, Math.min(g.h, H - 56));
  g.x = Math.max(8 - g.w + 120, Math.min(g.x, W - 120));
  g.y = Math.max(44, Math.min(g.y, H - 48));
  return g;
}
function aplicarGeo(j) {
  const g = j.geo, s = j.el.style;
  s.left = g.x + "px"; s.top = g.y + "px"; s.width = g.w + "px"; s.height = g.h + "px";
}
const salvarGeo = j => pref.set("geo:" + j.def.id, j.geo);

export function focar(id) {
  const j = janelas.get(id); if (!j) return;
  if (j.minimizada) { j.minimizada = false; j.el.hidden = false; j.el.classList.add("os-surgindo"); setTimeout(() => j.el.classList.remove("os-surgindo"), 260); }
  j.el.style.zIndex = ++zTopo;
  janelas.forEach(o => o.el.classList.toggle("os-ativa", o === j));
  ativa = id;
  emit("wm:mudou");
}

export function fechar(id) {
  const j = janelas.get(id); if (!j) return;
  try { j.def.aoFechar?.(); } catch (e) { console.error(e); }
  j.el.classList.add("os-saindo");
  setTimeout(() => j.el.remove(), 180);
  janelas.delete(id);
  if (ativa === id) {
    ativa = null;
    const topo = [...janelas.values()].filter(x => !x.minimizada).sort((a, b) => +b.el.style.zIndex - +a.el.style.zIndex)[0];
    if (topo) focar(topo.def.id);
  }
  emit("wm:mudou");
}

export function minimizar(id) {
  const j = janelas.get(id); if (!j) return;
  j.minimizada = true; j.el.hidden = true;
  if (ativa === id) ativa = null;
  emit("wm:mudou");
}

export function maximizar(id) {
  const j = janelas.get(id); if (!j || estreita()) return;
  if (j.max) { j.geo = j.max; j.max = null; j.el.classList.remove("os-max"); }
  else { j.max = { ...j.geo }; j.geo = { x: 8, y: 44, w: innerWidth - 16, h: innerHeight - 52 }; j.el.classList.add("os-max"); }
  aplicarGeo(j); salvarGeo(j);
}

/**
 * Abre (ou foca) uma janela.
 * def: { id, titulo (chave i18n), icone (nome do glifo), largura, altura, montar(corpo, api) -> void, aoFechar }
 */
export function abrir(def) {
  if (janelas.has(def.id)) { focar(def.id); return janelas.get(def.id); }
  const n = janelas.size;
  const salvo = pref.get("geo:" + def.id, null);
  const geo = limitar(salvo || {
    w: def.largura || 560, h: def.altura || 420,
    x: Math.round(innerWidth / 2 - (def.largura || 560) / 2 + n * 26 - 60),
    y: Math.round(Math.max(60, innerHeight / 2 - (def.altura || 420) / 2 + n * 22 - 30))
  });
  const el = document.createElement("div");
  el.className = "os-janela os-surgindo";
  el.setAttribute("role", "dialog");
  el.setAttribute("aria-labelledby", "os-jt-" + def.id);
  el.dataset.id = def.id;
  el.innerHTML = `
    <div class="os-barra">
      <div class="os-semaforo">
        <button class="os-sf os-sf-f" data-acao="fechar" data-t-title="jan.fechar"><span aria-hidden="true">×</span></button>
        <button class="os-sf os-sf-m" data-acao="min" data-t-title="jan.minimizar"><span aria-hidden="true">–</span></button>
        <button class="os-sf os-sf-x" data-acao="max" data-t-title="jan.maximizar"><span aria-hidden="true">+</span></button>
      </div>
      <div class="os-titulo" role="heading" aria-level="2" id="os-jt-${def.id}"><span class="os-titulo-ic">${glifo(def.icone || def.id)}</span><span data-t="${def.titulo}"></span></div>
    </div>
    <div class="os-corpo"></div>
    ${["n", "e", "s", "w", "ne", "se", "sw", "nw"].map(d => `<div class="os-borda os-b-${d}" data-dir="${d}"></div>`).join("")}`;
  camada().appendChild(el);
  const j = { el, def, geo, minimizada: false, max: null };
  janelas.set(def.id, j);
  aplicarGeo(j);
  aplicarEstatico(el);
  setTimeout(() => el.classList.remove("os-surgindo"), 260);

  el.addEventListener("pointerdown", () => focar(def.id), true);
  el.querySelector(".os-semaforo").addEventListener("click", e => {
    const a = e.target.closest("button")?.dataset.acao;
    if (a === "fechar") fechar(def.id); else if (a === "min") minimizar(def.id); else if (a === "max") maximizar(def.id);
  });
  const barra = el.querySelector(".os-barra");
  barra.addEventListener("dblclick", e => { if (!e.target.closest("button")) maximizar(def.id); });
  arrastar(barra, j, (dx, dy, g0) => { j.geo.x = g0.x + dx; j.geo.y = g0.y + dy; });
  el.querySelectorAll(".os-borda").forEach(b => {
    const d = b.dataset.dir;
    arrastar(b, j, (dx, dy, g0) => {
      if (d.includes("e")) j.geo.w = g0.w + dx;
      if (d.includes("s")) j.geo.h = g0.h + dy;
      if (d.includes("w")) { const w = Math.max(MIN_W, g0.w - dx); j.geo.x = g0.x + (g0.w - w); j.geo.w = w; }
      if (d.includes("n")) { const h = Math.max(MIN_H, g0.h - dy); j.geo.y = g0.y + (g0.h - h); j.geo.h = h; }
    });
  });

  const corpo = el.querySelector(".os-corpo");
  try { def.montar?.(corpo, { fechar: () => fechar(def.id), titulo: k => { const s = el.querySelector(".os-titulo [data-t]"); s.dataset.t = k; s.textContent = t(k); } }); }
  catch (e) { console.error(e); corpo.innerHTML = `<p class="os-erro" data-t="comum.erro"></p>`; aplicarEstatico(corpo); }
  focar(def.id);
  return j;
}

/** Remonta o conteúdo das janelas abertas (ex.: depois de login/logout). */
export function remontarTodas(exceto = []) {
  for (const j of janelas.values()) {
    if (exceto.includes(j.def.id)) continue;
    try { j.def.aoFechar?.(); } catch { /* ignora */ }
    const corpo = j.el.querySelector(".os-corpo");
    corpo.replaceChildren(); corpo.className = "os-corpo";
    try { j.def.montar?.(corpo, { fechar: () => fechar(j.def.id) }); } catch (e) { console.error(e); }
  }
}

function arrastar(alca, j, mover) {
  alca.addEventListener("pointerdown", e => {
    if (e.button !== 0 || e.target.closest("button,input,select,textarea") || estreita() || j.max) return;
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY, g0 = { ...j.geo };
    alca.setPointerCapture(e.pointerId);
    j.el.classList.add("os-movendo");
    const mv = ev => { mover(ev.clientX - x0, ev.clientY - y0, g0); limitar(j.geo); aplicarGeo(j); };
    const up = () => {
      alca.removeEventListener("pointermove", mv); alca.removeEventListener("pointerup", up); alca.removeEventListener("pointercancel", up);
      j.el.classList.remove("os-movendo"); salvarGeo(j);
    };
    alca.addEventListener("pointermove", mv); alca.addEventListener("pointerup", up); alca.addEventListener("pointercancel", up);
  });
}

/** Comportamentos globais: duplo clique fora fecha a janela ativa; Esc fecha; reajuste ao redimensionar a tela. */
export function iniciarWM() {
  document.addEventListener("dblclick", e => {
    if (!ativa) return;
    if (e.target.closest(".os-janela,.os-chrome,#nv,#pp,.os-menu-pop,.os-dica,.ig-modal,.os-modal,input,textarea,select,[contenteditable]")) return;
    fechar(ativa);
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !ativa) return;
    if (e.target.closest?.("input,textarea,select,[contenteditable]")) return; // não fecha enquanto digita
    fechar(ativa);
  });
  addEventListener("resize", () => janelas.forEach(j => { if (!j.max) { limitar(j.geo); aplicarGeo(j); } }));
}

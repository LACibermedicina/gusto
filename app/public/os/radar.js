// GUSTO · radar de fundo: receitas como pontos ao redor de você (escala logarítmica de distância) · by m3d.pro
// ◆ origem histórica do prato · ● onde está sendo feito · ○ onde está sendo consumido · tamanho = popularidade.
// A localização do visitante (opcional) fica só no navegador; o servidor só entrega dados agregados.
import { api, h, pref, on } from "./api.js";
import { t } from "./i18n.js";

const ESCALA_MAX = 20038;                 // meia volta da Terra (km)
const ANEIS = [1, 10, 100, 1000, 10000];
let raiz = null, dados = null, ref = null, abrir = null, tm = 0;

const rad = g => g * Math.PI / 180;
function distancia(a, b) {
  const dφ = rad(b.lat - a.lat), dλ = rad(b.lon - a.lon);
  const x = Math.sin(dφ / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dλ / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function rumo(a, b) {
  const φ1 = rad(a.lat), φ2 = rad(b.lat), dλ = rad(b.lon - a.lon);
  return Math.atan2(Math.sin(dλ) * Math.cos(φ2), Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ));
}
const km = d => d < 1 ? "< 1 km" : `${Math.round(d).toLocaleString("pt-BR")} km`;
// Pequeno núcleo vazio em volta de "você"; distâncias em escala logarítmica.
const NUCLEO = .06;
const raio = (d, R) => R * (NUCLEO + (1 - NUCLEO) * Math.log10(1 + Math.max(0, d)) / Math.log10(1 + ESCALA_MAX));

function desenhar() {
  if (!raiz || !dados) return;
  // Disco inclinado (elipse) ocupando a área de trabalho entre a barra de menus e a dock.
  const W = innerWidth, H = innerHeight, topo = 40, base = 100;
  const cx = W / 2, cy = topo + (H - topo - base) / 2;
  const R = Math.min(W * .46, 780), K = Math.max(.25, Math.min(.62, ((H - topo - base) / 2 - 10) / R));
  const pop = f => f.visitas + 5 * f.pedidos, maxPop = Math.max(1, ...dados.fichas.map(pop));
  const tam = f => 5 + 9 * Math.log10(1 + pop(f)) / Math.log10(1 + maxPop);
  const ocupados = [], rotulos = [];
  const posicao = (alvo, deslocAng = 0) => {
    const d = distancia(ref, alvo), θ = rumo(ref, alvo) + deslocAng, r = raio(d, R);
    let x = cx + r * Math.sin(θ), y = cy - r * K * Math.cos(θ), k = 0;
    while (ocupados.some(p => Math.hypot(p[0] - x, p[1] - y) < 12) && k < 6) { k++; x += 12; }  // pontos coincidentes lado a lado
    ocupados.push([x, y]);
    return { x, y, d };
  };
  let pontos = "", feitas = 0, consumidas = 0;
  for (const f of dados.fichas) {
    for (const p of f.consumida || []) {
      consumidas++; const q = posicao(p);
      pontos += `<g class="rd-pt rd-cons" transform="translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})" data-dica-titulo="${h(f.titulo)} — consumida aqui" data-dica-texto="${p.n} pedidos entregues nesta área (≈ 5 km) · ${km(q.d)} de você" data-grupo="radar"><circle r="${(4 + Math.min(8, p.n / 2)).toFixed(1)}"/></g>`;
    }
    for (const p of f.feita || []) {
      feitas++; const q = posicao(p);
      pontos += `<g class="rd-pt rd-feita" transform="translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})" data-dica-titulo="${h(f.titulo)} — feita aqui" data-dica-texto="${p.n} preparos nesta área (≈ 5 km) · ${km(q.d)} de você" data-grupo="radar"><circle r="${(3 + Math.min(8, p.n / 2)).toFixed(1)}"/></g>`;
    }
    if (f.origem) {
      const q = posicao(f.origem), s = tam(f);
      const texto = `${f.titulo.replace(/\s*\(.*\)$/, "")} · ${km(q.d)}`, lw = texto.length * 6.1;
      let lx = q.x + s / 2 + 6, ly = q.y + 4, n = 0;
      while (rotulos.some(b => lx < b[0] + b[2] && lx + lw > b[0] && Math.abs(ly - b[1]) < 13) && n < 8) { ly += 14; n++; }
      rotulos.push([lx, ly, lw]);
      pontos += `<g class="rd-pt rd-orig" data-slug="${h(f.slug)}" transform="translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})" tabindex="-1"
        data-dica-titulo="${h(f.titulo)}" data-dica-texto="Origem histórica: ${h(f.origem.lugar)} · ${km(q.d)} de ${h(ref.lugar)} · ${f.visitas} aberturas em 90 dias${f.pedidos ? ` · ${f.pedidos} pedidos` : ""}. Clique para abrir." data-grupo="radar">
        <rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" transform="rotate(45)"/>${n ? `<path d="M${s / 2} 0 L${(lx - q.x - 3).toFixed(1)} ${(ly - q.y - 4).toFixed(1)}" class="rd-guia"/>` : ""}<text x="${(lx - q.x).toFixed(1)}" y="${(ly - q.y).toFixed(1)}">${h(texto)}</text></g>`;
    }
  }
  const aneis = ANEIS.map(d => { const r = raio(d, R); return `<ellipse cx="${cx}" cy="${cy}" rx="${r.toFixed(1)}" ry="${(r * K).toFixed(1)}"/><text x="${(cx + r + 4).toFixed(1)}" y="${cy + 3}">${d.toLocaleString("pt-BR")} km</text>`; }).join("");
  const rOut = raio(ESCALA_MAX, R) * .98;
  raiz.querySelector(".rd-svg").innerHTML = `
    <g class="rd-aneis">${aneis}<line x1="${cx - rOut}" y1="${cy}" x2="${cx + rOut}" y2="${cy}"/><line x1="${cx}" y1="${cy - rOut * K}" x2="${cx}" y2="${cy + rOut * K}"/>
      <text x="${cx - 4}" y="${(cy - rOut * K - 6).toFixed(1)}" class="rd-card">N</text></g>
    <g class="rd-centro" transform="translate(${cx} ${cy})"><circle r="4"/><circle r="11" class="rd-pulso"/><text x="10" y="16">${h(t("radar.voce"))} · ${h(ref.lugar === "você" ? t("radar.voce") : ref.lugar)}</text></g>
    ${pontos}`;
  const v = raiz.querySelector(".rd-varredura");
  Object.assign(v.parentNode.style, { left: cx - R + "px", top: cy - R * K + "px", width: 2 * R + "px", height: 2 * R * K + "px" });
  Object.assign(v.style, { width: 2 * R + "px", height: 2 * R + "px", transform: "", top: (R * K - R) + "px" });
  v.parentNode.style.transform = "";
  const nota = raiz.querySelector(".rd-nota");
  nota.textContent = feitas + consumidas ? "" : t("radar.semDados");
}

function montarLegenda() {
  const lg = raiz.querySelector(".rd-legenda");
  const fechada = pref.get("radarLegendaFechada", false);
  lg.classList.toggle("rd-fechada", fechada);
  lg.innerHTML = `<button class="rd-abre" aria-label="${h(t("grupo.radar"))}" data-dica-titulo="${h(t("grupo.radar"))}" data-dica-texto="${h(t("radar.botao"))}">◎</button>
    <div class="rd-corpo"><b>${t("grupo.radar")}</b>
      <ul><li><i class="rd-ic rd-ic-orig"></i>${t("radar.orig")}</li><li><i class="rd-ic rd-ic-feita"></i>${t("radar.feita")}</li><li><i class="rd-ic rd-ic-cons"></i>${t("radar.cons")}</li>
        <li><i class="rd-ic rd-ic-tam"></i>${t("radar.tam")}</li><li><i class="rd-ic rd-ic-anel"></i>${t("radar.aneis")}</li></ul>
      <p class="rd-ref">${t("radar.centro")}: <b>${h(ref.lugar === "você" ? t("radar.voce") : ref.lugar)}</b> · <button class="rd-loc">${t("radar.loc")}</button></p>
      <p class="rd-nota"></p><button class="rd-fecha">${t("radar.ocultar")}</button></div>`;
  lg.querySelector(".rd-abre").onclick = () => { pref.set("radarLegendaFechada", false); lg.classList.remove("rd-fechada"); };
  lg.querySelector(".rd-fecha").onclick = () => { pref.set("radarLegendaFechada", true); lg.classList.add("rd-fechada"); };
  lg.querySelector(".rd-loc").onclick = () => navigator.geolocation?.getCurrentPosition(p => {
    ref = { lugar: "você", lat: +p.coords.latitude.toFixed(2), lon: +p.coords.longitude.toFixed(2) };   // arredondada, só no navegador
    pref.set("radarRef", ref); montarLegenda(); desenhar();
  }, () => {}, { maximumAge: 3600e3, timeout: 8000 });
  desenhar();
}

/** Mostra/oculta o radar (só para quem fez login; começa oculto). */
export async function mostrarRadar(sim, abrirFicha) {
  if (!raiz && sim) await iniciarRadar(abrirFicha);
  if (raiz) raiz.hidden = !sim;
  if (sim) { try { dados = await api("/os-api/publico/radar"); } catch { /* mantém o anterior */ } montarLegenda(); }
}
export const radarVisivel = () => !!raiz && !raiz.hidden;

async function iniciarRadar(abrirFicha) {
  abrir = abrirFicha;
  raiz = document.createElement("div");
  raiz.id = "os-radar"; raiz.hidden = true;
  raiz.innerHTML = `<div class="rd-disco"><div class="rd-varredura"></div></div><svg class="rd-svg" width="100%" height="100%" aria-hidden="true"></svg><div class="rd-legenda" role="note"></div>`;
  document.body.prepend(raiz);
  on("i18n:idioma", () => { if (!raiz.hidden) montarLegenda(); });
  raiz.querySelector(".rd-svg").addEventListener("click", e => { const g = e.target.closest(".rd-orig"); if (g && abrir) abrir(g.dataset.slug); });
  addEventListener("resize", () => { clearTimeout(tm); tm = setTimeout(desenhar, 150); });
  try { dados = await api("/os-api/publico/radar"); } catch { dados = { referencia: { lugar: "São Paulo", lat: -23.55, lon: -46.633 }, fichas: [] }; }
  ref = pref.get("radarRef", null) || dados.referencia;
}

// GUSTO · portal público (antes do login): fichas de receitas em estilo portal de notícias · by m3d.pro
import { api, h, on } from "./api.js";
import { t } from "./i18n.js";
import { mostrarStories, ligarVideos } from "./videos.js";
import { renderFicha, ligarFicha, localizar, nivel } from "./infografico.js";
import { iconeCozinha as ic } from "./icones-cozinha.js";
import { cenaSVG } from "./cena.js";

let raiz = null, cartoes = null;

function cartao(c, grande = false) {
  c = localizar(c);
  return `<article class="pt-card${grande ? " pt-hero" : ""}" tabindex="0" role="link" data-slug="${h(c.slug)}" aria-label="${h(t("pub.ver"))} ${h(c.titulo)}">
    <div class="pt-img">${cenaSVG(c.cena, `Ilustração: ${h(c.titulo)}`)}${c.tempo ? `<span class="pt-tempo">⏱ ${h(c.tempo)}</span>` : ""}</div>
    <div class="pt-faixa"><h3>${h(c.titulo.toUpperCase())}</h3><small>| ${h(t("ig.ficha"))}</small></div>
    <div class="pt-txt"><p class="pt-cat">${h(c.categoria)}</p><p class="pt-res">${h(c.resumo)}</p>
      ${grande && c.historia ? `<p class="pt-hist"><b>${t("pub.historia")}.</b> ${h(c.historia.split(". ").slice(0, 2).join(". ").replace(/\.?$/, "."))}</p>` : ""}
      <p class="pt-meta">${c.tempo ? `⏱ ${h(c.tempo)}` : ""}${c.nivel ? ` · ${h(nivel(c.nivel))}` : ""}${c.contextoAlvo ? ` · ${h(c.contextoAlvo)}` : ""}</p>
      <p class="pt-modos"><span>📖 ${t("pub.historia")}</span><span>🧾 ${t("pub.preparo")}</span><span>⚙ ${t("pub.avancados")}</span></p>
      <span class="pt-ler">${t("pub.ver")}</span></div>
  </article>`;
}

async function abrirFicha(slug) {
  fichaAberta = slug;
  const m = document.createElement("div");
  m.className = "ig-modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
  m.innerHTML = `<div class="ig-modal-caixa"><button class="ig-fechar" aria-label="${h(t("pub.fechar"))}">×</button><p class="os-mu">${t("pub.carregando")}</p></div>`;
  document.body.appendChild(m);
  const fechar = () => { m.remove(); fichaAberta = null; removeEventListener("keydown", esc); };
  const esc = e => { if (e.key === "Escape") fechar(); };
  addEventListener("keydown", esc);
  m.addEventListener("click", e => { if (e.target === m || e.target.closest(".ig-fechar")) fechar(); });
  try {
    const d = await api(`/os-api/publico/infograficos/${encodeURIComponent(slug)}`);
    const caixa = m.querySelector(".ig-modal-caixa");
    caixa.innerHTML = `<button class="ig-fechar" aria-label="${h(t("pub.fechar"))}">×</button>${renderFicha(d)}`;
    ligarFicha(caixa);
    ligarVideos(caixa, slug);
    m.querySelector(".ig-fechar").focus();
  } catch (e) { m.querySelector(".ig-modal-caixa p").textContent = e.message; }
}

export async function mostrarPortal() {
  if (!raiz) {
    raiz = document.createElement("section");
    raiz.id = "os-portal"; raiz.setAttribute("aria-label", "Fichas técnicas públicas");
    const main = document.getElementById("v");
    (main?.parentNode || document.body).insertBefore(raiz, main ? main.nextSibling : null);
    raiz.addEventListener("click", e => { const c = e.target.closest(".pt-card"); if (c) abrirFicha(c.dataset.slug); });
    raiz.addEventListener("keydown", e => { const c = e.target.closest?.(".pt-card"); if (c && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); abrirFicha(c.dataset.slug); } });
  }
  raiz.hidden = false;
  if (cartoes) return;
  raiz.innerHTML = `<p class="os-mu pt-carregando">${t("pub.carregando")}</p>`;
  let lista;
  try { lista = await api("/os-api/publico/infograficos"); }
  catch { raiz.innerHTML = ""; return; }
  desenharCartoes(lista);
}

function desenharCartoes(lista) {
  cartoes = lista;
  if (!cartoes.length) { raiz.innerHTML = ""; return; }
  const [hero, ...resto] = cartoes.some(c => c.destaque) ? [cartoes.find(c => c.destaque), ...cartoes.filter(c => !c.destaque)] : cartoes;
  raiz.innerHTML = `<header class="pt-cabeca"><span class="pt-selo">${t("pub.selo")}</span><h2>${t("pub.titulo")}</h2>
      <p>${t("pub.sub")}</p></header>
    <section class="pt-stories" hidden></section>
    <div class="pt-grade">${cartao(hero, true)}${resto.map(c => cartao(c)).join("")}</div>`;
  mostrarStories(raiz.querySelector(".pt-stories"));
}

// Troca de idioma: redesenha os cards e a ficha aberta.
let fichaAberta = null;
on("i18n:idioma", () => {
  if (raiz && cartoes) { const c = cartoes; cartoes = null; desenharCartoes(c); }
  const m = document.querySelector(".ig-modal"); if (m && fichaAberta) { m.remove(); abrirFicha(fichaAberta); }
});

export function esconderPortal() { if (raiz) raiz.hidden = true; document.querySelector(".ig-modal")?.remove(); }
export { abrirFicha };

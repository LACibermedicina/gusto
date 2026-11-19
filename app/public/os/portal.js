// GUSTO · portal público (antes do login): fichas de receitas em estilo portal de notícias · by m3d.pro
import { api, h } from "./api.js";
import { renderFicha, ligarFicha } from "./infografico.js";
import { iconeCozinha as ic } from "./icones-cozinha.js";

let raiz = null, cartoes = null;

function cartao(c, grande = false) {
  return `<article class="pt-card${grande ? " pt-hero" : ""}" tabindex="0" role="link" data-slug="${h(c.slug)}" aria-label="Abrir receita: ${h(c.titulo)}">
    <div class="pt-faixa"><h3>${h(c.titulo.toUpperCase())}</h3><small>| FICHA COGNITIVA DE EXECUÇÃO E TÉCNICA CLÁSSICA</small></div>
    <div class="pt-quad" aria-hidden="true">
      <span>${ic("molecula")}<i>Físico-química</i></span><span>${ic("sensorial")}<i>Praça</i></span>
      <span>${ic("panela")}<i>Fluxograma</i></span><span>${ic("estrela")}<i>Segredos</i></span>
    </div>
    <div class="pt-txt"><p class="pt-cat">${h(c.categoria)}</p><p class="pt-res">${h(c.resumo)}</p>
      ${grande && c.etapas ? `<ol class="pt-linha">${c.etapas.map((e, i) => `<li>${ic(e.icone, e.titulo)}<span>${i + 1}. ${h(e.titulo)}</span></li>`).join("")}</ol>${c.alerta ? `<p class="pt-alerta">⚠ <b>${h(c.alerta)}</b></p>` : ""}${c.sensorial ? `<div class="pt-duas"><div><p class="pt-cat">Perfil sensorial ideal</p><ul>${c.sensorial.map(x => `<li>${h(x)}</li>`).join("")}</ul></div>${c.dica ? `<div><p class="pt-cat">Segredo do chef</p><p>★ ${h(c.dica)}</p></div>` : ""}</div>` : ""}` : ""}
      <p class="pt-meta">${c.tempo ? `⏱ ${h(c.tempo)}` : ""}${c.nivel ? ` · ${h(c.nivel)}` : ""}${c.contextoAlvo ? ` · ${h(c.contextoAlvo)}` : ""}</p>
      <p class="pt-modos"><span>🧾 Ingredientes e modo de preparo</span><span>⚙ Detalhes avançados</span></p>
      <span class="pt-ler">Ver receita →</span></div>
  </article>`;
}

async function abrirFicha(slug) {
  const m = document.createElement("div");
  m.className = "ig-modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
  m.innerHTML = `<div class="ig-modal-caixa"><button class="ig-fechar" aria-label="Fechar">×</button><p class="os-mu">Carregando…</p></div>`;
  document.body.appendChild(m);
  const fechar = () => { m.remove(); removeEventListener("keydown", esc); };
  const esc = e => { if (e.key === "Escape") fechar(); };
  addEventListener("keydown", esc);
  m.addEventListener("click", e => { if (e.target === m || e.target.closest(".ig-fechar")) fechar(); });
  try {
    const d = await api(`/os-api/publico/infograficos/${encodeURIComponent(slug)}`);
    const caixa = m.querySelector(".ig-modal-caixa");
    caixa.innerHTML = `<button class="ig-fechar" aria-label="Fechar">×</button>${renderFicha(d)}`;
    ligarFicha(caixa);
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
  raiz.innerHTML = `<p class="os-mu pt-carregando">Carregando fichas…</p>`;
  try { cartoes = await api("/os-api/publico/infograficos"); }
  catch { raiz.innerHTML = ""; return; }
  if (!cartoes.length) { raiz.innerHTML = ""; return; }
  const [hero, ...resto] = cartoes.some(c => c.destaque) ? [cartoes.find(c => c.destaque), ...cartoes.filter(c => !c.destaque)] : cartoes;
  raiz.innerHTML = `<header class="pt-cabeca"><span class="pt-selo">Gusto · Escola</span><h2>Fichas técnicas da semana</h2>
      <p>Técnicas clássicas em 4 quadrantes: físico-química, praça, fluxograma e segredos do chef — com referências.</p></header>
    <div class="pt-grade">${cartao(hero, true)}${resto.map(c => cartao(c)).join("")}</div>`;
}

export function esconderPortal() { if (raiz) raiz.hidden = true; document.querySelector(".ig-modal")?.remove(); }
export { abrirFicha };

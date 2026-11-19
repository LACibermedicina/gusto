// GUSTO · renderização do infográfico gastronômico (cabeçalho + 4 quadrantes + glossário) · by m3d.pro
import { h } from "./api.js";
import { t, idiomaAtual } from "./i18n.js";
import { iconeCozinha as ic } from "./icones-cozinha.js";
import { cenaSVG } from "./cena.js";

const itens = l => l.map(x => `<li>${h(x)}</li>`).join("");

export function renderInfografico(d) {
  d = localizar(d);
  const fq = d.fisicoQuimica, pr = d.praca, fl = d.fluxo, sg = d.segredos;
  return `<article class="ig" aria-label="${h(d.titulo)}">
  <header class="ig-cab">
    <div><h2>${h(d.titulo.toUpperCase())}</h2><p>| ${h(t("ig.ficha"))}</p></div>
    <dl class="ig-meta">${d.contextoAlvo ? `<div><dt>${t("pub.contexto")}</dt><dd>${h(d.contextoAlvo)}</dd></div>` : ""}${d.tempo ? `<div><dt>${t("pub.tempo")}</dt><dd>${h(d.tempo)}</dd></div>` : ""}${d.rendimento ? `<div><dt>${t("pub.rendimento")}</dt><dd>${h(d.rendimento)}</dd></div>` : ""}${d.nivel ? `<div><dt>${t("pub.nivel")}</dt><dd>${h(d.nivel)}</dd></div>` : ""}</dl>
  </header>
  <div class="ig-grade">
    <section class="ig-q ig-q1"><h3><span>B</span> ${t("ig.b")}</h3>
      <ol class="ig-linha">${fq.etapas.map((e, i) => `<li><div class="ig-et-ic">${ic(e.icone, e.titulo)}<b>${i + 1}</b></div><div><h4>${h(e.titulo)}</h4><p>${h(e.texto)}</p></div></li>`).join("")}</ol>
      <div class="ig-alerta">${ic(fq.alerta.icone, t("ig.alerta"))}<div><h4>⚠ ${h(fq.alerta.titulo)}</h4><p>${h(fq.alerta.texto)}</p></div></div>
    </section>
    <section class="ig-q ig-q2"><h3><span>C</span> ${t("ig.c")}</h3>
      <div class="ig-topicos">
        <div class="ig-top">${ic("sensorial", "Perfil sensorial")}<div><h4>${t("ig.sensorial")}</h4><ul>${itens(pr.sensorial)}</ul></div></div>
        <div class="ig-top">${ic("balanca", "Insumos e proporções")}<div><h4>${t("ig.insumos")}</h4><ul>${itens(pr.insumos)}</ul></div></div>
        <div class="ig-top ig-top-al">${ic("alerta", "Sinais de alerta")}<div><h4>${t("ig.defeitos")}</h4><ul>${itens(pr.defeitos)}</ul></div></div>
        <div class="ig-top ig-top-ok">${ic("resgate", "Ação corretiva")}<div><h4>${t("ig.correcao")}</h4><ul>${itens(pr.correcao)}</ul></div></div>
      </div>
    </section>
    <section class="ig-q ig-q3"><h3><span>D</span> ${t("ig.d")}</h3>
      <div class="ig-fluxo">
        <div class="ig-no ig-ini">${ic("panela", "Início")}<span>${h(fl.inicio)}</span></div>
        <div class="ig-seta" aria-hidden="true"></div>
        <div class="ig-dec"><span>${h(fl.decisao)}</span></div>
        <div class="ig-ramos">
          <div class="ig-ramo ig-ramo-ok"><div class="ig-rot">✔ ${h(fl.ok.rotulo)}</div>${fl.ok.passos.map(p => `<div class="ig-seta" aria-hidden="true"></div><div class="ig-no">${h(p)}</div>`).join("")}</div>
          <div class="ig-ramo ig-ramo-dv"><div class="ig-rot">✖ ${h(fl.desvio.rotulo)}</div>${fl.desvio.passos.map(p => `<div class="ig-seta" aria-hidden="true"></div><div class="ig-no">${h(p)}</div>`).join("")}<div class="ig-volta" aria-hidden="true">${t("ig.volta")}</div></div>
        </div>
        <div class="ig-seta" aria-hidden="true"></div>
        <div class="ig-no ig-fim">${ic("prato", "Emplatamento")}<span>${h(fl.fim)}</span></div>
      </div>
    </section>
    <section class="ig-q ig-q4"><h3><span>E</span> ${t("ig.e")}</h3>
      <div class="ig-top">${ic("estrela", "Segredos do chef")}<div><h4>${t("ig.dicas")}</h4><ul>${itens(sg.dicas)}</ul></div></div>
      <div class="ig-top ig-refs">${ic("livro", "Referências")}<div><h4>${t("ig.refs")}</h4><ol>${itens(sg.referencias)}</ol></div></div>
    </section>
  </div>
  ${sg.glossario?.length ? `<footer class="ig-glos"><b>${t("ig.glossario")}:</b> ${sg.glossario.map(g => `<span><b>${h(g.termo)}</b> – ${h(g.definicao)}</span>`).join(" · ")}</footer>` : ""}
</article>`;
}

/** Card de preparo: ingredientes (mise en place) + modo de preparo + ponto de atenção. */
export function renderSimples(d) {
  const s = d.simples;
  d = localizar(d);
  return `<article class="fx-simples" aria-label="${h(d.titulo)} — receita">
  <header class="ig-cab fx-cab">
    <div><p class="fx-kicker">${h(d.categoria || "")}</p><h2>${h(d.titulo.toUpperCase())}</h2><p>${h(d.resumo || "")}</p></div>
    <dl class="ig-meta">${d.tempo ? `<div><dt>${t("pub.tempo")}</dt><dd>${h(d.tempo)}</dd></div>` : ""}${d.rendimento ? `<div><dt>${t("pub.rendimento")}</dt><dd>${h(d.rendimento)}</dd></div>` : ""}${d.nivel ? `<div><dt>${t("pub.nivel")}</dt><dd>${h(d.nivel)}</dd></div>` : ""}</dl>
  </header>
  <div class="fx-grade">
    <section class="fx-ing"><h3>${ic("balanca", t("pub.ingredientes"))}${t("pub.ingredientes")}</h3>
      <ul>${s.ingredientes.map((i, k) => `<li><label><input type="checkbox" data-k="${k}"><span class="fx-qtd">${h(i.qtd)}</span><span>${h(i.item)}</span></label></li>`).join("")}</ul>
      <p class="fx-dica">${t("pub.marque")}</p></section>
    <section class="fx-prep"><h3>${ic("panela", t("pub.preparo"))}${t("pub.preparo")}</h3>
      <ol>${s.preparo.map(p => `<li><span>${h(p)}</span></li>`).join("")}</ol>
      ${d.fisicoQuimica?.alerta ? `<div class="fx-atencao">${ic("alerta", "Atenção")}<div><b>${t("pub.atencao")}: ${h(d.fisicoQuimica.alerta.titulo)}</b><p>${h(d.fisicoQuimica.alerta.texto)}</p></div></div>` : ""}</section>
  </div>
</article>`;
}

/** Título, resumo e categoria no idioma atual (quando a ficha traz tradução). */
export function localizar(d) { const x = d.i18n?.[idiomaAtual()]; return x ? { ...d, ...Object.fromEntries(Object.entries(x).filter(([, v]) => v)) } : d; }
const NIVEIS = { "básico": "nivel.basico", "intermediário": "nivel.intermediario", "avançado": "nivel.avancado" };
export const nivel = n => (NIVEIS[String(n).toLowerCase()] ? t(NIVEIS[String(n).toLowerCase()]) : n);

const nomeCurto = i => i.item.replace(/\s*\(.*$/, "");

/** Entrada da receita: ilustração do prato pronto com os ingredientes, tempo, resumo e história. */
export function renderEntrada(d) {
  const ings = d.simples?.ingredientes || [];
  d = localizar(d);
  return `<article class="fe" aria-label="${h(d.titulo)}">
  <figure class="fe-img">${cenaSVG(d.cena, `Ilustração: ${h(d.titulo)} pronto, com os ingredientes`)}
    ${ings.length ? `<figcaption><span class="fe-leg">${t("pub.ingredientes")}</span>${ings.map(i => `<span class="fe-chip"><b>${h(i.qtd)}</b> ${h(nomeCurto(i))}</span>`).join("")}</figcaption>` : ""}</figure>
  <div class="fe-txt">
    <p class="fe-cat">${h(d.categoria || "")}</p>
    <h2>${h(d.titulo)}</h2>
    <p class="fe-badges">${d.tempo ? `<span>⏱ ${h(d.tempo)}</span>` : ""}${d.rendimento ? `<span>🍽 ${h(d.rendimento)}</span>` : ""}${d.nivel ? `<span>◆ ${h(nivel(d.nivel))}</span>` : ""}</p>
    <p class="fe-res">${h(d.resumo || "")}</p>
    ${idiomaAtual() !== "pt" ? `<p class="fe-aviso">${t("pub.conteudoPT")}</p>` : ""}
    ${d.historia ? `<section class="fe-hist">${ic("livro", "História")}<div><h3>${t("pub.historiaPrato")}</h3><p>${h(d.historia)}</p></div></section>` : ""}
    <button class="fx-alternar" type="button" aria-expanded="false">${ic("molecula", "")}<span><b>${t("pub.avancados")}</b><small>${t("pub.avancadosDesc")}</small></span><i aria-hidden="true">›</i></button>
  </div>
</article>`;
}

/** Ficha completa: começa na apresentação ilustrada; "Detalhes avançados" reúne o card de preparo e o infográfico. */
export function renderFicha(d) {
  if (!d.simples) return renderInfografico(d);
  return `<div class="fx"><div class="fx-entrada">${renderEntrada(d)}</div><div class="fx-avancado" hidden>
    <button class="fx-voltar" type="button">${t("pub.voltar")}</button>
    <p class="fx-titulo-av">${t("pub.avancados")}</p>
    ${renderSimples(d)}<div class="fx-sep"></div>${renderInfografico(d)}</div></div>`;
}

/** Liga os botões de alternância de uma ficha já inserida no DOM. */
export function ligarFicha(raiz) {
  const fx = raiz.querySelector(".fx"); if (!fx) return;
  const simples = fx.querySelector(".fx-entrada"), av = fx.querySelector(".fx-avancado"), bt = fx.querySelector(".fx-alternar");
  const mostrar = adv => {
    simples.hidden = adv; av.hidden = !adv; bt.setAttribute("aria-expanded", String(adv));
    (adv ? av : simples).scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  bt.addEventListener("click", () => mostrar(true));
  fx.querySelector(".fx-voltar").addEventListener("click", () => mostrar(false));
  fx.querySelectorAll(".fx-ing input").forEach(c => c.addEventListener("change", () => c.closest("li").classList.toggle("fx-ok", c.checked)));
}

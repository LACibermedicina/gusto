// GUSTO · renderização do infográfico gastronômico (cabeçalho + 4 quadrantes + glossário) · by m3d.pro
import { h } from "./api.js";
import { iconeCozinha as ic } from "./icones-cozinha.js";

const itens = l => l.map(x => `<li>${h(x)}</li>`).join("");

export function renderInfografico(d) {
  const fq = d.fisicoQuimica, pr = d.praca, fl = d.fluxo, sg = d.segredos;
  return `<article class="ig" aria-label="${h(d.titulo)}">
  <header class="ig-cab">
    <div><h2>${h(d.titulo.toUpperCase())}</h2><p>| ${h(d.contexto)}</p></div>
    <dl class="ig-meta">${d.contextoAlvo ? `<div><dt>Contexto</dt><dd>${h(d.contextoAlvo)}</dd></div>` : ""}${d.tempo ? `<div><dt>Tempo</dt><dd>${h(d.tempo)}</dd></div>` : ""}${d.rendimento ? `<div><dt>Rendimento</dt><dd>${h(d.rendimento)}</dd></div>` : ""}${d.nivel ? `<div><dt>Nível</dt><dd>${h(d.nivel)}</dd></div>` : ""}</dl>
  </header>
  <div class="ig-grade">
    <section class="ig-q ig-q1"><h3><span>B</span> Físico-química e transformação</h3>
      <ol class="ig-linha">${fq.etapas.map((e, i) => `<li><div class="ig-et-ic">${ic(e.icone, e.titulo)}<b>${i + 1}</b></div><div><h4>${h(e.titulo)}</h4><p>${h(e.texto)}</p></div></li>`).join("")}</ol>
      <div class="ig-alerta">${ic(fq.alerta.icone, "Alerta crítico")}<div><h4>⚠ ${h(fq.alerta.titulo)}</h4><p>${h(fq.alerta.texto)}</p></div></div>
    </section>
    <section class="ig-q ig-q2"><h3><span>C</span> Apoio cognitivo de praça</h3>
      <div class="ig-topicos">
        <div class="ig-top">${ic("sensorial", "Perfil sensorial")}<div><h4>Perfil sensorial ideal</h4><ul>${itens(pr.sensorial)}</ul></div></div>
        <div class="ig-top">${ic("balanca", "Insumos e proporções")}<div><h4>Insumos críticos e proporções</h4><ul>${itens(pr.insumos)}</ul></div></div>
        <div class="ig-top ig-top-al">${ic("alerta", "Sinais de alerta")}<div><h4>Sinais de alerta / defeitos</h4><ul>${itens(pr.defeitos)}</ul></div></div>
        <div class="ig-top ig-top-ok">${ic("resgate", "Ação corretiva")}<div><h4>Ação corretiva imediata</h4><ul>${itens(pr.correcao)}</ul></div></div>
      </div>
    </section>
    <section class="ig-q ig-q3"><h3><span>D</span> Fluxograma de execução</h3>
      <div class="ig-fluxo">
        <div class="ig-no ig-ini">${ic("panela", "Início")}<span>${h(fl.inicio)}</span></div>
        <div class="ig-seta" aria-hidden="true"></div>
        <div class="ig-dec"><span>${h(fl.decisao)}</span></div>
        <div class="ig-ramos">
          <div class="ig-ramo ig-ramo-ok"><div class="ig-rot">✔ ${h(fl.ok.rotulo)}</div>${fl.ok.passos.map(p => `<div class="ig-seta" aria-hidden="true"></div><div class="ig-no">${h(p)}</div>`).join("")}</div>
          <div class="ig-ramo ig-ramo-dv"><div class="ig-rot">✖ ${h(fl.desvio.rotulo)}</div>${fl.desvio.passos.map(p => `<div class="ig-seta" aria-hidden="true"></div><div class="ig-no">${h(p)}</div>`).join("")}<div class="ig-volta" aria-hidden="true">↺ volta à decisão</div></div>
        </div>
        <div class="ig-seta" aria-hidden="true"></div>
        <div class="ig-no ig-fim">${ic("prato", "Emplatamento")}<span>${h(fl.fim)}</span></div>
      </div>
    </section>
    <section class="ig-q ig-q4"><h3><span>E</span> Segredos do chef e referências</h3>
      <div class="ig-top">${ic("estrela", "Segredos do chef")}<div><h4>Pulos do gato</h4><ul>${itens(sg.dicas)}</ul></div></div>
      <div class="ig-top ig-refs">${ic("livro", "Referências")}<div><h4>Referências bibliográficas e técnicas</h4><ol>${itens(sg.referencias)}</ol></div></div>
    </section>
  </div>
  ${sg.glossario?.length ? `<footer class="ig-glos"><b>Glossário:</b> ${sg.glossario.map(g => `<span><b>${h(g.termo)}</b> – ${h(g.definicao)}</span>`).join(" · ")}</footer>` : ""}
</article>`;
}

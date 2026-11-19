// GUSTO · módulo Infográficos: consultar fichas e (com permissão) gerar por IA, revisar e publicar · by m3d.pro
import { api, h } from "../api.js";
import { aplicarEstatico } from "../i18n.js";
import { sessao, pode } from "../sessao.js";
import { renderInfografico } from "../infografico.js";

const CONTEXTOS = ["Praça de cozinha quente em serviço de alta demanda", "Aula prática de técnicas clássicas", "Estudo para concursos de gastronomia", "Ficha técnica operacional"];

export const infograficos = () => ({
  id: "infograficos", titulo: "app.infograficos", icone: "notas", largura: 1100, altura: 720,
  montar(corpo) {
    const gestor = !!sessao.usuario && pode("infograficos");
    let lista = [], atual = null;

    const carregarLista = async () => { lista = gestor ? await api("/os-api/infograficos") : await api("/os-api/publico/infograficos"); };
    const abrir = async slug => {
      atual = gestor ? await api(`/os-api/infograficos/${slug}`) : await api(`/os-api/publico/infograficos/${slug}`);
      desenhar();
    };

    function desenhar(msg = "") {
      corpo.innerHTML = `<div class="igm">
        <aside class="igm-lista">
          ${gestor ? `<button class="os-btn os-btn-p igm-novo">＋ Gerar com IA</button>` : ""}
          ${lista.map(c => `<button class="igm-item${atual?.slug === c.slug ? " os-sel" : ""}" data-s="${h(c.slug)}"><b>${h(c.titulo)}</b><small>${h(c.categoria)}${gestor ? (c.publicado ? " · publicado" : " · rascunho") + (c.origem === "ia" ? " · IA" : "") : ""}</small></button>`).join("")}
        </aside>
        <section class="igm-ver">${msg ? `<p class="os-erro">${h(msg)}</p>` : ""}
          ${atual === "novo" ? `<form class="os-form igm-form">
              <h3>Novo infográfico (agente Chef Executivo / ciência dos alimentos)</h3>
              <label>Prato ou técnica central<input name="prato" required maxlength="120" placeholder="Ex.: Emulsão de molho holandês"></label>
              <label>Contexto-alvo<select name="contexto">${CONTEXTOS.map(c => `<option>${h(c)}</option>`).join("")}</select></label>
              <label>Referências técnicas mandatórias<textarea name="referencias" rows="3">Escoffier — Le Guide Culinaire; Larousse Gastronomique; Institut Paul Bocuse; McGee — On Food and Cooking; ANVISA RDC 216/2004</textarea></label>
              <button class="os-btn os-btn-p">Gerar rascunho</button><p class="os-mu os-peq">O resultado entra como rascunho para revisão técnica antes de publicar.</p></form>`
            : atual ? `${gestor ? `<div class="igm-acoes">
                <button class="os-btn igm-pub">${atual.publicado ? "Despublicar" : "Publicar no portal"}</button>
                <button class="os-btn igm-dest">${atual.destaque ? "Tirar destaque" : "Destacar"}</button>
                <button class="os-btn os-btn-r igm-del">Excluir</button></div>` : ""}${renderInfografico(atual)}`
            : `<div class="os-vazio">📚<p>Escolha uma ficha.</p></div>`}
        </section></div>`;
      aplicarEstatico(corpo);
      corpo.querySelectorAll(".igm-item").forEach(b => (b.onclick = () => abrir(b.dataset.s).catch(e => desenhar(e.message))));
      corpo.querySelector(".igm-novo")?.addEventListener("click", () => { atual = "novo"; desenhar(); });
      const f = corpo.querySelector(".igm-form");
      if (f) f.onsubmit = async e => {
        e.preventDefault();
        const bt = f.querySelector("button"); bt.disabled = true; bt.textContent = "Gerando… (até 1 min)";
        try {
          const d = await api("/os-api/infograficos/gerar", { metodo: "POST", corpo: { prato: f.prato.value, contexto: f.contexto.value, referencias: f.referencias.value } });
          await carregarLista(); atual = d; desenhar();
        } catch (err) { atual = "novo"; desenhar(err.message); }
      };
      const alterar = async corpoReq => { await api(`/os-api/infograficos/${atual.slug}`, { metodo: "PUT", corpo: corpoReq }); await carregarLista(); await abrir(atual.slug); };
      corpo.querySelector(".igm-pub")?.addEventListener("click", () => alterar({ publicado: !atual.publicado }).catch(e => desenhar(e.message)));
      corpo.querySelector(".igm-dest")?.addEventListener("click", () => alterar({ destaque: !atual.destaque }).catch(e => desenhar(e.message)));
      corpo.querySelector(".igm-del")?.addEventListener("click", async () => {
        if (!confirm(`Excluir "${atual.titulo}"?`)) return;
        await api(`/os-api/infograficos/${atual.slug}`, { metodo: "DELETE" }); atual = null; await carregarLista(); desenhar();
      });
    }

    corpo.innerHTML = `<p class="os-mu">Carregando…</p>`;
    carregarLista().then(() => { if (lista[0]) return abrir(lista[0].slug); desenhar(); }).catch(e => desenhar(e.message));
  }
});

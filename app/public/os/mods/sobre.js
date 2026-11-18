// GUSTO · módulo Sobre (versão, ambiente, novidades) · by m3d.pro
import { h, VERSAO, AMBIENTE } from "../api.js";
import { aplicarEstatico } from "../i18n.js";
import { sessao } from "../sessao.js";
import { glifo } from "../icones.js";

const NOVIDADES = ["grafo", "notas", "comunidade", "assistente", "privacidade"];

export const sobre = () => ({
  id: "sobre", titulo: "app.sobre", icone: "sobre", largura: 440, altura: 470,
  montar(corpo) {
    corpo.innerHTML = `<div class="os-form os-sobre">
      <div class="os-logo">${glifo("assistente")}<div><b>Gusto OS</b><small>by m3d.pro</small></div></div>
      <dl><dt data-t="sobre.versao"></dt><dd><code>${h(VERSAO)}</code></dd>
        <dt data-t="sobre.ambiente"></dt><dd data-t="${AMBIENTE === "teste" ? "sobre.teste" : "sobre.producao"}"></dd>
        <dt data-t="sobre.ia"></dt><dd data-t="${sessao.info?.ia ? "sobre.sim" : "sobre.nao"}"></dd></dl>
      <b data-t="sobre.novidades"></b>
      <ul>${NOVIDADES.map(k => `<li><span class="os-mini">${glifo(k)}</span><b data-t="app.${k}"></b> — <span data-t="desc.${k}"></span></li>`).join("")}
        <li><span class="os-mini">🌐</span><b data-t="idioma.titulo"></b> — 中文 · Español · English · हिन्दी · Português</li></ul>
      <p class="os-mu os-peq" data-t="jan.dica"></p></div>`;
    aplicarEstatico(corpo);
  }
});

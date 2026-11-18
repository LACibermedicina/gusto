// GUSTO · módulo Privacidade (LGPD): consentimentos, portabilidade, eliminação e dados locais · by m3d.pro
import { api, h, url } from "../api.js";
import { t, aplicarEstatico, definirConsentimentoIA } from "../i18n.js";
import { sessao, recarregarSessao } from "../sessao.js";

const FINALIDADES = ["terms", "ai_processing", "chat_history", "video"];

export const privacidade = ({ abrirConta }) => ({
  id: "privacidade", titulo: "app.privacidade", icone: "privacidade", largura: 520, altura: 560,
  async montar(corpo) {
    const info = sessao.info || {};
    const lg = info.lgpd || {};
    let cons = null;
    if (sessao.usuario && !sessao.usuario.trocarSenha) cons = (await api("/os-api/lgpd/consentimentos").catch(() => null))?.consentimentos;

    corpo.innerHTML = `<div class="os-form os-priv">
      <p data-t="lgpd.intro"></p>
      <p class="os-mu os-peq">${h(t("lgpd.controlador", { c: lg.controlador || "M3D.pro" }))}<br>${lg.contato ? h(t("lgpd.contato", { c: lg.contato })) : `<span data-t="lgpd.semContato"></span>`}</p>
      ${cons ? `<fieldset>${FINALIDADES.map(f => `<label class="os-chave"><input type="checkbox" data-f="${f}" ${cons[f]?.concedido ? "checked" : ""}><span data-t="lgpd.f.${f}"></span>${cons[f]?.em ? `<small class="os-mu">${new Date(cons[f].em).toLocaleDateString()}</small>` : ""}</label>`).join("")}</fieldset>
        <a class="os-btn" href="${url("/os-api/lgpd/exportar")}" download data-t="lgpd.exportar"></a>
        <details class="os-perigo"><summary data-t="lgpd.excluir"></summary><p class="os-mu" data-t="lgpd.excluirTexto"></p>
          <form><input name="s" type="password" autocomplete="current-password" required data-t-ph="conta.senha"><input name="c" required data-t-ph="lgpd.confirme" pattern="EXCLUIR"><button class="os-btn os-btn-r" data-t="lgpd.excluir"></button><p class="os-erro" role="alert"></p></form></details>`
      : `<button class="os-btn os-btn-p os-ent" data-t="conta.entrar"></button>`}
      <hr><b data-t="lgpd.local"></b><p class="os-mu os-peq" data-t="lgpd.localTexto"></p>
      <button class="os-btn os-limpar" data-t="lgpd.limparLocal"></button>
    </div>`;
    aplicarEstatico(corpo);
    corpo.querySelector(".os-ent")?.addEventListener("click", abrirConta);
    corpo.querySelectorAll("input[data-f]").forEach(c => (c.onchange = async () => {
      try {
        await api(`/os-api/lgpd/consentimentos/${c.dataset.f}`, { metodo: "PUT", corpo: { concedido: c.checked } });
        if (c.dataset.f === "ai_processing") definirConsentimentoIA(c.checked);
      } catch (e) { c.checked = !c.checked; alert(e.message); }
    }));
    const f = corpo.querySelector(".os-perigo form");
    if (f) f.onsubmit = async e => {
      e.preventDefault();
      try { await api("/os-api/lgpd/excluir", { metodo: "POST", corpo: { senha: f.s.value, confirmar: f.c.value } }); await recarregarSessao(); }
      catch (err) { f.querySelector(".os-erro").textContent = err.message; }
    };
    corpo.querySelector(".os-limpar").onclick = () => {
      Object.keys(localStorage).filter(k => k.includes("gusto-os:")).forEach(k => localStorage.removeItem(k.replace(/^teste:/, "")));
      location.reload();
    };
  }
});

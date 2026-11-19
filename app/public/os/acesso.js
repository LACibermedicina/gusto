// GUSTO · camada OS · menu de acesso centralizado na barra superior: entrar, criar conta e Google/X/Apple/Microsoft · by m3d.pro
import { api, url, h, AMBIENTE } from "./api.js";
import { t, aplicarEstatico } from "./i18n.js";

// Marcas desenhadas de forma simplificada, só para identificar o provedor no botão de entrada.
const MARCAS = {
  google: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.6l3.1-3.1A11 11 0 0 0 2.2 7.1l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4z"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.6-2c-1.5-.2-3 .9-3.7.9-.8 0-2-.9-3.2-.9a4.8 4.8 0 0 0-4 2.5c-1.8 3-.5 7.5 1.2 10 .8 1.2 1.8 2.6 3.1 2.5 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4a10 10 0 0 0 1.4-2.8 4.3 4.3 0 0 1-2.7-4.1zM14 5.4c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.6 2.8-1.4z"/></svg>`,
  microsoft: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="9.5" height="9.5" fill="#F25022"/><rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00"/><rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF"/><rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900"/></svg>`,
  x: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.8 2.5h3.1l-6.8 7.8 8 10.6h-6.3l-4.9-6.4-5.6 6.4H2.2l7.3-8.3L1.8 2.5h6.4l4.4 5.9zm-1.1 16.5h1.7L7.4 4.2H5.6z"/></svg>`
};
const ORDEM = ["google", "apple", "microsoft", "x"];
const USUARIO_RE = /^[a-z0-9._-]{3,20}$/;

let opcoes = null;
async function carregarOpcoes() {
  if (!opcoes) opcoes = await api("/os-api/contas/opcoes").catch(() => ({ registro: false, provedores: [] }));
  return opcoes;
}

/**
 * Monta o acesso: uma pílula discreta no centro da barra ("Entrar · Criar conta") que abre um painel logo abaixo.
 * entrarComSenha(u, p) → Promise<"ok"|"erro"|"bloqueio">; aoEntrar() é chamado depois de criar conta.
 */
export function montarAcesso(alvo, { entrarComSenha, aoEntrar }) {
  alvo.innerHTML = `
    <div class="os-ac-pilula" role="group">
      <button type="button" class="os-ac-abrir" data-aba="entrar" aria-expanded="false"><span data-t="pub.entrar"></span></button>
      <span class="os-ac-sep" aria-hidden="true"></span>
      <button type="button" class="os-ac-abrir" data-aba="criar" aria-expanded="false" data-t="ac.criar"></button>
    </div>
    <div class="os-ac-painel" role="dialog" aria-modal="false" hidden>
      <div class="os-ac-abas" role="tablist">
        <button type="button" role="tab" data-aba="entrar" data-t="pub.entrar"></button>
        <button type="button" role="tab" data-aba="criar" data-t="ac.criar"></button>
      </div>
      <div class="os-ac-sociais"></div>
      <div class="os-ac-ou"><span data-t="ac.ou"></span></div>
      <form class="os-ac-form" data-form="entrar" autocomplete="on">
        <input name="u" autocomplete="username" maxlength="20" required data-t-ph="pub.usuario" autocapitalize="none" spellcheck="false">
        <input name="p" type="password" autocomplete="current-password" required data-t-ph="pub.senha">
        <button class="os-ac-enviar" data-t="pub.entrar"></button>
      </form>
      <form class="os-ac-form" data-form="criar" autocomplete="on" hidden>
        <input name="nome" autocomplete="name" maxlength="80" required data-t-ph="ac.nome">
        <div class="os-ac-campo"><input name="u" autocomplete="username" maxlength="20" required data-t-ph="ac.usuario" autocapitalize="none" spellcheck="false"><small class="os-ac-disp" aria-live="polite"></small></div>
        <input name="p" type="password" autocomplete="new-password" minlength="8" required data-t-ph="ac.senha">
        <label class="os-ac-aceite"><input type="checkbox" name="aceite" required> <span data-t="ac.aceite"></span></label>
        <details class="os-ac-lgpd"><summary data-t="ac.lgpdTitulo"></summary><p data-t="ac.lgpdTexto"></p></details>
        <button class="os-ac-enviar" data-t="ac.criarConta"></button>
      </form>
      <p class="os-ac-erro" role="alert"></p>
    </div>`;
  aplicarEstatico(alvo);
  const painel = alvo.querySelector(".os-ac-painel"), erro = alvo.querySelector(".os-ac-erro");
  const formE = alvo.querySelector('[data-form="entrar"]'), formC = alvo.querySelector('[data-form="criar"]');

  function aba(qual) {
    alvo.querySelectorAll("[role=tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.aba === qual)));
    formE.hidden = qual !== "entrar"; formC.hidden = qual !== "criar"; erro.textContent = "";
    painel.dataset.aba = qual;
    alvo.querySelectorAll(".os-ac-abrir").forEach(b => b.setAttribute("aria-expanded", String(b.dataset.aba === qual)));
    (qual === "entrar" ? formE.u : formC.nome).focus({ preventScroll: true });
  }
  async function abrir(qual) {
    const o = await carregarOpcoes();
    alvo.querySelector('.os-ac-abrir[data-aba="criar"]').hidden = !o.registro;
    alvo.querySelector('[role=tab][data-aba="criar"]').hidden = !o.registro;
    desenharSociais(o);
    painel.hidden = false;
    aba(o.registro ? qual : "entrar");
  }
  function fechar() {
    painel.hidden = true; erro.textContent = "";
    alvo.querySelectorAll(".os-ac-abrir").forEach(b => b.setAttribute("aria-expanded", "false"));
  }
  function desenharSociais(o) {
    const caixa = alvo.querySelector(".os-ac-sociais");
    // Em produção só aparecem os provedores configurados; na homologação, os demais ficam apagados com aviso.
    const lista = ORDEM.map(c => o.provedores.find(p => p.cod === c)).filter(p => p && (p.ativo || AMBIENTE === "teste"));
    caixa.hidden = !lista.length; alvo.querySelector(".os-ac-ou").hidden = !lista.length;
    caixa.innerHTML = lista.map(p => `<a class="os-ac-social${p.ativo ? "" : " os-off"}" data-prov="${p.cod}" href="${p.ativo ? url(`/os-api/oauth/${p.cod}/inicio`) : "#"}"
      data-dica-titulo="${h(p.nome)}" data-dica-texto="${h(p.ativo ? t("ac.com", { p: p.nome }) : t("ac.naoConfig"))}" aria-label="${h(t("ac.com", { p: p.nome }))}">${MARCAS[p.cod]}</a>`).join("");
    caixa.querySelectorAll(".os-off").forEach(a => a.addEventListener("click", e => { e.preventDefault(); erro.textContent = t("ac.naoConfig"); }));
  }

  alvo.querySelectorAll(".os-ac-abrir").forEach(b => b.addEventListener("click", () => {
    if (!painel.hidden && painel.dataset.aba === b.dataset.aba) fechar(); else abrir(b.dataset.aba);
  }));
  alvo.querySelectorAll("[role=tab]").forEach(b => b.addEventListener("click", () => aba(b.dataset.aba)));
  document.addEventListener("pointerdown", e => { if (!painel.hidden && !alvo.contains(e.target)) fechar(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !painel.hidden) fechar(); });

  formE.addEventListener("submit", async e => {
    e.preventDefault(); erro.textContent = "";
    const bt = formE.querySelector("button"); bt.disabled = true;
    try {
      const r = await entrarComSenha(formE.u.value.trim().toLowerCase(), formE.p.value);
      if (r === "ok") { formE.reset(); fechar(); }
      else erro.textContent = t(r === "bloqueio" ? "pub.bloqueio" : "pub.erro");
    } finally { bt.disabled = false; }
  });

  let timer = 0;
  formC.u.addEventListener("input", () => {
    const v = formC.u.value = formC.u.value.toLowerCase().replace(/\s+/g, "");
    const disp = formC.querySelector(".os-ac-disp"); clearTimeout(timer); disp.textContent = ""; disp.className = "os-ac-disp";
    if (!v) return;
    if (!USUARIO_RE.test(v)) { disp.textContent = t("ac.formato"); disp.classList.add("os-mal"); return; }
    timer = setTimeout(async () => {
      const r = await api(`/os-api/contas/disponivel?u=${encodeURIComponent(v)}`).catch(() => null);
      if (!r || formC.u.value !== v) return;
      disp.textContent = r.ok ? t("ac.livre") : t(r.motivo === "formato" ? "ac.reservado" : "ac.ocupado");
      disp.classList.add(r.ok ? "os-bem" : "os-mal");
    }, 350);
  });
  formC.addEventListener("submit", async e => {
    e.preventDefault(); erro.textContent = "";
    const bt = formC.querySelector(".os-ac-enviar"); bt.disabled = true;
    try {
      await api("/os-api/registro", { metodo: "POST", corpo: { nome: formC.nome.value, username: formC.u.value.trim().toLowerCase(), senha: formC.p.value, aceite: formC.aceite.checked } });
      formC.reset(); fechar();
      await aoEntrar?.({ novo: true });
    } catch (err) { erro.textContent = err.message || t("ac.falhou"); }
    finally { bt.disabled = false; }
  });
  return { abrir, fechar };
}

/** Mensagem após voltar de Google/X/Apple/Microsoft (?entrou= / ?oauth=). Limpa a URL. */
export function lerRetornoOAuth() {
  const p = new URLSearchParams(location.search);
  const entrou = p.get("entrou"), novo = p.get("novo") === "1", falha = p.get("oauth");
  if (!entrou && !falha) return null;
  ["entrou", "novo", "oauth"].forEach(k => p.delete(k));
  history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : "") + location.hash);
  return { entrou, novo, falha };
}

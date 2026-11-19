// GUSTO · camada OS v0.1.0-alpha · inicialização: barra superior, bandeiras, mesa com ícones, menu lateral · by m3d.pro
import { AMBIENTE, VERSAO, pref, on, h } from "./api.js";
import { IDIOMAS, BANDEIRAS, t, definirIdioma, aplicarEstatico, idiomaAtual, definirConsentimentoIA, consentimentoIAPerguntado } from "./i18n.js";
import { iniciarWM, abrir, abertas, focar, estaAberta, remontarTodas, fechar } from "./wm.js";
import { icone } from "./icones.js";
import { sessao, recarregarSessao, pode } from "./sessao.js";
import { conta } from "./mods/conta.js";
import { grafo } from "./mods/grafo.js";
import { notas } from "./mods/notas.js";
import { comunidade } from "./mods/comunidade.js";
import { privacidade } from "./mods/privacidade.js";
import { sobre } from "./mods/sobre.js";
import { iniciarAvatar, alternarAvatar } from "./mods/avatar.js";
import { instalarPonteLogin } from "./ponte.js";
import { mostrarPortal, esconderPortal } from "./portal.js";
import { infograficos } from "./mods/infograficos.js";
import { api } from "./api.js";

// Registro de módulos: id, fábrica da janela e funcionalidade exigida (RBAC por usuário no servidor).
const MODULOS = [
  { id: "grafo", fab: grafo, feat: "os_graph" },
  { id: "notas", fab: notas, feat: "notes" },
  { id: "comunidade", fab: comunidade, feat: "chat" },
  { id: "infograficos", fab: infograficos },
  { id: "assistente", feat: "avatar", acao: () => alternarAvatar(ctx) },
  { id: "privacidade", fab: privacidade },
  { id: "sobre", fab: sobre },
  { id: "conta", fab: conta }
];
const ctx = {
  abrirModulo: id => abrirModulo(id),
  abrirConta: () => abrirModulo("conta")
};

function abrirModulo(id) {
  const m = MODULOS.find(x => x.id === id); if (!m) return;
  fecharLateral();
  if (m.acao) return m.acao();
  if (estaAberta(id)) return focar(id);
  abrir(m.fab(ctx));
}

function montarChrome() {
  const raiz = document.createElement("div");
  raiz.id = "os-raiz";
  raiz.innerHTML = `
    <div id="os-janelas"></div>
    ${AMBIENTE === "teste" ? `<div class="os-selo os-chrome" data-t="selo.teste"></div>` : ""}
    <div class="os-topo os-chrome" role="navigation" aria-label="Gusto OS">
      <button class="os-menu-btn" data-t-title="menu.abrir" aria-expanded="false" aria-controls="os-lateral"><span class="os-hamb" aria-hidden="true"><i></i><i></i><i></i></span><b>Gusto OS</b></button>
      <div class="os-bandeiras" role="group" data-t-title="idioma.titulo">
        ${IDIOMAS.map(i => `<button class="os-bandeira" data-lang="${i.cod}" title="${h(i.nome)} · ${h(i.rotulo)}" aria-label="${h(i.nome)}" aria-pressed="false">${BANDEIRAS[i.cod]}</button>`).join("")}
      </div>
      <span class="os-trad" aria-live="polite"></span>
      <time class="os-relogio os-notr"></time>
    </div>
    <div class="os-mesa os-chrome" role="toolbar" aria-label="Módulos">
      ${MODULOS.map(m => `<button class="os-atalho" data-mod="${m.id}"><span class="os-atalho-ic">${icone(m.id)}</span><span class="os-atalho-nome" data-t="app.${m.id}"></span><i class="os-ponto" aria-hidden="true"></i><i class="os-cadeado" aria-hidden="true" hidden>🔒</i></button>`).join("")}
    </div>
    <div id="os-lateral" class="os-lateral os-chrome" role="complementary" aria-hidden="true">
      <div class="os-lat-cab"><b>Gusto OS</b><small class="os-notr">v${h(VERSAO)}</small><button class="os-btn os-fecha-lat" aria-label="×">×</button></div>
      <h4 data-t="menu.modulos"></h4>
      <div class="os-lat-mods">${MODULOS.map(m => `<button class="os-lat-mod" data-mod="${m.id}"><span class="os-mini-ic">${icone(m.id)}</span><span><b data-t="app.${m.id}"></b><small data-t="desc.${m.id}"></small></span><i class="os-cadeado" hidden>🔒</i></button>`).join("")}</div>
      <h4 data-t="menu.abertas"></h4><div class="os-lat-abertas"></div>
      <h4 data-t="idioma.titulo"></h4>
      <div class="os-lat-idiomas">${IDIOMAS.map(i => `<button class="os-lat-lang" data-lang="${i.cod}">${BANDEIRAS[i.cod]}<span>${h(i.nome)}</span></button>`).join("")}</div>
    </div>
    <div class="os-veu" hidden></div>`;
  document.body.appendChild(raiz);

  raiz.querySelectorAll("[data-mod]").forEach(b => b.addEventListener("click", () => abrirModulo(b.dataset.mod)));
  raiz.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => escolherIdioma(b.dataset.lang)));
  raiz.querySelector(".os-menu-btn").onclick = () => (document.body.classList.contains("os-lat-aberta") ? fecharLateral() : abrirLateral());
  raiz.querySelector(".os-fecha-lat").onclick = fecharLateral;
  raiz.querySelector(".os-veu").onclick = fecharLateral;

  // Efeito "Pixar": inclinação 3D do ícone seguindo o ponteiro.
  raiz.querySelectorAll(".os-atalho").forEach(b => {
    b.addEventListener("pointermove", e => { const r = b.getBoundingClientRect(); b.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - .5) * -22}deg`); b.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - .5) * 22}deg`); });
    b.addEventListener("pointerleave", () => { b.style.removeProperty("--rx"); b.style.removeProperty("--ry"); });
  });

  const rel = raiz.querySelector(".os-relogio");
  const tick = () => { const d = new Date(); rel.textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); rel.dateTime = d.toISOString(); };
  tick(); setInterval(tick, 15000);
}

function abrirLateral() {
  document.body.classList.add("os-lat-aberta");
  document.querySelector(".os-veu").hidden = false;
  document.getElementById("os-lateral").setAttribute("aria-hidden", "false");
  document.querySelector(".os-menu-btn").setAttribute("aria-expanded", "true");
  atualizarAbertas();
}
function fecharLateral() {
  document.body.classList.remove("os-lat-aberta");
  const v = document.querySelector(".os-veu"); if (v) v.hidden = true;
  document.getElementById("os-lateral")?.setAttribute("aria-hidden", "true");
  document.querySelector(".os-menu-btn")?.setAttribute("aria-expanded", "false");
}

function atualizarAbertas() {
  const box = document.querySelector(".os-lat-abertas"); if (!box) return;
  const l = abertas();
  box.innerHTML = l.length ? l.map(j => `<button class="os-lat-ab${j.minimizada ? " os-min" : ""}" data-id="${j.id}">• <span data-t="${j.titulo}"></span></button>`).join("") : `<p class="os-mu" data-t="menu.nenhuma"></p>`;
  box.querySelectorAll("[data-id]").forEach(b => (b.onclick = () => { focar(b.dataset.id); fecharLateral(); }));
  aplicarEstatico(box);
  document.querySelectorAll(".os-atalho").forEach(a => a.classList.toggle("os-rodando", l.some(j => j.id === a.dataset.mod)));
}

function atualizarCadeados() {
  const logado = sessao.usuario && !sessao.usuario.trocarSenha;
  document.querySelectorAll("[data-mod]").forEach(b => {
    const m = MODULOS.find(x => x.id === b.dataset.mod);
    const travado = !!(m?.feat && logado && !pode(m.feat));
    b.querySelector(".os-cadeado")?.toggleAttribute("hidden", !travado);
    b.classList.toggle("os-travado", travado);
  });
}

function marcarIdioma(cod) {
  document.querySelectorAll("[data-lang]").forEach(b => { b.classList.toggle("os-sel", b.dataset.lang === cod); b.setAttribute?.("aria-pressed", String(b.dataset.lang === cod)); });
}

function perguntarConsentimento() {
  return new Promise(resolve => {
    const m = document.createElement("div");
    m.className = "os-modal os-chrome"; m.setAttribute("role", "alertdialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = `<div class="os-modal-caixa"><h3 data-t="idioma.consent.titulo"></h3><p data-t="idioma.consent.texto"></p>
      <div class="os-linha"><button class="os-btn os-btn-p" data-r="1" data-t="idioma.consent.sim"></button><button class="os-btn" data-r="0" data-t="idioma.consent.nao"></button></div></div>`;
    aplicarEstatico(m); document.body.appendChild(m);
    m.querySelector("[data-r='1']").focus();
    m.addEventListener("click", e => { const r = e.target.closest("[data-r]")?.dataset.r; if (r === undefined) return; m.remove(); resolve(r === "1"); });
  });
}

async function escolherIdioma(cod) {
  fecharLateral();
  await definirIdioma(cod);
  marcarIdioma(cod);
  if (cod !== "pt" && !consentimentoIAPerguntado()) {
    const sim = await perguntarConsentimento();
    definirConsentimentoIA(sim);
    if (sessao.usuario && !sessao.usuario.trocarSenha) {
      import("./api.js").then(({ api }) => api("/os-api/lgpd/consentimentos/ai_processing", { metodo: "PUT", corpo: { concedido: sim } }).catch(() => {}));
    }
  }
}

function boasVindas() {
  if (pref.get("boasVindas", false)) return;
  abrir({
    id: "boas", titulo: "boas.titulo", icone: "sobre", largura: 420, altura: 330,
    montar(corpo, j) {
      corpo.innerHTML = `<div class="os-form"><ol class="os-passos"><li data-t="boas.p1"></li><li data-t="boas.p2"></li><li data-t="boas.p3"></li></ol>
        <p class="os-mu os-peq" data-t="jan.dica"></p><button class="os-btn os-btn-p" data-t="boas.ok"></button></div>`;
      aplicarEstatico(corpo);
      corpo.querySelector("button").onclick = () => { pref.set("boasVindas", true); j.fechar(); };
    },
    aoFechar() { pref.set("boasVindas", true); }
  });
}

// ---------------- Portão de login ----------------
// Antes do login nada do Gusto OS aparece: só a tela de login da base e o portal público de fichas.
// "Logado" = sessão real na API + usuário ativo na interface base (a ponte mantém os dois juntos).
const baseLogada = () => { try { return !!ME; } catch { return false; } }; // eslint-disable-line no-undef
let jaEntrou = false;
function atualizarPortao() {
  const logado = !!(sessao.usuario && baseLogada());
  document.body.classList.toggle("os-deslogado", !logado);
  if (logado) {
    esconderPortal();
    if (!jaEntrou) { jaEntrou = true; iniciarAvatar(ctx); boasVindas(); }
  } else {
    if (jaEntrou) { abertas().forEach(j => fechar(j.id)); fecharLateral(); jaEntrou = false; document.getElementById("os-avatar")?.remove(); }
    mostrarPortal();
  }
}
/** Recarregou a página com a sessão da API válida: reabre a interface base sem pedir a senha de novo. */
function restaurarBase() {
  try {
    if (!sessao.usuario || ME) return; // eslint-disable-line no-undef
    const u = S.users.find(x => x.u === sessao.usuario.username && x.on); // eslint-disable-line no-undef
    if (!u) return;
    ME = u.u; S.role = u.roles[0]; S.tab = "dash"; draw(); // eslint-disable-line no-undef
  } catch { /* base indisponível */ }
}
function envolverBase() {
  const d = window.draw, l = window.logout;
  if (typeof d === "function" && !d.__os) { window.draw = Object.assign(function (...a) { const r = d.apply(this, a); atualizarPortao(); return r; }, { __os: true }); }
  if (typeof l === "function" && !l.__os) {
    window.logout = Object.assign(function (...a) {
      api("/auth/logout", { metodo: "POST", corpo: {} }).catch(() => {}).finally(() => recarregarSessao());
      return l.apply(this, a);
    }, { __os: true });
  }
}

async function iniciar() {
  document.body.classList.add("os-deslogado");
  mostrarPortal();
  montarChrome();
  iniciarWM();
  const preferido = pref.get("idioma", "pt"); // português por padrão; a troca é sempre escolha explícita do usuário
  await definirIdioma(preferido, { salvar: false });
  marcarIdioma(preferido);
  await recarregarSessao();
  atualizarCadeados();
  // "Entrar no Gusto" (interface base) também aceita a conta do servidor.
  instalarPonteLogin(async r => { await recarregarSessao(); if (r?.must_change_password) setTimeout(() => abrirModulo("conta"), 300); });
  envolverBase();
  restaurarBase();
  atualizarPortao();

  on("wm:mudou", atualizarAbertas);
  on("i18n:idioma", () => { atualizarAbertas(); marcarIdioma(idiomaAtual()); remontarTodas(["conta"]); }); // datas/rótulos com locale do novo idioma
  on("i18n:status", s => {
    const el = document.querySelector(".os-trad");
    el.textContent = s === "traduzindo" ? t("idioma.traduzindo") : s === "semIA" ? "⚠" : "";
    el.title = s === "semIA" ? t("idioma.semIA") : "";
  });
  let ultimo = JSON.stringify(sessao.usuario);
  on("sessao:mudou", () => {
    atualizarCadeados();
    atualizarPortao();
    const agora = JSON.stringify(sessao.usuario);
    if (agora !== ultimo) { ultimo = agora; remontarTodas(["conta"]); }
  });

  document.documentElement.classList.add("os-pronto");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();

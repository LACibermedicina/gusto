// GUSTO · camada OS · inicialização · by m3d.pro
// Antes do login: só a tela de login, as bandeiras discretas e o portal de fichas.
// Depois: barra de menus no topo (grupos), dock inferior única (módulos da base + Gusto OS, agrupados),
// mesa vazia com as fichas públicas; o conteúdo da base abre numa janela "Cozinha".
import { AMBIENTE, VERSAO, pref, on, h, api } from "./api.js";
import { IDIOMAS, BANDEIRAS, t, definirIdioma, aplicarEstatico, idiomaAtual, definirConsentimentoIA, consentimentoIAPerguntado } from "./i18n.js";
import { iniciarWM, abrir, abertas, focar, estaAberta, remontarTodas, fechar } from "./wm.js";
import { glifo } from "./icones.js";
import { sessao, recarregarSessao, pode } from "./sessao.js";
import { conta } from "./mods/conta.js";
import { grafo } from "./mods/grafo.js";
import { notas } from "./mods/notas.js";
import { comunidade } from "./mods/comunidade.js";
import { privacidade } from "./mods/privacidade.js";
import { sobre } from "./mods/sobre.js";
import { infograficos } from "./mods/infograficos.js";
import { iniciarAvatar, alternarAvatar } from "./mods/avatar.js";
import { instalarPonteLogin, garantirLocal } from "./ponte.js";
import { montarAcesso, lerRetornoOAuth } from "./acesso.js";
import { mostrarPortal, esconderPortal, abrirFicha } from "./portal.js";
import { mostrarRadar, radarVisivel } from "./radar.js";
import { iniciarDicas } from "./dicas.js";

/* eslint-disable no-undef */ // S, ME, draw, gof… são globais do script da interface base
const base = {
  logada: () => { try { return !!ME; } catch { return false; } },
  adm: () => { try { return !!S.users.find(u => u.u === ME)?.adm; } catch { return false; } },
  ir: tab => { try { S.tab = tab; S.sel = 0; MP.mode = 0; sv(); draw(); } catch { /* base indisponível */ } }
};
/* eslint-enable no-undef */

// ---------------- Grupos e módulos ----------------
// Ordem = ordem na dock e na barra de menus. "base" = grupo que espelha a navegação da interface base.
const GRUPOS = [
  { id: "cozinha", base: true },
  { id: "estudo", itens: ["infograficos", "notas"] },
  { id: "comunidade", itens: ["comunidade", "assistente"] },
  { id: "admin", itens: ["grafo", "usuarios"], so: () => sessao.root || base.adm() },
  { id: "conta", itens: ["conta", "privacidade", "sobre"] }
];
const MODULOS = {
  infograficos: { fab: infograficos },
  notas: { fab: notas, feat: "notes" },
  comunidade: { fab: comunidade, feat: "chat" },
  assistente: { feat: "avatar", acao: () => alternarAvatar(ctx) },
  grafo: { fab: grafo, feat: "os_graph" },
  usuarios: { acao: () => abrirCozinha("adm"), icone: "conta" },
  conta: { fab: conta },
  privacidade: { fab: privacidade },
  sobre: { fab: sobre }
};
// Itens da navegação da base → chave da explicação (hover).
const BASE_ITENS = [
  [/S\.tab='dash'/, "inicio"], [/S\.tab='deck'/, "cartas"], [/S\.tab='ord'/, "pedidos"], [/S\.tab='cal'/, "agenda"],
  [/S\.tab='wal'/, "carteira"], [/mapmode/, "mapa"], [/pop\('more'/, "mais"], [/pop\('tray'/, "guardados"], [/pop\('nt'/, "avisos"], [/po\('/, "painel"]
];
const ABRE_JANELA = new Set(["inicio", "cartas", "pedidos", "agenda", "carteira", "painel"]);

const ctx = { abrirModulo: id => abrirModulo(id), abrirConta: () => abrirModulo("conta") };
const disponivel = id => { const m = MODULOS[id]; return !m?.feat || pode(m.feat); };

function abrirModulo(id) {
  fecharMenus();
  const m = MODULOS[id]; if (!m) return;
  if (m.feat && !pode(m.feat)) return;
  if (m.acao) return m.acao();
  if (estaAberta(id)) return focar(id);
  abrir(m.fab(ctx));
}

// ---------------- Janela "Cozinha": o conteúdo da interface base (main#v) ----------------
let lugarOriginal = null, abrirNoProximoDraw = false;
const cozinhaDef = () => ({
  id: "cozinha", titulo: "grupo.cozinha", icone: "cozinha", largura: Math.min(940, innerWidth - 40), altura: Math.min(700, innerHeight - 130),
  montar(corpo) {
    const v = document.getElementById("v"); if (!v) return;
    if (!lugarOriginal) lugarOriginal = { pai: v.parentNode, prox: v.nextSibling };
    corpo.classList.add("os-cozinha-corpo"); corpo.appendChild(v); v.classList.add("os-em-janela");
  },
  aoFechar() {
    const v = document.getElementById("v");
    if (v && lugarOriginal) { v.classList.remove("os-em-janela"); lugarOriginal.pai.insertBefore(v, lugarOriginal.prox); }
  }
});
function abrirCozinha(tab) {
  fecharMenus();
  if (tab) base.ir(tab);
  if (estaAberta("cozinha")) focar("cozinha"); else abrir(cozinhaDef());
}

// ---------------- Acesso (antes do login) ----------------
async function entrarComSenha(u, p) {
  /* eslint-disable no-undef */
  try { if (!document.getElementById("lu")) login(); } catch { /* */ }
  /* eslint-enable no-undef */
  const lu = document.getElementById("lu"), lp = document.getElementById("lp");
  if (!lu || !lp || typeof window.go_ !== "function") return "erro";
  lu.value = u; lp.value = p;
  await window.go_();
  await new Promise(r => setTimeout(r, 150));
  if (base.logada()) return "ok";
  return /aguarde|tentativas/i.test(document.getElementById("le")?.textContent || "") ? "bloqueio" : "erro";
}
/** Sessão aberta no servidor sem senha digitada (cadastro novo ou Google/X/Apple/Microsoft): entra também na base. */
async function entrouPeloServidor({ novo } = {}) {
  await recarregarSessao();
  await restaurarBase();
  atualizarPortao();
  if (novo && base.logada()) setTimeout(() => abrirModulo("conta"), 400);
}
function avisoPublico(txt) {
  const el = document.querySelector(".os-pub-aviso"); if (!el) return;
  el.textContent = txt; el.hidden = false; clearTimeout(avisoPublico.t);
  avisoPublico.t = setTimeout(() => { el.hidden = true; }, 7000);
}

// ---------------- Barra superior ----------------
function montarChrome() {
  const raiz = document.createElement("div");
  raiz.id = "os-raiz";
  raiz.innerHTML = `
    <div id="os-janelas"></div>
    ${AMBIENTE === "teste" ? `<div class="os-selo" data-t="selo.teste"></div>` : ""}
    <div class="os-topo-pub" role="banner">
      <span class="os-pub-logo"></span>
      <span class="os-pub-esp"></span>
      <div class="os-pub-acesso"></div>
      <span class="os-pub-idiomas"></span>
      <p class="os-pub-aviso" role="status" hidden></p>
    </div>
    <div class="os-idiomas" role="group" aria-label="Idioma">
      ${IDIOMAS.map(i => `<button class="os-bandeira" data-lang="${i.cod}" data-dica-titulo="${h(i.nome)}" data-dica-texto="${h(i.rotulo)}" aria-label="${h(i.nome)}" aria-pressed="false">${BANDEIRAS[i.cod]}</button>`).join("")}
      <span class="os-trad" aria-live="polite"></span>
    </div>
    <div class="os-menubar os-chrome" role="menubar" aria-label="Gusto OS">
      <button class="os-mb-logo" data-menu="gusto" aria-haspopup="true">${glifo("cozinha")}<b>Gusto</b></button>
      <div class="os-mb-grupos"></div>
      <div class="os-mb-dir"><button class="os-mb-radar" aria-pressed="false" data-dica-chave="radar.botao" data-dica-titulo="Radar">◎</button><span class="os-mb-base"></span><time class="os-relogio os-notr"></time><span class="os-mb-user os-notr"></span></div>
    </div>
    <div class="os-menu-pop os-chrome" role="menu" hidden></div>`;
  document.body.appendChild(raiz);
  // Logo da base no cabeçalho público.
  const logo = document.querySelector("body > header svg");
  raiz.querySelector(".os-pub-logo").innerHTML = (logo ? logo.outerHTML : "") + `<b>Gusto</b><small>by m3d.pro</small>`;
  // Acesso no centro da barra: entrar (login da base + ponte para a API), criar conta e provedores externos.
  montarAcesso(raiz.querySelector(".os-pub-acesso"), { entrarComSenha, aoEntrar: entrouPeloServidor });
  raiz.querySelector(".os-mb-radar").addEventListener("click", async e => {
    const b = e.currentTarget, sim = !radarVisivel();
    await mostrarRadar(sim, abrirFicha);
    b.setAttribute("aria-pressed", String(sim)); b.classList.toggle("os-on", sim);
    document.body.classList.toggle("os-radar-on", sim); pref.set("radarAtivo", sim);
  });
  // As bandeiras ficam dentro da barra depois do login (posição muda por CSS).
  raiz.querySelectorAll("[data-lang]").forEach(b => b.addEventListener("click", () => escolherIdioma(b.dataset.lang)));
  raiz.querySelector(".os-mb-logo").addEventListener("click", e => alternarMenu("gusto", e.currentTarget));
  const rel = raiz.querySelector(".os-relogio");
  const tick = () => { const d = new Date(); rel.textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); rel.dateTime = d.toISOString(); };
  tick(); setInterval(tick, 15000);
  document.addEventListener("pointerdown", e => { if (!e.target.closest(".os-menu-pop,.os-menubar")) fecharMenus(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") fecharMenus(); });
}

/** Controles da base (papel, créditos, modo detalhado, acessibilidade, sair) passam para a barra de menus. */
function moverControlesBase() {
  const alvo = document.querySelector(".os-mb-base"); if (!alvo || alvo.childElementCount) return;
  ["rs", "cr", "dm", "ax", "lo"].forEach(id => { const el = document.getElementById(id); if (el) alvo.appendChild(el); });
  const dicas = { rs: "base.papel", cr: "base.creditos", dm: "base.detalhe", ax: "base.acess", lo: "menu.sair" };
  for (const [id, k] of Object.entries(dicas)) { const el = document.getElementById(id); if (el) { el.dataset.dicaChave = k; el.removeAttribute("title"); } }
}

function itensGrupo(g) {
  if (g.base) {
    return [...document.querySelectorAll("#nv > button:not(.os-dk)")].map(b => {
      const k = baseChave(b); return k ? { tipo: "base", chave: k, nome: b.getAttribute("aria-label") || b.textContent.trim(), ic: b.querySelector("span")?.textContent || "•", el: b } : null;
    }).filter(Boolean);
  }
  return g.itens.filter(id => MODULOS[id] && disponivel(id)).map(id => ({ tipo: "os", id }));
}
const gruposVisiveis = () => GRUPOS.filter(g => !g.so || g.so());

function montarMenus() {
  const box = document.querySelector(".os-mb-grupos"); if (!box) return;
  box.innerHTML = gruposVisiveis().map(g => `<button class="os-mb-item" data-menu="${g.id}" aria-haspopup="true" data-t="grupo.${g.id}"></button>`).join("");
  box.querySelectorAll("[data-menu]").forEach(b => b.addEventListener("click", e => alternarMenu(b.dataset.menu, e.currentTarget)));
  aplicarEstatico(box);
  document.querySelector(".os-mb-user").textContent = sessao.usuario?.nome || "";
}

let menuAberto = null;
function fecharMenus() { const p = document.querySelector(".os-menu-pop"); if (p) p.hidden = true; document.querySelectorAll(".os-menubar .os-on").forEach(b => b.classList.remove("os-on")); menuAberto = null; }
function alternarMenu(id, botao) {
  if (menuAberto === id) return fecharMenus();
  fecharMenus(); menuAberto = id; botao.classList.add("os-on");
  const pop = document.querySelector(".os-menu-pop");
  let html;
  if (id === "gusto") {
    html = `<button class="os-mi" data-acao="sobre">${glifo("sobre")}<span><b data-t="app.sobre"></b><small data-t="desc.sobre"></small></span></button>
      <button class="os-mi" data-acao="privacidade">${glifo("privacidade")}<span><b data-t="app.privacidade"></b><small data-t="desc.privacidade"></small></span></button>
      <div class="os-mi-idiomas">${IDIOMAS.map(i => `<button class="os-bandeira${i.cod === idiomaAtual() ? " os-sel" : ""}" data-lang-menu="${i.cod}" aria-label="${h(i.nome)}" data-dica-titulo="${h(i.nome)}" data-dica-texto="${h(i.rotulo)}">${BANDEIRAS[i.cod]}</button>`).join("")}</div>
      <hr><button class="os-mi" data-acao="sair"><span class="os-mi-em">⎋</span><span><b data-t="menu.sair"></b><small data-t="desc.sair"></small></span></button>`;
  } else {
    const g = GRUPOS.find(x => x.id === id);
    html = `<p class="os-mi-grupo" data-t="gdesc.${id}"></p>` + itensGrupo(g).map(it => it.tipo === "base"
      ? `<button class="os-mi" data-base="${it.chave}" data-dica-chave="base.${it.chave}" data-dica-titulo="${h(it.nome)}" data-grupo="cozinha"><span class="os-mi-em">${h(it.ic)}</span><span><b>${h(it.nome)}</b><small data-t="base.${it.chave}"></small></span></button>`
      : `<button class="os-mi" data-acao="${it.id}" data-dica-chave="desc.${it.id}" data-dica-titulo="${h(t("app." + it.id))}" data-grupo="${id}">${glifo(MODULOS[it.id].icone || it.id)}<span><b data-t="app.${it.id}"></b><small data-t="desc.${it.id}"></small></span></button>`).join("");
  }
  pop.innerHTML = html; aplicarEstatico(pop);
  const r = botao.getBoundingClientRect();
  pop.style.left = Math.max(6, Math.min(innerWidth - 330, r.left)) + "px";
  pop.hidden = false;
  pop.querySelectorAll("[data-acao]").forEach(b => b.addEventListener("click", () => {
    const a = b.dataset.acao; fecharMenus();
    if (a === "sair") { try { logout(); } catch { /* */ } } else abrirModulo(a); // eslint-disable-line no-undef
  }));
  pop.querySelectorAll("[data-lang-menu]").forEach(b => b.addEventListener("click", () => escolherIdioma(b.dataset.langMenu)));
  pop.querySelectorAll("[data-base]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.base, el = itensGrupo(GRUPOS[0]).find(i => i.chave === k)?.el; fecharMenus();
    if (ABRE_JANELA.has(k)) abrirNoProximoDraw = true;
    el?.click();
  }));
}

// ---------------- Dock inferior (a navegação #nv da base + grupos do Gusto OS) ----------------
function baseChave(b) { const oc = b.getAttribute("onclick") || ""; return BASE_ITENS.find(([re]) => re.test(oc))?.[1] || null; }

function decorarDock() {
  const nv = document.getElementById("nv"); if (!nv || !base.logada()) return;
  nv.querySelectorAll(".os-dk, .os-dk-dv").forEach(e => e.remove());
  nv.querySelectorAll(":scope > button").forEach(b => {
    const k = baseChave(b); if (!k) return;
    b.dataset.grupo = "cozinha"; b.dataset.dicaChave = "base." + k; b.dataset.dicaTitulo = b.getAttribute("aria-label") || "";
    b.removeAttribute("title");
  });
  let html = "";
  for (const g of gruposVisiveis().slice(1)) {
    const itens = itensGrupo(g); if (!itens.length) continue;
    html += `<i class="dv os-dk-dv" aria-hidden="true"></i>` + itens.map(it =>
      `<button class="os-dk${estaAberta(it.id) ? " os-rodando" : ""}" data-mod="${it.id}" data-grupo="${g.id}" data-dica-chave="desc.${it.id}" aria-label="${h(t("app." + it.id))}">
        <span class="os-dk-ic" aria-hidden="true">${glifo(MODULOS[it.id].icone || it.id)}</span>${h(t("app." + it.id))}<i class="os-ponto" aria-hidden="true"></i></button>`).join("");
  }
  nv.insertAdjacentHTML("beforeend", html);
  nv.querySelectorAll(".os-dk").forEach(b => b.addEventListener("click", () => abrirModulo(b.dataset.mod)));
  const coz = nv.querySelector(`button[data-grupo="cozinha"]`);
  if (coz) coz.classList.toggle("os-rodando", estaAberta("cozinha"));
}

// Clique num item da base que mostra conteúdo → abre a janela Cozinha depois do redesenho.
document.addEventListener("click", e => {
  const b = e.target.closest?.("#nv > button:not(.os-dk), #pp .pi"); if (!b || !base.logada()) return;
  const k = b.closest("#pp") ? "painel" : baseChave(b);
  if (k && ABRE_JANELA.has(k)) abrirNoProximoDraw = true;
}, true);

// ---------------- Idiomas ----------------
function marcarIdioma(cod) {
  document.querySelectorAll("[data-lang]").forEach(b => { b.classList.toggle("os-sel", b.dataset.lang === cod); b.setAttribute("aria-pressed", String(b.dataset.lang === cod)); });
}
function perguntarConsentimento() {
  return new Promise(resolve => {
    const m = document.createElement("div");
    m.className = "os-modal"; m.setAttribute("role", "alertdialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = `<div class="os-modal-caixa"><h3 data-t="idioma.consent.titulo"></h3><p data-t="idioma.consent.texto"></p>
      <div class="os-linha"><button class="os-btn os-btn-p" data-r="1" data-t="idioma.consent.sim"></button><button class="os-btn" data-r="0" data-t="idioma.consent.nao"></button></div></div>`;
    aplicarEstatico(m); document.body.appendChild(m);
    m.querySelector("[data-r='1']").focus();
    m.addEventListener("click", e => { const r = e.target.closest("[data-r]")?.dataset.r; if (r === undefined) return; m.remove(); resolve(r === "1"); });
  });
}
async function escolherIdioma(cod) {
  fecharMenus();
  await definirIdioma(cod);
  marcarIdioma(cod);
  if (cod !== "pt" && !consentimentoIAPerguntado()) {
    const sim = await perguntarConsentimento();
    definirConsentimentoIA(sim);
    if (sessao.usuario && !sessao.usuario.trocarSenha) api("/os-api/lgpd/consentimentos/ai_processing", { metodo: "PUT", corpo: { concedido: sim } }).catch(() => {});
  }
}

function boasVindas() {
  if (pref.get("boasVindas2", false)) return;
  abrir({
    id: "boas", titulo: "boas.titulo", icone: "sobre", largura: 440, altura: 340,
    montar(corpo, j) {
      corpo.innerHTML = `<div class="os-form"><ol class="os-passos"><li data-t="boas.p1"></li><li data-t="boas.p2"></li><li data-t="boas.p3"></li></ol>
        <p class="os-mu os-peq" data-t="jan.dica"></p><button class="os-btn os-btn-p" data-t="boas.ok"></button></div>`;
      aplicarEstatico(corpo);
      corpo.querySelector("button").onclick = () => { pref.set("boasVindas2", true); j.fechar(); };
    },
    aoFechar() { pref.set("boasVindas2", true); }
  });
}

// ---------------- Portão de login ----------------
let jaEntrou = false;
function atualizarPortao() {
  const logado = !!(sessao.usuario && base.logada());
  document.body.classList.toggle("os-deslogado", !logado);
  document.body.classList.toggle("os-logado", logado);
  mostrarPortal(); // a mesa sempre mostra as fichas públicas; janelas ficam por cima
  const idiomas = document.querySelector(".os-idiomas"), dir = document.querySelector(".os-mb-dir"), pub = document.querySelector(".os-pub-idiomas");
  if (idiomas && dir && pub) { const alvo = logado ? dir : pub; if (idiomas.parentNode !== alvo) alvo.insertBefore(idiomas, alvo.firstChild); }
  if (logado) {
    moverControlesBase(); montarMenus(); decorarDock();
    if (!jaEntrou) {
      jaEntrou = true; iniciarAvatar(ctx); boasVindas();
      if (pref.get("radarAtivo", false)) document.querySelector(".os-mb-radar")?.click();
    }
  } else if (jaEntrou) {
    abertas().forEach(j => fechar(j.id)); fecharMenus(); jaEntrou = false; document.getElementById("os-avatar")?.remove();
    if (radarVisivel()) { mostrarRadar(false); document.body.classList.remove("os-radar-on"); }
  }
}
async function restaurarBase() {
  if (!sessao.usuario || sessao.usuario.trocarSenha) return;
  if (base.logada()) return;
  await garantirLocal(sessao.usuario); // conta sem usuário local (cadastro novo, outro navegador, provedor externo)
  /* eslint-disable no-undef */
  try {
    const u = S.users.find(x => x.u === sessao.usuario.username && x.on);
    if (!u) return;
    ME = u.u; S.role = u.roles[0]; S.tab = "dash"; draw();
  } catch { /* base indisponível */ }
  /* eslint-enable no-undef */
}
function envolverBase() {
  const d = window.draw, l = window.logout;
  if (typeof d === "function" && !d.__os) {
    window.draw = Object.assign(function (...a) {
      const r = d.apply(this, a);
      atualizarPortao();
      if (abrirNoProximoDraw && base.logada()) { abrirNoProximoDraw = false; abrirCozinha(); }
      return r;
    }, { __os: true });
  }
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
  iniciarDicas();
  const preferido = pref.get("idioma", "pt");
  await definirIdioma(preferido, { salvar: false });
  marcarIdioma(preferido);
  await recarregarSessao();
  instalarPonteLogin(async r => { await recarregarSessao(); if (r?.must_change_password) setTimeout(() => abrirModulo("conta"), 300); });
  envolverBase();
  await restaurarBase();
  atualizarPortao();
  const ret = lerRetornoOAuth();
  if (ret?.entrou && base.logada()) { if (ret.novo) setTimeout(() => abrirModulo("conta"), 400); }
  else if (ret?.falha || ret?.entrou) avisoPublico(t("ac.falha." + (ret.falha || "erro")) || t("ac.falhou"));

  on("wm:mudou", decorarDock);
  on("i18n:idioma", () => { marcarIdioma(idiomaAtual()); montarMenus(); decorarDock(); remontarTodas(["conta", "cozinha"]); });
  on("i18n:status", s => {
    const el = document.querySelector(".os-trad");
    el.textContent = s === "traduzindo" ? t("idioma.traduzindo") : s === "semIA" ? "⚠" : "";
    el.title = s === "semIA" ? t("idioma.semIA") : "";
  });
  let ultimo = JSON.stringify(sessao.usuario);
  on("sessao:mudou", () => {
    atualizarPortao();
    const agora = JSON.stringify(sessao.usuario);
    if (agora !== ultimo) { ultimo = agora; remontarTodas(["conta", "cozinha"]); }
  });
  document.documentElement.classList.add("os-pronto");
  void VERSAO;
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();

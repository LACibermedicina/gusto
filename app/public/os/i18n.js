// GUSTO · camada OS · idiomas: dicionário estático + tradução contextual por IA de toda a tela · by m3d.pro
import { api, url, pref, emit } from "./api.js";

// Ordem do padrão: os 5 idiomas mais falados (Mandarim, Espanhol, Inglês, Hindi, Português).
export const IDIOMAS = [
  { cod: "zh", html: "zh-CN", nome: "中文", rotulo: "Mandarim (China)" },
  { cod: "es", html: "es", nome: "Español", rotulo: "Espanhol" },
  { cod: "en", html: "en", nome: "English", rotulo: "Inglês" },
  { cod: "hi", html: "hi", nome: "हिन्दी", rotulo: "Hindi (Índia)" },
  { cod: "pt", html: "pt-BR", nome: "Português", rotulo: "Português (Brasil)" }
];

const estrela = (cx, cy, r, rot = 0) => {
  const p = [];
  for (let i = 0; i < 10; i++) {
    const a = rot + (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r * 0.382 : r;
    p.push((cx + rr * Math.cos(a)).toFixed(2) + "," + (cy + rr * Math.sin(a)).toFixed(2));
  }
  return `<polygon points="${p.join(" ")}" fill="#FFDE00"/>`;
};

// Bandeiras em SVG próprio (emoji de bandeira não aparece no Windows).
export const BANDEIRAS = {
  zh: `<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#DE2910"/>${estrela(5, 5, 3)}${estrela(10, 2, 1, .9)}${estrela(12, 4, 1, .3)}${estrela(12, 7, 1, 0)}${estrela(10, 9, 1, .9)}</svg>`,
  es: `<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#AA151B"/><rect y="5" width="30" height="10" fill="#F1BF00"/></svg>`,
  en: `<svg viewBox="0 0 60 40" aria-hidden="true"><clipPath id="osuk"><rect width="60" height="40"/></clipPath><g clip-path="url(#osuk)"><rect width="60" height="40" fill="#012169"/><path d="M0,0 60,40M60,0 0,40" stroke="#fff" stroke-width="8"/><path d="M0,0 60,40M60,0 0,40" stroke="#C8102E" stroke-width="3"/><path d="M30,0V40M0,20H60" stroke="#fff" stroke-width="12"/><path d="M30,0V40M0,20H60" stroke="#C8102E" stroke-width="7"/></g></svg>`,
  hi: `<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#fff"/><rect width="30" height="6.67" fill="#FF9933"/><rect y="13.33" width="30" height="6.67" fill="#138808"/><circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" stroke-width=".7"/><circle cx="15" cy="10" r=".6" fill="#000080"/></svg>`,
  pt: `<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#009C3B"/><polygon points="15,2.2 27.6,10 15,17.8 2.4,10" fill="#FFDF00"/><circle cx="15" cy="10" r="4.6" fill="#002776"/><path d="M10.6,9.1 Q15,7.6 19.5,10.6" stroke="#fff" stroke-width=".9" fill="none"/></svg>`
};

let dic = {}, dicPT = {}, idioma = "pt";
export const idiomaAtual = () => idioma;

export function t(chave, vars = {}) {
  const s = dic[chave] ?? dicPT[chave] ?? chave;
  return s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
}

async function carregar(cod) {
  const r = await fetch(url(`/os/i18n/${cod}.json`), { cache: "no-cache" });
  if (!r.ok) throw new Error("dicionário " + cod);
  return r.json();
}

/** Aplica o dicionário estático aos elementos marcados com data-t / data-t-ph / data-t-title. */
export function aplicarEstatico(raiz = document) {
  raiz.querySelectorAll("[data-t]").forEach(el => { el.textContent = t(el.dataset.t, el.dataset.tv ? JSON.parse(el.dataset.tv) : {}); });
  raiz.querySelectorAll("[data-t-ph]").forEach(el => { el.placeholder = t(el.dataset.tPh); });
  raiz.querySelectorAll("[data-t-title]").forEach(el => { el.title = t(el.dataset.tTitle); el.setAttribute("aria-label", el.title); });
}

// ---------------- Tradução contextual por IA de toda a tela ----------------
const ATRIBUTOS = ["placeholder", "title", "aria-label"];
const PULAR = "script,style,noscript,textarea,input,select,option,code,pre,svg,canvas,video,[contenteditable],[data-t],[data-t-ph],[data-t-title],.os-notr,#os-avatar-canvas";
const cache = new Map();            // idioma -> Map(original -> traduzido) — só em memória
const originais = new Map();        // Text node -> {orig, aplicado}
const attrOrig = new Map();         // Element -> {attr: {orig, aplicado}}
let observador = null, agendado = 0, emCurso = false;

const temLetra = s => /\p{L}/u.test(s);
const consentiuIA = () => pref.get("consentIA", false) === true;

function coletar() {
  const pend = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const v = n.nodeValue;
      if (!v || !v.trim() || !temLetra(v) || v.length > 600) return NodeFilter.FILTER_REJECT;
      const p = n.parentElement;
      if (!p || p.closest(PULAR)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nos = [];
  for (let n; (n = w.nextNode());) {
    const reg = originais.get(n);
    if (reg && n.nodeValue === reg.aplicado) continue;          // já traduzido e inalterado
    const orig = n.nodeValue;
    originais.set(n, { orig, aplicado: null });
    nos.push(n); pend.add(orig.trim());
  }
  const els = [];
  document.body.querySelectorAll(ATRIBUTOS.map(a => `[${a}]`).join(",")).forEach(el => {
    if (el.closest(".os-notr") || el.matches("[data-t-title],[data-t-ph]")) return;
    for (const a of ATRIBUTOS) {
      const v = el.getAttribute(a); if (!v || !temLetra(v)) continue;
      const reg = attrOrig.get(el)?.[a];
      if (reg && v === reg.aplicado) continue;
      attrOrig.set(el, { ...(attrOrig.get(el) || {}), [a]: { orig: v, aplicado: null } });
      els.push([el, a]); pend.add(v.trim());
    }
  });
  return { nos, els, textos: [...pend] };
}

function aplicarTraducoes({ nos, els }, mapa) {
  observador?.disconnect();
  for (const n of nos) {
    const reg = originais.get(n); if (!reg || !n.isConnected) { originais.delete(n); continue; }
    const k = reg.orig.trim(), tr = mapa.get(k);
    if (!tr) continue;
    const novo = reg.orig.replace(k, tr);
    n.nodeValue = novo; reg.aplicado = novo;
  }
  for (const [el, a] of els) {
    const reg = attrOrig.get(el)?.[a]; if (!reg) continue;
    const tr = mapa.get(reg.orig.trim()); if (!tr) continue;
    el.setAttribute(a, tr); reg.aplicado = tr;
  }
  observar();
}

async function traduzirTela() {
  if (idioma === "pt" || !consentiuIA() || emCurso) return;
  emCurso = true;
  try {
    const lote = coletar();
    const mapa = cache.get(idioma) || new Map(); cache.set(idioma, mapa);
    const faltam = lote.textos.filter(s => !mapa.has(s));
    if (faltam.length) emit("i18n:status", "traduzindo");
    for (let i = 0; i < faltam.length; i += 80) {
      const pedaco = faltam.slice(i, i + 80);
      const lang = idioma;
      const r = await api("/os-api/traduzir", { metodo: "POST", corpo: { lang, textos: pedaco }, cabecalhos: { "x-os-consent": "ai_processing" } });
      if (lang !== idioma) return;                        // usuário trocou de idioma no meio
      if (!r.ia) { emit("i18n:status", "semIA"); pedaco.forEach(s => mapa.set(s, s)); continue; }
      pedaco.forEach((s, k) => mapa.set(s, r.traducoes[k] || s));
    }
    aplicarTraducoes(lote, mapa);
    emit("i18n:status", "ok");
  } catch (e) {
    emit("i18n:status", e.status === 429 ? "limite" : "semIA");
  } finally { emCurso = false; }
}

function agendar() { clearTimeout(agendado); agendado = setTimeout(traduzirTela, 350); }
function observar() {
  if (idioma === "pt" || !consentiuIA()) return;
  observador ||= new MutationObserver(agendar);
  observador.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
}

function restaurarTela() {
  observador?.disconnect();
  for (const [n, reg] of originais) if (n.isConnected && n.nodeValue === reg.aplicado) n.nodeValue = reg.orig;
  for (const [el, m] of attrOrig) for (const [a, reg] of Object.entries(m)) if (el.isConnected && el.getAttribute(a) === reg.aplicado) el.setAttribute(a, reg.orig);
  originais.clear(); attrOrig.clear();
}

export async function definirIdioma(cod, { salvar = true } = {}) {
  const meta = IDIOMAS.find(i => i.cod === cod) || IDIOMAS[4];
  dicPT = Object.keys(dicPT).length ? dicPT : await carregar("pt");
  dic = meta.cod === "pt" ? dicPT : await carregar(meta.cod).catch(() => dicPT);
  restaurarTela();
  idioma = meta.cod;
  document.documentElement.lang = meta.html;
  document.documentElement.dataset.osLang = meta.cod;
  if (salvar) pref.set("idioma", meta.cod);
  aplicarEstatico();
  emit("i18n:idioma", meta.cod);
  if (meta.cod !== "pt" && consentiuIA()) { observar(); traduzirTela(); }
}

export function definirConsentimentoIA(sim) {
  pref.set("consentIA", !!sim);
  if (sim && idioma !== "pt") { observar(); traduzirTela(); }
  if (!sim) restaurarTela();
}

export const consentimentoIAPerguntado = () => pref.get("consentIA", null) !== null;

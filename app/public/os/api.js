// GUSTO · camada OS · cliente HTTP (cookies de sessão, JSON, base /teste/) · by m3d.pro
export const BASE = (document.querySelector('meta[name="gusto-base"]')?.content || "").replace(/\/+$/, "");
export const AMBIENTE = document.querySelector('meta[name="gusto-ambiente"]')?.content || "producao";
export const VERSAO = document.querySelector('meta[name="gusto-versao"]')?.content || "";
export const url = p => BASE + p;

export class ErroAPI extends Error { constructor(status, msg) { super(msg); this.status = status; } }

export async function api(caminho, { metodo = "GET", corpo, cabecalhos = {} } = {}) {
  const r = await fetch(url(caminho), {
    method: metodo,
    credentials: "same-origin",
    headers: { ...(corpo !== undefined ? { "Content-Type": "application/json" } : {}), ...cabecalhos },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined
  });
  const tipo = r.headers.get("content-type") || "";
  const dados = tipo.includes("json") ? await r.json().catch(() => ({})) : await r.text();
  if (!r.ok) throw new ErroAPI(r.status, (dados && dados.error) || `Erro ${r.status}`);
  return dados;
}

export const wsURL = caminho => `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}${BASE}${caminho}`;

/** Escapa texto para inserção em HTML. */
export const h = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Pequeno barramento de eventos da camada OS. */
const ouvintes = new Map();
export const on = (ev, fn) => { (ouvintes.get(ev) || ouvintes.set(ev, new Set()).get(ev)).add(fn); return () => ouvintes.get(ev).delete(fn); };
export const emit = (ev, d) => (ouvintes.get(ev) || []).forEach(fn => { try { fn(d); } catch (e) { console.error(e); } });

/** Armazenamento local de preferências da camada OS (não guarda dados pessoais). */
const PFX = "gusto-os:";
export const pref = {
  get(k, d) { try { const v = localStorage.getItem(PFX + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(PFX + k, JSON.stringify(v)); } catch { /* modo privado */ } }
};

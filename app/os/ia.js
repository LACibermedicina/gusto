// GUSTO · camada OS · IA com failsafe multi-provedor e quarentena de chaves · by m3d.pro
// Ordem configurável (IA_ORDEM). Chaves separadas por vírgula. Nada de dado pessoal identificável
// chega aqui: quem chama deve passar o texto por mascarar() (ver privacidade.js).

const env = (k, d = "") => (process.env[k] ?? d).trim();
const lista = k => env(k).split(",").map(s => s.trim()).filter(s => s && !s.includes("…") && !s.includes("..."));

const PROVEDORES = {
  gemini: {
    chaves: () => lista("IA_GEMINI_KEYS"),
    modelo: () => env("IA_GEMINI_MODELO", "gemini-2.5-flash"),
    async chamar(chave, modelo, { sistema, usuario, maxTokens, json }) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": chave },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: sistema }] },
          contents: [{ role: "user", parts: [{ text: usuario }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2, ...(json ? { responseMimeType: "application/json" } : {}) }
        }),
        signal: AbortSignal.timeout(25000)
      });
      if (!r.ok) throw Object.assign(new Error("gemini " + r.status), { status: r.status });
      const d = await r.json();
      return (d.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
    }
  },
  anthropic: {
    chaves: () => lista("IA_ANTHROPIC_KEYS").filter(k => k.startsWith("sk-ant-api")),
    modelo: () => env("IA_ANTHROPIC_MODELO", "claude-haiku-4-5"),
    async chamar(chave, modelo, { sistema, usuario, maxTokens }) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": chave, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: modelo, max_tokens: maxTokens, system: sistema, messages: [{ role: "user", content: usuario }] }),
        signal: AbortSignal.timeout(25000)
      });
      if (!r.ok) throw Object.assign(new Error("anthropic " + r.status), { status: r.status });
      const d = await r.json();
      return (d.content || []).filter(c => c.type === "text").map(c => c.text).join("");
    }
  },
  openai: {
    chaves: () => lista("IA_OPENAI_KEYS"),
    modelo: () => env("IA_OPENAI_MODELO", "gpt-4.1-mini"),
    async chamar(chave, modelo, { sistema, usuario, maxTokens, json }) {
      const r = await fetch(env("IA_OPENAI_URL", "https://api.openai.com/v1").replace(/\/+$/, "") + "/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + chave },
        body: JSON.stringify({
          model: modelo, max_tokens: maxTokens, temperature: 0.2,
          ...(json ? { response_format: { type: "json_object" } } : {}),
          messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }]
        }),
        signal: AbortSignal.timeout(25000)
      });
      if (!r.ok) throw Object.assign(new Error("openai " + r.status), { status: r.status });
      const d = await r.json();
      return d.choices?.[0]?.message?.content || "";
    }
  }
};

// chave -> instante em que sai da quarentena
const quarentena = new Map();
const QUARENTENA_MS = { 401: 6 * 3600e3, 403: 6 * 3600e3, 429: 10 * 60e3, padrao: 2 * 60e3 };

const ordem = () => env("IA_ORDEM", "gemini,anthropic,openai").split(",").map(s => s.trim()).filter(p => PROVEDORES[p]);

export function iaDisponivel() {
  return ordem().some(p => PROVEDORES[p].chaves().length > 0);
}

export function iaStatus() {
  const agora = Date.now();
  return ordem().map(p => ({
    provedor: p,
    modelo: PROVEDORES[p].modelo(),
    chaves: PROVEDORES[p].chaves().length,
    emQuarentena: PROVEDORES[p].chaves().filter(k => (quarentena.get(k) || 0) > agora).length
  }));
}

/** Gera texto tentando provedores/chaves em ordem. Lança erro 503 se todos falharem. */
export async function gerar({ sistema, usuario, maxTokens = 800, json = false }) {
  const agora = Date.now();
  const falhas = [];
  for (const nome of ordem()) {
    const p = PROVEDORES[nome];
    for (const chave of p.chaves()) {
      if ((quarentena.get(chave) || 0) > agora) continue;
      try {
        const texto = await p.chamar(chave, p.modelo(), { sistema, usuario, maxTokens, json });
        if (texto && texto.trim()) return { texto: texto.trim(), provedor: nome };
        falhas.push(nome + ": vazio");
      } catch (e) {
        quarentena.set(chave, Date.now() + (QUARENTENA_MS[e.status] || QUARENTENA_MS.padrao));
        falhas.push(e.message);
      }
    }
  }
  const err = new Error("IA indisponível no momento");
  err.s = 503; err.falhas = falhas;
  throw err;
}

/** Extrai JSON de uma resposta que pode vir cercada de ```json ... ``` */
export function extrairJSON(texto) {
  const t = String(texto).trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(t); } catch { /* tenta o maior bloco */ }
  const i = Math.min(...["[", "{"].map(c => t.indexOf(c)).filter(i => i >= 0));
  const j = Math.max(t.lastIndexOf("]"), t.lastIndexOf("}"));
  if (Number.isFinite(i) && j > i) return JSON.parse(t.slice(i, j + 1));
  throw new Error("Resposta de IA sem JSON");
}

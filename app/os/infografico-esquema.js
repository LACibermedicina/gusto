// GUSTO · esquema dos infográficos gastronômicos (ficha cognitiva em 4 quadrantes) · by m3d.pro
// Usado para validar o conteúdo semeado, o gerado por IA e o editado pelo admin.

export const ICONES = [
  "balanca", "faca", "chama", "termometro", "gota", "molecula", "colher", "alerta", "sensorial",
  "relogio", "resgate", "livro", "estrela", "panela", "prato", "forno", "gelo", "batedor"
];

const erro = msg => Object.assign(new Error(msg), { s: 400 });
const txt = (v, max, campo, obrig = true) => {
  const s = String(v ?? "").replace(/\s+/g, " ").trim();
  if (obrig && !s) throw erro(`Campo obrigatório: ${campo}`);
  return s.slice(0, max);
};
const lista = (v, min, max, maxTxt, campo) => {
  if (!Array.isArray(v)) throw erro(`Lista obrigatória: ${campo}`);
  const l = v.map(x => txt(x, maxTxt, campo, false)).filter(Boolean).slice(0, max);
  if (l.length < min) throw erro(`${campo}: mínimo de ${min} itens`);
  return l;
};
const icone = (v, padrao) => (ICONES.includes(v) ? v : padrao);

export const slugificar = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "infografico";

/** Painel simplificado: ingredientes com quantidade + modo de preparo em passos curtos. Opcional em fichas antigas. */
export function validarSimples(v, obrigatorio = false) {
  if (!v) { if (obrigatorio) throw erro("Painel simplificado obrigatório (ingredientes e modo de preparo)"); return null; }
  if (!Array.isArray(v.ingredientes)) throw erro("Painel simplificado: lista de ingredientes");
  const ingredientes = v.ingredientes.map(i => ({ qtd: txt(i?.qtd, 40, "quantidade", false), item: txt(i?.item, 120, "ingrediente", false) }))
    .filter(i => i.item).slice(0, 25);
  if (ingredientes.length < 2) throw erro("Painel simplificado: mínimo de 2 ingredientes");
  return { ingredientes, preparo: lista(v.preparo, 2, 15, 280, "modo de preparo") };
}

/** Valida e normaliza um infográfico. Lança erro 400 com a primeira falha encontrada. */
export function validarInfografico(d) {
  if (!d || typeof d !== "object") throw erro("Infográfico inválido");
  const fq = d.fisicoQuimica || {}, pr = d.praca || {}, fl = d.fluxo || {}, sg = d.segredos || {};
  if (!Array.isArray(fq.etapas) || fq.etapas.length !== 4) throw erro("Bloco B: exatamente 4 etapas (insumos → ação → reação → ponto)");
  const padraoEtapa = ["balanca", "chama", "molecula", "colher"];
  return {
    titulo: txt(d.titulo, 90, "titulo"),
    contexto: txt(d.contexto || "FICHA COGNITIVA DE EXECUÇÃO E TÉCNICA CLÁSSICA", 90, "contexto"),
    contextoAlvo: txt(d.contextoAlvo, 120, "contextoAlvo"),
    categoria: txt(d.categoria, 40, "categoria"),
    resumo: txt(d.resumo, 280, "resumo"),
    tempo: txt(d.tempo, 40, "tempo", false),
    rendimento: txt(d.rendimento, 40, "rendimento", false),
    nivel: txt(d.nivel, 30, "nivel", false),
    simples: validarSimples(d.simples),
    fisicoQuimica: {
      etapas: fq.etapas.map((e, i) => ({ titulo: txt(e.titulo, 50, `etapa ${i + 1}`), texto: txt(e.texto, 320, `etapa ${i + 1}`), icone: icone(e.icone, padraoEtapa[i]) })),
      alerta: { titulo: txt(fq.alerta?.titulo, 60, "alerta crítico"), texto: txt(fq.alerta?.texto, 360, "alerta crítico"), icone: icone(fq.alerta?.icone, "termometro") }
    },
    praca: {
      sensorial: lista(pr.sensorial, 2, 6, 200, "perfil sensorial"),
      insumos: lista(pr.insumos, 2, 8, 200, "insumos críticos"),
      defeitos: lista(pr.defeitos, 2, 6, 200, "sinais de alerta"),
      correcao: lista(pr.correcao, 2, 6, 220, "ação corretiva")
    },
    fluxo: {
      inicio: txt(fl.inicio, 120, "fluxo: início"),
      decisao: txt(fl.decisao, 140, "fluxo: decisão"),
      ok: { rotulo: txt(fl.ok?.rotulo, 60, "fluxo: ramo ok"), passos: lista(fl.ok?.passos, 2, 5, 160, "fluxo: passos ok") },
      desvio: { rotulo: txt(fl.desvio?.rotulo, 60, "fluxo: ramo desvio"), passos: lista(fl.desvio?.passos, 2, 5, 160, "fluxo: passos desvio") },
      fim: txt(fl.fim, 140, "fluxo: fim")
    },
    segredos: {
      dicas: lista(sg.dicas, 3, 7, 240, "segredos do chef"),
      referencias: lista(sg.referencias, 2, 6, 220, "referências"),
      glossario: (Array.isArray(sg.glossario) ? sg.glossario : []).map(g => ({ termo: txt(g?.termo, 40, "termo", false), definicao: txt(g?.definicao, 160, "definição", false) }))
        .filter(g => g.termo && g.definicao).slice(0, 10)
    }
  };
}

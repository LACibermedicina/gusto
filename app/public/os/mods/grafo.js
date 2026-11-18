// GUSTO · módulo Grafo de funcionalidades (nós + conexões, arrastar e soltar) · by m3d.pro
import { api, h } from "../api.js";
import { t, aplicarEstatico } from "../i18n.js";
import { sessao, pode } from "../sessao.js";

// Tipos de bloco: emoji, cor e módulo do Gusto OS que o nó abre (quando houver).
export const TIPOS = {
  receitas: ["🍲", "#e8590c"], pedidos: ["📦", "#1c7ed6"], agenda: ["📅", "#7048e8", "notas"], carteira: ["⭐", "#f08c00"],
  mapa: ["🗺️", "#2b8a3e"], comunidade: ["💬", "#1098ad", "comunidade"], assistente: ["🤖", "#d6336c", "assistente"],
  pagamentos: ["💳", "#5c940d"], nota: ["📝", "#868e96", "notas"], dado: ["🔷", "#495057"]
};
const NS = "http://www.w3.org/2000/svg";
const LARG = 150, ALT = 46;
const novoId = () => "n" + Math.random().toString(36).slice(2, 9);

export const grafo = ({ abrirModulo, abrirConta }) => ({
  id: "grafo", titulo: "app.grafo", icone: "grafo", largura: 820, altura: 540,
  montar(corpo) {
    corpo.classList.add("os-grafo");
    corpo.innerHTML = `
      <aside class="os-paleta" aria-label="${h(t("grafo.paleta"))}"><h3 data-t="grafo.paleta"></h3>
        ${Object.entries(TIPOS).map(([k, [e, c]]) => `<div class="os-bloco" draggable="true" data-tipo="${k}" style="--cor:${c}" tabindex="0"><span>${e}</span><span data-t="grafo.t.${k}"></span></div>`).join("")}
      </aside>
      <div class="os-area">
        <svg class="os-svg" tabindex="0" aria-label="Grafo"><defs><marker id="os-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#b08968"/></marker></defs><g class="os-mundo"><g class="os-arestas"></g><path class="os-fantasma" /><g class="os-nos"></g></g></svg>
        <div class="os-insp" hidden><input class="os-rot" maxlength="60" data-t-ph="grafo.rotulo"><button class="os-btn os-abrir" data-t="grafo.abrirModulo"></button><button class="os-btn os-del" data-t="comum.excluir"></button></div>
        <div class="os-rodape"><span class="os-mu os-ajuda" data-t="grafo.ajuda"></span><span class="os-estado os-mu"></span><button class="os-btn os-centro" data-t="grafo.centralizar"></button></div>
      </div>`;
    aplicarEstatico(corpo);

    const svg = corpo.querySelector(".os-svg"), mundo = svg.querySelector(".os-mundo");
    const gA = svg.querySelector(".os-arestas"), gN = svg.querySelector(".os-nos"), fantasma = svg.querySelector(".os-fantasma");
    const insp = corpo.querySelector(".os-insp"), rot = insp.querySelector(".os-rot"), estado = corpo.querySelector(".os-estado");
    let G = { nodes: [], edges: [] }, sel = null, vista = { x: 0, y: 0, k: 1 }, timer = 0;
    const online = () => sessao.usuario && !sessao.usuario.trocarSenha && pode("os_graph");

    const pt = e => { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left - vista.x) / vista.k, y: (e.clientY - r.top - vista.y) / vista.k }; };
    const aplicarVista = () => mundo.setAttribute("transform", `translate(${vista.x} ${vista.y}) scale(${vista.k})`);
    const curva = (a, b) => { const x1 = a.x + LARG, y1 = a.y + ALT / 2, x2 = b.x, y2 = b.y + ALT / 2, d = Math.max(40, Math.abs(x2 - x1) / 2); return `M${x1} ${y1} C${x1 + d} ${y1} ${x2 - d} ${y2} ${x2} ${y2}`; };

    const salvar = () => {
      clearTimeout(timer);
      if (!online()) { estado.textContent = t("grafo.local"); return; }
      estado.textContent = "…";
      timer = setTimeout(async () => {
        try { await api("/os-api/grafo", { metodo: "PUT", corpo: { name: "Meu grafo", data: G } }); estado.textContent = "✓ " + t("comum.salvo"); }
        catch (e) { estado.textContent = "⚠ " + e.message; }
      }, 600);
    };

    function desenhar() {
      const porId = Object.fromEntries(G.nodes.map(n => [n.id, n]));
      gA.innerHTML = G.edges.map((e, i) => porId[e.de] && porId[e.para]
        ? `<path class="os-aresta${sel?.aresta === i ? " os-sel" : ""}" data-i="${i}" d="${curva(porId[e.de], porId[e.para])}" marker-end="url(#os-seta)"/>` : "").join("");
      gN.innerHTML = G.nodes.map(n => {
        const [e, c] = TIPOS[n.tipo] || TIPOS.dado;
        return `<g class="os-no${sel?.no === n.id ? " os-sel" : ""}" data-id="${n.id}" transform="translate(${n.x} ${n.y})" style="--cor:${c}">
          <rect class="os-no-sombra" x="2" y="5" width="${LARG}" height="${ALT}" rx="14"/>
          <rect class="os-no-corpo" width="${LARG}" height="${ALT}" rx="14"/>
          <rect class="os-no-faixa" width="8" height="${ALT}" rx="4"/>
          <text x="22" y="${ALT / 2 + 6}" class="os-no-emoji">${e}</text>
          <text x="46" y="${ALT / 2 + 5}" class="os-no-rot">${h((n.rotulo || t("grafo.t." + n.tipo)).slice(0, 18))}</text>
          <circle class="os-porta" cx="${LARG}" cy="${ALT / 2}" r="7"/></g>`;
      }).join("");
      const n = sel?.no && porId[sel.no];
      insp.hidden = !sel;
      if (n) { rot.value = n.rotulo || ""; rot.hidden = false; insp.querySelector(".os-abrir").hidden = !TIPOS[n.tipo]?.[2]; }
      else if (sel) { rot.hidden = true; insp.querySelector(".os-abrir").hidden = true; }
    }

    // Soltar bloco da paleta (HTML5 DnD) ou com Enter no teclado.
    const criar = (tipo, p) => { const n = { id: novoId(), tipo, rotulo: "", x: Math.round(p.x - LARG / 2), y: Math.round(p.y - ALT / 2) }; G.nodes.push(n); sel = { no: n.id }; desenhar(); salvar(); };
    corpo.querySelectorAll(".os-bloco").forEach(b => {
      b.addEventListener("dragstart", e => { e.dataTransfer.setData("text/os-tipo", b.dataset.tipo); e.dataTransfer.effectAllowed = "copy"; });
      // Toque/clique ou teclado: cria no centro da área (arrastar não existe em telas de toque).
      const noCentro = () => { const r = svg.getBoundingClientRect(); criar(b.dataset.tipo, pt({ clientX: r.left + r.width / 2 + (Math.random() - .5) * 60, clientY: r.top + r.height / 2 + (Math.random() - .5) * 60 })); };
      b.addEventListener("click", noCentro);
      b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); noCentro(); } });
    });
    svg.addEventListener("dragover", e => { if (e.dataTransfer.types.includes("text/os-tipo")) { e.preventDefault(); svg.classList.add("os-alvo"); } });
    svg.addEventListener("dragleave", () => svg.classList.remove("os-alvo"));
    svg.addEventListener("drop", e => { e.preventDefault(); svg.classList.remove("os-alvo"); const tipo = e.dataTransfer.getData("text/os-tipo"); if (TIPOS[tipo]) criar(tipo, pt(e)); });

    // Arrastar nós, conectar pela porta, mover a vista pelo fundo.
    svg.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      const gNo = e.target.closest(".os-no"), porta = e.target.classList.contains("os-porta"), aresta = e.target.closest(".os-aresta");
      svg.setPointerCapture(e.pointerId); svg.focus({ preventScroll: true });
      const p0 = pt(e);
      let mv, up;
      if (gNo && porta) {
        const de = G.nodes.find(n => n.id === gNo.dataset.id);
        mv = ev => { const p = pt(ev); fantasma.setAttribute("d", curva(de, { x: p.x, y: p.y - ALT / 2 })); };
        up = ev => {
          fantasma.setAttribute("d", "");
          const alvo = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.(".os-no");
          if (alvo && alvo.dataset.id !== de.id && !G.edges.some(x => x.de === de.id && x.para === alvo.dataset.id)) { G.edges.push({ de: de.id, para: alvo.dataset.id }); salvar(); }
          desenhar();
        };
      } else if (gNo) {
        const n = G.nodes.find(x => x.id === gNo.dataset.id), o = { x: n.x, y: n.y };
        sel = { no: n.id }; desenhar();
        let moveu = false;
        mv = ev => { const p = pt(ev); n.x = Math.round(o.x + p.x - p0.x); n.y = Math.round(o.y + p.y - p0.y); moveu = true; desenhar(); };
        up = () => { if (moveu) salvar(); };
      } else if (aresta) {
        sel = { aresta: +aresta.dataset.i }; desenhar(); return;
      } else {
        sel = null; desenhar();
        const v0 = { ...vista }, c0 = { x: e.clientX, y: e.clientY };
        mv = ev => { vista.x = v0.x + ev.clientX - c0.x; vista.y = v0.y + ev.clientY - c0.y; aplicarVista(); };
      }
      const fim = ev => { svg.removeEventListener("pointermove", mv); svg.removeEventListener("pointerup", fim); up?.(ev); };
      if (mv) svg.addEventListener("pointermove", mv);
      svg.addEventListener("pointerup", fim);
    });
    svg.addEventListener("wheel", e => {
      e.preventDefault();
      const r = svg.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, k = Math.min(2.5, Math.max(.3, vista.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1)));
      vista.x = mx - (mx - vista.x) * k / vista.k; vista.y = my - (my - vista.y) * k / vista.k; vista.k = k; aplicarVista();
    }, { passive: false });

    const excluir = () => {
      if (sel?.no) { G.edges = G.edges.filter(x => x.de !== sel.no && x.para !== sel.no); G.nodes = G.nodes.filter(n => n.id !== sel.no); }
      else if (sel?.aresta !== undefined) G.edges.splice(sel.aresta, 1);
      sel = null; desenhar(); salvar();
    };
    svg.addEventListener("keydown", e => { if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); excluir(); } });
    insp.querySelector(".os-del").onclick = excluir;
    insp.querySelector(".os-abrir").onclick = () => { const n = G.nodes.find(x => x.id === sel?.no); const m = n && TIPOS[n.tipo]?.[2]; if (m) abrirModulo(m); };
    rot.addEventListener("input", () => { const n = G.nodes.find(x => x.id === sel?.no); if (n) { n.rotulo = rot.value.slice(0, 60); desenhar(); salvar(); } });
    corpo.querySelector(".os-centro").onclick = () => {
      if (!G.nodes.length) { vista = { x: 0, y: 0, k: 1 }; aplicarVista(); return; }
      const r = svg.getBoundingClientRect(), xs = G.nodes.map(n => n.x), ys = G.nodes.map(n => n.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs) + LARG, minY = Math.min(...ys), maxY = Math.max(...ys) + ALT;
      const k = Math.min(1.4, Math.max(.3, Math.min(r.width / (maxX - minX + 80), r.height / (maxY - minY + 80))));
      vista = { k, x: r.width / 2 - (minX + maxX) / 2 * k, y: r.height / 2 - (minY + maxY) / 2 * k }; aplicarVista();
    };

    // Grafo inicial: o do servidor, ou um exemplo que mostra o fluxo do Gusto.
    const exemplo = () => ({
      nodes: [["a", "receitas", 30, 40], ["b", "pedidos", 240, 40], ["c", "pagamentos", 450, 40], ["d", "agenda", 240, 150], ["e", "comunidade", 30, 150], ["f", "assistente", 450, 150]]
        .map(([id, tipo, x, y]) => ({ id, tipo, rotulo: "", x, y })),
      edges: [{ de: "a", para: "b" }, { de: "b", para: "c" }, { de: "b", para: "d" }, { de: "e", para: "a" }, { de: "d", para: "f" }]
    });
    (async () => {
      if (online()) { try { const r = await api("/os-api/grafo"); G = r.data || exemplo(); } catch { G = exemplo(); } }
      else { G = exemplo(); estado.textContent = t("grafo.local"); if (!sessao.usuario) { const b = document.createElement("button"); b.className = "os-btn"; b.textContent = t("conta.entrar"); b.onclick = abrirConta; estado.after(b); } }
      vista = { x: 20, y: 30, k: 1 }; aplicarVista(); desenhar();
    })();
  }
});

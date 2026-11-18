// GUSTO · módulo Notas da agenda (calendário + notas cruzadas entre dias) · by m3d.pro
import { api, h } from "../api.js";
import { t, aplicarEstatico, idiomaAtual } from "../i18n.js";
import { exigir } from "../sessao.js";

const dstr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const LOCALES = { pt: "pt-BR", en: "en-GB", es: "es", zh: "zh-CN", hi: "hi-IN" };

export const notas = ({ abrirConta }) => ({
  id: "notas", titulo: "app.notas", icone: "notas", largura: 760, altura: 520,
  montar(corpo) {
    let mes = new Date(); mes.setDate(1);
    let dia = dstr(new Date()), dados = { notas: [], links: [] }, aberta = null;

    const carregar = async () => {
      const ini = new Date(mes.getFullYear(), mes.getMonth() - 1, 20), fim = new Date(mes.getFullYear(), mes.getMonth() + 1, 12);
      dados = await api(`/os-api/notas?de=${dstr(ini)}&ate=${dstr(fim)}`);
      render();
    };
    const ligadas = id => dados.links.filter(l => l.a === id || l.b === id).map(l => (l.a === id ? l.b : l.a));

    function render() {
      const loc = LOCALES[idiomaAtual()] || "pt-BR";
      const primeiro = new Date(mes), inicio = new Date(primeiro); inicio.setDate(1 - ((primeiro.getDay() + 6) % 7));
      const cont = {}; dados.notas.forEach(n => (cont[n.dia] = (cont[n.dia] || 0) + 1));
      const dias = Array.from({ length: 42 }, (_, i) => { const d = new Date(inicio); d.setDate(inicio.getDate() + i); return d; });
      const semana = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(loc, { weekday: "narrow" }));
      const doDia = dados.notas.filter(n => n.dia === dia);
      const nota = aberta && dados.notas.find(n => n.id === aberta);
      corpo.innerHTML = `<div class="os-notas">
        <section class="os-cal">
          <div class="os-cab"><button class="os-btn os-ant" aria-label="‹">‹</button><b class="os-notr">${h(mes.toLocaleDateString(loc, { month: "long", year: "numeric" }))}</b><button class="os-btn os-prox" aria-label="›">›</button></div>
          <div class="os-cal-grade os-notr">${semana.map(s => `<span class="os-cal-s">${h(s)}</span>`).join("")}
          ${dias.map(d => { const k = dstr(d); return `<button class="os-cal-d${d.getMonth() !== mes.getMonth() ? " os-fora" : ""}${k === dia ? " os-sel" : ""}${k === dstr(new Date()) ? " os-hoje" : ""}" data-d="${k}">${d.getDate()}${cont[k] ? `<i>${cont[k]}</i>` : ""}</button>`; }).join("")}</div>
          <button class="os-btn os-hojeb" data-t="notas.hoje"></button>
        </section>
        <section class="os-lista">
          <div class="os-cab"><b class="os-notr">${h(new Date(dia + "T12:00").toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long" }))}</b><button class="os-btn os-btn-p os-nova" data-t="notas.nova"></button></div>
          ${doDia.length ? doDia.map(n => `<button class="os-nota${n.id === aberta ? " os-sel" : ""}" data-id="${n.id}"><b>${h(n.titulo)}</b><small>${h(n.corpo.slice(0, 80))}</small>${ligadas(n.id).length ? `<i>🔗 ${ligadas(n.id).length}</i>` : ""}</button>`).join("") : `<p class="os-mu" data-t="notas.vazio"></p>`}
        </section>
        <section class="os-editor">${nota ? `
          <input class="os-tit" maxlength="120" value="${h(nota.titulo)}" data-t-ph="notas.titulo">
          <div class="os-linha"><input type="date" class="os-data" value="${nota.dia}"><button class="os-btn os-del" data-t="comum.excluir"></button></div>
          <textarea class="os-txt" maxlength="10000" data-t-ph="notas.corpo">${h(nota.corpo)}</textarea>
          <div class="os-links"><b data-t="notas.ligadas"></b>
            ${ligadas(nota.id).map(id => { const o = dados.notas.find(x => x.id === id); return `<span class="os-chip"><button class="os-ir" data-id="${id}" data-dia="${o?.dia || ""}">📝 ${h(o ? o.dia + " · " + o.titulo : "…")}</button><button class="os-desl" data-id="${id}" aria-label="×">×</button></span>`; }).join("")}
            <select class="os-ligar"><option value="" data-t="notas.ligar"></option></select></div>` : ""}
        </section></div>`;
      aplicarEstatico(corpo);
      corpo.querySelector(".os-ant").onclick = () => { mes.setMonth(mes.getMonth() - 1); carregar(); };
      corpo.querySelector(".os-prox").onclick = () => { mes.setMonth(mes.getMonth() + 1); carregar(); };
      corpo.querySelector(".os-hojeb").onclick = () => { mes = new Date(); mes.setDate(1); dia = dstr(new Date()); aberta = null; carregar(); };
      corpo.querySelectorAll(".os-cal-d").forEach(b => (b.onclick = () => { dia = b.dataset.d; aberta = null; render(); }));
      corpo.querySelectorAll(".os-nota").forEach(b => (b.onclick = () => { aberta = b.dataset.id; render(); }));
      corpo.querySelector(".os-nova").onclick = async () => {
        const r = await api("/os-api/notas", { metodo: "POST", corpo: { dia, titulo: t("notas.nova"), corpo: "" } });
        aberta = r.id; await carregar(); corpo.querySelector(".os-tit")?.select();
      };
      if (!nota) return;
      let tm = 0;
      const salvar = campos => { clearTimeout(tm); tm = setTimeout(() => api(`/os-api/notas/${nota.id}`, { metodo: "PATCH", corpo: campos }).then(() => Object.assign(nota, campos)).catch(e => alert(e.message)), 500); };
      corpo.querySelector(".os-tit").oninput = e => salvar({ titulo: e.target.value });
      corpo.querySelector(".os-txt").oninput = e => salvar({ corpo: e.target.value });
      corpo.querySelector(".os-data").onchange = async e => { await api(`/os-api/notas/${nota.id}`, { metodo: "PATCH", corpo: { dia: e.target.value } }); dia = e.target.value; await carregar(); };
      corpo.querySelector(".os-del").onclick = async () => { await api(`/os-api/notas/${nota.id}`, { metodo: "DELETE" }); aberta = null; await carregar(); };
      corpo.querySelectorAll(".os-ir").forEach(b => (b.onclick = () => { if (b.dataset.dia) { dia = b.dataset.dia; const d = new Date(dia + "T12:00"); mes = new Date(d.getFullYear(), d.getMonth(), 1); } aberta = b.dataset.id; carregar(); }));
      corpo.querySelectorAll(".os-desl").forEach(b => (b.onclick = async () => { await api(`/os-api/notas/${nota.id}/links`, { metodo: "POST", corpo: { com: b.dataset.id, remover: true } }); await carregar(); }));
      // Ligações cruzadas: busca notas de qualquer dia (não só do mês carregado).
      const sel = corpo.querySelector(".os-ligar");
      api("/os-api/notas/busca?q=").then(lista => {
        const ja = new Set(ligadas(nota.id));
        lista.filter(o => o.id !== nota.id && !ja.has(o.id)).forEach(o => sel.insertAdjacentHTML("beforeend", `<option value="${o.id}">${h(o.dia)} · ${h(o.titulo)}</option>`));
      }).catch(() => {});
      sel.onchange = async () => { if (!sel.value) return; await api(`/os-api/notas/${nota.id}/links`, { metodo: "POST", corpo: { com: sel.value } }); await carregar(); };
    }

    exigir(corpo, "notes", () => { corpo.innerHTML = `<p class="os-mu" data-t="comum.carregando"></p>`; aplicarEstatico(corpo); carregar().catch(e => (corpo.textContent = e.message)); }, abrirConta)();
  }
});

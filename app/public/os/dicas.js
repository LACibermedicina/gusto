// GUSTO · quadros explicativos ao passar o mouse (dock, menus, barra superior) · by m3d.pro
// Marque um elemento com data-dica-chave="desc.x" (texto do dicionário) ou data-dica-texto="…";
// título: data-dica-titulo, aria-label ou texto; grupo opcional: data-grupo.
import { t } from "./i18n.js";

let caixa = null, alvo = null, timer = 0;

function conteudo(el) {
  const titulo = el.dataset.dicaTitulo || el.getAttribute("aria-label") || el.querySelector("b")?.textContent || el.textContent.trim();
  const texto = el.dataset.dicaChave ? t(el.dataset.dicaChave) : (el.dataset.dicaTexto || "");
  const grupo = el.dataset.grupo ? t("grupo." + el.dataset.grupo) : "";
  return { titulo, texto, grupo };
}

function mostrar(el) {
  const { titulo, texto, grupo } = conteudo(el);
  if (!texto && !grupo) return;
  caixa.innerHTML = `${grupo ? `<small></small>` : ""}<b></b>${texto ? `<p></p>` : ""}`;
  if (grupo) caixa.querySelector("small").textContent = grupo;
  caixa.querySelector("b").textContent = titulo;
  if (texto) caixa.querySelector("p").textContent = texto;
  caixa.hidden = false;
  const r = el.getBoundingClientRect(), c = caixa.getBoundingClientRect();
  if (el.closest(".os-menu-pop")) {                  // itens de menu: quadro ao lado, sem cobrir a lista
    const direita = r.right + c.width + 12 < innerWidth;
    caixa.style.left = (direita ? r.right + 10 : r.left - c.width - 10) + "px";
    caixa.style.top = Math.max(8, Math.min(innerHeight - c.height - 8, r.top)) + "px";
    return;
  }
  const embaixo = r.top < 140;                       // itens no topo: quadro abaixo; dock: acima
  caixa.style.left = Math.max(8, Math.min(innerWidth - c.width - 8, r.left + r.width / 2 - c.width / 2)) + "px";
  caixa.style.top = (embaixo ? r.bottom + 10 : r.top - c.height - 10) + "px";
}
function esconder() { clearTimeout(timer); alvo = null; if (caixa) caixa.hidden = true; }

export function iniciarDicas() {
  caixa = document.createElement("div");
  caixa.className = "os-dica"; caixa.setAttribute("role", "tooltip"); caixa.hidden = true;
  document.body.appendChild(caixa);
  const sel = "[data-dica-chave],[data-dica-texto]";
  const entrar = e => {
    const el = e.target.closest?.(sel); if (!el || el === alvo) return;
    esconder(); alvo = el; timer = setTimeout(() => alvo === el && mostrar(el), e.type === "focusin" ? 0 : 350);
  };
  document.addEventListener("pointerover", entrar);
  document.addEventListener("focusin", entrar);
  document.addEventListener("pointerout", e => { if (alvo && !alvo.contains(e.relatedTarget)) esconder(); });
  document.addEventListener("focusout", esconder);
  document.addEventListener("pointerdown", esconder, true);
  addEventListener("scroll", esconder, true);
}

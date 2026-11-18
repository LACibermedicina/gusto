// GUSTO · camada OS · estado da sessão do servidor e permissões (RBAC por funcionalidade) · by m3d.pro
import { api, emit } from "./api.js";
import { aplicarEstatico } from "./i18n.js";

export const sessao = { info: null, usuario: null, perms: {}, papeis: [], root: false };

export async function recarregarSessao() {
  sessao.info = await api("/os-api/info").catch(() => ({ usuario: null, ia: false, ice: [] }));
  sessao.usuario = sessao.info.usuario;
  sessao.perms = {}; sessao.papeis = []; sessao.root = false;
  if (sessao.usuario && !sessao.usuario.trocarSenha) {
    const p = await api("/os-api/permissoes").catch(() => null);
    if (p) { sessao.perms = p.funcionalidades; sessao.papeis = p.papeis; sessao.root = p.root; }
  }
  emit("sessao:mudou", sessao);
  return sessao;
}

export const pode = f => !!(sessao.root || sessao.perms[f]);

/**
 * Garante login e permissão antes de montar um módulo. Se faltar algo, mostra o aviso adequado
 * e remonta sozinho quando a sessão mudar.
 */
export function exigir(corpo, funcionalidade, montar, abrirConta) {
  const desenhar = () => {
    if (!sessao.usuario || sessao.usuario.trocarSenha) {
      corpo.innerHTML = `<div class="os-vazio">${"🔑"}<p data-t="conta.precisa"></p><button class="os-btn os-btn-p" data-t="conta.entrar"></button></div>`;
      corpo.querySelector("button").onclick = abrirConta;
      aplicarEstatico(corpo); return false;
    }
    if (funcionalidade && !pode(funcionalidade)) {
      corpo.innerHTML = `<div class="os-vazio">🚫<p data-t="comum.semPermissao"></p></div>`;
      aplicarEstatico(corpo); return false;
    }
    montar(); return true;
  };
  return desenhar;
}

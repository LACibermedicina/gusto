// GUSTO · camada OS · ponte de login: a tela "Entrar no Gusto" da interface base passa a aceitar a conta do servidor · by m3d.pro
// A base guarda usuários só no navegador (localStorage, SHA-256 com sal) e tem um root com senha embutida desconhecida.
// Aqui, antes do login local, tentamos o login real da API; se der certo, o usuário local é criado/atualizado com a
// mesma senha (no mesmo formato de hash da base) e o login local segue normalmente. Sem servidor, nada muda.
import { api } from "./api.js";

const PAPEIS = { client: "c", cook: "p", courier: "e", inspector: "f" };

function estadoBase() {
  // S, sv, H e salt são declarações de nível superior do script da base (escopo global léxico).
  try { return { S, sv, H, salt }; } catch { return null; } // eslint-disable-line no-undef
}

async function sincronizarLocal(usuario, senha, me) {
  const b = estadoBase(); if (!b || !Array.isArray(b.S?.users)) return;
  const papeis = (me?.roles || []).map(r => PAPEIS[r]).filter(Boolean);
  if (!papeis.length) papeis.push("c");
  const s = b.salt(), hash = await b.H(s, senha);
  let u = b.S.users.find(x => x.u === usuario);
  if (!u) {
    u = { u: usuario, n: me?.display_name || usuario, s, h: hash, roles: papeis, adm: me?.is_root ? 1 : 0, on: 1, deny: [] };
    b.S.users.push(u);
  } else {
    Object.assign(u, { s, h: hash, on: 1, n: me?.display_name || u.n, adm: me?.is_root ? 1 : u.adm });
    if (!u.roles?.length) u.roles = papeis;
  }
  if (b.S.wz && me?.is_root) b.S.wz[usuario] = b.S.wz[usuario] || 0; // guia de primeiro acesso continua disponível
  b.sv();
}

/** Envolve o go_() da base. aoEntrar(resp) é chamado após login real na API. */
export function instalarPonteLogin(aoEntrar) {
  const original = window.go_;
  if (typeof original !== "function" || original.__ponte) return;
  const ponte = async function (...args) {
    const usuario = (document.querySelector("#lu")?.value || "").trim().toLowerCase();
    const senha = document.querySelector("#lp")?.value || "";
    if (usuario && senha) {
      try {
        const r = await api("/auth/login", { metodo: "POST", corpo: { username: usuario, password: senha } });
        const me = await api("/me").catch(() => null);
        await sincronizarLocal(usuario, senha, me);
        aoEntrar?.(r);
      } catch { /* conta só local ou senha errada no servidor: segue o login da base */ }
    }
    return original.apply(this, args);
  };
  ponte.__ponte = true;
  window.go_ = ponte;
}

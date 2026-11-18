// GUSTO · módulo Conta do servidor (login na API real, troca de senha inicial) · by m3d.pro
import { api, h, on } from "../api.js";
import { t, aplicarEstatico } from "../i18n.js";
import { sessao, recarregarSessao } from "../sessao.js";

export const conta = () => ({
  id: "conta", titulo: "app.conta", icone: "conta", largura: 380, altura: 400,
  montar(corpo) {
    const desenhar = () => {
      const u = sessao.usuario;
      if (!u) {
        corpo.innerHTML = `<form class="os-form" autocomplete="on">
          <p class="os-mu" data-t="conta.explica"></p>
          <label><span data-t="conta.usuario"></span><input name="u" autocomplete="username" required maxlength="20"></label>
          <label><span data-t="conta.senha"></span><input name="p" type="password" autocomplete="current-password" required></label>
          <button class="os-btn os-btn-p" data-t="conta.entrar"></button><p class="os-erro" role="alert"></p></form>`;
        const f = corpo.querySelector("form");
        f.onsubmit = async e => {
          e.preventDefault();
          try { await api("/auth/login", { metodo: "POST", corpo: { username: f.u.value.trim().toLowerCase(), password: f.p.value } }); await recarregarSessao(); }
          catch (err) { f.querySelector(".os-erro").textContent = err.message; }
        };
      } else if (u.trocarSenha) {
        corpo.innerHTML = `<form class="os-form"><p><b>${h(t("conta.ola", { nome: u.nome }))}</b></p><p class="os-mu" data-t="conta.trocar"></p>
          <label><span data-t="conta.senhaAtual"></span><input name="o" type="password" autocomplete="current-password" required></label>
          <label><span data-t="conta.senhaNova"></span><input name="n" type="password" autocomplete="new-password" minlength="8" required></label>
          <button class="os-btn os-btn-p" data-t="comum.salvar"></button><p class="os-erro" role="alert"></p></form>`;
        const f = corpo.querySelector("form");
        f.onsubmit = async e => {
          e.preventDefault();
          try { await api("/auth/password", { metodo: "POST", corpo: { old: f.o.value, next: f.n.value } }); await recarregarSessao(); }
          catch (err) { f.querySelector(".os-erro").textContent = err.message; }
        };
      } else {
        corpo.innerHTML = `<div class="os-form"><p class="os-grande">👋 <b>${h(t("conta.ola", { nome: u.nome }))}</b></p>
          <p class="os-mu">${sessao.papeis.map(h).join(" · ")}${sessao.root ? " · root" : ""}</p>
          <button class="os-btn" data-t="conta.sair"></button></div>`;
        corpo.querySelector("button").onclick = async () => { await api("/auth/logout", { metodo: "POST", corpo: {} }).catch(() => {}); await recarregarSessao(); };
      }
      aplicarEstatico(corpo);
    };
    desenhar();
    this._off = on("sessao:mudou", desenhar);
  },
  aoFechar() { this._off?.(); }
});

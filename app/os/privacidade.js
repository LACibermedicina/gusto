// GUSTO · camada OS · LGPD: mascaramento, consentimentos, portabilidade e eliminação · by m3d.pro
import crypto from "crypto";
import bcrypt from "bcryptjs";

export const VERSAO_TERMOS = "2026-11-v1";
export const FINALIDADES = ["terms", "ai_processing", "chat_history", "video"];

// Ordem importa: padrões mais específicos primeiro.
const PADROES = [
  ["email", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
  ["cnpj", /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g],
  ["cpf", /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g],
  ["cartao", /\b(?:\d[ -]?){13,19}\b/g],
  ["telefone", /(?:\+?55\s?)?\(?\b\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g],
  ["cep", /\b\d{5}-\d{3}\b/g]
];

/**
 * Substitui identificadores diretos por marcadores ⟦n⟧ antes de enviar texto a terceiros (IA).
 * Retorna o texto mascarado e o mapa para restaurar a resposta. Minimização: LGPD art. 6º, III.
 */
export function mascarar(texto, mapa = []) {
  let t = String(texto ?? "");
  for (const [, re] of PADROES) {
    t = t.replace(re, m => {
      let i = mapa.indexOf(m);
      if (i < 0) { mapa.push(m); i = mapa.length - 1; }
      return `⟦${i}⟧`;
    });
  }
  return { texto: t, mapa };
}

export function restaurar(texto, mapa) {
  return String(texto ?? "").replace(/⟦(\d+)⟧/g, (m, i) => (mapa[+i] !== undefined ? mapa[+i] : m));
}

export const hashTexto = s => crypto.createHash("sha256").update(String(s)).digest("hex");

export async function consentimentos(q, uid) {
  const r = await q("select purpose,granted,version,at from lgpd_consents where user_id=$1", [uid]);
  const m = Object.fromEntries(FINALIDADES.map(f => [f, { concedido: false, versao: null, em: null }]));
  for (const x of r.rows) m[x.purpose] = { concedido: x.granted, versao: x.version, em: x.at };
  return m;
}

export async function temConsentimento(q, uid, finalidade) {
  const r = await q("select granted from lgpd_consents where user_id=$1 and purpose=$2", [uid, finalidade]);
  return !!r.rows[0]?.granted;
}

// Consultas de portabilidade (art. 18, V). Cada item é independente: se uma tabela não existir
// numa instalação antiga, o item vem com erro em vez de derrubar a exportação.
const EXPORT = {
  conta: "select id,username,display_name,is_root,is_active,created_at from users where id=$1",
  papeis: "select role::text,granted_by from user_roles where user_id=$1",
  perfil: "select phone,address,locale,ST_AsText(home::geometry) home from profiles where user_id=$1",
  permissoes_individuais: "select feature,allowed,set_at from user_feature_overrides where user_id=$1",
  sessoes: "select created_at,expires_at,revoked,user_agent from sessions where user_id=$1 order by created_at desc limit 50",
  consentimentos: "select purpose,granted,version,at from lgpd_consents where user_id=$1",
  carteira: "select * from wallets where user_id=$1",
  extrato: "select kind::text,amount,memo,ref_order,at from ledger where user_id=$1 order by at desc limit 1000",
  receitas: "select id,title,status,created_at from recipes where author_id=$1",
  notas: "select id,day,title,body,created_at,updated_at from os_notes where owner_id=$1 order by day",
  grafos: "select name,data,updated_at from os_graphs where owner_id=$1",
  mensagens: "select r.slug sala,m.body,m.at from chat_messages m join chat_rooms r on r.id=m.room_id where m.author_id=$1 order by m.at",
  gamificacao: "select xp,muted,updated_at from os_xp where user_id=$1",
  auditoria: "select action,entity,entity_id,at from audit_log where actor=$1 order by at desc limit 500"
};

export async function exportar(q, uid) {
  const saida = { gerado_em: new Date().toISOString(), controlador: process.env.LGPD_CONTROLADOR || "M3D.pro", dados: {} };
  for (const [k, sql] of Object.entries(EXPORT)) {
    try { saida.dados[k] = (await q(sql, [uid])).rows; }
    catch (e) { saida.dados[k] = { indisponivel: true }; }
  }
  await q("insert into lgpd_requests(user_id,kind) values($1,'export')", [uid]).catch(() => {});
  return saida;
}

/**
 * Eliminação (art. 18, VI) com preservação do que a lei obriga a manter (art. 16, I):
 * registros financeiros e de pedidos ficam, mas desvinculados de qualquer identificação.
 */
export async function eliminar({ tx, q }, uid, senha) {
  const u = (await q("select password_hash,is_root from users where id=$1", [uid])).rows[0];
  if (!u) throw Object.assign(new Error("Conta não encontrada"), { s: 404 });
  if (u.is_root) throw Object.assign(new Error("O root não pode ser eliminado por aqui"), { s: 403 });
  if (!(await bcrypt.compare(String(senha || ""), u.password_hash))) throw Object.assign(new Error("Senha incorreta"), { s: 401 });
  const apelido = "removido-" + crypto.randomBytes(4).toString("hex");
  await tx(async c => {
    for (const sql of [
      "delete from os_notes where owner_id=$1",
      "delete from os_graphs where owner_id=$1",
      "delete from chat_messages where author_id=$1",
      "delete from os_xp where user_id=$1",
      "delete from lgpd_consents where user_id=$1",
      "delete from profiles where user_id=$1",
      "delete from user_feature_overrides where user_id=$1",
      "update sessions set revoked=true,user_agent=null,ip=null where user_id=$1"
    ]) await c.query(sql, [uid]);
    await c.query(
      "update users set username=$2,display_name='Titular removido',is_active=false,password_hash=$3,must_change_password=true where id=$1",
      [uid, apelido, await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10)]
    );
    await c.query("insert into lgpd_requests(user_id,kind) values($1,'delete')", [uid]);
  });
  return { ok: true };
}

// GUSTO · testes do cadastro e da entrada com provedores externos (sem rede, sem banco) · node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { provedores, perfilDe, sugerirUsuario, USUARIO_RE } from "../app/os/contas.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const jwt = c => ["e30", Buffer.from(JSON.stringify(c)).toString("base64url"), "x"].join(".");

test("provedores só ficam ativos com as variáveis completas", () => {
  assert.deepEqual(Object.values(provedores({})).map(p => p.ativo), [false, false, false, false]);
  const p = provedores({ OAUTH_GOOGLE_ID: "a", OAUTH_GOOGLE_SECRET: "b", OAUTH_X_ID: "c", OAUTH_APPLE_ID: "d" });
  assert.equal(p.google.ativo, true); assert.equal(p.x.ativo, false); assert.equal(p.apple.ativo, false);
  assert.match(provedores({ OAUTH_MICROSOFT_TENANT: "consumers" }).microsoft.auth, /\/consumers\//);
});

test("sugestão de usuário respeita o formato e evita nomes reservados", () => {
  assert.equal(sugerirUsuario("Ana Júlia Ávila"), "ana.julia.avila");
  assert.equal(sugerirUsuario("root"), "chef");
  assert.equal(sugerirUsuario("@@"), "chef");
  for (const s of ["João da Silva Pereira Santos", "x", "李雷", "a_b-c.d"]) assert.ok(USUARIO_RE.test(sugerirUsuario(s)), s);
});

test("perfil OIDC (Google/Microsoft/Apple) e X", () => {
  const g = perfilDe("google", { id_token: jwt({ sub: "123", name: "Ana", email: "ana@ex.com", nonce: "n", aud: "cli" }) });
  assert.deepEqual([g.sujeito, g.nome, g.email, g.sugestao, g.nonce], ["123", "Ana", "ana@ex.com", "ana", "n"]);
  const a = perfilDe("apple", { id_token: jwt({ sub: "z" }) }, { usuarioApple: { name: { firstName: "Bia", lastName: "Reis" } } });
  assert.equal(a.nome, "Bia Reis");
  const x = perfilDe("x", {}, { perfil: { data: { id: "99", name: "Chef", username: "chefx" } } });
  assert.deepEqual([x.sujeito, x.email, x.sugestao], ["99", null, "chefx"]);
  assert.equal(perfilDe("google", { id_token: "lixo" }).sujeito, "");
});

test("client_secret da Apple é um JWT ES256 verificável", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).replace(/\n/g, "\\n");
  const p = provedores({ OAUTH_APPLE_ID: "pro.m3d.gusto", OAUTH_APPLE_TEAM_ID: "T", OAUTH_APPLE_KEY_ID: "K", OAUTH_APPLE_KEY: pem }).apple;
  assert.equal(p.ativo, true);
  const [c, b, s] = p.segredo().split(".");
  assert.equal(JSON.parse(Buffer.from(c, "base64url")).alg, "ES256");
  const corpo = JSON.parse(Buffer.from(b, "base64url"));
  assert.equal(corpo.sub, "pro.m3d.gusto"); assert.equal(corpo.aud, "https://appleid.apple.com"); assert.ok(corpo.exp > corpo.iat);
  assert.ok(crypto.verify("sha256", Buffer.from(`${c}.${b}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url")));
});

test("retorno OAuth isento da trava de JSON só na rota de retorno", () => {
  const srv = fs.readFileSync(path.join(RAIZ, "app/server.js"), "utf8");
  const re = new RegExp(srv.match(/!\/(\^\\\/os-api\\\/oauth\\\/\[a-z\]\+\\\/retorno\$)\/\.test/)[1]);
  assert.ok(re.test("/os-api/oauth/apple/retorno"));
  assert.ok(!re.test("/os-api/registro") && !re.test("/os-api/oauth/apple/retorno/x"));
});

test("chaves novas de acesso existem nos 5 idiomas", () => {
  const pt = JSON.parse(fs.readFileSync(path.join(RAIZ, "app/public/os/i18n/pt.json"), "utf8"));
  const chaves = Object.keys(pt).filter(k => k.startsWith("ac."));
  assert.ok(chaves.length >= 20);
  for (const l of ["en", "es", "zh", "hi"]) {
    const d = JSON.parse(fs.readFileSync(path.join(RAIZ, `app/public/os/i18n/${l}.json`), "utf8"));
    assert.deepEqual(chaves.filter(k => !(k in d)), [], l);
  }
});

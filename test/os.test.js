// GUSTO · testes unitários da camada OS (sem banco) · node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mascarar, restaurar } from "../app/os/privacidade.js";
import { injetar, validarGrafo, credenciaisTurn, IDIOMAS } from "../app/os/index.js";
import { extrairJSON, iaDisponivel } from "../app/os/ia.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

test("LGPD: mascara e-mail, telefone, CPF, CNPJ, cartão e CEP antes da IA", () => {
  const original = "Ana (ana.silva@ex.com.br) tel +55 (11) 98765-4321, CPF 123.456.789-09, CNPJ 12.345.678/0001-90, cartão 4111 1111 1111 1111, CEP 01310-100";
  const { texto, mapa } = mascarar(original);
  for (const dado of ["ana.silva@ex.com.br", "98765-4321", "123.456.789-09", "12.345.678/0001-90", "4111 1111 1111 1111", "01310-100"]) assert.ok(!texto.includes(dado), dado);
  assert.match(texto, /⟦\d+⟧/);
  assert.equal(restaurar(texto, mapa), original);
});

test("LGPD: mesmo dado repetido usa o mesmo marcador; mapa compartilhado entre textos", () => {
  const mapa = [];
  const a = mascarar("x@y.com e x@y.com", mapa).texto;
  const b = mascarar("de novo x@y.com", mapa).texto;
  assert.equal(a, "⟦0⟧ e ⟦0⟧"); assert.equal(b, "de novo ⟦0⟧"); assert.equal(mapa.length, 1);
});

test("LGPD: texto sem dado pessoal passa intacto (números de receita não são mascarados)", () => {
  const s = "Asse a 180 °C por 35 minutos; rende 8 porções (R$ 12,50).";
  assert.equal(mascarar(s).texto, s);
});

test("injeção da camada OS preserva o index base e marca o ambiente", () => {
  const base = '<!doctype html><html><head><title>Gusto</title></head><body><main>app</main></body></html>';
  const prod = injetar(base, { base: "", ambiente: "producao", versao: "0.1.0-alpha" });
  assert.ok(prod.includes('<main>app</main>'));
  assert.ok(prod.includes('href="/os/os.css?v=0.1.0-alpha"'));
  assert.ok(prod.includes('src="/os/boot.js?v=0.1.0-alpha"'));
  assert.ok(!prod.includes("teste:"));
  const t = injetar(base, { base: "/teste/", ambiente: "teste", versao: "x" });
  assert.ok(t.includes('href="/teste/os/os.css?v=x"'));
  assert.ok(t.includes('content="noindex,nofollow"'));
  assert.ok(t.includes('const P="teste:"'), "homologação isola o localStorage");
  assert.ok(t.indexOf('const P="teste:"') < t.indexOf("<title>"), "isolamento roda antes de qualquer script da base");
});

test("injeção funciona no index.html real", () => {
  const html = fs.readFileSync(path.join(RAIZ, "app/public/index.html"), "utf8");
  const out = injetar(html, { base: "", ambiente: "producao", versao: "v" });
  assert.equal(out.length > html.length, true);
  assert.equal((out.match(/os\/boot\.js/g) || []).length, 1);
});

test("grafo: valida, limita e descarta conexões inválidas ou duplicadas", () => {
  const g = validarGrafo({
    nodes: [{ id: "a", tipo: "receitas", rotulo: "x".repeat(100), x: 99999, y: -3 }, { id: "b", tipo: "pedidos", x: 1, y: 2 }],
    edges: [{ de: "a", para: "b" }, { de: "a", para: "b" }, { de: "a", para: "zz" }, { de: "a", para: "a" }]
  });
  assert.equal(g.nodes[0].rotulo.length, 60);
  assert.equal(g.nodes[0].x, 5000);
  assert.deepEqual(g.edges, [{ de: "a", para: "b" }]);
  assert.throws(() => validarGrafo({ nodes: [{ id: "<script>" }], edges: [] }), /id inválido/);
  assert.throws(() => validarGrafo({ nodes: Array.from({ length: 201 }, (_, i) => ({ id: "n" + i })), edges: [] }), /grande demais/);
});

test("TURN: credenciais efêmeras no formato do coturn (use-auth-secret)", () => {
  const c = credenciaisTurn("segredo", "uuid-do-usuario", 60);
  const [exp, sufixo] = c.username.split(":");
  assert.ok(+exp > Date.now() / 1000);
  assert.equal(sufixo.length, 12);
  assert.ok(!c.username.includes("uuid-do-usuario"), "não expõe o id do usuário");
  assert.match(c.credential, /^[A-Za-z0-9+/]+=*$/);
});

test("IA: extrai JSON mesmo cercado por ```", () => {
  assert.deepEqual(extrairJSON('```json\n{"t":["a","b"]}\n```'), { t: ["a", "b"] });
  assert.deepEqual(extrairJSON('Claro! ["x"] fim'), ["x"]);
});

test("IA: chaves de exemplo (com …) não contam como configuradas", () => {
  const antes = process.env.IA_GEMINI_KEYS;
  process.env.IA_GEMINI_KEYS = "AIza…exemplo";
  assert.equal(iaDisponivel(), false);
  if (antes === undefined) delete process.env.IA_GEMINI_KEYS; else process.env.IA_GEMINI_KEYS = antes;
});

test("i18n: os 5 dicionários têm exatamente as mesmas chaves e placeholders", () => {
  const dir = path.join(RAIZ, "app/public/os/i18n");
  const pt = JSON.parse(fs.readFileSync(path.join(dir, "pt.json"), "utf8"));
  assert.deepEqual(Object.keys(IDIOMAS).sort(), ["en", "es", "hi", "pt", "zh"]);
  for (const l of ["zh", "es", "en", "hi"]) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, `${l}.json`), "utf8"));
    assert.deepEqual(Object.keys(d).sort(), Object.keys(pt).sort(), l);
    for (const k of Object.keys(pt)) {
      const ph = s => (s.match(/\{\w+\}/g) || []).sort().join();
      assert.equal(ph(d[k]), ph(pt[k]), `${l}:${k}`);
      assert.ok(d[k].trim(), `${l}:${k} vazio`);
    }
  }
});

test("i18n: toda chave usada no front existe no dicionário", () => {
  const pt = JSON.parse(fs.readFileSync(path.join(RAIZ, "app/public/os/i18n/pt.json"), "utf8"));
  const arquivos = [];
  const andar = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => e.isDirectory() ? andar(path.join(d, e.name)) : e.name.endsWith(".js") && arquivos.push(path.join(d, e.name)));
  andar(path.join(RAIZ, "app/public/os"));
  const usadas = new Set();
  for (const f of arquivos) {
    const s = fs.readFileSync(f, "utf8");
    for (const m of s.matchAll(/data-t(?:-ph|-title)?="([a-z]+\.[a-zA-Z_.]+)"/g)) usadas.add(m[1]);
    for (const m of s.matchAll(/\bt\("([a-z]+\.[a-zA-Z_.]+)"/g)) usadas.add(m[1]);
  }
  const faltam = [...usadas].filter(k => !k.endsWith(".") && !(k in pt)); // prefixos dinâmicos (ex.: grafo.t.) são cobertos abaixo
  for (const tipo of ["receitas", "pedidos", "agenda", "carteira", "mapa", "comunidade", "assistente", "pagamentos", "nota", "dado"]) assert.ok(`grafo.t.${tipo}` in pt, tipo);
  assert.deepEqual(faltam, []);
});

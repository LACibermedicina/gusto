// GUSTO · testes dos vídeos dos pratos (sem rede, sem banco) · node --test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectarTipo, duracaoMP4, analisarLink, classificar, CURTO_S } from "../app/os/videos.js";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const caixa = (tipo, corpo) => { const b = Buffer.alloc(8); b.writeUInt32BE(8 + corpo.length); b.write(tipo, 4, "latin1"); return Buffer.concat([b, corpo]); };
function mp4(segundos, escala = 1000, versao = 0) {
  const ftyp = caixa("ftyp", Buffer.from("isom\0\0\x02\0isomiso2", "latin1"));
  let mvhd;
  if (versao === 0) { mvhd = Buffer.alloc(100); mvhd[0] = 0; mvhd.writeUInt32BE(escala, 12); mvhd.writeUInt32BE(segundos * escala, 16); }
  else { mvhd = Buffer.alloc(112); mvhd[0] = 1; mvhd.writeUInt32BE(escala, 20); mvhd.writeBigUInt64BE(BigInt(segundos * escala), 24); }
  const free = caixa("free", Buffer.alloc(40));
  const mdat = caixa("mdat", Buffer.alloc(500));
  return Buffer.concat([ftyp, free, mdat, caixa("moov", caixa("mvhd", mvhd))]); // moov no fim, como sai de muitas câmeras
}

test("tipo detectado pelos bytes, não pela extensão", () => {
  assert.equal(detectarTipo(mp4(5)), "video/mp4");
  const qt = mp4(5); qt.write("qt  ", 8, "latin1"); assert.equal(detectarTipo(qt), "video/quicktime");
  assert.equal(detectarTipo(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0])), "video/webm");
  assert.equal(detectarTipo(Buffer.from("<html><script>")), null);
  assert.equal(detectarTipo(Buffer.from("GIF89a....")), null);
});

test("duração de MP4 (mvhd v0 e v1, moov no fim)", async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gusto-vd-"));
  const a = path.join(d, "a.bin"), b = path.join(d, "b.bin"), c = path.join(d, "c.bin");
  fs.writeFileSync(a, mp4(42)); fs.writeFileSync(b, mp4(754, 90000, 1)); fs.writeFileSync(c, Buffer.from("ftyp sem moov"));
  assert.equal(await duracaoMP4(a), 42);
  assert.equal(await duracaoMP4(b), 754);
  assert.equal(await duracaoMP4(c), null);
  fs.rmSync(d, { recursive: true });
});

test("links: YouTube/Vimeo incorporáveis, demais só como link", () => {
  const s = analisarLink("https://youtube.com/shorts/abcdefghijk");
  assert.deepEqual([s.plataforma, s.tipo, s.incorporar], ["youtube", "reel", "https://www.youtube-nocookie.com/embed/abcdefghijk"]);
  assert.equal(analisarLink("https://www.youtube.com/live/abcdefghijk").tipo, "live");
  assert.equal(analisarLink("https://youtu.be/abcdefghijk?t=3").url, "https://www.youtube.com/watch?v=abcdefghijk");
  assert.equal(analisarLink("https://www.youtube.com/watch?v=abcdefghijk").tipo, "tutorial");
  assert.equal(analisarLink("https://vimeo.com/123456789").incorporar, "https://player.vimeo.com/video/123456789");
  const ig = analisarLink("https://www.instagram.com/reel/Cxyz/");
  assert.deepEqual([ig.plataforma, ig.tipo, ig.incorporar], ["instagram", "reel", null]);
  assert.equal(analisarLink("https://www.tiktok.com/@chef/video/1").tipo, "reel");
  assert.equal(analisarLink("https://twitch.tv/chef").tipo, "live");
  for (const ruim of ["http://youtube.com/watch?v=abcdefghijk", "javascript:alert(1)", "https://user:pw@youtube.com/watch?v=abcdefghijk", "https://youtube.com/watch?v=<script>", "nada"])
    assert.equal(analisarLink(ruim), null, ruim);
});

test("acima de 90 s vira live/tutorial", () => {
  assert.equal(classificar("reel", 30), "reel");
  assert.equal(classificar("story", CURTO_S), "story");
  assert.equal(classificar("story", CURTO_S + 1), "tutorial");
  assert.equal(classificar("reel", 400), "tutorial");
  assert.equal(classificar("live", 400), "live");
  assert.equal(classificar("qualquer", null), "reel");
});

test("CSP libera só os players do YouTube sem cookies e do Vimeo; envio em partes isento só no PUT", async () => {
  const { cspOS } = await import("../app/os/index.js");
  assert.deepEqual(cspOS.frameSrc, ["https://www.youtube-nocookie.com", "https://player.vimeo.com"]);
  const srv = fs.readFileSync(path.join(RAIZ, "app/server.js"), "utf8");
  assert.match(srv, /req\.method=="PUT"&&\/\^\\\/os-api\\\/videos\\\/\[0-9a-f-\]\{36\}\\\/parte\$\//);
});

test("chaves de vídeo nos 5 idiomas", () => {
  const pt = JSON.parse(fs.readFileSync(path.join(RAIZ, "app/public/os/i18n/pt.json"), "utf8"));
  const ch = Object.keys(pt).filter(k => k.startsWith("vd."));
  assert.ok(ch.length >= 40);
  for (const l of ["en", "es", "zh", "hi"]) {
    const d = JSON.parse(fs.readFileSync(path.join(RAIZ, `app/public/os/i18n/${l}.json`), "utf8"));
    assert.deepEqual(ch.filter(k => !(k in d)), [], l);
  }
});

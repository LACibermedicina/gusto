// GUSTO · camada OS · ícones 3D estilo "Pixar" (SVG volumétrico + micro-animações em CSS) · by m3d.pro
// Cada glifo usa gradientes radiais com brilho especular e sombra de contato para parecer um objeto de massinha.

const esfera = (id, c1, c2) =>
  `<radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".18" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>`;
const brilho = (cx, cy, rx, ry) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".55"/>`;
const sombra = (cx, cy, rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * .22}" fill="#000" opacity=".18"/>`;

const GLIFOS = {
  grafo: p => `<defs>${esfera(p + "a", "#ffb35c", "#e8590c")}${esfera(p + "b", "#6ee7d8", "#0f9488")}${esfera(p + "c", "#c4a7ff", "#6d3fd6")}
    <linearGradient id="${p}t" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fff7ec"/><stop offset="1" stop-color="#d9c3a8"/></linearGradient></defs>
    ${sombra(32, 57, 22)}
    <path d="M18 40 L32 18 L47 39 Z" fill="none" stroke="url(#${p}t)" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="32" cy="17" r="10" fill="url(#${p}a)"/>${brilho(28.5, 12.5, 3.4, 2)}
    <circle cx="17" cy="41" r="9" fill="url(#${p}b)"/>${brilho(14, 37.5, 3, 1.8)}
    <circle cx="47" cy="41" r="9" fill="url(#${p}c)"/>${brilho(44, 37.5, 3, 1.8)}`,
  notas: p => `<defs><linearGradient id="${p}p" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="#efe2c9"/></linearGradient>
    <linearGradient id="${p}r" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ff8a8a"/><stop offset="1" stop-color="#d63b3b"/></linearGradient>
    <linearGradient id="${p}l" x1="0" x2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#f2a900"/></linearGradient></defs>
    ${sombra(31, 58, 20)}
    <rect x="13" y="12" width="34" height="42" rx="7" fill="url(#${p}p)" stroke="#d8c3a0" stroke-width="1.2"/>
    <rect x="13" y="10" width="34" height="10" rx="5" fill="url(#${p}r)"/>${brilho(22, 13, 6, 1.6)}
    <g stroke="#c9b48f" stroke-width="2.4" stroke-linecap="round"><path d="M20 28h20M20 35h20M20 42h12"/></g>
    <g transform="rotate(38 46 40)"><rect x="42" y="22" width="8" height="26" rx="3.5" fill="url(#${p}l)"/><path d="M42 48 L46 56 L50 48 Z" fill="#f6d2a8"/><path d="M45 53 L46 56 L47 53Z" fill="#3a2a1a"/><rect x="42" y="20" width="8" height="5" rx="2" fill="#ff9aa2"/></g>`,
  comunidade: p => `<defs>${esfera(p + "a", "#7cc4ff", "#1c6fd1")}${esfera(p + "b", "#ffc078", "#e8590c")}</defs>
    ${sombra(32, 58, 22)}
    <path d="M8 22c0-7 6-12 14-12h12c8 0 14 5 14 12s-6 12-14 12h-8l-9 7 2-7c-6-1-11-6-11-12z" fill="url(#${p}a)"/>${brilho(19, 15, 6, 2)}
    <path d="M56 38c0-6-5-10-12-10h-8c-7 0-12 4-12 10s5 10 12 10h5l8 6-2-6c5-1 9-5 9-10z" fill="url(#${p}b)"/>${brilho(36, 32, 5, 1.6)}
    <g fill="#fff"><circle cx="20" cy="22" r="2.4"/><circle cx="28" cy="22" r="2.4"/><circle cx="36" cy="22" r="2.4"/></g>`,
  assistente: p => `<defs>${esfera(p + "h", "#ffd8a8", "#f08c3a")}${esfera(p + "c", "#ffffff", "#dfe3ea")}</defs>
    ${sombra(32, 59, 18)}
    <circle cx="32" cy="38" r="17" fill="url(#${p}h)"/>
    <g fill="url(#${p}c)"><circle cx="22" cy="17" r="7"/><circle cx="32" cy="13" r="8"/><circle cx="42" cy="17" r="7"/><rect x="20" y="17" width="24" height="9" rx="3"/></g>
    <ellipse cx="25" cy="37" rx="4.6" ry="5.6" fill="#fff"/><ellipse cx="39" cy="37" rx="4.6" ry="5.6" fill="#fff"/>
    <circle cx="26" cy="38" r="2.8" fill="#2b2118"/><circle cx="40" cy="38" r="2.8" fill="#2b2118"/>
    <circle cx="27" cy="36.8" r="1" fill="#fff"/><circle cx="41" cy="36.8" r="1" fill="#fff"/>
    <ellipse cx="20" cy="45" rx="3.2" ry="2" fill="#ff8787" opacity=".6"/><ellipse cx="44" cy="45" rx="3.2" ry="2" fill="#ff8787" opacity=".6"/>
    <path d="M27 47 Q32 51 37 47" stroke="#7a3b10" stroke-width="2.2" fill="none" stroke-linecap="round"/>${brilho(26, 27, 5, 2)}`,
  privacidade: p => `<defs><linearGradient id="${p}s" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#8ce99a"/><stop offset="1" stop-color="#2b8a3e"/></linearGradient>
    <linearGradient id="${p}g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#e09f00"/></linearGradient></defs>
    ${sombra(32, 58, 18)}
    <path d="M32 6 L52 13 V30 C52 43 43 51 32 56 C21 51 12 43 12 30 V13 Z" fill="url(#${p}s)"/>
    <path d="M32 9 L49 15 V30 C49 41 41 48 32 52" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>
    <path d="M26 31v-5a6 6 0 0 1 12 0v5" fill="none" stroke="#fff3bf" stroke-width="3.4" stroke-linecap="round"/>
    <rect x="22" y="30" width="20" height="15" rx="4" fill="url(#${p}g)"/><circle cx="32" cy="37" r="2.4" fill="#7a5200"/>${brilho(24, 15, 6, 2.2)}`,
  infograficos: p => `<defs><linearGradient id="${p}c" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#5c2333"/><stop offset="1" stop-color="#2b0f18"/></linearGradient>${esfera(p + "h", "#ffffff", "#dfe3ea")}</defs>
    ${sombra(32, 58, 20)}
    <rect x="10" y="14" width="44" height="40" rx="6" fill="#fffdf7" stroke="#d8c3a0"/>
    <rect x="10" y="14" width="44" height="11" rx="6" fill="url(#${p}c)"/><rect x="15" y="18" width="22" height="3" rx="1.5" fill="#fff"/>
    <g fill="#ffd8a8"><rect x="14" y="29" width="17" height="10" rx="2"/><rect x="33" y="29" width="17" height="10" rx="2"/></g>
    <g fill="#c5f6fa"><rect x="14" y="41" width="17" height="10" rx="2"/><rect x="33" y="41" width="17" height="10" rx="2"/></g>
    <g fill="url(#${p}h)"><circle cx="44" cy="10" r="5"/><circle cx="50" cy="8" r="5.5"/><circle cx="56" cy="10" r="5"/><rect x="43" y="10" width="14" height="5" rx="2"/></g>`,
  cozinha: p => `<defs>${esfera(p + "a", "#868e96", "#212529")}<linearGradient id="${p}c" x1="0" x2="1"><stop offset="0" stop-color="#ffa94d"/><stop offset="1" stop-color="#d9480f"/></linearGradient></defs>
    ${sombra(30, 58, 22)}
    <ellipse cx="28" cy="38" rx="20" ry="13" fill="url(#${p}a)"/><ellipse cx="28" cy="35" rx="16" ry="9" fill="#343a40"/>
    <rect x="44" y="33" width="18" height="6" rx="3" transform="rotate(-12 44 36)" fill="url(#${p}c)"/>
    <ellipse cx="24" cy="34" rx="6" ry="4" fill="#fff"/><circle cx="25" cy="34" r="2.6" fill="#ffd43b"/>
    <path d="M18 22 q4 -6 0 -12 M28 20 q4 -6 0 -12 M38 22 q4 -6 0 -12" stroke="#ced4da" stroke-width="2.4" fill="none" stroke-linecap="round"/>${brilho(20, 30, 5, 1.6)}`,
  sobre: p => `<defs>${esfera(p + "a", "#91a7ff", "#3b5bdb")}</defs>
    ${sombra(32, 58, 18)}<circle cx="32" cy="31" r="21" fill="url(#${p}a)"/>${brilho(24, 20, 7, 3)}
    <circle cx="32" cy="21" r="3.6" fill="#fff"/><rect x="28.5" y="28" width="7" height="17" rx="3.5" fill="#fff"/>`,
  conta: p => `<defs>${esfera(p + "a", "#ffd8a8", "#e8590c")}${esfera(p + "b", "#ffa94d", "#c2410c")}</defs>
    ${sombra(32, 58, 20)}<circle cx="32" cy="23" r="11" fill="url(#${p}a)"/>${brilho(28, 18, 3.6, 2)}
    <path d="M12 54c0-11 9-18 20-18s20 7 20 18z" fill="url(#${p}b)"/>${brilho(24, 41, 5, 1.6)}`
};

export const CORES = {
  grafo: ["#fff4e6", "#ffd8a8"], notas: ["#fff9db", "#ffe8a3"], comunidade: ["#e7f5ff", "#a5d8ff"],
  assistente: ["#fff0f6", "#ffc9de"], infograficos: ["#fff5f5", "#e9b8c2"], cozinha: ["#fff4e6", "#ffc078"], privacidade: ["#ebfbee", "#b2f2bb"], sobre: ["#edf2ff", "#bac8ff"], conta: ["#fff4e6", "#ffc078"]
};

let seq = 0;
/** Retorna o SVG do glifo (ids únicos por instância). */
export function glifo(nome) {
  const p = "osg" + nome + (seq++);
  return `<svg class="os-glifo" viewBox="0 0 64 64" aria-hidden="true">${(GLIFOS[nome] || GLIFOS.sobre)(p)}</svg>`;
}

/** Bloco completo do ícone: azulejo "squircle" + glifo + reflexo. */
export function icone(nome) {
  const [c1, c2] = CORES[nome] || CORES.sobre;
  return `<span class="os-icone" style="--c1:${c1};--c2:${c2}"><span class="os-icone-base"></span>${glifo(nome)}<span class="os-icone-brilho"></span></span>`;
}

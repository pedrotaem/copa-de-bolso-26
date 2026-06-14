/* pixelart.js — gera arte pixel por atleta.
   Dois usos:
     1) retrato grande (cabeça+ombros) para o draft / modal de seleção  -> faceToCanvas()
     2) features de cabeça (pele/cabelo/barba) p/ o sprite do tabuleiro -> getFeatures().head
   Procedural e parametrizado: cada atleta tem pele, cabelo (cor+estilo), barba e faixa.
*/

/* ---- paletas ---- */
const SKIN = {
  escura:  { base: "#5A3B28", som: "#452D1E", luz: "#6E4A33" },
  morena:  { base: "#7A4F35", som: "#5F3D29", luz: "#8E5E40" },
  parda:   { base: "#A86C42", som: "#86532F", luz: "#BE7E50" },
  media:   { base: "#D89B6A", som: "#B97E52", luz: "#E8B488" },
  clara:   { base: "#F0C39A", som: "#D6A47B", luz: "#F7D6B5" },
  palida:  { base: "#F5D5B5", som: "#E0BB98", luz: "#FCE4CC" },
};
const HAIR = {
  preto:     "#15110D",
  castEsc:   "#2A1B12",
  castanho:  "#4A3220",
  castClaro: "#6E4A28",
  loiro:     "#C9A24B",
  loiroEsc:  "#9B7A3A",
  grisalho:  "#8A8278",
};

/* features explícitas dos atletas reais (figurinhas exemplo) */
export const FEATURES = {
  // Antonio Rüdiger — pele escura, cabeça raspada, barba cheia, faixa branca
  rudiger_de:      { skin: "escura", hair: "preto",    style: "raspado", beard: "cheia",   band: "#FFFFFF" },
  // Felix Nmecha — pele morena, cabelo curto crespo, barba por fazer
  nmecha_de:       { skin: "morena", hair: "preto",    style: "crespo",  beard: "porfazer" },
  // Nico Schlotterbeck — pele clara, cabelo castanho médio, barba por fazer
  schlotterbeck_de:{ skin: "clara",  hair: "castClaro",style: "medio",   beard: "porfazer" },
  // Nick Woltemade — pele clara, cabelo castanho curto, leve barba
  woltemade_de:    { skin: "clara",  hair: "castanho", style: "curto",   beard: "porfazer" },
  // Maximilian Mittelstädt — pele clara, cabelo castanho, barba curta
  mittelstadt_de:  { skin: "media",  hair: "castanho", style: "curto",   beard: "curta" },
  // Marc-André ter Stegen — goleiro, pele clara, cabelo castanho, barba cheia
  terstegen_de:    { skin: "clara",  hair: "castanho", style: "curto",   beard: "cheia" },
  // Jamal Musiala — pele morena, cabelo preto curto, sem barba
  musiala_de:      { skin: "morena", hair: "preto",    style: "curto",   beard: "nenhuma" },
  // Leon Goretzka — pele clara, undercut castanho escuro, barba por fazer
  goretzka_de:     { skin: "clara",  hair: "castEsc",  style: "undercut",beard: "porfazer" },
};

/* fallback determinístico p/ os demais atletas (sem foto) */
const STYLES = ["curto", "medio", "raspado", "crespo", "undercut"];
const BEARDS = ["nenhuma", "porfazer", "curta", "cheia", "bigode"];
const SKINS  = ["clara", "media", "parda", "morena", "palida", "escura"];
const HAIRS  = ["preto", "castEsc", "castanho", "castClaro", "loiro", "grisalho"];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

/* retorna {skin, hair, style, beard, band, c1, c2} resolvidos em cores */
export function getFeatures(a) {
  let f = FEATURES[a.id];
  if (!f) {
    const h = hash(a.id);
    f = {
      skin:  SKINS[h % SKINS.length],
      hair:  HAIRS[(h >> 3) % HAIRS.length],
      style: STYLES[(h >> 6) % STYLES.length],
      beard: a.pos === "GOL" ? "curta" : BEARDS[(h >> 9) % BEARDS.length],
    };
  }
  const skin = SKIN[f.skin] || SKIN.media;
  const hair = HAIR[f.hair] || HAIR.castanho;
  return {
    skin, hair, style: f.style, beard: f.beard || "nenhuma",
    band: f.band || null,
    c1: a.cor1 || "#FFFFFF",
    c2: a.cor2 || "#1B1A17",
  };
}

/* ---- construção do grid do rosto (16 larg x 18 alt) ---- */
const W = 16, H = 18;

function blank() {
  return Array.from({ length: H }, () => Array(W).fill(null));
}
function rowFill(g, r, c0, c1, color) {
  for (let c = c0; c <= c1; c++) if (c >= 0 && c < W && r >= 0 && r < H) g[r][c] = color;
}

function buildFaceGrid(F) {
  const g = blank();
  const sk = F.skin.base, skS = F.skin.som, skL = F.skin.luz;
  const hr = F.hair;
  const beardColor = mix(hr, skS);

  // --- rosto (máscara oval) ---
  rowFill(g, 4, 5, 10, sk);
  rowFill(g, 5, 4, 11, sk);
  rowFill(g, 6, 4, 11, sk);
  rowFill(g, 7, 4, 11, sk);
  rowFill(g, 8, 4, 11, sk);
  rowFill(g, 9, 4, 11, sk);
  rowFill(g, 10, 5, 10, sk);
  rowFill(g, 11, 5, 10, sk);
  rowFill(g, 12, 6, 9, sk);
  // orelhas
  g[7][3] = skS; g[7][12] = skS;
  g[8][3] = skS; g[8][12] = skS;
  // sombreado lateral do rosto
  g[5][4] = skS; g[6][4] = skS; g[7][4] = skS; g[8][4] = skS;
  g[5][11] = skL; g[6][11] = skL;

  // --- cabelo por estilo ---
  switch (F.style) {
    case "raspado": // pele do crânio escurecida, leve sombra de cabelo
      rowFill(g, 3, 5, 10, mix(hr, sk));
      rowFill(g, 4, 4, 11, mix(hr, sk));
      g[4][4] = hr; g[4][11] = hr;
      break;
    case "crespo": // afro curto e arredondado
      rowFill(g, 0, 5, 10, hr);
      rowFill(g, 1, 4, 11, hr);
      rowFill(g, 2, 3, 12, hr);
      rowFill(g, 3, 3, 12, hr);
      rowFill(g, 4, 3, 4, hr); rowFill(g, 4, 11, 12, hr);
      g[5][3] = hr; g[6][3] = hr; g[5][12] = hr;
      break;
    case "undercut": // topo cheio, laterais raspadas
      rowFill(g, 1, 5, 10, hr);
      rowFill(g, 2, 4, 11, hr);
      rowFill(g, 3, 4, 11, hr);
      rowFill(g, 4, 5, 10, hr);
      g[4][4] = mix(hr, sk); g[4][11] = mix(hr, sk);
      g[5][4] = mix(hr, sk); g[5][11] = mix(hr, sk);
      break;
    case "medio": // cabelo mais volumoso, cobre testa e laterais
      rowFill(g, 0, 6, 9, hr);
      rowFill(g, 1, 4, 11, hr);
      rowFill(g, 2, 3, 12, hr);
      rowFill(g, 3, 3, 12, hr);
      rowFill(g, 4, 3, 5, hr); rowFill(g, 4, 10, 12, hr);
      g[5][4] = hr; g[5][11] = hr; g[6][4] = hr; g[6][11] = hr;
      break;
    case "curto":
    default:
      rowFill(g, 1, 6, 9, hr);
      rowFill(g, 2, 4, 11, hr);
      rowFill(g, 3, 4, 11, hr);
      g[4][4] = hr; g[4][11] = hr;
      g[5][4] = mix(hr, skS); g[5][11] = mix(hr, skS);
      break;
  }

  // --- faixa de cabeça ---
  if (F.band) {
    rowFill(g, 4, 4, 11, F.band);
    g[4][3] = F.band; g[4][12] = F.band;
  }

  // --- sobrancelhas ---
  const brow = mix(hr, "#000000");
  g[6][5] = brow; g[6][6] = brow;
  g[6][9] = brow; g[6][10] = brow;

  // --- olhos ---
  g[7][5] = "#FFFFFF"; g[7][6] = "#1B1A17";
  g[7][9] = "#1B1A17"; g[7][10] = "#FFFFFF";

  // --- nariz ---
  g[8][7] = skS; g[8][8] = skS; g[9][8] = skS;

  // --- boca ---
  rowFill(g, 10, 6, 9, "#8E4B40");

  // --- barba ---
  switch (F.beard) {
    case "cheia":
      rowFill(g, 9, 4, 11, beardColor);
      rowFill(g, 10, 4, 11, beardColor);
      rowFill(g, 11, 4, 11, beardColor);
      rowFill(g, 12, 5, 10, beardColor);
      g[13] && rowFill(g, 13, 6, 9, beardColor);
      // mantém boca visível
      rowFill(g, 10, 6, 9, "#8E4B40");
      break;
    case "curta":
      rowFill(g, 11, 5, 10, mix(beardColor, sk));
      rowFill(g, 12, 6, 9, beardColor);
      g[10][5] = mix(beardColor, sk); g[10][10] = mix(beardColor, sk);
      break;
    case "porfazer":
      rowFill(g, 11, 6, 9, mix(sk, beardColor));
      g[12][7] = mix(sk, beardColor); g[12][8] = mix(sk, beardColor);
      g[10][5] = mix(sk, beardColor); g[10][10] = mix(sk, beardColor);
      break;
    case "bigode":
      g[9][6] = beardColor; g[9][7] = beardColor; g[9][8] = beardColor; g[9][9] = beardColor;
      break;
    default: break; // nenhuma
  }

  // --- pescoço ---
  rowFill(g, 13, 6, 9, skS);

  // --- camisa / ombros ---
  const C = F.c1, col = F.c2;
  rowFill(g, 14, 3, 12, C);
  rowFill(g, 15, 2, 13, C);
  rowFill(g, 16, 1, 14, C);
  rowFill(g, 17, 1, 14, C);
  // gola
  g[14][7] = col; g[14][8] = col;
  g[15][6] = col; g[15][9] = col;
  // sombra de ombro
  g[16][1] = mix(C, "#000000"); g[16][14] = mix(C, "#000000");

  return g;
}

/* mistura simples de 2 cores hex (média) */
function mix(a, b) {
  const pa = hex(a), pb = hex(b);
  const r = (pa[0] + pb[0]) >> 1, gg = (pa[1] + pb[1]) >> 1, bl = (pa[2] + pb[2]) >> 1;
  return "#" + [r, gg, bl].map(v => v.toString(16).padStart(2, "0")).join("");
}
function hex(h) {
  h = h.replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/* atletas com retrato em imagem (pixel art externa, fundo já removido).
   Caminho relativo à raiz do site. */
export const IMG_OVERRIDE = {
  rudiger_de: "assets/rudiger.png",
  // Seleção brasileira 2026 — recortes com fundo removido (assets/atletas-br/)
  alisson:      "assets/atletas-br/alisson.png",
  bento:        "assets/atletas-br/bento.png",
  militao:      "assets/atletas-br/militao.png",
  gmagalhaes:   "assets/atletas-br/gmagalhaes.png",
  marquinhos:   "assets/atletas-br/marquinhos.png",
  danilo:       "assets/atletas-br/danilo.png",
  wesley:       "assets/atletas-br/wesley.png",
  casemiro:     "assets/atletas-br/casemiro.png",
  brunoguim:    "assets/atletas-br/brunoguim.png",
  paqueta:      "assets/atletas-br/paqueta.png",
  vinijr:       "assets/atletas-br/vinijr.png",
  raphinha:     "assets/atletas-br/raphinha.png",
  estevao:      "assets/atletas-br/estevao.png",
  martinelli:   "assets/atletas-br/martinelli.png",
  cunha:        "assets/atletas-br/cunha.png",
  luizhenrique: "assets/atletas-br/luizhenrique.png",
};

/* retorna o elemento de retrato (canvas procedural OU img de arte externa).
   px = tamanho de cada pixel-art unit (ignorado p/ imagens).
   opts.transparent = sem fundo bege (p/ usar como token no tabuleiro). */
export function faceToCanvas(athlete, px = 8, opts = {}) {
  const url = IMG_OVERRIDE[athlete.id];
  if (url) {
    const img = document.createElement("img");
    img.className = "pixelart pixelart--img";
    img.alt = athlete.nome;
    img.src = url;
    return img;
  }
  const F = getFeatures(athlete);
  const g = buildFaceGrid(F);
  const cv = document.createElement("canvas");
  cv.width = W * px;
  cv.height = H * px;
  cv.className = "pixelart";
  const ctx = cv.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (!opts.transparent) {
    // fundo: gradiente pixelado discreto
    ctx.fillStyle = "#F3ECD8";
    ctx.fillRect(0, 0, cv.width, cv.height);
  }
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const color = g[r][c];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(c * px, r * px, px, px);
    }
  }
  return cv;
}

/* token pré-renderizado e cacheado p/ desenhar no tabuleiro (canvas 2D).
   Para imagens externas, devolve o <img> (desenha quando carregar). */
const _tokenCache = new Map();
export function athleteToken(athlete) {
  const id = athlete.id;
  if (_tokenCache.has(id)) return _tokenCache.get(id);
  const el = faceToCanvas(athlete, 3, { transparent: true });
  _tokenCache.set(id, el);
  return el;
}

export { buildFaceGrid, W as FACE_W, H as FACE_H };

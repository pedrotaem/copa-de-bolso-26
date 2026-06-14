/* render.js — desenha o estado da partida num canvas 2D em pixel art.
   Sprites são desenhados via grids 8x12 de "pixels" com cores do atleta. */

import { CAMPO_W, CAMPO_H, GOL_W, RAIO_BOLA } from "./sim.js";
import { athleteToken } from "../data/pixelart.js";

/* token desenhável? (canvas sempre; img só depois de carregar) */
function tokenPronto(el) {
  if (!el) return false;
  if (el.tagName === "IMG") return el.complete && el.naturalWidth > 0;
  return true;
}

/* Sprite atleta pixel art — corpo simples 8x12 em "pixels" lógicos.
   Cada "pixel" = 2 unidades de canvas (P = 2). Centramos no jogador. */
const P = 2; // tamanho de cada pixel-art unit em canvas

// Templates:
//  - linha 0..1 = cabelo (escuro)
//  - linha 2..3 = rosto
//  - linha 4..6 = camisa
//  - linha 7    = cinto / mistura
//  - linha 8..9 = shorts
//  - linha 10..11 = pernas
const SK0 = "#F2C896"; // pele padrão
const HR0 = "#1E1815"; // cabelo padrão
const BT = "#101010"; // botas
const SH = "#1B1A17"; // shorts (default escuro)

function mix2(a, b) {
  const pa = toRgb(a), pb = toRgb(b);
  return "#" + [0,1,2].map(i => (((pa[i]+pb[i])>>1)).toString(16).padStart(2,"0")).join("");
}
function toRgb(h) {
  h = h.replace("#","");
  if (h.length === 3) h = h.split("").map(c=>c+c).join("");
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

// sprite 8x12 — usa features do atleta (pele/cabelo/barba) quando disponíveis
function spritePixels(camisa, shorts, feat) {
  const C = camisa;
  const S = shorts || SH;
  const SK = (feat && feat.skin && feat.skin.base) || SK0;
  const HR = (feat && feat.hair) || HR0;
  const temBarba = feat && feat.beard && feat.beard !== "nenhuma";
  // linha 3 = queixo: vira barba (mistura cabelo+pele) se houver
  const J = temBarba ? mix2(HR, SK) : SK;
  const _ = null;
  return [
    [_,_,HR,HR,HR,HR,_,_],
    [_,HR,HR,HR,HR,HR,HR,_],
    [_,HR,SK,SK,SK,SK,HR,_],
    [_,_,J ,SK,SK,J ,_,_],
    [_,C ,C ,C ,C ,C ,C ,_],
    [C ,C ,C ,C ,C ,C ,C ,C ],
    [C ,C ,C ,C ,C ,C ,C ,C ],
    [_,C ,C ,S ,S ,C ,C ,_],
    [_,S ,S ,S ,S ,S ,S ,_],
    [_,S ,S ,S ,S ,S ,S ,_],
    [_,SK,SK,_,_,SK,SK,_],
    [_,BT,BT,_,_,BT,BT,_],
  ];
}

export function desenharPartida(ctx, P_sim) {
  desenharCampo(ctx);
  // sombras (jogadores + juízes) primeiro
  for (const j of P_sim.jogadores) sombra(ctx, j.x, j.y, 9);
  if (P_sim.juizes) for (const r of P_sim.juizes) sombra(ctx, r.x, r.y, 7);
  // juízes atrás dos jogadores
  if (P_sim.juizes) for (const r of P_sim.juizes) desenharJuiz(ctx, r);
  // jogadores
  for (const j of P_sim.jogadores) desenharJogador(ctx, j, P_sim);
  // bola
  desenharBola(ctx, P_sim.bola);
}

function sombra(ctx, x, y, rx) {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 9, rx, 3, 0, 0, Math.PI * 2);
  ctx.fill();
}

/* árbitro (preto) e bandeirinhas (preto + bandeira amarelo/vermelho) */
function desenharJuiz(ctx, r) {
  const camisa = "#161616", shorts = "#161616";
  const px = spritePixels(camisa, shorts, null);
  const startX = r.x - 8, startY = r.y - 12;
  for (let row = 0; row < px.length; row++) {
    for (let col = 0; col < px[row].length; col++) {
      const c = px[row][col];
      if (!c) continue;
      // detalhe amarelo na gola do árbitro de campo
      ctx.fillStyle = (r.tipo === "campo" && row === 4) ? "#F5B11E" : c;
      ctx.fillRect(startX + col * P, startY + row * P, P, P);
    }
  }
  if (r.tipo === "linha") {
    // bandeira xadrez amarelo/vermelho
    const fx = r.lado === "esq" ? r.x - 16 : r.x + 10;
    const fy = r.y - 14;
    ctx.fillStyle = "#161616";
    ctx.fillRect(r.lado === "esq" ? r.x - 10 : r.x + 8, fy, 2, 16); // haste
    ctx.fillStyle = "#F5B11E"; ctx.fillRect(fx, fy, 6, 6);
    ctx.fillStyle = "#E2342B"; ctx.fillRect(fx + 6, fy, 6, 6);
    ctx.fillStyle = "#E2342B"; ctx.fillRect(fx, fy + 6, 6, 6);
    ctx.fillStyle = "#F5B11E"; ctx.fillRect(fx + 6, fy + 6, 6, 6);
  }
}

function desenharCampo(ctx) {
  const W = CAMPO_W, H = CAMPO_H;
  // listras
  const stripes = 12;
  const sh = H / stripes;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? "#0E2417" : "#1D4A2E";
    ctx.fillRect(0, i * sh, W, sh);
  }
  // linhas brancas
  ctx.strokeStyle = "#EDE7D6";
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.beginPath(); ctx.moveTo(4, H / 2); ctx.lineTo(W - 4, H / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 60, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, H / 2, 3, 0, Math.PI * 2); ctx.fill();

  // áreas
  ctx.strokeRect(W / 2 - 130, 4, 260, 90);     // grande área de cima (ADV)
  ctx.strokeRect(W / 2 - 60, 4, 120, 40);      // pequena área cima
  ctx.strokeRect(W / 2 - 130, H - 94, 260, 90); // grande área baixo (MEU)
  ctx.strokeRect(W / 2 - 60, H - 44, 120, 40); // pequena área baixo

  // gol (visual fora do campo)
  ctx.fillStyle = "#EDE7D6";
  ctx.fillRect(W / 2 - GOL_W / 2, -3, GOL_W, 5);
  ctx.fillRect(W / 2 - GOL_W / 2, H - 2, GOL_W, 5);
}

/* sprite procedural 8x12 (fallback enquanto a imagem do atleta não carrega) */
function desenharSpriteProc(ctx, j) {
  const px = spritePixels(j.cor1 || "#fff", j.cor2 || SH, j.feat);
  const startX = j.x - 8, startY = j.y - 12;
  for (let row = 0; row < px.length; row++) {
    for (let col = 0; col < px[row].length; col++) {
      const c = px[row][col];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(startX + col * P, startY + row * P, P, P);
    }
  }
}

function desenharJogador(ctx, j, P_sim) {
  // pixel art do atleta como token no tabuleiro (fallback: sprite procedural)
  const token = athleteToken(j);
  if (tokenPronto(token)) {
    const w = 34, h = 36;          // maior, p/ identificar o atleta
    const topo = j.y - h + 9;      // ancora a cabeça acima do ponto do jogador
    ctx.imageSmoothingEnabled = false;
    // halo da cor do time atrás do token (já identifica o lado)
    ctx.fillStyle = j.time === "MEU" ? "rgba(57,255,122,0.22)" : "rgba(226,52,43,0.22)";
    ctx.beginPath();
    ctx.ellipse(j.x, j.y - 6, 17, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    // recorta a parte de cima da arte (rosto/cabeça) e amplia => foco no rosto
    const sw = token.naturalWidth || token.width;
    const sh = token.naturalHeight || token.height;
    const sx = sw * 0.12, sCropW = sw * 0.76;   // tira margens laterais
    const sy = 0, sCropH = sh * 0.60;            // só o terço superior (cabeça)
    try {
      ctx.drawImage(token, sx, sy, sCropW, sCropH, j.x - w / 2, topo, w, h);
    } catch (e) { desenharSpriteProc(ctx, j); }
  } else {
    desenharSpriteProc(ctx, j);
  }
  // indicador "tem a bola"
  if (P_sim && P_sim.bola.dono === j.id) {
    ctx.strokeStyle = "#F5B11E";
    ctx.lineWidth = 2;
    ctx.strokeRect(j.x - 16, j.y - 28, 32, 36);
  }
  // cartão amarelo pendurado (advertido)
  if (j.amarelos >= 1) {
    ctx.fillStyle = "#161616";
    ctx.fillRect(j.x + 12, j.y - 30, 5, 7);
    ctx.fillStyle = "#F5B11E";
    ctx.fillRect(j.x + 13, j.y - 29, 3, 5);
  }
}

function desenharBola(ctx, b) {
  // sombra
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(b.x, b.y + 6, 5, 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // bola pixel
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(b.x - 4, b.y - 4, 8, 8);
  ctx.fillStyle = "#1B1A17";
  ctx.fillRect(b.x - 2, b.y - 2, 2, 2);
  ctx.fillRect(b.x, b.y - 2, 2, 2);
  ctx.fillRect(b.x - 4, b.y, 2, 2);
  ctx.fillRect(b.x + 2, b.y, 2, 2);
}

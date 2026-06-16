/* sim.js — Motor de simulação da partida.
   Sistema de coordenadas: campo W x H (pixels). 0,0 = topo-esquerda.
   Nosso time joga atacando pra baixo (y crescente). Adversário ataca pra cima.
   Cada tick = 1 frame; usamos requestAnimationFrame externamente. */

import { makeRng } from "../util/state.js";
import { ATLETAS } from "../data/athletes.js";
import { getFeatures } from "../data/pixelart.js";
import { FORMACOES, espelhar } from "../data/formacoes.js";

export const CAMPO_W = 600;
export const CAMPO_H = 800;
export const GOL_W = 160; // largura do gol
export const RAIO_JOGADOR = 8;
export const RAIO_BOLA = 4;

// 1s real = 30s jogo. 60fps => 60 ticks/s. 60 * 30 = 1800 ticks por minuto de jogo.
// Para 90 minutos: 90 * 60 = 5400 segundos de jogo / 30 = 180 segundos reais a 1x.
// Vamos com 30fps no canvas, então 30 ticks/s, e 1 tick = 1s jogo.
// Logo: 90 min = 5400s jogo = 5400 ticks ≈ 180s a 30fps. (Pedro confirmou 3 min reais p/ 90 min.)
export const TICKS_POR_MIN = 60;       // 60 ticks = 1 minuto de jogo
export const DURACAO_TICKS = 90 * TICKS_POR_MIN; // 5400 ticks no total
export const INTERVALO_TICK = 45 * TICKS_POR_MIN; // intervalo no minuto 45
// goleiro segura no máx. 16s reais. 30 ticks = 1s real (5400 ticks = 90min ≈ 3min reais).
export const GK_HOLD_MAX = 16 * 30; // 480 ticks

/* Cria estado de uma partida nova */
export function novaPartida({ meuTime, adversario, seed }) {
  const rng = makeRng(seed || Date.now());

  // monta jogadores: meu time (titulares) com posição alvo da formação
  const meuForm = FORMACOES[meuTime.formacao].slots;
  const advForm = espelhar(FORMACOES[adversario.formacao].slots);

  const meuJogs = meuTime.titulares.slice(0, 11).map((id, i) => {
    const a = ATLETAS.find(x => x.id === id);
    const slot = meuForm[i];
    return mkJogador(a, "MEU", slot, i, meuTime);
  });
  const advJogs = adversario.jogadores.slice(0, 11).map((a, i) => {
    const slot = advForm[i];
    return mkJogador(a, "ADV", slot, i, adversario);
  });

  return {
    rng,
    tick: 0,
    paused: false,
    velocidade: 1, // 1x / 2x / 4x
    estado: "primeiro_tempo", // primeiro_tempo | intervalo | segundo_tempo | fim
    meuTime, adversario,
    jogadores: [...meuJogs, ...advJogs],
    juizes: mkJuizes(),            // 1 árbitro de campo + 2 assistentes de linha
    bola: { x: CAMPO_W / 2, y: CAMPO_H / 2, vx: 0, vy: 0, dono: null },
    paradaAte: 0,                  // tick até o qual o jogo fica parado (falta/cartão)
    placar: { MEU: 0, ADV: 0 },
    eventos: [],
    stats: {
      MEU: { posseTicks: 0, chutes: 0, chutesNoGol: 0, gols: [], faltas: 0, amarelos: 0, vermelhos: 0 },
      ADV: { posseTicks: 0, chutes: 0, chutesNoGol: 0, gols: [], faltas: 0, amarelos: 0, vermelhos: 0 },
    },
    pendingKickoff: null, // {time:"MEU"|"ADV", at:tick}
  };
}

/* árbitro central + 2 bandeirinhas (sistema diagonal) */
function mkJuizes() {
  return [
    { tipo: "campo", x: CAMPO_W / 2, y: CAMPO_H / 2, vx: 0, vy: 0 },
    { tipo: "linha", lado: "esq", x: 6, y: CAMPO_H * 0.30, vx: 0, vy: 0 },
    { tipo: "linha", lado: "dir", x: CAMPO_W - 6, y: CAMPO_H * 0.70, vx: 0, vy: 0 },
  ];
}

function mkJogador(a, time, slot, idx, timeInfo) {
  const fy = time === "MEU" ? slot.y : slot.y; // já espelhado se ADV
  // semente determinística por jogador → movimento independente (sem sincronia robótica)
  const semente = (hashStr(a.id + time + idx) % 1000) / 1000;
  return {
    id: a.id, idx,
    nome: a.nome,
    pos: a.pos,
    time,
    atr: { ...a.atr },
    cor1: a.cor1 || timeInfo.cor1 || "#fff",
    cor2: a.cor2 || timeInfo.cor2 || "#000",
    feat: getFeatures(a),
    x: slot.x * CAMPO_W,
    y: fy * CAMPO_H,
    homeX: slot.x * CAMPO_W,
    homeY: fy * CAMPO_H,
    vx: 0, vy: 0,
    fadiga: 0,           // 0 = 100%, 50 = fadigado, 100 = exausto
    cooldown: Math.floor(semente * 14), // decisões defasadas entre si (anti-lockstep)
    tackleCd: 0,         // frames até poder tentar novo desarme
    estado: "idle",      // idle | perseguir | com_bola | apoio | voltar | comemorar
    overall: a.overall || 75,
    // personalidade de movimento (independente por atleta)
    wx: 0, wy: 0,                    // deriva (wander) pessoal, random-walk
    faseW: semente * Math.PI * 2,    // fase do passo de deriva
    atrair: 0.22 + semente * 0.20,   // o quanto segue a bola quando fora da jogada
    discipl: discById(a.pos),        // o quanto respeita a própria zona (0..1)
    amarelos: 0,
    expulso: false,
    subiu: false,        // goleiro que subiu pro ataque no fim
  };
}

/* hash simples p/ semente determinística */
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/* disciplina posicional por posição: goleiro é o mais preso à zona */
function discById(pos) {
  return { GOL: 0.98, ZAG: 0.80, LAT: 0.66, MEI: 0.55, ATA: 0.48 }[pos] ?? 0.6;
}

/* faixa de profundidade (fração do campo a partir do próprio gol) por posição.
   Define a zona probabilística onde o atleta passa a maior parte do jogo. */
const FAIXA_POS = {
  GOL: [0.00, 0.13],
  ZAG: [0.02, 0.45],
  LAT: [0.05, 0.62],
  MEI: [0.18, 0.82],
  ATA: [0.40, 0.97],
};

/* converte faixa de profundidade em y absoluto conforme o lado que o time defende.
   MEU defende o topo (y pequeno) e ataca pra baixo; ADV o oposto. */
function zonaY(time, pos) {
  const [a, b] = FAIXA_POS[pos] || [0.1, 0.9];
  if (time === "MEU") return [a * CAMPO_H, b * CAMPO_H];
  return [(1 - b) * CAMPO_H, (1 - a) * CAMPO_H];
}

/* faixa lateral: laterais ficam no seu corredor; goleiro no miolo da área */
function zonaX(j) {
  if (j.pos === "GOL") return [CAMPO_W / 2 - 120, CAMPO_W / 2 + 120];
  if (j.pos === "LAT") {
    return j.homeX < CAMPO_W / 2 ? [0, CAMPO_W * 0.46] : [CAMPO_W * 0.54, CAMPO_W];
  }
  return [8, CAMPO_W - 8];
}

/* Avança 1 tick. Retorna o estado atualizado (mutável). */
export function tickSim(P) {
  if (P.estado === "fim") return P;
  if (P.paused) return P;

  // Transição metade/fim
  if (P.estado === "primeiro_tempo" && P.tick === INTERVALO_TICK) {
    P.estado = "intervalo";
    P.eventos.push({ minuto: 45, tipo: "intervalo", texto: "Intervalo." });
    // pausa breve auto
    P.pendingKickoff = { time: P.bola.dono?.startsWith("ADV") ? "MEU" : "ADV", at: P.tick + 60 };
    resetKickoff(P);
  }
  if (P.estado === "intervalo" && P.pendingKickoff && P.tick >= P.pendingKickoff.at) {
    P.estado = "segundo_tempo";
    P.pendingKickoff = null;
  }
  if (P.estado === "segundo_tempo" && P.tick >= DURACAO_TICKS) {
    P.estado = "fim";
    P.eventos.push({ minuto: 90, tipo: "fim", texto: "Fim de jogo." });
    return P;
  }

  if (P.estado === "primeiro_tempo" || P.estado === "segundo_tempo") {
    const parado = P.tick < P.paradaAte; // jogo parado p/ falta marcada
    decidirEMover(P, parado);
    moverJuizes(P);
    if (!parado) {
      moverBola(P);
      verificarGol(P);
    }
    P.tick++;
  } else {
    moverJuizes(P);
    P.tick++;
  }
  return P;
}

function decidirEMover(P, parado) {
  for (const j of P.jogadores) {
    j.cooldown = Math.max(0, j.cooldown - 1);
    j.tackleCd = Math.max(0, j.tackleCd - 1);
    j.fadiga = Math.min(100, j.fadiga + 0.005);

    // deriva pessoal (random-walk independente) — quebra a sincronia robótica
    atualizarWander(P, j);

    const dono = P.bola.dono ? P.jogadores.find(x => x.id === P.bola.dono) : null;
    let alvo;
    if (parado) {
      alvo = { x: j.homeX, y: j.homeY, livre: false };
    } else {
      alvo = alvoDoJogador(P, j, dono);
    }
    aplicarZona(P, j, alvo);          // prende probabilisticamente à zona da posição
    moverPara(P, j, alvo, parado);
  }
  if (!parado) disputas(P);           // desarmes & faltas
}

/* deriva lenta e independente por jogador */
function atualizarWander(P, j) {
  j.faseW += 0.05 + (j.atrair - 0.22) * 0.1;
  const amp = j.pos === "GOL" ? 3 : 9;
  // alvo de deriva oscilante + ruído próprio (rng chamado por jogador => valores distintos)
  j.wx += (Math.cos(j.faseW) * amp - j.wx) * 0.08 + (P.rng() - 0.5) * 0.6;
  j.wy += (Math.sin(j.faseW * 0.8) * amp - j.wy) * 0.08 + (P.rng() - 0.5) * 0.6;
  const lim = j.pos === "GOL" ? 6 : 16;
  j.wx = Math.max(-lim, Math.min(lim, j.wx));
  j.wy = Math.max(-lim, Math.min(lim, j.wy));
}

/* decide o alvo (x,y) de um jogador conforme o contexto da bola */
function alvoDoJogador(P, j, dono) {
  const dir = j.time === "MEU" ? 1 : -1; // sentido de ataque
  const taticaTime = j.time === "MEU" ? P.meuTime.tatica : P.adversario.tatica;
  const distBola = Math.hypot(P.bola.x - j.x, P.bola.y - j.y);

  // ---- goleiro: 95% do jogo dentro da área (ver aplicarZona) ----
  if (j.pos === "GOL") {
    if (dono === j) {
      j.estado = "com_bola";
      j.gkHold = (j.gkHold || 0) + 1;
      // distribui quando livre do cooldown OU força a saída no limite de 16s reais
      if (j.cooldown === 0 || j.gkHold >= GK_HOLD_MAX) gkDistribuir(P, j);
    } else {
      j.gkHold = 0;
    }
    return alvoGoleiro(P, j, dir);
  }

  // ---- com a bola ----
  if (dono === j) {
    j.estado = "com_bola";
    if (j.cooldown === 0) decidirAcaoComBola(P, j);
    return {
      x: CAMPO_W / 2 + (j.x - CAMPO_W / 2) * 0.85,
      y: j.y + dir * 60,
      livre: true,
    };
  }

  // ---- meu time tem a bola: dá apoio (linhas de passe) ----
  if (dono && dono.time === j.time) {
    j.estado = "apoio";
    // mistura própria zona com a posição da bola, à frente dela; coef. pessoal
    const k = 0.30 + j.atrair * 0.4;
    return {
      x: j.homeX * (1 - k) + (P.bola.x + (j.homeX - CAMPO_W / 2) * 0.2) * k,
      y: j.homeY * (1 - k) + (P.bola.y + dir * 70) * k,
      livre: false,
    };
  }

  // ---- adversário tem a bola, ou bola solta ----
  // bola com o goleiro adversário: não pode ficar em cima marcando.
  // mantém um raio mínimo (bolha) ao redor do goleiro — recua quem invadiu.
  if (dono && dono.time !== j.time && dono.pos === "GOL") {
    j.estado = "recuar";
    const STANDOFF = 140;
    const dx = j.x - P.bola.x, dy = j.y - P.bola.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < STANDOFF) {
      // dentro da bolha: empurra pra fora, na direção do próprio campo
      return { x: P.bola.x + dx / d * STANDOFF, y: P.bola.y + dy / d * STANDOFF, livre: false };
    }
    return { x: j.homeX, y: j.homeY, livre: false }; // fora da bolha: mantém a forma
  }
  const presser = jogadorMaisProximo(P, P.bola.x, P.bola.y, j.time);
  if (presser === j || distBola < 70) {
    j.estado = "perseguir";
    return { x: P.bola.x, y: P.bola.y, livre: true };
  }
  // demais: marcam a própria zona deslocando-se levemente com a bola (coef. pessoal)
  j.estado = "voltar";
  const k = j.atrair * (1 - j.discipl * 0.5);
  const empurra = (taticaTime.agressividade - 50) / 50 * 36;
  return {
    x: j.homeX * (1 - k) + P.bola.x * k,
    y: j.homeY * (1 - k) + P.bola.y * k + dir * empurra,
    livre: false,
  };
}

/* goleiro: acompanha a bola na largura, colado à linha; só sobe no fim se perdendo */
function alvoGoleiro(P, j, dir) {
  const outro = j.time === "MEU" ? "ADV" : "MEU";
  const perdendo = P.placar[j.time] < P.placar[outro];
  const ultimoLance = minuto(P) >= 88;
  const ataqueY = j.time === "MEU" ? P.bola.y > CAMPO_H * 0.78 : P.bola.y < CAMPO_H * 0.22;

  // último lance: goleiro sobe pra cabecear se perdendo e a bola está no ataque
  if (ultimoLance && perdendo && ataqueY) {
    if (!j.subiu) {
      j.subiu = true;
      P.eventos.push({ minuto: minuto(P), tipo: "info", time: j.time,
        texto: `🧤 ${j.nome} sobe pro ataque no último lance!` });
    }
    j.estado = "perseguir";
    return { x: P.bola.x, y: P.bola.y, livre: true };
  }
  j.subiu = false;
  j.estado = "marcar";
  // linha do gol do próprio time + leve saída conforme a bola se aproxima
  const linha = j.time === "MEU" ? 24 : CAMPO_H - 24;
  const aproxima = j.time === "MEU"
    ? Math.max(0, 1 - P.bola.y / (CAMPO_H * 0.35))
    : Math.max(0, 1 - (CAMPO_H - P.bola.y) / (CAMPO_H * 0.35));
  const golX = CAMPO_W / 2 + (P.bola.x - CAMPO_W / 2) * 0.5;
  return {
    x: golX,
    y: linha + dir * aproxima * 55,
    livre: true,
  };
}

/* aplica a "coleira" da zona: clampa o alvo à faixa da posição.
   Quanto maior a disciplina, mais apertado. O presser/portador podem extrapolar. */
function aplicarZona(P, j, alvo) {
  if (j.pos === "GOL") {
    if (j.subiu) return; // liberado no último lance
    const [yMin, yMax] = zonaY(j.time, "GOL");
    const [xMin, xMax] = zonaX(j);
    alvo.x = Math.max(xMin, Math.min(xMax, alvo.x));
    alvo.y = Math.max(yMin, Math.min(yMax, alvo.y));
    return;
  }
  let [yMin, yMax] = zonaY(j.time, j.pos);
  let [xMin, xMax] = zonaX(j);
  // folga: jogador "livre" (perseguindo/portador) pode sair um pouco da zona
  const folga = alvo.livre ? CAMPO_H * 0.16 : CAMPO_H * 0.04 * (1 - j.discipl);
  yMin -= folga; yMax += folga;
  if (j.pos === "LAT") { const fx = alvo.livre ? CAMPO_W * 0.16 : 0; xMin -= fx; xMax += fx; }
  alvo.x = Math.max(xMin, Math.min(xMax, alvo.x));
  alvo.y = Math.max(yMin, Math.min(yMax, alvo.y));
}

/* integra movimento até o alvo + deriva pessoal */
function moverPara(P, j, alvo, parado) {
  const aceleracao = 0.5;
  const maxV = 2.6;
  const fadigaMul = 1 - (j.fadiga / 100) * 0.35;
  let velMaxJ = (maxV * (0.7 + j.atr.vel / 99 * 0.6)) * fadigaMul;
  if (parado) velMaxJ *= 0.4; // anda devagar com o jogo parado

  const ax_ = (alvo.x + j.wx) - j.x;
  const ay_ = (alvo.y + j.wy) - j.y;
  const d = Math.hypot(ax_, ay_) || 1;
  j.vx = Math.max(-velMaxJ, Math.min(velMaxJ, j.vx + (ax_ / d) * aceleracao));
  j.vy = Math.max(-velMaxJ, Math.min(velMaxJ, j.vy + (ay_ / d) * aceleracao));
  j.vx *= 0.86; j.vy *= 0.86;
  j.x += j.vx; j.y += j.vy;
  j.x = Math.max(8, Math.min(CAMPO_W - 8, j.x));
  j.y = Math.max(8, Math.min(CAMPO_H - 8, j.y));
}

/* ===== desarmes & faltas ===== */
function disputas(P) {
  if (!P.bola.dono) return;
  const dono = P.jogadores.find(j => j.id === P.bola.dono);
  if (!dono) return;
  // adversário mais perto do portador
  let adv = null, dm = Infinity;
  for (const j of P.jogadores) {
    if (j.time === dono.time) continue;
    const d = Math.hypot(j.x - dono.x, j.y - dono.y);
    if (d < dm) { dm = d; adv = j; }
  }
  if (!adv || dm > 15 || adv.tackleCd > 0) return;
  adv.tackleCd = 26;

  const tatica = adv.time === "MEU" ? P.meuTime.tatica : P.adversario.tatica;
  const agro = tatica.agressividade / 100;
  const defSkill = (adv.atr.def + adv.atr.frc) / 2 / 99;
  const drbSkill = (dono.atr.drb + dono.atr.vel) / 2 / 99;

  // drible: chance do portador se desvencilhar do marcador (lençol/caneta/etc.)
  const pDrible = Math.max(0, Math.min(0.42, 0.16 + drbSkill * 0.42 - defSkill * 0.34));
  const pLimpo = Math.max(0.05, 0.34 + defSkill * 0.40 - drbSkill * 0.30);
  const pFalta = Math.max(0.05, 0.08 + agro * 0.14 + drbSkill * 0.12 - defSkill * 0.10);
  const r = P.rng();

  if (r < pDrible) {                          // drible — passa pelo marcador
    aplicarDrible(P, dono, adv);
  } else if (r < pDrible + pLimpo) {          // desarme limpo
    P.bola.dono = adv.id; P.bola.vx = 0; P.bola.vy = 0;
    P.eventos.push({ minuto: minuto(P), tipo: "posse", autorId: adv.id, time: adv.time,
      texto: `${adv.nome} desarma ${dono.nome}.` });
  } else if (r < pDrible + pLimpo + pFalta) { // falta
    cometerFalta(P, adv, dono);
  }
  // senão: portador passou pelo marcador, segue a jogada
}

/* dribles que livram o portador do marcador */
const DRIBLES = ["lençol", "caneta", "drible da vaca", "corta pra dentro", "meia-lua"];
function aplicarDrible(P, dono, adv) {
  const dir = dono.time === "MEU" ? 1 : -1;
  const nome = DRIBLES[Math.floor(P.rng() * DRIBLES.length)];
  // arranque pra frente, livrando do marcador
  dono.vx += (P.rng() - 0.5) * 1.8;
  dono.vy += dir * 2.4;
  dono.cooldown = 6;
  adv.tackleCd = 42;            // marcador batido não tenta de novo na hora
  P.eventos.push({ minuto: minuto(P), tipo: "drible", autorId: dono.id, time: dono.time,
    texto: `✨ ${dono.nome} aplica um ${nome} e passa por ${adv.nome}!` });
}

function cometerFalta(P, faltoso, vitima) {
  const min = minuto(P);
  P.stats[faltoso.time].faltas++;

  // o árbitro viu? depende da distância dele ao lance; bandeirinhas ajudam
  const arb = P.juizes.find(r => r.tipo === "campo");
  const dArb = arb ? Math.hypot(arb.x - faltoso.x, arb.y - faltoso.y) : 250;
  const pVer = Math.min(0.97, 0.62 + (250 - Math.min(250, dArb)) / 250 * 0.33);

  if (P.rng() > pVer) {
    // não marcada — lei da vantagem, bola fica viva
    P.eventos.push({ minuto: min, tipo: "falta", time: faltoso.time,
      texto: `Falta de ${faltoso.nome}, mas o árbitro manda seguir.` });
    P.bola.dono = null;
    P.bola.vx = (P.rng() - 0.5) * 4; P.bola.vy = (P.rng() - 0.5) * 4;
    return;
  }

  // marcada — jogo para
  const naArea = faltaNaAreaDefensiva(faltoso);
  P.eventos.push({ minuto: min, tipo: "falta", time: faltoso.time,
    texto: `🟨? Falta de ${faltoso.nome} sobre ${vitima.nome}.` });

  // gravidade do cartão
  const tatica = faltoso.time === "MEU" ? P.meuTime.tatica : P.adversario.tatica;
  const agro = tatica.agressividade / 100;
  const ultimoHomem = vitima.pos === "ATA" && faltaNaAreaDefensiva(faltoso, 0.5);
  const s = P.rng() + agro * 0.12 + (ultimoHomem ? 0.10 : 0);
  let card = null;
  if (s > 1.06 || (ultimoHomem && s > 0.82)) card = "vermelho";
  else if (s > 0.80) card = "amarelo";
  aplicarCartao(P, faltoso, card);

  // reinício: pênalti se na área, senão falta pro time da vítima
  P.paradaAte = P.tick + 36; // ~0,6s de jogo parado
  if (naArea) {
    penalti(P, vitima.time);
  } else {
    P.bola.x = faltoso.x; P.bola.y = faltoso.y;
    P.bola.vx = 0; P.bola.vy = 0;
    const cobrador = jogadorMaisProximo(P, faltoso.x, faltoso.y, vitima.time) ||
      P.jogadores.find(j => j.time === vitima.time && !j.expulso);
    P.bola.dono = cobrador ? cobrador.id : null;
    if (cobrador) { cobrador.cobrarFalta = true; cobrador.cooldown = 12; }
  }
}

function aplicarCartao(P, j, card) {
  if (!card) return;
  const min = minuto(P);
  if (card === "amarelo") {
    j.amarelos++;
    P.stats[j.time].amarelos++;
    P.eventos.push({ minuto: min, tipo: "cartao", cor: "amarelo", autorId: j.id, nome: j.nome, time: j.time,
      texto: `🟨 Amarelo para ${j.nome}.` });
    if (j.amarelos >= 2) expulsar(P, j, "2º amarelo");
  } else {
    expulsar(P, j, "vermelho direto");
  }
}

function expulsar(P, j, motivo) {
  if (j.expulso) return;
  j.expulso = true;
  P.stats[j.time].vermelhos++;
  P.eventos.push({ minuto: minuto(P), tipo: "cartao", cor: "vermelho", autorId: j.id, nome: j.nome, time: j.time,
    texto: `🟥 ${j.nome} expulso (${motivo})!` });
  if (P.bola.dono === j.id) P.bola.dono = null;
  const idx = P.jogadores.indexOf(j);
  if (idx >= 0) P.jogadores.splice(idx, 1); // time joga com um a menos
}

/* falta dentro da grande área do time que cometeu? */
function faltaNaAreaDefensiva(faltoso, escala = 1) {
  const dentroX = Math.abs(faltoso.x - CAMPO_W / 2) < 130;
  if (!dentroX) return false;
  const prof = 94 * escala;
  return faltoso.time === "MEU" ? faltoso.y < prof : faltoso.y > CAMPO_H - prof;
}

/* pênalti: cobrança direta do melhor finalizador do time atacante */
function penalti(P, time) {
  const spotY = time === "MEU" ? CAMPO_H - 70 : 70; // marca da cal no gol adversário
  const cobrador = P.jogadores
    .filter(j => j.time === time && !j.expulso && j.pos !== "GOL")
    .sort((a, b) => b.atr.fin - a.atr.fin)[0];
  P.bola.x = CAMPO_W / 2; P.bola.y = spotY; P.bola.vx = 0; P.bola.vy = 0;
  P.bola.dono = cobrador ? cobrador.id : null;
  if (cobrador) { cobrador.x = CAMPO_W / 2; cobrador.y = spotY - (time === "MEU" ? 14 : -14); }
  P.eventos.push({ minuto: minuto(P), tipo: "penalti", time,
    texto: `⚽ Pênalti! ${cobrador ? cobrador.nome : "?"} vai cobrar.` });
  // cobra logo após a parada
  P.paradaAte = P.tick + 30;
  if (cobrador) { cobrador.cooldown = 30; cobrador.cobrarPenalti = true; }
}

/* ===== árbitro e bandeirinhas ===== */
function moverJuizes(P) {
  const b = P.bola;
  for (const r of P.juizes) {
    let tx, ty, vmax;
    if (r.tipo === "campo") {
      // segue a bola em diagonal, a uma distância
      vmax = 2.2;
      tx = b.x - 46; ty = b.y - 30;
    } else {
      vmax = 2.6;
      if (r.lado === "esq") { tx = 8; ty = Math.max(40, Math.min(CAMPO_H / 2, b.y)); }
      else { tx = CAMPO_W - 8; ty = Math.max(CAMPO_H / 2, Math.min(CAMPO_H - 40, b.y)); }
    }
    const dx = tx - r.x, dy = ty - r.y, d = Math.hypot(dx, dy) || 1;
    r.vx = Math.max(-vmax, Math.min(vmax, r.vx + (dx / d) * 0.4));
    r.vy = Math.max(-vmax, Math.min(vmax, r.vy + (dy / d) * 0.4));
    r.vx *= 0.85; r.vy *= 0.85;
    r.x = Math.max(2, Math.min(CAMPO_W - 2, r.x + r.vx));
    r.y = Math.max(2, Math.min(CAMPO_H - 2, r.y + r.vy));
  }
}

function jogadorMaisProximo(P, bx, by, time) {
  let melhor = null, dmin = Infinity;
  for (const j of P.jogadores) {
    if (j.time !== time) continue;
    if (j.pos === "GOL") continue; // goleiro fica
    const d = Math.hypot(j.x - bx, j.y - by);
    if (d < dmin) { dmin = d; melhor = j; }
  }
  return melhor;
}

function decidirAcaoComBola(P, j) {
  // cobranças (set pieces) têm prioridade
  if (j.cobrarPenalti) { j.cobrarPenalti = false; baterPenalti(P, j); j.cooldown = 30; return; }
  if (j.cobrarFalta)   { j.cobrarFalta = false;   cobrarFalta(P, j);   j.cooldown = 22; return; }

  const golY = j.time === "MEU" ? CAMPO_H : 0;
  const distGol = Math.abs(golY - j.y);
  const adversarios = P.jogadores.filter(x => x.time !== j.time);
  // pressão = quantos adversários a menos de 60px
  const press = adversarios.filter(a => Math.hypot(a.x - j.x, a.y - j.y) < 60).length;
  const taticaTime = j.time === "MEU" ? P.meuTime.tatica : P.adversario.tatica;

  const tercoAtaque = distGol < CAMPO_H * 0.42;
  const aberto = Math.abs(j.x - CAMPO_W / 2) > 150;     // perto da linha de fundo lateral
  const avancado = colegaAvancado(P, j);                // colega em profundidade c/ espaço

  // pesos por tipo de lance
  let pPasse = 0.42, pDrible = 0.18, pChute = 0, pCruz = 0, pLanc = 0;
  if (distGol < 220) pChute = 0.35 + (j.atr.fin / 99) * 0.4;
  if (tercoAtaque && aberto) pCruz = 0.34;                              // cruzamento da ponta
  if (avancado && press < 2) pLanc = 0.16 + (j.atr.vis / 99) * 0.12;    // lançamento em profundidade
  if (taticaTime.estilo === "posse") { pPasse += 0.15; pDrible -= 0.05; pLanc -= 0.04; }
  if (taticaTime.estilo === "contra-ataque") { pChute += 0.08; pLanc += 0.10; }
  if (taticaTime.estilo === "pressing") { pPasse -= 0.1; pDrible += 0.1; }
  if (press >= 2) { pPasse += 0.12; pDrible -= 0.05; pCruz += 0.05; }
  pPasse = Math.max(0, pPasse); pDrible = Math.max(0, pDrible); pLanc = Math.max(0, pLanc);

  const total = Math.max(0.01, pPasse + pDrible + pChute + pCruz + pLanc);
  let r = P.rng() * total;
  if (r < pChute) { chutar(P, j); j.cooldown = 20; return; }
  r -= pChute;
  if (r < pCruz) { cruzar(P, j); j.cooldown = 16; return; }
  r -= pCruz;
  if (r < pLanc) {
    const alvo = avancado || melhorColega(P, j);
    if (alvo) { lancar(P, j, alvo); j.cooldown = 18; return; }
  }
  r -= pLanc;
  if (r < pPasse) {
    const colega = melhorColega(P, j);
    if (colega) { passar(P, j, colega); j.cooldown = 16; return; }
  }
  // resto: drible em condução
  driblar(P, j);
  j.cooldown = 10;
}

/* distribuição do goleiro: lança a um colega avançado com espaço; senão passa
   ao colega livre mais próximo; chutão pra frente como último recurso.
   Sempre solta a bola (passar/lancar/chutar zeram bola.dono). */
function gkDistribuir(P, j) {
  j.gkHold = 0;
  const alvo = colegaAvancado(P, j) || melhorColega(P, j);
  if (alvo) {
    const d = Math.hypot(alvo.x - j.x, alvo.y - j.y);
    if (d > 220) lancar(P, j, alvo); else passar(P, j, alvo);
  } else {
    chutar(P, j); // sem opção de passe: chutão
  }
  j.cooldown = 24;
}

/* colega claramente à frente (profundidade) e com pouca marcação — alvo de lançamento */
function colegaAvancado(P, j) {
  const dir = j.time === "MEU" ? 1 : -1;
  let melhor = null, best = -Infinity;
  for (const c of P.jogadores) {
    if (c.time !== j.time || c.id === j.id || c.pos === "GOL") continue;
    const dy = (c.y - j.y) * dir;          // positivo = à frente
    if (dy < 120) continue;                // só profundidade real
    const marca = P.jogadores.filter(a => a.time !== j.time && Math.hypot(a.x - c.x, a.y - c.y) < 40).length;
    const score = dy - marca * 60 + (P.rng() - 0.5) * 30;
    if (score > best) { best = score; melhor = c; }
  }
  return melhor;
}

/* dentro da grande área de ataque (pra cabecear cruzamento) */
function naAreaAtaque(j) {
  if (Math.abs(j.x - CAMPO_W / 2) >= 140) return false;
  return j.time === "MEU" ? j.y > CAMPO_H - 120 : j.y < 120;
}

function melhorColega(P, j) {
  const dir = j.time === "MEU" ? 1 : -1;
  const cand = P.jogadores.filter(x => x.time === j.time && x.id !== j.id && x.pos !== "GOL");
  let melhor = null, scoreBest = -Infinity;
  for (const c of cand) {
    const dy = (c.y - j.y) * dir; // positivo = à frente
    const dist = Math.hypot(c.x - j.x, c.y - j.y);
    const adversariosPerto = P.jogadores
      .filter(a => a.time !== j.time)
      .filter(a => Math.hypot(a.x - c.x, a.y - c.y) < 35).length;
    const score = dy * 1.2 - dist * 0.15 - adversariosPerto * 50 + c.atr.vis * 0.05 + (P.rng() - 0.5) * 30;
    if (score > scoreBest) { scoreBest = score; melhor = c; }
  }
  return melhor;
}

function passar(P, de, para) {
  const dx = para.x - de.x, dy = para.y - de.y;
  const d = Math.hypot(dx, dy) || 1;
  // velocidade do passe = função de PAS + ruído
  const v = 9 + de.atr.pas / 99 * 8;
  // ruído de mira proporcional a 1 - PAS
  const erro = (1 - de.atr.pas / 99) * 0.18 * (P.rng() - 0.5);
  const ang = Math.atan2(dy, dx) + erro;
  P.bola.vx = Math.cos(ang) * v;
  P.bola.vy = Math.sin(ang) * v;
  P.bola.dono = null;
  P.eventos.push({ minuto: minuto(P), tipo: "passe", autorId: de.id, alvoId: para.id, time: de.time, texto: `${de.nome} → ${para.nome}` });
  // mantemos só os últimos 30 eventos no log visível (limpamos visualmente em render)
}

function driblar(P, j) {
  const dir = j.time === "MEU" ? 1 : -1;
  // arremessa a bola um pouco à frente, dono se mantém perto
  P.bola.vx = (j.vx) + (P.rng() - 0.5) * 1.2;
  P.bola.vy = (j.vy) + dir * 2.4;
  // ainda em domínio (não solta)
}

/* lançamento: bola longa e forte pra um colega em profundidade */
function lancar(P, de, para) {
  const dx = para.x - de.x, dy = para.y - de.y;
  const v = 13 + de.atr.pas / 99 * 7;                       // mais forte que passe curto
  const erro = (1 - de.atr.vis / 99) * 0.16 * (P.rng() - 0.5);
  const ang = Math.atan2(dy, dx) + erro;
  P.bola.vx = Math.cos(ang) * v;
  P.bola.vy = Math.sin(ang) * v;
  P.bola.dono = null;
  P.eventos.push({ minuto: minuto(P), tipo: "lancamento", autorId: de.id, alvoId: para.id, time: de.time,
    texto: `📡 ${de.nome} lança em profundidade para ${para.nome}!` });
}

/* cruzamento: bola na área; o próximo atacante na área cabeceia */
function cruzar(P, de) {
  const dir = de.time === "MEU" ? 1 : -1;
  const golY = de.time === "MEU" ? CAMPO_H - 30 : 30;       // dentro da área adversária
  const alvoAtk = P.jogadores
    .filter(x => x.time === de.time && x.id !== de.id && x.pos !== "GOL")
    .sort((a, b) => (b.y - a.y) * dir)[0];                  // mais avançado
  const alvoX = alvoAtk ? (alvoAtk.x + CAMPO_W / 2) / 2 : CAMPO_W / 2;
  const dx = alvoX - de.x, dy = golY - de.y;
  const v = 12 + de.atr.pas / 99 * 6;
  const erro = (1 - de.atr.pas / 99) * 0.16 * (P.rng() - 0.5);
  const ang = Math.atan2(dy, dx) + erro;
  P.bola.vx = Math.cos(ang) * v;
  P.bola.vy = Math.sin(ang) * v;
  P.bola.dono = null;
  P.bola.cruzamento = { time: de.time };                   // marca p/ virar cabeceio na área
  P.eventos.push({ minuto: minuto(P), tipo: "cruzamento", autorId: de.id, time: de.time,
    texto: `🎯 ${de.nome} cruza na área!` });
}

/* cabeceio: finalização de cabeça (força + finalização), menos precisa que de pé */
function cabecear(P, j) {
  const golY = j.time === "MEU" ? CAMPO_H - 4 : 4;
  const golX = CAMPO_W / 2 + (P.rng() - 0.5) * (GOL_W - 8);
  const dx = golX - j.x, dy = golY - j.y;
  const v = 11 + j.atr.frc / 99 * 6;
  const mira = (j.atr.fin + j.atr.frc) / 2 / 99;
  const erro = (1 - mira) * 0.22 * (P.rng() - 0.5);
  const ang = Math.atan2(dy, dx) + erro;
  P.bola.vx = Math.cos(ang) * v;
  P.bola.vy = Math.sin(ang) * v;
  P.bola.dono = null;
  P.stats[j.time].chutes++;
  if (Math.abs(erro) < 0.08) P.stats[j.time].chutesNoGol++;
  P.eventos.push({ minuto: minuto(P), tipo: "cabeceio", autorId: j.id, time: j.time,
    texto: `🦅 ${j.nome} sobe mais que a zaga e cabeceia!` });
}

/* cobrança de falta: chute direto (se central e perto), senão cruza ou toca curto */
function cobrarFalta(P, j) {
  const golY = j.time === "MEU" ? CAMPO_H : 0;
  const distGol = Math.abs(golY - j.y);
  const central = Math.abs(j.x - CAMPO_W / 2) < 150;
  if (distGol < 250 && central && P.rng() < 0.45 + j.atr.fin / 99 * 0.3) {
    const golY2 = j.time === "MEU" ? CAMPO_H - 4 : 4;
    const golX = CAMPO_W / 2 + (P.rng() - 0.5) * (GOL_W - 16);
    const dx = golX - j.x, dy = golY2 - j.y;
    const v = 15 + j.atr.fin / 99 * 8;
    const erro = (1 - j.atr.fin / 99) * 0.14 * (P.rng() - 0.5); // falta ensaiada: precisa
    const ang = Math.atan2(dy, dx) + erro;
    P.bola.vx = Math.cos(ang) * v;
    P.bola.vy = Math.sin(ang) * v;
    P.bola.dono = null;
    P.stats[j.time].chutes++;
    if (Math.abs(erro) < 0.06) P.stats[j.time].chutesNoGol++;
    P.eventos.push({ minuto: minuto(P), tipo: "cobranca", autorId: j.id, time: j.time,
      texto: `🎯 ${j.nome} bate a falta direto pro gol!` });
  } else if (Math.abs(j.x - CAMPO_W / 2) > 120 || distGol < 300) {
    cruzar(P, j); // bola na área
  } else {
    const colega = melhorColega(P, j);
    if (colega) passar(P, j, colega); else driblar(P, j);
  }
}

/* cobrança de pênalti: canto / defesa do goleiro / pra fora */
function baterPenalti(P, j) {
  const dir = j.time === "MEU" ? 1 : -1;
  const golY = j.time === "MEU" ? CAMPO_H - 2 : 2;
  const gk = P.jogadores.find(g => g.time !== j.time && g.pos === "GOL");
  const pGol = Math.max(0.45, Math.min(0.92, 0.58 + j.atr.fin / 99 * 0.32 - (gk ? gk.atr.ref / 99 * 0.22 : 0)));
  const r = P.rng();
  if (r < pGol) {                                   // no canto — vai pro gol
    const lado = P.rng() < 0.5 ? -1 : 1;
    const golX = CAMPO_W / 2 + lado * (GOL_W / 2 - 14);
    const dx = golX - j.x, dy = golY - j.y, d = Math.hypot(dx, dy) || 1;
    const v = 18 + j.atr.fin / 99 * 6;
    P.bola.vx = (dx / d) * v; P.bola.vy = (dy / d) * v; P.bola.dono = null;
    P.stats[j.time].chutes++; P.stats[j.time].chutesNoGol++;
    P.eventos.push({ minuto: minuto(P), tipo: "penalti", autorId: j.id, time: j.time,
      texto: `⚽ ${j.nome} bate no canto!` });
  } else if (gk && P.rng() < 0.6) {                 // defesa do goleiro
    P.bola.x = gk.x; P.bola.y = gk.y; P.bola.vx = 0; P.bola.vy = 0; P.bola.dono = gk.id;
    P.stats[j.time].chutes++;
    P.eventos.push({ minuto: minuto(P), tipo: "penalti", time: j.time,
      texto: `🧤 ${gk.nome} defende o pênalti de ${j.nome}!` });
  } else {                                          // isola
    P.bola.dono = null;
    P.bola.vx = (P.rng() - 0.5) * 6; P.bola.vy = dir * (16 + P.rng() * 4);
    P.stats[j.time].chutes++;
    P.eventos.push({ minuto: minuto(P), tipo: "penalti", time: j.time,
      texto: `😱 ${j.nome} isola o pênalti!` });
  }
}

function chutar(P, j) {
  const dir = j.time === "MEU" ? 1 : -1;
  const golY = j.time === "MEU" ? CAMPO_H - 4 : 4;
  const golX = CAMPO_W / 2 + (P.rng() - 0.5) * (GOL_W - 20);
  const dx = golX - j.x, dy = golY - j.y;
  const d = Math.hypot(dx, dy) || 1;
  const v = 14 + j.atr.fin / 99 * 8;
  // erro de mira invertido por finalização e visão
  const erro = (1 - j.atr.fin / 99) * 0.18 * (P.rng() - 0.5);
  const ang = Math.atan2(dy, dx) + erro;
  P.bola.vx = Math.cos(ang) * v;
  P.bola.vy = Math.sin(ang) * v;
  P.bola.dono = null;
  const t = j.time;
  P.stats[t].chutes++;
  // chuta no gol se erro foi pequeno
  if (Math.abs(erro) < 0.07) P.stats[t].chutesNoGol++;
  P.eventos.push({ minuto: minuto(P), tipo: "chute", autorId: j.id, time: t, texto: `${j.nome} arrisca de longe!` });
}

function moverBola(P) {
  const b = P.bola;
  // se em domínio, segue jogador
  if (b.dono) {
    const dono = P.jogadores.find(j => j.id === b.dono);
    if (!dono) { b.dono = null; }
    else {
      const dir = dono.time === "MEU" ? 1 : -1;
      b.x = dono.x + dono.vx * 1.5 + (dir * 6);
      b.y = dono.y + dono.vy * 1.5 + (dir * 10);
      // posse stats
      P.stats[dono.time].posseTicks++;
      return;
    }
  }
  // livre — física
  b.x += b.vx; b.y += b.vy;
  b.vx *= 0.93; b.vy *= 0.93;

  // tentativa de domínio por jogadores próximos
  let melhorDono = null, distMelhor = Infinity;
  for (const j of P.jogadores) {
    const d = Math.hypot(j.x - b.x, j.y - b.y);
    if (d < 16 && d < distMelhor) {
      // goleiro só pega se a bola estiver na área dele
      if (j.pos === "GOL") {
        if ((j.time === "MEU" && b.y > 100) || (j.time === "ADV" && b.y < CAMPO_H - 100)) continue;
      }
      melhorDono = j; distMelhor = d;
    }
  }
  if (melhorDono) {
    // cruzamento chegando: atacante na área cabeceia em vez de só dominar
    if (b.cruzamento && melhorDono.time === b.cruzamento.time &&
        melhorDono.pos !== "GOL" && naAreaAtaque(melhorDono)) {
      b.cruzamento = null;
      b.dono = melhorDono.id;
      cabecear(P, melhorDono);
    } else {
      b.cruzamento = null;
      b.dono = melhorDono.id;
      P.eventos.push({ minuto: minuto(P), tipo: "posse", autorId: melhorDono.id, time: melhorDono.time, texto: `${melhorDono.nome} domina.` });
      b.vx = 0; b.vy = 0;
    }
  }
  // bola saindo dos limites laterais => reposição rápida
  if (b.x < 4 || b.x > CAMPO_W - 4) {
    b.x = Math.max(8, Math.min(CAMPO_W - 8, b.x));
    b.vx = -b.vx * 0.4; b.vy *= 0.4;
  }
  if (b.y < 4 && b.dono === null) {
    // chute pra fora da linha de fundo do adversário (defesa do "MEU" => não é gol)
    // pra simplificar, reposicionamos
    P.bola.x = CAMPO_W / 2; P.bola.y = 80; P.bola.vx = 0; P.bola.vy = 0; P.bola.cruzamento = null;
  }
  if (b.y > CAMPO_H - 4 && b.dono === null) {
    P.bola.x = CAMPO_W / 2; P.bola.y = CAMPO_H - 80; P.bola.vx = 0; P.bola.vy = 0; P.bola.cruzamento = null;
  }
}

function verificarGol(P) {
  const b = P.bola;
  // gol = entra no retângulo (CAMPO_W/2 ± GOL_W/2) em y < 0 ou y > CAMPO_H
  const dentroLargura = b.x > (CAMPO_W - GOL_W) / 2 && b.x < (CAMPO_W + GOL_W) / 2;
  if (dentroLargura && b.y < 6) {
    // gol do time MEU (atacam pra cima? não — atacam pra baixo. então gol em y<6 = gol do ADV)
    // espera: no nosso layout, MEU tem y baixo = defesa. Atacam pra baixo (y crescente).
    // Logo: gol em y > CAMPO_H = gol do MEU; gol em y < 0 = gol do ADV.
    fazerGol(P, "ADV");
  }
  if (dentroLargura && b.y > CAMPO_H - 6) {
    fazerGol(P, "MEU");
  }
}

function fazerGol(P, time) {
  // autor = último que finalizou/tocou pra esse time (inclui cabeceio, pênalti e falta direta)
  const FINAL = ["chute", "cabeceio", "penalti", "cobranca", "passe", "lancamento", "cruzamento"];
  const ultimoEvento = [...P.eventos].reverse().find(e => FINAL.includes(e.tipo) && e.time === time && e.autorId);
  const autorId = ultimoEvento?.autorId || P.jogadores.find(j => j.time === time)?.id;
  const autor = P.jogadores.find(j => j.id === autorId);
  P.placar[time]++;
  P.stats[time].gols.push({ minuto: minuto(P), autorId, autorNome: autor?.nome || "?" });
  P.eventos.push({ minuto: minuto(P), tipo: "gol", autorId, nome: autor?.nome || "?", time, texto: `⚽ GOOOOL! ${autor?.nome || "?"} marca!` });
  // animação simples: bola pro centro, todos comemoram brevemente
  resetKickoff(P, time === "MEU" ? "ADV" : "MEU");
}

function resetKickoff(P, quemSai) {
  P.bola.x = CAMPO_W / 2;
  P.bola.y = CAMPO_H / 2;
  P.bola.vx = 0; P.bola.vy = 0;
  P.bola.dono = null;
  P.bola.cruzamento = null;
  // jogadores voltam aproximadamente ao home
  P.jogadores.forEach(j => {
    j.x = j.homeX + (P.rng() - 0.5) * 12;
    j.y = j.homeY + (P.rng() - 0.5) * 12;
    j.vx = 0; j.vy = 0;
    j.wx = 0; j.wy = 0;
    j.subiu = false;
    j.cobrarFalta = false;
    j.cobrarPenalti = false;
  });
  if (quemSai) {
    // dá a posse pro time `quemSai` no centro
    const central = P.jogadores
      .filter(j => j.time === quemSai && j.pos === "MEI")
      .sort((a,b) => Math.hypot(a.x - CAMPO_W/2, a.y - CAMPO_H/2) - Math.hypot(b.x - CAMPO_W/2, b.y - CAMPO_H/2))[0];
    if (central) {
      P.bola.x = central.x; P.bola.y = central.y; P.bola.dono = central.id;
    }
  }
}

export function minuto(P) {
  return Math.floor(P.tick / TICKS_POR_MIN);
}

/* SUBSTITUIÇÃO: troca titular por reserva (durante a partida).
   meuTime.titulares/reservas guardam ids. P.jogadores precisa refletir o swap. */
export function substituir(P, idSai, idEntra) {
  const titulares = P.meuTime.titulares;
  const reservas = P.meuTime.reservas;
  const iSai = titulares.indexOf(idSai);
  const iEntra = reservas.indexOf(idEntra);
  if (iSai < 0 || iEntra < 0) return false;
  // swap nas listas
  titulares[iSai] = idEntra;
  reservas[iEntra] = idSai;

  // swap na P.jogadores: substitui o objeto j cujo id == idSai por novo j gerado
  const jSai = P.jogadores.find(x => x.id === idSai && x.time === "MEU");
  if (!jSai) return false;
  const novoA = ATLETAS.find(a => a.id === idEntra);
  const novoJ = {
    ...jSai,
    id: novoA.id,
    nome: novoA.nome,
    pos: novoA.pos,
    atr: { ...novoA.atr },
    cor1: novoA.cor1, cor2: novoA.cor2,
    feat: getFeatures(novoA),
    fadiga: 0, // entra renovado
    cooldown: 0,
    tackleCd: 0,
    overall: novoA.overall,
    amarelos: 0,
    expulso: false,
    subiu: false,
    wx: 0, wy: 0,
    discipl: discById(novoA.pos),
  };
  const idx = P.jogadores.indexOf(jSai);
  P.jogadores[idx] = novoJ;
  P.eventos.push({ minuto: minuto(P), tipo: "subst", time: "MEU",
    texto: `🔄 ${jSai.nome} sai, ${novoA.nome} entra.` });
  return true;
}

export function mudarTatica(P, chave, valor) {
  P.meuTime.tatica[chave] = valor;
  P.eventos.push({ minuto: minuto(P), tipo: "tatica", time: "MEU",
    texto: `Técnico ajusta ${chave}: ${valor}` });
}

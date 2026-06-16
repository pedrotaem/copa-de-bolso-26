/* partida.js — F5+F6: tela de simulação + painel do técnico */
import { state, go } from "../util/state.js";
import { ATLETAS, FLAGS } from "../data/athletes.js";
import { novaPartida, tickSim, substituir, mudarTatica,
  CAMPO_W, CAMPO_H, DURACAO_TICKS, minuto } from "../engine/sim.js";
import { desenharPartida } from "../engine/render.js";

let raf = null;
let lastLogLen = 0;
let escolhaSub = null; // { sai: id } -> aguardando reserva
let cartaoVistos = 0;       // quantos cartões já alertados
let tickerVistos = 0;       // tamanho do log na última montagem do ticker
let manualPause = false;    // pausa pedida pelo usuário (botão)
let alertaTimer = null;     // timer da auto-pausa de 5s
let introRaf = null;        // rAF da entrada das equipes
let introAtiva = false;     // true enquanto atletas estão entrando em campo
let audioEntrada = null;    // trilha tocada na entrada

export function renderPartida(root) {
  if (!state.adversario) { go("escalacao"); return; }
  state.partida = novaPartida({
    meuTime: state.time,
    adversario: state.adversario,
    seed: Date.now(),
  });
  // reset de UI da partida
  lastLogLen = 0; cartaoVistos = 0; tickerVistos = 0; manualPause = false;
  if (alertaTimer) { clearTimeout(alertaTimer); alertaTimer = null; }

  root.innerHTML = `
    <section class="match">
      <header class="match__hud">
        <div class="hud__time hud__time--meu">
          <span class="hud__label">Seu time</span>
          <strong>${state.time.nome}</strong>
        </div>
        <div class="hud__scoreboard">
          <span class="hud__score" id="score-meu">0</span>
          <span class="hud__vs">×</span>
          <span class="hud__score" id="score-adv">0</span>
          <span class="hud__min" id="hud-min">0'</span>
        </div>
        <div class="hud__time hud__time--adv">
          <span class="hud__label">${FLAGS[state.adversario.nac] || ""} ${state.adversario.nac}</span>
          <strong>${state.adversario.nome}</strong>
        </div>
      </header>

      <div class="match__ticker" aria-label="Lances importantes">
        <div class="ticker__col ticker__col--meu">
          <div class="ticker__head">${state.time.nome}</div>
          <div class="ticker__feed" id="ticker-meu"></div>
        </div>
        <div class="ticker__col ticker__col--adv">
          <div class="ticker__head">${FLAGS[state.adversario.nac] || ""} ${state.adversario.nome}</div>
          <div class="ticker__feed" id="ticker-adv"></div>
        </div>
      </div>

      <div class="match__layout">
        <div class="match__canvas-wrap">
          <div class="match__pitch">
            <div class="posse" aria-label="Posse de bola">
              <span class="posse__pct posse__pct--meu" id="posse-pct-meu">50%</span>
              <div class="posse__track">
                <div class="posse__seg posse__seg--meu" id="posse-fill-meu" style="height:50%"></div>
                <div class="posse__seg posse__seg--adv" id="posse-fill-adv" style="height:50%"></div>
              </div>
              <span class="posse__pct posse__pct--adv" id="posse-pct-adv">50%</span>
              <span class="posse__cap">POSSE</span>
            </div>
            <canvas id="cv" width="${CAMPO_W}" height="${CAMPO_H}"></canvas>
          </div>
          <div class="match__controls">
            <button class="btn btn--ghost" id="btn-pause">⏸ pausar</button>
            <button class="btn btn--ghost speed on" data-speed="1">1×</button>
            <button class="btn btn--ghost speed" data-speed="2">2×</button>
            <button class="btn btn--ghost speed" data-speed="4">4×</button>
            <span class="spacer"></span>
            <button class="btn btn--ghost" id="btn-skip">avançar →</button>
          </div>
        </div>

        <aside class="match__side">
          <div class="esc__panel">
            <h3>SUBSTITUIÇÕES (3 max)</h3>
            <div id="subs-info">Use até 3 trocas. Clique no titular → reserva.</div>
            <div class="subs-cols">
              <div class="subs-col">
                <h4>EM CAMPO</h4>
                <div id="subs-em-campo" class="subs-list"></div>
              </div>
              <div class="subs-col">
                <h4>BANCO</h4>
                <div id="subs-banco" class="subs-list"></div>
              </div>
            </div>
          </div>

          <div class="esc__panel">
            <h3>TÁTICA NO JOGO</h3>
            <label class="esc__field">
              <span>Estilo</span>
              <div class="esc__seg" id="t-estilo">
                ${segLive("estilo", ["posse","contra-ataque","pressing"])}
              </div>
            </label>
            <label class="esc__field">
              <span>Linha defensiva</span>
              <div class="esc__seg" id="t-linha">
                ${segLive("linhaDef", ["baixa","media","alta"])}
              </div>
            </label>
            <label class="esc__field">
              <span>Agressividade <em id="t-agr-val">${state.time.tatica.agressividade}</em></span>
              <input id="t-agr" type="range" min="0" max="100" value="${state.time.tatica.agressividade}" />
            </label>
          </div>

          <div class="esc__panel esc__panel--info">
            <h3>NARRATIVA</h3>
            <div id="log" class="match__log"></div>
          </div>
        </aside>
      </div>
    </section>
  `;

  // Controles
  document.getElementById("btn-pause").addEventListener("click", togglePause);
  document.querySelectorAll(".speed").forEach(b => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".speed").forEach(x => x.classList.remove("on"));
      b.classList.add("on");
      state.partida.velocidade = +b.getAttribute("data-speed");
    });
  });
  document.getElementById("btn-skip").addEventListener("click", () => {
    if (introAtiva) return; // ignora durante a entrada das equipes
    // avança 10 ticks * 60 = 1 minuto de jogo
    for (let i = 0; i < 60; i++) tickSim(state.partida);
    updateHUD();
    renderLog();
  });

  // Tática live
  document.querySelectorAll("#t-estilo button, #t-linha button").forEach(b => {
    b.addEventListener("click", () => {
      const seg = b.parentElement;
      seg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
      const key = b.getAttribute("data-key");
      const val = b.getAttribute("data-val");
      mudarTatica(state.partida, key, val);
    });
  });
  document.getElementById("t-agr").addEventListener("input", (e) => {
    document.getElementById("t-agr-val").textContent = e.target.value;
    mudarTatica(state.partida, "agressividade", +e.target.value);
  });

  renderListasSubs();

  const ctx = document.getElementById("cv").getContext("2d");
  iniciarEntrada(ctx);
}

/* ===== ENTRADA DAS EQUIPES =====
   Antes do apito: atletas entram pela lateral esquerda em duas filas
   paralelas (uma por time, cada uma no seu campo) e caminham até a posição
   da formação. Toca a trilha de entrada. Sim fica congelado até terminar. */
const ENTRADA_STAGGER = 9;    // atraso (frames) entre um atleta e o próximo da fila
const ENTRADA_WALK_IN = 80;   // frames p/ entrar e ocupar o lugar perfilado no meio
const ENTRADA_HOLD = 48;      // frames perfilados no centro antes de assumir posições
const ENTRADA_WALK_OUT = 70;  // frames p/ ir do centro até a posição da formação
let introDispStart = 0;       // frame em que começa a dispersão p/ formação
let introTotal = 0;           // frame final da entrada

function iniciarEntrada(ctx) {
  const P = state.partida;
  introAtiva = true;
  P.paused = true;                 // congela a simulação durante a entrada
  setControlesEntrada(true);       // desabilita controles enquanto entram

  // filas perfiladas no meio: MEU (defende o topo) logo acima da linha central, ADV abaixo
  const ordenar = (a, b) => a.idx - b.idx;
  posicionarFila(P.jogadores.filter(j => j.time === "MEU").sort(ordenar), CAMPO_H / 2 - 40);
  posicionarFila(P.jogadores.filter(j => j.time === "ADV").sort(ordenar), CAMPO_H / 2 + 40);

  // linha do tempo: todos entram em fila e perfilam → seguram no meio → dispersam
  const assembleDone = ENTRADA_STAGGER * 10 + ENTRADA_WALK_IN;
  introDispStart = assembleDone + ENTRADA_HOLD;
  introTotal = introDispStart + ENTRADA_WALK_OUT + 12;

  tocarTrilhaEntrada();

  let f = 0;
  const passo = () => {
    for (const j of P.jogadores) animarEntrada(j, f);
    desenharPartida(ctx, P);
    desenharCaptionEntrada(ctx, f, introTotal);
    f++;
    if (f <= introTotal) {
      introRaf = requestAnimationFrame(passo);
      return;
    }
    // fim da entrada: encaixa todos no home e começa o jogo
    for (const j of P.jogadores) { j.x = j.homeX; j.y = j.homeY; j.vx = 0; j.vy = 0; }
    introRaf = null;
    introAtiva = false;
    P.paused = manualPause;
    setControlesEntrada(false);
    loop(ctx);
  };
  passo();
}

/* posiciona um time em fila única off-field na lateral esquerda (altura `laneY`)
   e define o lugar perfilado no meio que cada atleta vai ocupar */
function posicionarFila(lista, laneY) {
  const n = lista.length;
  const span = 44;                                 // espaçamento na fila central
  const x0 = CAMPO_W / 2 - (n - 1) * span / 2;      // fila centralizada no campo
  lista.forEach((j, i) => {
    j.entradaStartX = -16 - i * 24; // i=0 lidera; resto enfileirado fora da tela
    j.entradaStartY = laneY;
    j.entradaCenterX = x0 + i * span; // lugar perfilado no meio
    j.entradaCenterY = laneY;
    j.entradaDelay = i * ENTRADA_STAGGER;
    j.x = j.entradaStartX;
    j.y = j.entradaStartY;
  });
}

/* anima um atleta em 2 fases: (1) entra em fila pela lateral e perfila no meio,
   (2) após todos perfilados, vai do centro até a posição da formação. */
function animarEntrada(j, f) {
  const easeInOut = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  // fase 1 — entra e ocupa o lugar na fila central
  const lpIn = Math.max(0, Math.min(1, (f - j.entradaDelay) / ENTRADA_WALK_IN));
  const eIn = easeInOut(lpIn);
  let x = j.entradaStartX + (j.entradaCenterX - j.entradaStartX) * eIn;
  let y = j.entradaStartY + (j.entradaCenterY - j.entradaStartY) * eIn;
  let andando = lpIn > 0 && lpIn < 1;
  // fase 2 — do centro perfilado até a formação
  if (f >= introDispStart) {
    const lpOut = Math.max(0, Math.min(1, (f - introDispStart) / ENTRADA_WALK_OUT));
    const eOut = easeInOut(lpOut);
    x = j.entradaCenterX + (j.homeX - j.entradaCenterX) * eOut;
    y = j.entradaCenterY + (j.homeY - j.entradaCenterY) * eOut;
    andando = lpOut > 0 && lpOut < 1;
  }
  if (andando) y += Math.sin((f - j.entradaDelay) * 0.4) * 1.6;
  j.x = x;
  j.y = y;
}

/* legenda "ENTRAM EM CAMPO" com fade in/out */
function desenharCaptionEntrada(ctx, f, total) {
  const a = f < 12 ? f / 12 : (f > total - 16 ? Math.max(0, (total - f) / 16) : 1);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(CAMPO_W / 2 - 150, 18, 300, 40);
  ctx.fillStyle = "#EDE7D6";
  ctx.font = "20px 'Anton', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ENTRAM EM CAMPO", CAMPO_W / 2, 38);
  ctx.restore();
}

function setControlesEntrada(desabilitar) {
  ["btn-pause", "btn-skip"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = desabilitar;
  });
  document.querySelectorAll(".speed").forEach(b => { b.disabled = desabilitar; });
}

function tocarTrilhaEntrada() {
  try {
    audioEntrada = new Audio("assets/Project-Sirius-8-bit.mp3");
    audioEntrada.volume = 0.7;
    const PULA = 1.5; // o mp3 tem ~1,5s de silêncio no começo
    const adianta = () => { try { audioEntrada.currentTime = PULA; } catch (e) {} };
    audioEntrada.addEventListener("loadedmetadata", adianta, { once: true });
    adianta(); // caso os metadados já estejam em cache
    audioEntrada.play().catch(() => {}); // navegador pode bloquear; segue sem som
  } catch (e) { /* sem áudio, segue o jogo */ }
}

function segLive(key, vals) {
  return vals.map(v =>
    `<button data-key="${key}" data-val="${v}" class="${state.time.tatica[key]===v?"on":""}">${v}</button>`
  ).join("");
}

function togglePause() {
  manualPause = !manualPause;
  state.partida.paused = manualPause;
  document.getElementById("btn-pause").textContent = manualPause ? "▶ retomar" : "⏸ pausar";
}

function loop(ctx) {
  const P = state.partida;
  if (!P) return;
  // velocidade => quantos ticks por frame
  const stepsPerFrame = P.paused ? 0 : P.velocidade;
  for (let i = 0; i < stepsPerFrame; i++) {
    tickSim(P);
    if (checarCartao(P)) break; // cartão -> para de avançar e alerta
  }
  desenharPartida(ctx, P);
  updateHUD();
  renderTicker();
  renderLog();
  if (P.estado === "fim") {
    state.resultado = P;
    setTimeout(() => go("resultado"), 800);
    return;
  }
  raf = requestAnimationFrame(() => loop(ctx));
}

function updateHUD() {
  const P = state.partida;
  document.getElementById("score-meu").textContent = P.placar.MEU;
  document.getElementById("score-adv").textContent = P.placar.ADV;
  document.getElementById("hud-min").textContent = `${minuto(P)}'`;
  // barra de posse de bola (mesma fórmula da tela de resultado)
  const totalPosse = P.stats.MEU.posseTicks + P.stats.ADV.posseTicks || 1;
  const posseMeu = Math.round(P.stats.MEU.posseTicks / totalPosse * 100);
  const posseAdv = 100 - posseMeu;
  document.getElementById("posse-fill-meu").style.height = `${posseMeu}%`;
  document.getElementById("posse-fill-adv").style.height = `${posseAdv}%`;
  document.getElementById("posse-pct-meu").textContent = `${posseMeu}%`;
  document.getElementById("posse-pct-adv").textContent = `${posseAdv}%`;
}

/* destaque por tipo de lance dentro de uma sequência */
function pieceCls(ev) {
  if (ev.tipo === "gol") return "evp--gol";
  if (ev.tipo === "cartao") return ev.cor === "vermelho" ? "evp--vermelho" : "evp--amarelo";
  if (ev.tipo === "penalti" || ev.tipo === "cobranca") return "evp--pen";
  if (ev.tipo === "cabeceio") return "evp--cabeceio";
  return "";
}

/* agrupa eventos consecutivos do mesmo time numa só "sequência" (mesma posse).
   Posse muda de time => nova linha. Eventos sem time ficam isolados. */
function agruparSequencias(eventos) {
  const grupos = [];
  for (const ev of eventos) {
    const t = ev.time || null;
    const ult = grupos[grupos.length - 1];
    if (ult && t && ult.time === t) {
      ult.eventos.push(ev);
      ult.minFim = ev.minuto;
    } else {
      grupos.push({ time: t, minIni: ev.minuto, minFim: ev.minuto, eventos: [ev] });
    }
  }
  return grupos;
}

function renderLog() {
  const P = state.partida;
  if (P.eventos.length === lastLogLen) return;
  lastLogLen = P.eventos.length;
  const log = document.getElementById("log");
  if (!log) return;
  // só "puxa" pro fim se o usuário já estava no fim (senão respeita o scroll de consulta)
  const noFim = log.scrollHeight - log.scrollTop - log.clientHeight < 28;

  const grupos = agruparSequencias(P.eventos);
  log.innerHTML = grupos.map(g => {
    const teamCls = g.time === "MEU" ? "ev--meu" : g.time === "ADV" ? "ev--adv" : "ev--neutro";
    const minTxt = g.minIni === g.minFim ? `${g.minIni}'` : `${g.minIni}'–${g.minFim}'`;
    const tag = g.time === "MEU" ? state.time.nome
              : g.time === "ADV" ? state.adversario.nome : "";
    const pieces = g.eventos
      .map(ev => `<span class="evp ${pieceCls(ev)}">${ev.texto || ""}</span>`)
      .join(`<span class="ev__sep">›</span>`);
    return `<div class="ev ev--seq ${teamCls}">
        <span class="ev__min">${minTxt}</span>${tag ? `<span class="ev__team">${tag}</span>` : ""}
        <span class="ev__seq">${pieces}</span>
      </div>`;
  }).join("");

  if (noFim) log.scrollTop = log.scrollHeight; // mantém o lance mais novo à vista
}

/* ticker de lances importantes sob o placar: gols e cartões, separados por time
   (coluna esquerda = seu time, direita = adversário) */
function renderTicker() {
  const P = state.partida;
  if (P.eventos.length === tickerVistos) return;
  tickerVistos = P.eventos.length;
  const elMeu = document.getElementById("ticker-meu");
  const elAdv = document.getElementById("ticker-adv");
  if (!elMeu || !elAdv) return;
  const imp = P.eventos.filter(e => e.tipo === "gol" || e.tipo === "cartao");

  const chip = e => {
    if (e.tipo === "gol")
      return `<span class="tk tk--gol"><b>${e.minuto}'</b> ⚽ ${e.nome || ""}</span>`;
    const ico = e.cor === "vermelho" ? "🟥" : "🟨";
    return `<span class="tk tk--${e.cor}"><b>${e.minuto}'</b> ${ico} ${e.nome || ""}</span>`;
  };
  // mais recentes no topo de cada coluna
  const render = (el, time) => {
    const lista = imp.filter(e => e.time === time).slice(-8).reverse();
    el.innerHTML = lista.length ? lista.map(chip).join("") : `<span class="tk--vazio">—</span>`;
  };
  render(elMeu, "MEU");
  render(elAdv, "ADV");
}

/* novo cartão? pausa 5s e alerta */
function checarCartao(P) {
  const cartoes = P.eventos.filter(e => e.tipo === "cartao");
  if (cartoes.length <= cartaoVistos) return false;
  const novo = cartoes[cartoes.length - 1];
  cartaoVistos = cartoes.length;
  pausaAlerta(novo);
  return true;
}

function pausaAlerta(ev) {
  const P = state.partida;
  P.paused = true; // auto-pausa (independe do botão)
  mostrarAlerta(ev);
  if (alertaTimer) clearTimeout(alertaTimer);
  alertaTimer = setTimeout(() => {
    alertaTimer = null;
    esconderAlerta();
    if (state.partida) state.partida.paused = manualPause; // retoma, salvo se usuário pausou
  }, 5000);
}

function mostrarAlerta(ev) {
  let ov = document.querySelector(".cardalert");
  if (!ov) {
    ov = document.createElement("div");
    ov.className = "cardalert";
    document.body.appendChild(ov);
  }
  const vermelho = ev.cor === "vermelho";
  ov.className = `cardalert cardalert--on cardalert--${ev.cor}`;
  ov.innerHTML = `
    <div class="cardalert__box">
      <div class="cardalert__card">${vermelho ? "🟥" : "🟨"}</div>
      <div class="cardalert__txt">
        <strong>${vermelho ? "CARTÃO VERMELHO" : "CARTÃO AMARELO"}</strong>
        <span>${ev.nome || ""} · ${ev.minuto}'</span>
      </div>
      <div class="cardalert__bar"><span></span></div>
    </div>`;
}

function esconderAlerta() {
  const ov = document.querySelector(".cardalert");
  if (ov) ov.classList.remove("cardalert--on");
}

function renderListasSubs() {
  const P = state.partida;
  // contar substituições feitas
  const feitas = P.eventos.filter(e => e.tipo === "subst").length;
  document.getElementById("subs-info").textContent =
    `Trocas usadas: ${feitas}/3 · ${escolhaSub ? "Clique no reserva para entrar." : "Clique no titular que vai sair."}`;

  const meusEmCampo = P.jogadores.filter(j => j.time === "MEU");
  const meusBanco = P.meuTime.reservas
    .map(id => ATLETAS.find(a => a.id === id))
    .filter(Boolean);

  document.getElementById("subs-em-campo").innerHTML = meusEmCampo.map(j =>
    `<button class="banco-row ${escolhaSub?.sai===j.id?'banco-row--sel':''}" data-sai="${j.id}">
       <span class="banco-row__pos">${j.pos}</span>
       <span class="banco-row__name">${j.nome}</span>
       <span class="banco-row__ovr">${j.overall}</span>
     </button>`).join("");

  document.getElementById("subs-banco").innerHTML = meusBanco.map(a =>
    `<button class="banco-row" data-entra="${a.id}" ${escolhaSub ? "" : "disabled"}>
       <span class="banco-row__pos">${a.pos}</span>
       <span class="banco-row__name">${a.nome}</span>
       <span class="banco-row__ovr">${a.overall}</span>
     </button>`).join("");

  document.querySelectorAll("[data-sai]").forEach(el =>
    el.addEventListener("click", () => {
      if (feitas >= 3) return;
      escolhaSub = { sai: el.getAttribute("data-sai") };
      renderListasSubs();
    }));
  document.querySelectorAll("[data-entra]").forEach(el =>
    el.addEventListener("click", () => {
      if (!escolhaSub) return;
      const ok = substituir(P, escolhaSub.sai, el.getAttribute("data-entra"));
      if (ok) escolhaSub = null;
      renderListasSubs();
    }));
}

export function cleanupPartida() {
  if (raf) cancelAnimationFrame(raf);
  raf = null;
  if (introRaf) cancelAnimationFrame(introRaf);
  introRaf = null;
  introAtiva = false;
  if (audioEntrada) { try { audioEntrada.pause(); } catch (e) {} audioEntrada = null; }
  if (alertaTimer) { clearTimeout(alertaTimer); alertaTimer = null; }
  const ov = document.querySelector(".cardalert");
  if (ov) ov.remove();
}

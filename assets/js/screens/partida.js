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
          <canvas id="cv" width="${CAMPO_W}" height="${CAMPO_H}"></canvas>
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
  loop(ctx);
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
}

function renderLog() {
  const P = state.partida;
  if (P.eventos.length === lastLogLen) return;
  lastLogLen = P.eventos.length;
  const log = document.getElementById("log");
  // mostra últimos 8
  const recentes = P.eventos.slice(-10).reverse();
  log.innerHTML = recentes.map(ev => {
    const cls = ev.tipo === "gol" ? "ev--gol"
              : ev.tipo === "intervalo" ? "ev--int"
              : ev.tipo === "subst" ? "ev--sub"
              : ev.tipo === "tatica" ? "ev--tat"
              : ev.tipo === "penalti" ? "ev--pen"
              : ev.tipo === "falta" ? "ev--falta"
              : ev.tipo === "cartao" ? (ev.cor === "vermelho" ? "ev--vermelho" : "ev--amarelo")
              : "";
    return `<div class="ev ${cls}"><span class="ev__min">${ev.minuto}'</span> ${ev.texto || ""}</div>`;
  }).join("");
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
  if (alertaTimer) { clearTimeout(alertaTimer); alertaTimer = null; }
  const ov = document.querySelector(".cardalert");
  if (ov) ov.remove();
}

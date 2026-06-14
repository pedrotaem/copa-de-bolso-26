/* escalacao.js — F3: campo com formação + táticas + reservas + iniciar partida */
import { state, go } from "../util/state.js";
import { ATLETAS, FLAGS, POS_LABEL } from "../data/athletes.js";
import { FORMACOES } from "../data/formacoes.js";
import { pickAdversarioAleatorio } from "../data/teams.js";

let selecionado = null; // id de atleta selecionado para troca

export function renderEscalacao(root) {
  const escolhidos = state.time.titulares.concat(state.time.reservas);
  if (escolhidos.length !== 16) { go("selecao"); return; }

  // garantir que titulares casem com a formação (auto-arranjo na primeira entrada)
  autoArranjar();

  root.innerHTML = `
    <section class="esc">
      <header class="sel__head">
        <div>
          <span class="hero__eyebrow">Passo 02 · Escalação</span>
          <h1 class="sel__title">Escale e <em>defina a tática</em></h1>
          <p class="sel__lead">Toque em dois atletas para trocar. Configure formação e estilo abaixo.</p>
        </div>
        <div class="sel__head-right">
          <button class="btn btn--ghost" id="back">← Voltar</button>
          <button class="btn btn--primary" id="iniciar">Iniciar partida →</button>
        </div>
      </header>

      <div class="esc__grid">
        <div class="esc__campo-wrap">
          <div class="esc__formacao-row">
            <label class="filtro">
              <span>FORMAÇÃO</span>
              <select id="f-form">
                ${Object.entries(FORMACOES).map(([k,v]) => `<option value="${k}" ${k===state.time.formacao?"selected":""}>${v.label}</option>`).join("")}
              </select>
            </label>
            <span class="esc__cap">Capitão: <strong id="capitao">—</strong></span>
          </div>
          <div class="campo" id="campo"></div>
        </div>

        <aside class="esc__side">
          <div class="esc__panel">
            <h3>TÁTICA</h3>
            <label class="esc__field">
              <span>Estilo de jogo</span>
              <div class="esc__seg" data-key="estilo">
                ${seg("estilo", ["posse","contra-ataque","pressing"])}
              </div>
            </label>
            <label class="esc__field">
              <span>Linha defensiva</span>
              <div class="esc__seg" data-key="linhaDef">
                ${seg("linhaDef", ["baixa","media","alta"])}
              </div>
            </label>
            <label class="esc__field">
              <span>Agressividade <em id="agr-val">${state.time.tatica.agressividade}</em></span>
              <input id="agr" type="range" min="0" max="100" value="${state.time.tatica.agressividade}" />
            </label>
          </div>

          <div class="esc__panel">
            <h3>BANCO (5)</h3>
            <div class="esc__banco" id="banco"></div>
          </div>

          <div class="esc__panel esc__panel--info">
            <h3>ADVERSÁRIO</h3>
            <div id="adv-info">—</div>
          </div>
        </aside>
      </div>
    </section>
  `;

  // Adversário aleatório fica fixo no estado pra mostrar
  if (!state.adversario) state.adversario = pickAdversarioAleatorio();
  refreshAdv();

  // Formação
  document.getElementById("f-form").addEventListener("change", (e) => {
    state.time.formacao = e.target.value;
    autoArranjar();
    renderCampo();
  });

  // Táticas segmentadas
  root.querySelectorAll(".esc__seg").forEach(seg => {
    const key = seg.getAttribute("data-key");
    seg.querySelectorAll("button").forEach(b => {
      b.addEventListener("click", () => {
        state.time.tatica[key] = b.getAttribute("data-val");
        seg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
      });
    });
  });

  // Agressividade
  const agr = document.getElementById("agr");
  agr.addEventListener("input", () => {
    state.time.tatica.agressividade = +agr.value;
    document.getElementById("agr-val").textContent = agr.value;
  });

  // Voltar / iniciar
  document.getElementById("back").addEventListener("click", () => go("selecao"));
  document.getElementById("iniciar").addEventListener("click", () => go("partida"));

  renderCampo();
  renderBanco();
  refreshCapitao();
}

function seg(key, vals) {
  return vals.map(v => `<button data-val="${v}" class="${state.time.tatica[key]===v?"on":""}">${v}</button>`).join("");
}

function autoArranjar() {
  // garante que os 11 titulares de state.time.titulares sigam a ordem da formação
  const formaSlots = FORMACOES[state.time.formacao].slots;
  const reservatorio = state.time.titulares.concat(state.time.reservas).map(id => ATLETAS.find(a => a.id === id));
  const usados = new Set();
  const novosTitulares = [];

  formaSlots.forEach(slot => {
    // pega o melhor disponível na posição do slot
    const candidato = reservatorio
      .filter(a => a && !usados.has(a.id) && a.pos === slot.pos)
      .sort((a,b) => b.overall - a.overall)[0]
      // fallback: qualquer um (caso o jogador não tenha o suficiente daquela posição)
      || reservatorio.filter(a => a && !usados.has(a.id)).sort((a,b) => b.overall - a.overall)[0];
    if (candidato) {
      usados.add(candidato.id);
      novosTitulares.push(candidato.id);
    }
  });

  const resto = reservatorio.filter(a => a && !usados.has(a.id)).map(a => a.id);
  state.time.titulares = novosTitulares;
  state.time.reservas = resto;
}

function renderCampo() {
  const campo = document.getElementById("campo");
  const slots = FORMACOES[state.time.formacao].slots;
  campo.innerHTML = `
    <svg viewBox="0 0 100 100" class="campo__svg" preserveAspectRatio="none">
      <!-- gramado listrado horizontal -->
      ${Array.from({length: 8}).map((_,i) => `
        <rect x="0" y="${i*12.5}" width="100" height="12.5" fill="${i%2?'#0E2417':'#1D4A2E'}"/>
      `).join("")}
      <!-- linhas brancas -->
      <rect x="3" y="3" width="94" height="94" fill="none" stroke="#EDE7D6" stroke-width="0.6"/>
      <line x1="3" y1="50" x2="97" y2="50" stroke="#EDE7D6" stroke-width="0.4"/>
      <circle cx="50" cy="50" r="9" fill="none" stroke="#EDE7D6" stroke-width="0.4"/>
      <circle cx="50" cy="50" r="0.8" fill="#EDE7D6"/>
      <!-- grande área (nosso lado em cima ou embaixo? bottom é o adversário) -->
      <rect x="28" y="3" width="44" height="14" fill="none" stroke="#EDE7D6" stroke-width="0.4"/>
      <rect x="38" y="3" width="24" height="6" fill="none" stroke="#EDE7D6" stroke-width="0.4"/>
      <rect x="28" y="83" width="44" height="14" fill="none" stroke="#EDE7D6" stroke-width="0.4"/>
      <rect x="38" y="91" width="24" height="6" fill="none" stroke="#EDE7D6" stroke-width="0.4"/>
    </svg>
    <div class="campo__pos" id="pos-layer"></div>
  `;
  const layer = document.getElementById("pos-layer");
  layer.innerHTML = state.time.titulares.map((id, i) => {
    const a = ATLETAS.find(x => x.id === id); if (!a) return "";
    const slot = slots[i];
    return `
      <button class="pos-tag ${selecionado===id?'pos-tag--sel':''}" data-id="${id}"
              style="left:${slot.x*100}%;top:${(1-slot.y)*100}%;--c1:${a.cor1};--c2:${a.cor2}">
        <span class="pos-tag__ovr">${a.overall}</span>
        <span class="pos-tag__name">${a.nome}</span>
        <span class="pos-tag__meta">${slot.pos}</span>
      </button>
    `;
  }).join("");
  layer.querySelectorAll("[data-id]").forEach(el => {
    el.addEventListener("click", () => clickPos(el.getAttribute("data-id")));
  });
}

function renderBanco() {
  const banco = document.getElementById("banco");
  banco.innerHTML = state.time.reservas.map(id => {
    const a = ATLETAS.find(x => x.id === id); if (!a) return "";
    return `
      <button class="banco-row ${selecionado===id?'banco-row--sel':''}" data-id="${id}">
        <span class="banco-row__pos">${a.pos}</span>
        <span class="banco-row__name">${a.nome}</span>
        <span class="banco-row__ovr">${a.overall}</span>
      </button>
    `;
  }).join("");
  banco.querySelectorAll("[data-id]").forEach(el => {
    el.addEventListener("click", () => clickPos(el.getAttribute("data-id")));
  });
}

function clickPos(id) {
  if (selecionado === null) {
    selecionado = id;
  } else if (selecionado === id) {
    selecionado = null;
  } else {
    trocar(selecionado, id);
    selecionado = null;
  }
  renderCampo();
  renderBanco();
}

function trocar(idA, idB) {
  // swap entre titulares e/ou reservas
  const tIdxA = state.time.titulares.indexOf(idA);
  const tIdxB = state.time.titulares.indexOf(idB);
  const rIdxA = state.time.reservas.indexOf(idA);
  const rIdxB = state.time.reservas.indexOf(idB);

  if (tIdxA >= 0 && tIdxB >= 0) { state.time.titulares[tIdxA] = idB; state.time.titulares[tIdxB] = idA; }
  else if (tIdxA >= 0 && rIdxB >= 0) { state.time.titulares[tIdxA] = idB; state.time.reservas[rIdxB] = idA; }
  else if (rIdxA >= 0 && tIdxB >= 0) { state.time.titulares[tIdxB] = idA; state.time.reservas[rIdxA] = idB; }
  else if (rIdxA >= 0 && rIdxB >= 0) { state.time.reservas[rIdxA] = idB; state.time.reservas[rIdxB] = idA; }
  refreshCapitao();
}

function refreshCapitao() {
  // capitão = atleta de maior overall no time
  const all = state.time.titulares.map(id => ATLETAS.find(a => a.id === id)).filter(Boolean);
  all.sort((a,b) => b.overall - a.overall);
  const cap = all[0];
  const span = document.getElementById("capitao");
  if (span && cap) span.textContent = `${cap.nome} (${cap.overall})`;
}

function refreshAdv() {
  const adv = state.adversario;
  const flag = FLAGS[adv.nac] || "🏳️";
  const ovrMedio = Math.round(adv.jogadores.reduce((s,j) => s+j.overall, 0) / 11);
  const el = document.getElementById("adv-info");
  el.innerHTML = `
    <div class="adv">
      <div class="adv__bar" style="background:${adv.cor1};color:${adv.cor2}">
        ${flag} ${adv.nome}
      </div>
      <div class="adv__row">overall médio · <strong>${ovrMedio}</strong></div>
      <div class="adv__row">formação · <strong>${adv.formacao}</strong></div>
      <div class="adv__row">tática · <strong>${adv.tatica.estilo}</strong></div>
    </div>
  `;
}

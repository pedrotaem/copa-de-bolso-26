/* resultado.js — F7: tela de resultado */
import { state, go } from "../util/state.js";
import { FLAGS } from "../data/athletes.js";

export function renderResultado(root) {
  const P = state.resultado;
  if (!P) { go("home"); return; }

  const meu = P.placar.MEU;
  const adv = P.placar.ADV;
  const vencedor = meu > adv ? "MEU" : meu < adv ? "ADV" : "EMP";
  const titulo = vencedor === "MEU" ? "VITÓRIA"
              : vencedor === "ADV" ? "DERROTA"
              : "EMPATE";
  const cor = vencedor === "MEU" ? "var(--phosphor)"
            : vencedor === "ADV" ? "var(--accent)"
            : "var(--mostarda)";

  const totalPosse = P.stats.MEU.posseTicks + P.stats.ADV.posseTicks || 1;
  const posseMeu = Math.round(P.stats.MEU.posseTicks / totalPosse * 100);
  const posseAdv = 100 - posseMeu;

  // MVP = autor com mais gols ou, em empate, melhor overall do time vencedor
  let mvp = null;
  const gols = [...P.stats.MEU.gols, ...P.stats.ADV.gols];
  const golsPorAutor = {};
  gols.forEach(g => { golsPorAutor[g.autorId] = (golsPorAutor[g.autorId] || 0) + 1; });
  const topGoleadorId = Object.entries(golsPorAutor).sort((a,b) => b[1] - a[1])[0]?.[0];
  if (topGoleadorId) mvp = P.jogadores.find(j => j.id === topGoleadorId);
  if (!mvp) {
    const elenco = vencedor === "MEU" ? P.jogadores.filter(j => j.time === "MEU") : P.jogadores.filter(j => j.time === "ADV");
    mvp = elenco.sort((a,b) => b.overall - a.overall)[0];
  }

  root.innerHTML = `
    <section class="result">
      <div class="result__main">
        <span class="hero__eyebrow">Fim de jogo</span>
        <h1 class="result__title" style="color:${cor}">${titulo}</h1>
        <div class="result__placar">
          <div class="result__col">
            <div class="result__sname">${state.time.nome}</div>
            <div class="result__score">${meu}</div>
          </div>
          <div class="result__vs">×</div>
          <div class="result__col">
            <div class="result__sname">${FLAGS[state.adversario.nac] || ""} ${state.adversario.nome}</div>
            <div class="result__score">${adv}</div>
          </div>
        </div>

        <div class="result__stats">
          <div class="stat">
            <div class="stat__label">POSSE</div>
            <div class="stat__bar">
              <div class="stat__fill stat__fill--meu" style="width:${posseMeu}%"></div>
            </div>
            <div class="stat__vals">
              <span>${posseMeu}%</span>
              <span>${posseAdv}%</span>
            </div>
          </div>
          <div class="stat-row">
            <div class="stat-mini"><strong>${P.stats.MEU.chutes}</strong><span>chutes</span></div>
            <div class="stat-mini stat-mini--mid">Chutes</div>
            <div class="stat-mini"><strong>${P.stats.ADV.chutes}</strong><span>chutes</span></div>
          </div>
          <div class="stat-row">
            <div class="stat-mini"><strong>${P.stats.MEU.chutesNoGol}</strong><span>no gol</span></div>
            <div class="stat-mini stat-mini--mid">No gol</div>
            <div class="stat-mini"><strong>${P.stats.ADV.chutesNoGol}</strong><span>no gol</span></div>
          </div>
        </div>

        ${mvp ? `
        <div class="result__mvp">
          <div class="result__mvp-eyebrow">MVP DA PARTIDA</div>
          <div class="result__mvp-name" style="color:${mvp.cor1 || 'var(--accent)'}">${mvp.nome}</div>
          <div class="result__mvp-meta">${mvp.pos} · overall ${mvp.overall}</div>
        </div>` : ""}

        <div class="result__gols">
          <h3>GOLS</h3>
          ${gols.length === 0 ? `<div class="result__gols-empty">0 a 0. Que jogo travado.</div>` : ""}
          ${gols.sort((a,b) => a.minuto - b.minuto).map(g => `
            <div class="ev"><span class="ev__min">${g.minuto}'</span> ⚽ ${g.autorNome}</div>
          `).join("")}
        </div>

        <div class="result__cta">
          <button class="btn btn--primary" id="r-again">jogar de novo →</button>
          <button class="btn btn--ghost" id="r-team">trocar time</button>
          <button class="btn btn--ghost" id="r-home">início</button>
        </div>
      </div>
    </section>
  `;

  document.getElementById("r-again").addEventListener("click", () => {
    // sortear novo adversário e jogar com mesmo time
    state.adversario = null;
    state.resultado = null;
    go("escalacao");
  });
  document.getElementById("r-team").addEventListener("click", () => {
    state.resultado = null;
    state.adversario = null;
    state.time.titulares = [];
    state.time.reservas = [];
    go("selecao");
  });
  document.getElementById("r-home").addEventListener("click", () => {
    state.resultado = null;
    go("home");
  });
}

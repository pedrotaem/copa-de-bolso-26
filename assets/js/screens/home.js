/* home.js — tela inicial */
import { go } from "../util/state.js";

export function renderHome(root) {
  root.innerHTML = `
    <section class="hero">
      <div class="hero__copy">
        <span class="hero__eyebrow">Copa de Bolso · 2026</span>
        <h1 class="hero__title">
          Monte seu time.<br/>
          Veja o jogo<br/>
          <em>acontecer.</em>
        </h1>
        <p class="hero__lead">
          Escolha 16 lendas de toda a história das Copas — você é o técnico.
          Defina a formação e a tática, e assiste a partida rolar em pixel art.
          Substitua, mude o esquema, goleie.
        </p>
        <div class="hero__cta">
          <button class="btn btn--primary" data-go="selecao">Jogar agora →</button>
          <button class="btn btn--ghost" data-go="multi">Com amigos <span class="pill pill--mostarda" style="margin-left:8px">novo</span></button>
        </div>
      </div>

      <div class="hero__art" aria-hidden="true">
        <div class="hero__art-inner">
          <div class="hero__scoreboard">
            <span class="score">3</span>
            <span class="vs">×</span>
            <span class="score">0</span>
            <span style="margin-left:16px;">90'</span>
          </div>
          <div class="hero__legend">
            <div class="chip">El Maestro<span>10 · meia · AR</span></div>
            <div class="chip">O Fenômeno<span>09 · ata · BR</span></div>
            <div class="chip">Der Bomber<span>13 · ata · DE</span></div>
            <div class="chip">The Phantom<span>11 · meia · UK</span></div>
            <div class="chip">La Muralla<span>04 · zag · UY</span></div>
            <div class="chip">Le Magicien<span>10 · ata · FR</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="steps" aria-label="Como jogar">
      <div class="step">
        <span class="step__num">01</span>
        <span class="step__title">MONTE</span>
        <span class="step__desc">Escolha 16 atletas (11 titulares + 5 reservas) entre lendas de várias eras.</span>
      </div>
      <div class="step">
        <span class="step__num">02</span>
        <span class="step__title">DEFINA</span>
        <span class="step__desc">Formação, estilo de jogo, linha defensiva e agressividade.</span>
      </div>
      <div class="step">
        <span class="step__num">03</span>
        <span class="step__title">ASSISTA</span>
        <span class="step__desc">Veja o jogo rolar em pixel art. Substitua, mude tática, vença.</span>
      </div>
    </section>

    <div class="counters">
      <span><strong>30</strong> lendas</span>
      <span><strong>4</strong> formações</span>
      <span><strong>6</strong> seleções adversárias</span>
      <span><strong>90'</strong> de jogo simulado</span>
    </div>
  `;

  root.querySelectorAll("[data-go]").forEach((el) => {
    el.addEventListener("click", () => {
      const r = el.getAttribute("data-go");
      if (r === "multi") {
        alert("Multiplayer online — em breve.\nPor enquanto, single player vs CPU já está disponível.");
        return;
      }
      go(r);
    });
  });
}

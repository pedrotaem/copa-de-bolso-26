/* main.js — entry point + router minimalista */
import { state, subscribe, go } from "./util/state.js";
import { renderHome } from "./screens/home.js";
import { renderSelecao } from "./screens/selecao.js";
import { renderEscalacao } from "./screens/escalacao.js";
import { renderPartida, cleanupPartida } from "./screens/partida.js";
import { renderResultado } from "./screens/resultado.js";
import { initHeader } from "./ui/header.js";

const app = document.getElementById("app");

/* placeholder screens (serão implementadas em F2..F7) */
function renderPlaceholder(root, titulo, descricao, voltar = "home") {
  root.innerHTML = `
    <section class="hero" style="grid-template-columns: 1fr;">
      <div>
        <span class="hero__eyebrow">Em construção · ${titulo}</span>
        <h1 class="hero__title">${titulo}</h1>
        <p class="hero__lead">${descricao}</p>
        <button class="btn" data-back>← Voltar</button>
      </div>
    </section>
  `;
  root.querySelector("[data-back]").addEventListener("click", () => go(voltar));
}

function router() {
  switch (state.rota) {
    case "home":       return renderHome(app);
    case "selecao":    return renderSelecao(app);
    case "escalacao":  return renderEscalacao(app);
    case "partida":    return renderPartida(app);
    case "resultado":  return renderResultado(app);
    default:           return renderHome(app);
  }
}

/* re-render em qualquer mudança de rota */
subscribe((_, ev) => {
  if (ev === "rota" || ev === "change") {
    cleanupPartida();
    router();
  }
});

/* boot */
initHeader();
router();

/* expor pra debug em dev */
window.__copa = { state, go };

/* selecao.js — F2: draft de atletas em 3 colunas
   [esquerda] lista de jogadores (nome, país, barras chapadas, arte pixel reduzida)
   [centro]   detalhe do atleta selecionado (pixel expandida, gráfico teia, time atual)
   [direita]  seu time (16) */
import { state, go } from "../util/state.js";
import { ATLETAS, FLAGS, POS_LABEL, POS_ORDEM } from "../data/athletes.js";
import { faceToCanvas } from "../data/pixelart.js";

const TOTAL = 16;
const PAGE_SIZE = 20;   // atletas por página
const VISIVEIS = 5;     // atletas visíveis ao mesmo tempo no scroll
let filtros = { pos: "TODAS", era: "TODAS", nac: "TODAS", busca: "" };
let selectedId = null;
let pagina = 1;         // página atual da lista

/* atributos */
const ATTR_FULL = [
  ["vel", "VEL"], ["res", "RES"], ["drb", "DRB"], ["pas", "PAS"], ["fin", "FIN"],
  ["frc", "FRC"], ["def", "DEF"], ["vis", "VIS"], ["ref", "REF"],
];
const ATTR_LIST = [["vel","VEL"],["drb","DRB"],["pas","PAS"],["fin","FIN"],["def","DEF"],["vis","VIS"]];

/* barras: cor única, independente do valor (pedido do design) */
function flatBars(a, lista) {
  return lista.map(([k, lbl]) => {
    const v = a.atr[k];
    return `
      <div class="attr">
        <span class="attr__lbl">${lbl}</span>
        <span class="attr__track"><span class="attr__fill attr__fill--flat" style="width:${v}%"></span></span>
        <span class="attr__val">${v}</span>
      </div>`;
  }).join("");
}

/* gráfico teia (radar) com os 9 atributos */
function radarSVG(a) {
  const cx = 110, cy = 108, R = 84;
  const N = ATTR_FULL.length;
  const pt = (i, r) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r];
  };
  // anéis de grade
  let grid = "";
  for (const frac of [0.25, 0.5, 0.75, 1]) {
    const poly = Array.from({ length: N }, (_, i) => pt(i, R * frac).map(n => n.toFixed(1)).join(",")).join(" ");
    grid += `<polygon points="${poly}" class="radar__ring"/>`;
  }
  // eixos + rótulos
  let axes = "", labels = "";
  ATTR_FULL.forEach(([k, lbl], i) => {
    const [x, y] = pt(i, R);
    axes += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="radar__axis"/>`;
    const [lx, ly] = pt(i, R + 16);
    labels += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" class="radar__lbl" text-anchor="middle" dominant-baseline="middle">${lbl}</text>`;
  });
  // polígono do atleta
  const poly = ATTR_FULL.map(([k], i) => pt(i, R * (a.atr[k] / 99)).map(n => n.toFixed(1)).join(",")).join(" ");
  const dots = ATTR_FULL.map(([k], i) => {
    const [x, y] = pt(i, R * (a.atr[k] / 99));
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" class="radar__dot"/>`;
  }).join("");
  return `
    <svg class="radar" viewBox="0 0 220 220" role="img" aria-label="Gráfico de atributos">
      ${grid}${axes}
      <polygon points="${poly}" class="radar__area"/>
      ${dots}${labels}
    </svg>`;
}

export function renderSelecao(root) {
  state.atletas = ATLETAS;

  root.innerHTML = `
    <section class="sel">
      <header class="sel__head">
        <div>
          <span class="hero__eyebrow">Passo 01 · Monte sua seleção</span>
          <h1 class="sel__title">Escolha <em>${TOTAL}</em> atletas</h1>
          <p class="sel__lead">11 titulares + 5 reservas. Misture eras como quiser.</p>
        </div>
        <div class="sel__head-right">
          <div class="sel__counter" id="counter">0 / ${TOTAL}</div>
          <button class="btn btn--primary" id="continuar" disabled>Continuar →</button>
          <button class="btn btn--ghost" id="voltar">← Início</button>
        </div>
      </header>

      <div class="sel__filtros">
        <label class="filtro">
          <span>POSIÇÃO</span>
          <select id="f-pos">
            <option value="TODAS">Todas</option>
            ${POS_ORDEM.map(p => `<option value="${p}">${POS_LABEL[p]}</option>`).join("")}
          </select>
        </label>
        <label class="filtro">
          <span>ERA</span>
          <select id="f-era">
            <option value="TODAS">Todas</option>
            ${[...new Set(ATLETAS.map(a => a.era))].sort().map(e => `<option value="${e}">${e}</option>`).join("")}
          </select>
        </label>
        <label class="filtro">
          <span>NAÇÃO</span>
          <select id="f-nac">
            <option value="TODAS">Todas</option>
            ${[...new Set(ATLETAS.map(a => a.nac))].sort().map(n => `<option value="${n}">${FLAGS[n] || ""} ${n}</option>`).join("")}
          </select>
        </label>
        <label class="filtro filtro--busca">
          <span>BUSCAR</span>
          <input id="f-busca" type="search" placeholder="ex: maestro" />
        </label>
      </div>

      <div class="draft3">
        <div class="draft3__col">
          <div class="draft3__list" id="lista" aria-label="Catálogo de atletas"></div>
          <nav class="draft3__pager" id="pager" aria-label="Paginação do catálogo"></nav>
        </div>
        <div class="draft3__detail" id="detalhe" aria-live="polite"></div>
        <aside class="sel__time" aria-label="Seu time">
          <header>
            <h2>SEU TIME</h2>
            <span class="counter-line"><span id="counter-aside">0</span> / ${TOTAL}</span>
          </header>
          <div class="sel__time-cols" id="time-cols"></div>
          <footer class="sel__time-tip">
            <span>Mínimo: 1 GOL · 4 DEF · 3 MEI · 2 ATA</span>
          </footer>
        </aside>
      </div>
    </section>
  `;

  document.getElementById("voltar").addEventListener("click", () => go("home"));
  document.getElementById("continuar").addEventListener("click", () => {
    const sel = state.time.titulares.concat(state.time.reservas);
    state.time.titulares = sel.slice(0, 11);
    state.time.reservas = sel.slice(11);
    go("escalacao");
  });

  ["f-pos","f-era","f-nac"].forEach(id => {
    document.getElementById(id).addEventListener("change", (e) => {
      filtros[id.split("-")[1]] = e.target.value;
      pagina = 1;
      renderLista({ keepScroll: false });
    });
  });
  document.getElementById("f-busca").addEventListener("input", (e) => {
    filtros.busca = e.target.value.toLowerCase();
    pagina = 1;
    renderLista({ keepScroll: false });
  });

  renderLista();
  renderTime();
}

function selecionados() {
  return new Set(state.time.titulares.concat(state.time.reservas));
}

function filtrar() {
  return ATLETAS.filter(a =>
    (filtros.pos === "TODAS" || a.pos === filtros.pos) &&
    (filtros.era === "TODAS" || a.era === filtros.era) &&
    (filtros.nac === "TODAS" || a.nac === filtros.nac) &&
    (!filtros.busca || (a.nome + " " + a.apelido).toLowerCase().includes(filtros.busca))
  );
}

function toggleAtleta(id) {
  const all = state.time.titulares.concat(state.time.reservas);
  if (all.includes(id)) {
    state.time.titulares = state.time.titulares.filter(x => x !== id);
    state.time.reservas = state.time.reservas.filter(x => x !== id);
  } else if (all.length < TOTAL) {
    state.time.titulares.push(id);
  } else {
    flash("Time cheio (16/16). Remova alguém antes.");
    return;
  }
  renderLista();
  renderTime();
  renderDetalhe();
}

/* ---- coluna esquerda: lista ---- */
function renderLista(opts = {}) {
  const keepScroll = opts.keepScroll !== false; // padrão: mantém o scroll
  const lista = document.getElementById("lista");
  const pager = document.getElementById("pager");
  const prevScroll = lista.scrollTop;
  const sel = selecionados();
  const itens = ordenarBrPrimeiro(filtrar());
  if (!itens.length) {
    lista.innerHTML = `<div class="empty">Nenhum atleta com esses filtros.</div>`;
    lista.style.maxHeight = "";
    if (pager) pager.innerHTML = "";
    selectedId = null;
    renderDetalhe();
    return;
  }
  if (!selectedId || !itens.some(a => a.id === selectedId)) selectedId = itens[0].id;

  // paginação: 20 por página
  const totalPaginas = Math.ceil(itens.length / PAGE_SIZE);
  pagina = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (pagina - 1) * PAGE_SIZE;
  const pageItens = itens.slice(inicio, inicio + PAGE_SIZE);

  lista.innerHTML = pageItens.map(a => rowAtleta(a, sel.has(a.id), a.id === selectedId)).join("");
  lista.scrollTop = keepScroll ? prevScroll : 0;
  lista.querySelectorAll("[data-face]").forEach(slot => {
    const a = ATLETAS.find(x => x.id === slot.getAttribute("data-face"));
    if (a) slot.appendChild(faceToCanvas(a, 3));
  });
  lista.querySelectorAll("[data-toggle]").forEach(el => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleAtleta(el.getAttribute("data-toggle"));
    });
  });
  lista.querySelectorAll("[data-pick]").forEach(el => {
    el.addEventListener("click", () => {
      selectedId = el.getAttribute("data-pick");
      renderLista();
      renderDetalhe();
    });
  });

  ajustarAlturaScroll(lista);
  renderPager(pager, totalPaginas, itens.length);
  renderDetalhe();
}

/* atletas brasileiros (nac "BR") primeiro; mantém a ordem relativa do resto (sort estável) */
function ordenarBrPrimeiro(itens) {
  return itens.slice().sort((a, b) => (a.nac === "BR" ? 0 : 1) - (b.nac === "BR" ? 0 : 1));
}

/* fixa a altura da lista pra mostrar VISIVEIS atletas por vez; o resto fica no scroll */
function ajustarAlturaScroll(lista) {
  const rows = lista.querySelectorAll(".prow");
  if (!rows.length) { lista.style.maxHeight = ""; return; }
  const gap = parseFloat(getComputedStyle(lista).rowGap) || 8;
  const h = rows[0].getBoundingClientRect().height;
  lista.style.maxHeight = (h * VISIVEIS + gap * (VISIVEIS - 1)) + "px";
}

/* controles de paginação: anterior · indicador · próxima */
function renderPager(pager, totalPaginas, totalItens) {
  if (!pager) return;
  if (totalPaginas <= 1) {
    pager.innerHTML = `<span class="pager__info">${totalItens} atleta${totalItens === 1 ? "" : "s"}</span>`;
    return;
  }
  pager.innerHTML = `
    <button class="btn btn--ghost pager__btn" id="pg-prev" ${pagina <= 1 ? "disabled" : ""} aria-label="Página anterior">←</button>
    <span class="pager__info">Página ${pagina} de ${totalPaginas} · ${totalItens} atletas</span>
    <button class="btn btn--ghost pager__btn" id="pg-next" ${pagina >= totalPaginas ? "disabled" : ""} aria-label="Próxima página">→</button>`;
  const prev = pager.querySelector("#pg-prev");
  const next = pager.querySelector("#pg-next");
  if (prev) prev.addEventListener("click", () => { pagina--; renderLista({ keepScroll: false }); });
  if (next) next.addEventListener("click", () => { pagina++; renderLista({ keepScroll: false }); });
}

function rowAtleta(a, ativo, sel) {
  const flag = FLAGS[a.nac] || "🏳️";
  return `
    <div class="prow ${ativo ? "prow--on" : ""} ${sel ? "prow--sel" : ""}" data-pick="${a.id}" style="--c1:${a.cor1};--c2:${a.cor2}">
      <div class="prow__face" data-face="${a.id}"></div>
      <div class="prow__body">
        <div class="prow__top">
          <span class="prow__name">${a.nome}</span>
          <span class="prow__pos">${a.pos}</span>
        </div>
        <div class="prow__nac">${flag} ${a.nac} · ${a.era}</div>
        <div class="prow__bars">${flatBars(a, ATTR_LIST)}</div>
      </div>
      <button class="prow__add" data-toggle="${a.id}" title="${ativo ? "Remover do time" : "Adicionar ao time"}">${ativo ? "✓" : "+"}</button>
    </div>`;
}

/* ---- coluna central: detalhe ---- */
function renderDetalhe() {
  const box = document.getElementById("detalhe");
  if (!box) return;
  const a = ATLETAS.find(x => x.id === selectedId);
  if (!a) {
    box.innerHTML = `<div class="draft3__empty">Selecione um atleta na lista.</div>`;
    return;
  }
  const flag = FLAGS[a.nac] || "🏳️";
  const ativo = selecionados().has(a.id);
  const clube = a.clube || "Sem clube";
  box.innerHTML = `
    <div class="dcard" style="--c1:${a.cor1};--c2:${a.cor2}">
      <div class="dcard__hero">
        <div class="dcard__face"></div>
        <div class="dcard__id">
          <div class="dcard__ovr">${a.overall}</div>
          <h2 class="dcard__name">${a.nome}</h2>
          <div class="dcard__sub">${a.apelido} · ${flag} ${a.nac} · ${a.era}</div>
          <div class="dcard__pos">${POS_LABEL[a.pos]} · ${a.estilo}</div>
        </div>
      </div>
      <div class="dcard__team">
        <span class="dcard__team-lbl">TIME ATUAL</span>
        <span class="dcard__team-val">${clube}</span>
      </div>
      <div class="dcard__radar">${radarSVG(a)}</div>
      <div class="dcard__attrs">${flatBars(a, ATTR_FULL)}</div>
      <button class="btn btn--primary dcard__add" data-toggle="${a.id}">
        ${ativo ? "✓ no time — remover" : "+ adicionar ao time"}
      </button>
    </div>`;
  box.querySelector(".dcard__face").appendChild(faceToCanvas(a, 11));
  box.querySelector("[data-toggle]").addEventListener("click", () => toggleAtleta(a.id));
}

/* ---- coluna direita: seu time ---- */
function renderTime() {
  const cols = document.getElementById("time-cols");
  const sel = state.time.titulares.concat(state.time.reservas);
  const count = sel.length;

  document.getElementById("counter").textContent = `${count} / ${TOTAL}`;
  document.getElementById("counter-aside").textContent = count;
  document.getElementById("continuar").disabled = count !== TOTAL || !temMinimos(sel);

  const byPos = {};
  POS_ORDEM.forEach(p => byPos[p] = []);
  sel.forEach(id => {
    const a = ATLETAS.find(x => x.id === id);
    if (a) byPos[a.pos].push(a);
  });

  cols.innerHTML = POS_ORDEM.map(p => `
    <div class="time-col">
      <h3>${POS_LABEL[p]} <span>(${byPos[p].length})</span></h3>
      ${byPos[p].map(a => `
        <button class="time-row" data-toggle="${a.id}">
          <span class="time-row__num">${a.overall}</span>
          <span class="time-row__name">${a.nome}</span>
          <span class="time-row__x">×</span>
        </button>`).join("") || `<div class="time-row time-row--empty">vazio</div>`}
    </div>
  `).join("");

  cols.querySelectorAll("[data-toggle]").forEach(el => {
    el.addEventListener("click", () => toggleAtleta(el.getAttribute("data-toggle")));
  });
}

function temMinimos(sel) {
  const c = { GOL: 0, ZAG: 0, LAT: 0, MEI: 0, ATA: 0 };
  sel.forEach(id => {
    const a = ATLETAS.find(x => x.id === id);
    if (a) c[a.pos]++;
  });
  return c.GOL >= 1 && (c.ZAG + c.LAT) >= 4 && c.MEI >= 3 && c.ATA >= 2;
}

function flash(msg) {
  let el = document.querySelector(".flash");
  if (!el) {
    el = document.createElement("div");
    el.className = "flash";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("flash--on");
  clearTimeout(flash._t);
  flash._t = setTimeout(() => el.classList.remove("flash--on"), 2200);
}

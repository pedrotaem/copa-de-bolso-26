/* state.js — estado global do jogo + pub/sub minimalista */

const subscribers = new Map();
let nextId = 1;

export const state = {
  rota: "home",                    // home | selecao | escalacao | partida | resultado
  usuario: null,                   // null = visitante; { uid, nome, email, foto } quando logado
  tecnico: "Visitante",            // nome exibido; vira o 1º nome do usuário ao logar
  // catálogo
  atletas: [],                     // carregado via data/athletes.js
  // construção de time
  time: {
    nome: "Time de Bolso",
    titulares: [],                 // ids de atletas (11)
    reservas: [],                  // ids (5)
    formacao: "4-4-2",
    tatica: { estilo: "posse", linhaDef: "media", agressividade: 60 },
  },
  // adversário
  adversario: null,                // setado ao iniciar partida
  // partida em andamento
  partida: null,                   // { placar, eventos, ... } setado em F4/F5
  // resultado
  resultado: null,
};

export function subscribe(fn) {
  const id = nextId++;
  subscribers.set(id, fn);
  return () => subscribers.delete(id);
}

export function emit(event = "change") {
  for (const fn of subscribers.values()) {
    try { fn(state, event); } catch (e) { console.error(e); }
  }
}

export function go(rota) {
  state.rota = rota;
  emit("rota");
}

/* PRNG seedable mulberry32 — uso na simulação */
export function makeRng(seed = Date.now()) {
  let t = seed >>> 0;
  return function rng() {
    t |= 0; t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

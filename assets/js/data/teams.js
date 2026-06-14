/* teams.js — 6 seleções adversárias ficcionais pré-montadas (4-4-2)
   Cada uma com 11 titulares gerados rapidamente. Atributos médios variados. */

function gerarJogador(id, time, pos, base) {
  // base ~ overall alvo (75-87). Aplicamos variação por atributo conforme posição.
  const r = () => Math.max(40, Math.min(95, Math.round(base + (Math.random() - 0.5) * 14)));
  const r2 = (b, low, high) => Math.max(low, Math.min(high, Math.round(b + (Math.random() - 0.5) * 12)));
  const tpl = {
    GOL: { vel: r2(60, 50, 75), res: r2(78, 70, 85), drb: 30, pas: r2(60, 50, 75), fin: 18,
           frc: r2(80, 70, 90), def: r2(85, 75, 95), vis: r2(80, 70, 88), ref: r2(86, 75, 95) },
    ZAG: { vel: r2(68, 55, 80), res: r2(85, 75, 92), drb: r2(55, 45, 70), pas: r2(72, 60, 85),
           fin: r2(45, 30, 60), frc: r2(85, 75, 95), def: r2(86, 75, 94), vis: r2(80, 70, 90), ref: 55 },
    LAT: { vel: r2(85, 75, 95), res: r2(88, 80, 95), drb: r2(72, 60, 85), pas: r2(78, 65, 88),
           fin: r2(60, 45, 75), frc: r2(72, 60, 82), def: r2(75, 65, 85), vis: r2(78, 65, 88), ref: 50 },
    MEI: { vel: r2(78, 65, 90), res: r2(86, 78, 95), drb: r2(82, 70, 92), pas: r2(86, 75, 95),
           fin: r2(78, 65, 90), frc: r2(72, 60, 84), def: r2(60, 45, 75), vis: r2(88, 75, 96), ref: 50 },
    ATA: { vel: r2(88, 75, 96), res: r2(82, 72, 90), drb: r2(85, 70, 95), pas: r2(75, 65, 85),
           fin: r2(88, 75, 96), frc: r2(80, 65, 92), def: r2(38, 25, 55), vis: r2(80, 70, 90), ref: 50 },
  }[pos];
  const cor1 = time.cor1, cor2 = time.cor2;
  return { id, nome: time.gerarNome(pos), apelido: "", era: time.era, nac: time.nac, pos,
           estilo: "Genérico", atr: tpl, overall: 0, cor1, cor2, isCPU: true };
}

function overall(a) {
  const w = {
    GOL: { ref: 4, def: 3, vis: 2, frc: 1, res: 1 },
    ZAG: { def: 4, frc: 3, vis: 2, pas: 1, res: 1 },
    LAT: { vel: 3, res: 3, pas: 2, drb: 2, def: 1 },
    MEI: { pas: 3, vis: 3, drb: 2, fin: 1, res: 1 },
    ATA: { fin: 4, vel: 3, drb: 2, frc: 1, pas: 1 },
  }[a.pos];
  let s = 0, t = 0;
  for (const k in w) { s += a.atr[k] * w[k]; t += w[k]; }
  return Math.round(s / t);
}

const SOBRENOMES_BR = ["Silva", "Souza", "Oliveira", "Pereira", "Santos", "Lima", "Rocha", "Almeida", "Nunes", "Castro", "Ribeiro"];
const SOBRENOMES_GE = ["Müller", "Schmidt", "Weber", "Becker", "Hoffmann", "Wagner", "König", "Klein", "Fischer", "Lehmann", "Schulz"];
const NOMES = {
  BR: () => `${["Lucas","Bruno","Diego","Caio","Mateus","Rafael","Felipe","Tiago","Vinícius","Davi"][Math.floor(Math.random()*10)]} ${SOBRENOMES_BR[Math.floor(Math.random()*SOBRENOMES_BR.length)]}`,
  DE: () => `${["Hans","Felix","Lukas","Jonas","Niklas","Max","Tobias","Stefan","Erik","Otto"][Math.floor(Math.random()*10)]} ${SOBRENOMES_GE[Math.floor(Math.random()*SOBRENOMES_GE.length)]}`,
  AR: () => `${["Diego","Sergio","Juan","Pablo","Martín","Carlos","Luis","Hernán","Mateo","Lucas"][Math.floor(Math.random()*10)]} ${["López","González","Rodríguez","Pérez","Sánchez","Romero","Fernández","Díaz","Acosta"][Math.floor(Math.random()*9)]}`,
  ES: () => `${["Pablo","Javier","Iván","Sergio","Marco","David","Álvaro","Rubén","Mario","Luis"][Math.floor(Math.random()*10)]} ${["García","Martínez","López","Rodríguez","Sánchez","Pérez","Gómez","Ruiz","Torres"][Math.floor(Math.random()*9)]}`,
  FR: () => `${["Antoine","Hugo","Lucas","Théo","Mathis","Jules","Léo","Paul","Maxime","Adrien"][Math.floor(Math.random()*10)]} ${["Bernard","Dubois","Thomas","Robert","Petit","Durand","Leroy","Moreau","Simon"][Math.floor(Math.random()*9)]}`,
  IT: () => `${["Marco","Luca","Andrea","Matteo","Davide","Stefano","Lorenzo","Federico","Alessandro","Giuseppe"][Math.floor(Math.random()*10)]} ${["Rossi","Ferrari","Russo","Bianchi","Romano","Colombo","Ricci","Conti","Marino"][Math.floor(Math.random()*9)]}`,
};

function montar(time) {
  const lineup = [];
  const posList = ["GOL","LAT","ZAG","ZAG","LAT","MEI","MEI","MEI","MEI","ATA","ATA"];
  posList.forEach((p, i) => {
    const j = gerarJogador(`${time.id}_${i}`, time, p, time.base);
    j.overall = overall(j);
    lineup.push(j);
  });
  return lineup;
}

const TIMES_DEF = [
  { id: "carmim", nome: "Seleção Carmim", nac: "BR", cor1: "#E2342B", cor2: "#FFFFFF", base: 84,
    era: "2026", gerarNome: NOMES.BR },
  { id: "azul-mar", nome: "Seleção Azul-do-Mar", nac: "IT", cor1: "#0F4DA8", cor2: "#FFFFFF", base: 82,
    era: "2026", gerarNome: NOMES.IT },
  { id: "panzer", nome: "Seleção Panzer", nac: "DE", cor1: "#1B1A17", cor2: "#F5B11E", base: 83,
    era: "2026", gerarNome: NOMES.DE },
  { id: "albiceleste", nome: "Seleção Pampa", nac: "AR", cor1: "#7CB9E8", cor2: "#FFFFFF", base: 85,
    era: "2026", gerarNome: NOMES.AR },
  { id: "fúria", nome: "Seleção Fúria Vermelha", nac: "ES", cor1: "#C60B1E", cor2: "#FFC400", base: 82,
    era: "2026", gerarNome: NOMES.ES },
  { id: "les_bleus", nome: "Seleção Tricolor", nac: "FR", cor1: "#0055A4", cor2: "#EF4135", base: 84,
    era: "2026", gerarNome: NOMES.FR },
];

export const TIMES_ADVERSARIOS = TIMES_DEF.map(t => ({
  id: t.id, nome: t.nome, nac: t.nac, cor1: t.cor1, cor2: t.cor2, era: t.era, base: t.base,
  jogadores: montar(t),
  formacao: "4-4-2",
  tatica: { estilo: "posse", linhaDef: "media", agressividade: 60 },
}));

export function pickAdversarioAleatorio(seed) {
  const i = (seed || Date.now()) % TIMES_ADVERSARIOS.length;
  return TIMES_ADVERSARIOS[Math.floor(i)];
}

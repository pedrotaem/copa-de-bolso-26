/* formacoes.js — posições normalizadas (0..1) no campo
   Campo: 0,0 = topo-esquerda (gol do time); 1,1 = baixo-direita (gol adversário)
   Usado tanto na tela de escalação quanto na simulação (multiplicar pelo tamanho do campo). */

export const FORMACOES = {
  "4-4-2": {
    label: "4-4-2 Clássico",
    slots: [
      { pos: "GOL", x: 0.5,  y: 0.08 },
      { pos: "LAT", x: 0.15, y: 0.25 },
      { pos: "ZAG", x: 0.38, y: 0.22 },
      { pos: "ZAG", x: 0.62, y: 0.22 },
      { pos: "LAT", x: 0.85, y: 0.25 },
      { pos: "MEI", x: 0.18, y: 0.5 },
      { pos: "MEI", x: 0.4,  y: 0.5 },
      { pos: "MEI", x: 0.6,  y: 0.5 },
      { pos: "MEI", x: 0.82, y: 0.5 },
      { pos: "ATA", x: 0.38, y: 0.78 },
      { pos: "ATA", x: 0.62, y: 0.78 },
    ],
  },
  "4-3-3": {
    label: "4-3-3 Ofensivo",
    slots: [
      { pos: "GOL", x: 0.5,  y: 0.08 },
      { pos: "LAT", x: 0.15, y: 0.25 },
      { pos: "ZAG", x: 0.38, y: 0.22 },
      { pos: "ZAG", x: 0.62, y: 0.22 },
      { pos: "LAT", x: 0.85, y: 0.25 },
      { pos: "MEI", x: 0.3,  y: 0.5 },
      { pos: "MEI", x: 0.5,  y: 0.45 },
      { pos: "MEI", x: 0.7,  y: 0.5 },
      { pos: "ATA", x: 0.18, y: 0.78 },
      { pos: "ATA", x: 0.5,  y: 0.82 },
      { pos: "ATA", x: 0.82, y: 0.78 },
    ],
  },
  "3-5-2": {
    label: "3-5-2 Médio",
    slots: [
      { pos: "GOL", x: 0.5,  y: 0.08 },
      { pos: "ZAG", x: 0.3,  y: 0.22 },
      { pos: "ZAG", x: 0.5,  y: 0.2 },
      { pos: "ZAG", x: 0.7,  y: 0.22 },
      { pos: "LAT", x: 0.1,  y: 0.5 },
      { pos: "MEI", x: 0.3,  y: 0.5 },
      { pos: "MEI", x: 0.5,  y: 0.48 },
      { pos: "MEI", x: 0.7,  y: 0.5 },
      { pos: "LAT", x: 0.9,  y: 0.5 },
      { pos: "ATA", x: 0.38, y: 0.78 },
      { pos: "ATA", x: 0.62, y: 0.78 },
    ],
  },
  "5-3-2": {
    label: "5-3-2 Defensivo",
    slots: [
      { pos: "GOL", x: 0.5,  y: 0.08 },
      { pos: "LAT", x: 0.1,  y: 0.25 },
      { pos: "ZAG", x: 0.3,  y: 0.2 },
      { pos: "ZAG", x: 0.5,  y: 0.18 },
      { pos: "ZAG", x: 0.7,  y: 0.2 },
      { pos: "LAT", x: 0.9,  y: 0.25 },
      { pos: "MEI", x: 0.3,  y: 0.5 },
      { pos: "MEI", x: 0.5,  y: 0.48 },
      { pos: "MEI", x: 0.7,  y: 0.5 },
      { pos: "ATA", x: 0.38, y: 0.78 },
      { pos: "ATA", x: 0.62, y: 0.78 },
    ],
  },
};

/* Para o time adversário, espelhamos no eixo Y (eles atacam pra baixo no nosso campo) */
export function espelhar(slots) {
  return slots.map(s => ({ ...s, y: 1 - s.y }));
}

# Copa de Bolso '26 — demo web

> Monte sua seleção, defina táticas e assista a partida acontecer em pixel art. Demo.

Visual inspirado em almanaques de futebol (paleta papel/tinta, microcopy de gamificação) e em jogos de futebol pixel retrô.

## Como rodar

O demo usa `<script type="module">`, que **não** funciona via `file://` por restrição CORS dos browsers. Precisa servir via HTTP local. Duas opções:

**Python** (3.x já vem na maioria dos Windows/macOS/Linux):

```bash
cd copa-de-bolso-26
python -m http.server 8000
```

Abre <http://localhost:8000>.

**Node** (se preferir):

```bash
cd copa-de-bolso-26
npx serve .
```

(Outras opções: `npx http-server`, extensão "Live Server" do VS Code, etc.)

## Fluxo do demo

1. **Home** — hero com 3 passos (MONTE / DEFINA / ASSISTA) + counters.
2. **Seleção** — 30 lendas ficcionais (4 GOL, 6 ZAG, 4 LAT, 10 MEI, 6 ATA), filtros por posição / era / nação / busca. Monte 16 (11 titulares + 5 reservas) respeitando mínimos: 1 GOL · 4 DEF · 3 MEI · 2 ATA.
3. **Escalação** — campo SVG top-down. Auto-arranjo conforme formação (4-4-2, 4-3-3, 3-5-2, 5-3-2), toque em 2 atletas pra trocar. Tática: estilo (posse / contra-ataque / pressing), linha defensiva (baixa / média / alta), agressividade (slider 0-100).
4. **Partida** — canvas 600×800 com mini-atletas pixel art. Placar e minuto no HUD. Painel lateral do técnico: pausar, 1×/2×/4×, avançar 1 minuto, fazer até 3 substituições, mudar tática em tempo real. Log de eventos colorido (gols em vermelho, sub/intervalo em verde neon, tática em dourado).
5. **Resultado** — VITÓRIA/DERROTA/EMPATE com placar grande, barra de posse, stats de chutes, MVP destacado, lista de gols por minuto, botões "jogar de novo" / "trocar time" / "início".

## Modos

- **Single player vs CPU** — 100% funcional. Sorteia uma das 6 seleções adversárias ficcionais.
- **Multiplayer com amigos** — placeholder (botão "Com amigos" no home só mostra "em breve").

## Arquitetura

Single HTML SPA + módulos ES sem build step. Sem dependências (só Google Fonts via `<link>`).

```
copa-de-bolso-26/
├── index.html                # estrutura SPA
├── assets/
│   ├── css/
│   │   └── styles.css        # design system + telas
│   └── js/
│       ├── main.js           # entry + router
│       ├── util/
│       │   └── state.js      # state global, pub/sub, PRNG mulberry32
│       ├── data/
│       │   ├── athletes.js   # 30 lendas ficcionais
│       │   ├── teams.js      # 6 seleções adversárias
│       │   └── formacoes.js  # 4 formações com slots normalizados
│       ├── screens/
│       │   ├── home.js       # tela inicial
│       │   ├── selecao.js    # catálogo + montagem de time
│       │   ├── escalacao.js  # campo + táticas
│       │   ├── partida.js    # HUD + canvas + painel do técnico
│       │   └── resultado.js  # placar final + stats + MVP
│       └── engine/
│           ├── sim.js        # motor (FSM, decisões, física, eventos)
│           └── render.js     # canvas 2D + pixel art
├── docs/
│   └── plano.md              # plano original do projeto
└── README.md
```

## Design system

Paleta e tipografia no estilo almanaque (papel/tinta + verde campo):

| Token | Hex |
|---|---|
| `--bg` | `#F3ECD8` (papel bege) |
| `--ink` | `#1B1A17` (tinta) |
| `--accent` | `#E2342B` (vermelho carmim) |
| `--mostarda` | `#F5B11E` (amarelo destaque) |
| `--pitch` | `#0E2417` (verde campo) |
| `--pitch-line` | `#1D4A2E` |
| `--phosphor` | `#39FF7A` (verde neon vitória) |

**Tipografia:** Anton (display), Hanken Grotesk (corpo), Share Tech Mono (numerais).

**Assinaturas:** hard-shadow `3px 3px 0` (sem blur), botões pill `border-radius: 999px` com `border: 2px solid var(--ink)`, font-weight 800.

## Atletas

30 lendas com nomes **ficcionalizados** inspirados em arquétipos. Não são pessoas reais. Exemplos:

- **El Maestro** (AR, 1986, MEI) — Maestro · OVR 86
- **O Rei** (BR, 1970, MEI) — Universal · OVR 90
- **Der Bomber** (DE, 1974, ATA) — Artilheiro · OVR 88
- **The Phantom** (UK, 1966, MEI) — Inteligente · OVR 84
- **El Duende** (ES, 2010, MEI) — Toque · OVR 86

Cada um tem 9 atributos (velocidade, resistência, drible, passe, finalização, força, defesa, visão, reflexos) que influenciam decisões probabilísticas na simulação.

## Motor de simulação

- **Tick rate:** 30fps no canvas. 60 ticks = 1 minuto de jogo. 90 min = 5400 ticks ≈ 180s reais.
- **Velocidade:** 1×/2×/4× ajustável em jogo.
- **Agentes:** cada jogador é uma FSM (`idle | perseguir | com_bola | apoio | voltar`). Posição alvo = formação base + papel + posição da bola.
- **Decisões com bola:** passe / drible / chute com pesos vindos de atributos do dono + tática do time + pressão de adversários próximos.
- **Física da bola:** vetor velocidade com atrito 0.93/tick, domínio por proximidade (raio 16px), reposição quando sai do campo.
- **Eventos:** gol, chute, passe, domínio, falta abstrata, substituição, mudança de tática, intervalo, fim.

## Decisões e simplificações

- **Sem dados reais de atletas vivos** — todos os nomes são ficcionalizados para evitar problemas de imagem.
- **Multiplayer online** — apenas placeholder ("em breve").
- **Sem regras complexas** — sem impedimento, escanteios detalhados, cartões individuais. Faltas viram eventos abstratos no log.
- **Pixel art** — desenhado no canvas via `ctx.fillRect` em grids 8×12. Zero PNG binário no repo.

## Créditos

- Tipografia via Google Fonts: Anton, Hanken Grotesk, Share Tech Mono.

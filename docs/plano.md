# Plano — Copa de Bolso '26 (snapshot final)

Snapshot do plano executado. Para o README com instruções de uso, ver `../README.md`.

## Visão do produto

Demo web single-page onde o jogador monta uma seleção com 16 lendas ficcionalizadas (11 titulares + 5 reservas) de eras diferentes da Copa do Mundo, define formação e tática, e **assiste a partida acontecer em pixel art** num campo top-down. Atua como técnico — pode pausar, fazer substituições e mudar tática em tempo real. Joga contra 6 seleções adversárias pré-montadas (single player).

## Design system

Estilo almanaque de futebol (papel/tinta + verde campo):

**Paleta**

| Token | Hex | Origem |
|---|---|---|
| `--bg` | `#F3ECD8` | body bg |
| `--ink` | `#1B1A17` | text principal |
| `--accent` | `#E2342B` | `--accent` |
| `--mostarda` | `#F5B11E` | `--accent-2` |
| `--pitch` | `#0E2417` | `--pitch` |
| `--pitch-line` | `#1D4A2E` | `--line` |
| `--phosphor` | `#39FF7A` | `--phosphor` / `--win` |

**Tipografia** (Google Fonts)

- Display: **Anton** (h1 56px, letter-spacing -1%, line-height 0.96)
- Corpo: **Hanken Grotesk**
- Numerais: **Share Tech Mono**

**Assinaturas visuais**

- Hard-shadow `3px 3px 0` sem blur (vibe risco/papel)
- Botões pill (`border-radius: 999px`) com `border: 2px solid var(--ink)`, font-weight 800
- Sem radius médios — só 0px, 2px, 4px, 999px ou 50%

## Arquitetura técnica

- Single HTML SPA (`index.html`)
- Vanilla JS em módulos ES (sem framework, sem build)
- Canvas 2D para simulação visual (campo + sprites pixel art)
- DOM + CSS para menus, seleção, escalação, painel do técnico
- Sprites pixel art via `ctx.fillRect` em grids 8×12 (sem PNG binário)
- State global em objeto com pub/sub simples
- PRNG seedable mulberry32 para reprodutibilidade

## Modelo de dados (resumido)

```js
Atleta = { id, nome, apelido, era, nac, pos, estilo,
           atr: { vel, res, drb, pas, fin, frc, def, vis, ref },
           overall, cor1, cor2 }

Time = { nome, titulares: [11 ids], reservas: [5 ids],
         formacao: "4-4-2"|"4-3-3"|"3-5-2"|"5-3-2",
         tatica: { estilo: "posse"|"contra-ataque"|"pressing",
                   linhaDef: "baixa"|"media"|"alta",
                   agressividade: 0..100 } }

Partida = { tick, paused, velocidade, estado,
            jogadores: [{id, time, x, y, vx, vy, fadiga, estado, ...}],
            bola: {x, y, vx, vy, dono},
            placar: {MEU, ADV},
            eventos: [{minuto, tipo, autorId, texto}],
            stats: {MEU: {posseTicks, chutes, chutesNoGol, gols}, ADV: ...} }
```

## Motor de simulação

- 60 ticks = 1 minuto de jogo; 5400 ticks = 90 min ≈ 180s reais a 30fps
- Velocidade 1×/2×/4× ajustável em jogo
- FSM por jogador: `idle | perseguir | com_bola | apoio | voltar`
- Posição alvo: formação base + papel + posição da bola + agressividade da tática
- Com bola: decisão entre passe / drible / chute com pesos (atributos do dono, tática, pressão)
- Melhor colega para passe: score por (distância à frente + visão + colega livre - distância)
- Física da bola: vetor velocidade com atrito 0.93/tick, domínio por proximidade raio 16px
- Eventos: gol, chute, passe, domínio, substituição, tática, intervalo, fim
- Fadiga gradual; substituição reseta jogador entrando

## Fases executadas

| Fase | Entregue |
|---|---|
| **F0** | Definição da paleta/tipografia de almanaque — hex de `--accent`, `--accent-2`, `--pitch`, `--phosphor`, fonts Anton/Hanken Grotesk/Share Tech Mono, hard-shadow assinatura |
| **F1** | `index.html` + design system completo em CSS + tela home com hero + 3 passos + counters |
| **F2** | 30 atletas ficcionais + tela de seleção com filtros, cards-figurinha, painel lateral do time |
| **F3** | 4 formações com slots normalizados + 6 times adversários + campo SVG interativo + controles de tática |
| **F4** | Motor de simulação completo (FSM, decisões, física, eventos, gols, intervalo) |
| **F5** | Canvas 2D com pixel art (sprites 8×12, campo listrado, bola, sombras, marcadores) |
| **F6** | HUD + painel do técnico (pause, velocidades, substituições, mudança de tática em tempo real, log) |
| **F7** | Tela de resultado com placar, posse, chutes, MVP, lista de gols, CTAs |
| **F8** | README + este plano + listagem final de arquivos |

## Decisões e simplificações

- **Sem dados reais de atletas vivos** — todos os nomes são ficcionalizados para evitar problemas de imagem.
- **Multiplayer online** — apenas placeholder. Modo "2 jogadores" do home mostra alerta "em breve".
- **Sem regras complexas** — sem impedimento, escanteios detalhados, cartões individuais ou árbitro.
- **Pixel art** — desenhada no canvas via `ctx.fillRect` em grids 8×12. Zero PNG binário no repo.

## Pasta

Criada em `C:\Users\pedro\Claude\copa-de-bolso-26\` (autorizado via Cowork directory request).

Pedro pediu originalmente esse caminho; é o caminho final.

## Como rodar

Ver `../README.md` — basicamente `python -m http.server` na raiz.

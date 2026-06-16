/* ui/header.js — área de login no topo (estilo "Entrar com Google")
   - Visitante: botão "Entrar com Google".
   - Logado: avatar + 1º nome → menu com e-mail e "Sair".
   - Sem Firebase configurado: botão mostra aviso pra configurar. */
import { state, subscribe } from "../util/state.js";
import { initAuth, entrarComGoogle, sair, isConfigured } from "../util/auth.js";

const G_ICON = `
  <svg class="gicon" viewBox="0 0 18 18" width="16" height="16" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.62z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"/>
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
  </svg>`;

export function initHeader() {
  const area = document.getElementById("auth-area");
  if (!area) return;
  render(area);
  subscribe((_, ev) => { if (ev === "auth") render(area); });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".auth")) area.querySelector(".auth__menu")?.classList.remove("auth__menu--open");
  });
  initAuth();
}

function render(area) {
  const u = state.usuario;
  if (u) {
    area.innerHTML = `
      <div class="auth auth--in">
        <button class="auth__user" id="auth-user" aria-haspopup="true">
          ${avatar(u)}
          <span class="auth__name">${esc(primeiro(u.nome))}</span>
          <span class="auth__caret">▾</span>
        </button>
        <div class="auth__menu" id="auth-menu" role="menu">
          <div class="auth__menu-id">
            <strong>${esc(u.nome)}</strong>
            <span>${esc(u.email)}</span>
          </div>
          <button class="auth__menu-item" id="auth-sair" role="menuitem">Sair</button>
        </div>
      </div>`;
    const userBtn = area.querySelector("#auth-user");
    const menu = area.querySelector("#auth-menu");
    userBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("auth__menu--open");
    });
    area.querySelector("#auth-sair").addEventListener("click", async () => {
      try { await sair(); } catch (e) { console.warn(e); }
    });
  } else {
    area.innerHTML = `
      <div class="auth">
        <button class="auth__login" id="auth-login">
          ${G_ICON}<span>Entrar com Google</span>
        </button>
      </div>`;
    area.querySelector("#auth-login").addEventListener("click", async () => {
      if (!isConfigured) {
        toast("Login chega em breve — falta configurar o Firebase (ver docs/auth-firebase-setup.md).");
        return;
      }
      try { await entrarComGoogle(); }
      catch (e) {
        if (e?.code === "auth/popup-closed-by-user") return;
        console.warn(e);
        toast("Não rolou o login agora. Tenta de novo.");
      }
    });
  }
}

function avatar(u) {
  if (u.foto) return `<img class="auth__avatar" src="${esc(u.foto)}" alt="" referrerpolicy="no-referrer" />`;
  return `<span class="auth__avatar auth__avatar--txt">${esc(iniciais(u.nome))}</span>`;
}

function iniciais(nome) {
  const p = String(nome || "").trim().split(/\s+/);
  return ((p[0]?.[0] || "") + (p[1]?.[0] || "")).toUpperCase() || "?";
}
function primeiro(nome) { return String(nome || "").trim().split(/\s+/)[0] || "Jogador"; }
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/* toast simples reaproveitando o estilo .flash */
function toast(msg) {
  let el = document.querySelector(".flash");
  if (!el) { el = document.createElement("div"); el.className = "flash"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("flash--on");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("flash--on"), 3200);
}

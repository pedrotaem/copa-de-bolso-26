/* util/auth.js — login Google (Firebase Auth) + sync de perfil (Firestore)
   ------------------------------------------------------------------------
   - Acesso ao portal continua livre (modo visitante, sem login).
   - Ao logar, carrega/salva o perfil do jogador (time, tática) na nuvem,
     pra seguir entre dispositivos.
   - SDK carregado sob demanda; qualquer falha cai pra modo visitante. */
import { loadFirebase, isConfigured } from "../firebase/config.js";
import { state, emit, subscribe } from "./state.js";

export { isConfigured };

let fb = null;   // { auth, db, googleProvider, authMod, fsMod }

/* ---- ciclo de vida ---- */
export async function initAuth() {
  if (!isConfigured) { emit("auth"); return; }
  try {
    fb = await loadFirebase();
    fb.authMod.onAuthStateChanged(fb.auth, async (fbUser) => {
      if (fbUser) {
        state.usuario = {
          uid: fbUser.uid,
          nome: fbUser.displayName || "Jogador",
          email: fbUser.email || "",
          foto: fbUser.photoURL || "",
        };
        state.tecnico = primeiroNome(state.usuario.nome);
        await carregarPerfil(state.usuario.uid);
        ativarAutosave();
      } else {
        state.usuario = null;
        state.tecnico = "Visitante";
        desativarAutosave();
      }
      emit("auth");
    });
  } catch (e) {
    console.warn("[auth] Firebase indisponível — seguindo como visitante:", e);
    emit("auth");
  }
}

export async function entrarComGoogle() {
  if (!isConfigured) throw new Error("NAO_CONFIGURADO");
  if (!fb) fb = await loadFirebase();
  await fb.authMod.signInWithPopup(fb.auth, fb.googleProvider);
}

export async function sair() {
  if (!fb) return;
  await fb.authMod.signOut(fb.auth);
}

/* ---- perfil na nuvem (Firestore: usuarios/{uid}) ---- */
async function carregarPerfil(uid) {
  try {
    const { doc, getDoc, setDoc } = fb.fsMod;
    const ref = doc(fb.db, "usuarios", uid);
    const snap = await getDoc(ref);
    if (snap.exists() && snap.data().time) {
      Object.assign(state.time, snap.data().time);   // nuvem manda
    } else {
      await setDoc(ref, perfilPayload(), { merge: true }); // 1ª vez: captura progresso de visitante
    }
  } catch (e) {
    console.warn("[auth] carregarPerfil falhou:", e);
  }
}

function perfilPayload() {
  return {
    nome: state.usuario?.nome || "",
    email: state.usuario?.email || "",
    foto: state.usuario?.foto || "",
    time: {
      nome: state.time.nome,
      titulares: state.time.titulares,
      reservas: state.time.reservas,
      formacao: state.time.formacao,
      tatica: state.time.tatica,
    },
    atualizadoEm: fb.fsMod.serverTimestamp(),
  };
}

/* ---- autosave: salva em cada navegação (debounce) ---- */
let unsubAutosave = null, salvarT = null;

function ativarAutosave() {
  if (unsubAutosave) return;
  unsubAutosave = subscribe((_, ev) => {
    if (ev === "auth") return;     // não re-salvar logo após o load
    agendarSalvar();
  });
}

function desativarAutosave() {
  if (unsubAutosave) { unsubAutosave(); unsubAutosave = null; }
  clearTimeout(salvarT);
}

function agendarSalvar() {
  clearTimeout(salvarT);
  salvarT = setTimeout(salvarPerfil, 1200);
}

async function salvarPerfil() {
  if (!state.usuario || !fb) return;
  try {
    const { doc, setDoc } = fb.fsMod;
    await setDoc(doc(fb.db, "usuarios", state.usuario.uid), perfilPayload(), { merge: true });
  } catch (e) {
    console.warn("[auth] salvar falhou:", e);
  }
}

/* ---- util ---- */
function primeiroNome(nome) {
  return String(nome || "").trim().split(/\s+/)[0] || "Jogador";
}

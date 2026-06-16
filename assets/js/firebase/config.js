/* firebase/config.js — credenciais + carga preguiçosa do Firebase
   ----------------------------------------------------------------
   COLE AQUI as credenciais do seu projeto Firebase.
   Pegue em: console.firebase.google.com → Project settings → "Seus apps" → Web.
   Enquanto os valores começarem com "<", o app roda em modo VISITANTE
   (sem login) e o botão de login mostra um aviso pra configurar.
   Passo a passo completo: docs/auth-firebase-setup.md

   O SDK do Firebase é carregado por import DINÂMICO só quando precisa —
   assim o portal continua bootando mesmo se o CDN do Google cair/bloquear.
   ---------------------------------------------------------------- */

const SDK = "https://www.gstatic.com/firebasejs/10.14.1";

export const firebaseConfig = {
  apiKey: "AIzaSyB0LejTW5hYawqZnpHG95JSAcQYYJMKJAk",
  authDomain: "copadebolso.firebaseapp.com",
  projectId: "copadebolso",
  storageBucket: "copadebolso.firebasestorage.app",
  messagingSenderId: "424322698039",
  appId: "1:424322698039:web:5adeab061660d28b04e8b2",
};

/* true só quando as credenciais reais foram coladas */
export const isConfigured = !String(firebaseConfig.apiKey).startsWith("<");

let _fb = null;

/* carrega o SDK + inicializa uma única vez. Retorna null se não configurado. */
export async function loadFirebase() {
  if (!isConfigured) return null;
  if (_fb) return _fb;
  const [appMod, authMod, fsMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  const db = fsMod.getFirestore(app);
  const googleProvider = new authMod.GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: "select_account" });
  _fb = { app, auth, db, googleProvider, authMod, fsMod };
  return _fb;
}

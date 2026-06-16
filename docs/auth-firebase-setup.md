# Login com Google (Firebase) — setup

O portal já roda **sem login** (modo visitante). Pra ligar o "Entrar com Google"
e salvar o progresso do jogador na nuvem, faça 1 vez os passos abaixo (~5 min).

## 1. Criar projeto Firebase
1. Acesse https://console.firebase.google.com → **Adicionar projeto** (pode reusar um existente).
2. Pode desligar o Google Analytics (não é necessário).

## 2. Ativar login com Google
1. No projeto: **Build → Authentication → Get started**.
2. Aba **Sign-in method → Google → Ativar**. Defina o e-mail de suporte. Salvar.

## 3. Criar o banco (Firestore)
1. **Build → Firestore Database → Create database**.
2. Comece em **production mode**, escolha a região (ex.: `southamerica-east1`).
3. Em **Rules**, cole e publique (cada usuário só lê/escreve o próprio doc):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /usuarios/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

## 4. Registrar o app web e pegar as credenciais
1. **Project settings (⚙️) → Seus apps → ícone Web (`</>`)**. Registre o app.
2. Copie o objeto `firebaseConfig` mostrado.
3. Cole os valores em **`assets/js/firebase/config.js`** (substituindo os `<...>`).
   Assim que o `apiKey` não começar mais com `<`, o login liga sozinho.

> Essas chaves de config Web **não são segredo** (ficam expostas no front por design).
> A proteção real vem das regras do Firestore (passo 3) + domínios autorizados (passo 5).

## 5. Autorizar os domínios
**Authentication → Settings → Authorized domains** → adicione:
- `localhost` (testes locais)
- domínios de deploy (CloudFront / domínio custom):
  - `d1b8enu2ce40sv.cloudfront.net` (staging)
  - `d3tl7b0ddjqiau.cloudfront.net` (prod)

## 6. Testar
1. Sirva o site localmente (ex.: `python -m http.server` na raiz) e abra `http://localhost:8000`.
   > Tem que ser via `http://localhost`, **não** abrindo o arquivo `file://` — o popup do Google exige origem http(s).
2. Clique em **Entrar com Google** (topo direito). Logou → mostra avatar + nome.
3. Monte um time, recarregue logado em outro dispositivo: o time volta (sync via Firestore).

## Onde mexe no código
| Arquivo | Papel |
|---|---|
| `assets/js/firebase/config.js` | credenciais + init (Auth/Firestore) |
| `assets/js/util/auth.js` | login/logout + carregar/salvar perfil |
| `assets/js/ui/header.js` | botão de login / chip do usuário no topo |

Modelo de dados: coleção `usuarios`, doc por `uid`, com `{ nome, email, foto, time, atualizadoEm }`.

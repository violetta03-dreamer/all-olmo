# Guida SETUP — all'Olmo

Questa guida ti porta, passo per passo, da zero ad avere l'app funzionante sui telefoni. Non serve saper programmare: si tratta soprattutto di copiare e incollare.

Tempo stimato: 20-30 minuti, una volta sola.

---

## 1. Crea il progetto Firebase

1. Vai su [console.firebase.google.com](https://console.firebase.google.com) e accedi con un account Google (va bene anche quello personale).
2. Clicca **"Aggiungi progetto"**, dagli un nome (es. "all-olmo") e completa la creazione. Puoi disattivare Google Analytics, non serve.
3. Nel menu a sinistra vai su **Build → Firestore Database** → **Crea database**.
   - Scegli **modalità produzione** (non "modalità test").
   - Come regione scegli una in Europa, ad esempio **europe-west** (o "eur3" se te la propone così).
4. Sempre nel menu a sinistra vai su **Build → Authentication** → **Get started**.
   - Nella scheda "Sign-in method", abilita il provider **Email/Password**.
   - Vai nella scheda "Users" → **Add user** e crea l'utente condiviso (l'email e la password che userete tu e tua madre per entrare nell'app). Serve un solo account, condiviso da entrambi i telefoni.

## 2. Incolla le Security Rules

Le regole di sicurezza dicono a Firestore chi può leggere e scrivere i dati: qui impostiamo "solo chi ha fatto login nell'app".

1. In Firebase Console vai su **Firestore Database → Regole** (in inglese "Rules").
2. Sostituisci tutto il contenuto con questo:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

3. Clicca **Pubblica**.

Questo significa: nessuno può leggere o scrivere nulla senza aver fatto login con l'account email+password che avete creato.

## 3. Copia la configurazione web nel codice

1. In Firebase Console vai su **Impostazioni progetto** (l'icona a forma di ingranaggio in alto a sinistra) → scheda **Generale**.
2. Scorri fino a "Le tue app" e clicca l'icona **`</>`** (web) per registrare una nuova app web. Dai un nome qualsiasi (es. "all-olmo-web"), non serve configurare l'hosting Firebase.
3. Ti verrà mostrato un blocco di codice con un oggetto `firebaseConfig = { apiKey: "...", authDomain: "...", ... }`.
4. Apri il file `js/firebase-config.js` nella cartella dell'app e incolla i valori dentro l'oggetto già presente, sostituendo i commenti. Deve diventare così (con i tuoi valori veri):

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "all-olmo.firebaseapp.com",
  projectId: "all-olmo",
  storageBucket: "all-olmo.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
```

5. Salva il file. Questa configurazione non è un segreto (è pensata per stare nel codice pubblico): la sicurezza vera è nelle Security Rules del punto 2.

## 4. Procurati la chiave Gemini (e, se vuoi, quella OpenRouter)

**Gemini (obbligatoria, è il provider principale):**

1. Vai su [aistudio.google.com](https://aistudio.google.com), accedi con un account Google.
2. Clicca su **"Get API key"** → **"Create API key"**.
3. Copia la chiave (una stringa lunga che inizia con `AIza...`).
4. Apri l'app, vai in **Impostazioni** e incollala nel campo "Chiave Gemini". Ripeti su entrambi i telefoni.

**OpenRouter (facoltativa, è la riserva se Gemini non risponde):**

1. Vai su [openrouter.ai](https://openrouter.ai), crea un account.
2. Nella sezione "Keys" crea una nuova chiave API.
3. Nelle Impostazioni dell'app, campo "Chiave OpenRouter", incollala; nel campo "Modello OpenRouter" scrivi il nome del modello che vuoi usare (es. `anthropic/claude-3.5-sonnet` o un modello gratuito).
4. Spunta "Usa la riserva se il primario fallisce" se vuoi che l'app provi automaticamente OpenRouter quando Gemini dà errore.

## 5. Pubblica l'app e installala sui telefoni

1. Pubblica la cartella `app/` su **GitHub Pages** (repository → Settings → Pages → scegli il branch e la cartella `/app` o pubblica il contenuto di `app/` come root, a seconda di come è organizzato il repository).
2. Apri l'indirizzo pubblicato (qualcosa come `https://tuo-utente.github.io/nome-repo/`) dal browser del telefono.
3. Fai login con l'account email+password creato al punto 1.
4. Nel menu del browser scegli **"Aggiungi a schermata Home"** (Chrome Android) — così l'app si apre come una vera app, a schermo intero, con la sua icona.
5. Ripeti l'installazione sul secondo telefono, con lo stesso login.

## Attenzione

- Se apri l'app **prima** di aver completato il punto 3 (config Firebase), vedrai una schermata di benvenuto che te lo ricorda: è normale, non è un errore.
- Le chiavi API (Gemini/OpenRouter) restano solo nella memoria del telefono (localStorage): vanno inserite separatamente su ciascun telefono, in Impostazioni.
- Se in futuro cambi le Security Rules o l'utente Firebase, ricorda che tutti i telefoni condividono lo stesso account di accesso.

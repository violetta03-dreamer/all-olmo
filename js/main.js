// Bootstrap dell'app: registrazione service worker, routing via hash, stato di autenticazione.

import { configuratoFirebase, alCambioAutenticazione, accedi } from './firebase.js';
import { vai, mostraErrore, escapeHtml, eseguiCleanup } from './util.js';
import { renderGiardino } from './ui/giardino.js';
import { renderPianta } from './ui/pianta.js';
import { renderProblema } from './ui/problema.js';
import { renderImpostazioni } from './ui/impostazioni.js';

const contenitore = document.getElementById('app');

export let utenteCorrente = null;

const VERSIONE_APP = '1.0.0';
export function versioneApp() {
  return VERSIONE_APP;
}

function renderBenvenuto() {
  contenitore.innerHTML = `
    <div class="schermata-centrata">
      <div class="simbolo">🌿</div>
      <h1>Benvenuta su all'Olmo</h1>
      <p>Prima di iniziare serve collegare l'app al tuo progetto Firebase: è un passaggio da fare una volta sola.</p>
      <p>Segui la guida in <strong>SETUP.md</strong>, poi incolla la configurazione in <code>js/firebase-config.js</code> e ricarica questa pagina.</p>
      <a class="btn btn-primario" href="./SETUP.md" target="_blank" rel="noopener" style="margin-top:0.8rem;">Apri la guida SETUP.md</a>
    </div>
  `;
}

function renderLogin() {
  contenitore.innerHTML = `
    <div class="schermata-centrata">
      <div class="simbolo">🌱</div>
      <h1>all'Olmo</h1>
      <p>Accedi con l'account condiviso del giardino.</p>
      <form id="form-login">
        <div class="campo">
          <label for="login-email">Email</label>
          <input type="email" id="login-email" required autocomplete="username" />
        </div>
        <div class="campo">
          <label for="login-password">Password</label>
          <input type="password" id="login-password" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn btn-primario btn-blocco">Accedi</button>
      </form>
    </div>
  `;

  document.getElementById('form-login').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const pulsante = evento.target.querySelector('button[type="submit"]');
    pulsante.disabled = true;
    pulsante.textContent = 'Accesso in corso…';
    try {
      await accedi(email, password);
      // il router riparte da solo grazie a alCambioAutenticazione
    } catch (errore) {
      pulsante.disabled = false;
      pulsante.textContent = 'Accedi';
      mostraErrore(traduciErroreLogin(errore));
    }
  });
}

function traduciErroreLogin(errore) {
  const codice = errore?.code || '';
  if (codice.includes('invalid-credential') || codice.includes('wrong-password') || codice.includes('user-not-found')) {
    return 'Email o password non corrette.';
  }
  if (codice.includes('too-many-requests')) {
    return 'Troppi tentativi: aspetta qualche minuto e riprova.';
  }
  if (codice.includes('network')) {
    return 'Problema di connessione: controlla la rete e riprova.';
  }
  return 'Non sono riuscita ad accedere. Riprova tra poco.';
}

async function router() {
  if (!configuratoFirebase) {
    renderBenvenuto();
    return;
  }
  if (!utenteCorrente) {
    renderLogin();
    return;
  }

  const percorso = location.hash.replace(/^#/, '') || '/';
  const parti = percorso.split('/').filter(Boolean);

  eseguiCleanup();

  try {
    if (parti.length === 0) {
      await renderGiardino(contenitore);
    } else if (parti[0] === 'pianta' && parti[1]) {
      await renderPianta(contenitore, parti[1]);
    } else if (parti[0] === 'problema' && parti[1] && parti[2]) {
      await renderProblema(contenitore, parti[1], parti[2]);
    } else if (parti[0] === 'impostazioni') {
      await renderImpostazioni(contenitore);
    } else {
      await renderGiardino(contenitore);
    }
  } catch (errore) {
    contenitore.innerHTML = `
      <div class="schermata-centrata">
        <div class="simbolo">🥀</div>
        <h1>Qualcosa non ha funzionato</h1>
        <p>${escapeHtml(errore?.message || 'Errore imprevisto.')}</p>
        <button class="btn btn-secondario" id="btn-torna-giardino">Torna al giardino</button>
      </div>
    `;
    const btn = document.getElementById('btn-torna-giardino');
    if (btn) btn.addEventListener('click', () => vai('/'));
  }
}

window.addEventListener('hashchange', router);

function avvia() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  if (!configuratoFirebase) {
    renderBenvenuto();
    return;
  }

  alCambioAutenticazione((utente) => {
    utenteCorrente = utente;
    router();
  });
}

avvia();

// Inizializzazione Firebase: app, autenticazione, Firestore con cache offline.
// Se firebase-config.js è ancora vuoto, questo modulo non inizializza nulla e
// `configuratoFirebase` resta false — l'app lo usa per mostrare la schermata di benvenuto.

import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const configuratoFirebase = !!(firebaseConfig && firebaseConfig.apiKey);

let app = null;
let auth = null;
let db = null;

if (configuratoFirebase) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    setPersistence(auth, browserLocalPersistence).catch(() => {});
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
    });
  } catch (errore) {
    // Config presente ma non valida: l'app continua a funzionare mostrando
    // gli errori dove servono, invece di bloccarsi con un'eccezione non gestita.
    app = null;
    auth = null;
    db = null;
  }
}

export { app, auth, db };

/** Registra un listener sui cambi di stato dell'autenticazione. Ritorna una funzione di unsubscribe. */
export function alCambioAutenticazione(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function accedi(email, password) {
  if (!auth) throw new Error('Firebase non è configurato. Controlla js/firebase-config.js.');
  const credenziali = await signInWithEmailAndPassword(auth, email, password);
  return credenziali.user;
}

export async function esci() {
  if (!auth) return;
  await signOut(auth);
}

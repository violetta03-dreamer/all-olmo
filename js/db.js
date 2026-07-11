// CRUD Firestore: piante, foto, problemi, messaggi.
// Nomi dei campi in italiano, coerenti con il modello dati della spec.

import { db } from './firebase.js';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  limit,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

function assicuraDb() {
  if (!db) throw new Error('Firebase non è configurato: controlla js/firebase-config.js.');
  return db;
}

// ---------- PIANTE ----------

export function osservaPiante(callback, onErrore) {
  const q = query(collection(assicuraDb(), 'piante'), orderBy('nome'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onErrore && onErrore(err)
  );
}

export async function ottieniPianta(id) {
  const snap = await getDoc(doc(assicuraDb(), 'piante', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function creaPianta(dati) {
  const ref = await addDoc(collection(assicuraDb(), 'piante'), {
    nome: dati.nome || '',
    posizione: dati.posizione || '',
    tags: dati.tags || [],
    note: dati.note || '',
    thumb: dati.thumb || '',
    creataIl: serverTimestamp(),
    aggiornataIl: serverTimestamp(),
  });
  return ref.id;
}

export async function aggiornaPianta(id, dati) {
  await updateDoc(doc(assicuraDb(), 'piante', id), { ...dati, aggiornataIl: serverTimestamp() });
}

export async function eliminaPianta(id) {
  await deleteDoc(doc(assicuraDb(), 'piante', id));
}

// ---------- FOTO ----------

export function osservaFoto(piantaId, callback, onErrore) {
  const q = query(collection(assicuraDb(), 'piante', piantaId, 'foto'), orderBy('scattataIl', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onErrore && onErrore(err)
  );
}

export async function aggiungiFoto(piantaId, dati) {
  const ref = await addDoc(collection(assicuraDb(), 'piante', piantaId, 'foto'), {
    b64: dati.b64,
    didascalia: dati.didascalia || '',
    scattataIl: serverTimestamp(),
  });
  return ref.id;
}

export async function eliminaFoto(piantaId, fotoId) {
  await deleteDoc(doc(assicuraDb(), 'piante', piantaId, 'foto', fotoId));
}

// ---------- PROBLEMI ----------

export function osservaProblemi(piantaId, callback, onErrore) {
  const q = query(collection(assicuraDb(), 'piante', piantaId, 'problemi'), orderBy('apertoIl', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onErrore && onErrore(err)
  );
}

/** Vero/falso: la pianta ha almeno un problema attivo (in_corso o peggiorato). Usato per il badge in giardino. */
export function osservaProblemaAttivo(piantaId, callback) {
  const q = query(
    collection(assicuraDb(), 'piante', piantaId, 'problemi'),
    where('stato', 'in', ['in_corso', 'peggiorato']),
    limit(1)
  );
  return onSnapshot(
    q,
    (snap) => callback(!snap.empty),
    () => callback(false)
  );
}

export async function ottieniProblema(piantaId, problemaId) {
  const snap = await getDoc(doc(assicuraDb(), 'piante', piantaId, 'problemi', problemaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function creaProblema(piantaId, dati) {
  const ref = await addDoc(collection(assicuraDb(), 'piante', piantaId, 'problemi'), {
    titolo: dati.titolo || 'Nuovo problema',
    stato: 'in_corso',
    apertoIl: serverTimestamp(),
    aggiornatoIl: serverTimestamp(),
    riassunto: null,
  });
  return ref.id;
}

export async function aggiornaProblema(piantaId, problemaId, dati) {
  await updateDoc(doc(assicuraDb(), 'piante', piantaId, 'problemi', problemaId), {
    ...dati,
    aggiornatoIl: serverTimestamp(),
  });
}

export async function eliminaProblema(piantaId, problemaId) {
  await deleteDoc(doc(assicuraDb(), 'piante', piantaId, 'problemi', problemaId));
}

// ---------- MESSAGGI ----------

export function osservaMessaggi(piantaId, problemaId, callback, onErrore) {
  const q = query(
    collection(assicuraDb(), 'piante', piantaId, 'problemi', problemaId, 'messaggi'),
    orderBy('ts')
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => onErrore && onErrore(err)
  );
}

export async function aggiungiMessaggio(piantaId, problemaId, dati) {
  const ref = await addDoc(
    collection(assicuraDb(), 'piante', piantaId, 'problemi', problemaId, 'messaggi'),
    {
      ruolo: dati.ruolo,
      testo: dati.testo || '',
      fotoB64: dati.fotoB64 || null,
      ts: serverTimestamp(),
    }
  );
  return ref.id;
}

export async function ottieniMessaggi(piantaId, problemaId) {
  const snap = await getDocs(
    query(collection(assicuraDb(), 'piante', piantaId, 'problemi', problemaId, 'messaggi'), orderBy('ts'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

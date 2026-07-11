// Piccole utilità condivise da main.js e dalle view (js/ui/*).
// Isolate qui per evitare import circolari tra main.js e i moduli di ui/.

export function vai(hash) {
  location.hash = hash;
}

let timeoutToast = null;

export function mostraErrore(messaggio) {
  mostraToast(messaggio, 'errore');
}

export function mostraInfo(messaggio) {
  mostraToast(messaggio, 'info');
}

function mostraToast(messaggio, tipo) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = messaggio;
  toast.className = `toast toast--visibile toast--${tipo}`;
  clearTimeout(timeoutToast);
  timeoutToast = setTimeout(() => {
    toast.className = 'toast';
  }, 4200);
}

export function escapeHtml(testo) {
  const div = document.createElement('div');
  div.textContent = testo == null ? '' : String(testo);
  return div.innerHTML;
}

export function formattaData(timestamp) {
  if (!timestamp) return '';
  const data = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formattaOra(timestamp) {
  if (!timestamp) return '';
  const data = typeof timestamp.toDate === 'function' ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

export const ETICHETTE_STATO = {
  in_corso: 'In corso',
  migliorato: 'Migliorato',
  risolto: 'Risolto',
  peggiorato: 'Peggiorato',
  abbandonato: 'Abbandonato',
};

// Registro di funzioni di pulizia (es. unsubscribe da onSnapshot) da eseguire
// prima di disegnare una nuova view, per non lasciare listener Firestore attivi.
let listaCleanup = [];

export function registraCleanup(fn) {
  listaCleanup.push(fn);
}

export function eseguiCleanup() {
  for (const fn of listaCleanup) {
    try {
      fn();
    } catch {
      // ignora errori di pulizia
    }
  }
  listaCleanup = [];
}

export const TAG_SUGGERITI = [
  'interno',
  'balcone',
  'veranda',
  'orto',
  'officinali',
  'aromatiche',
  'grasse',
  'delicata',
  'nuova',
  'talea',
];

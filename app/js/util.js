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
  const durata = tipo === 'errore' ? 7000 : 4200;
  timeoutToast = setTimeout(() => {
    toast.className = 'toast';
  }, durata);
}

export function escapeHtml(testo) {
  const div = document.createElement('div');
  div.textContent = testo == null ? '' : String(testo);
  return div.innerHTML;
}

// Mini-parser markdown per le risposte dell'AI: grassetto, corsivo, elenchi
// puntati e numerati. Fatto in casa apposta (niente librerie). Il testo viene
// prima passato da escapeHtml, quindi il risultato è sicuro da inserire nel DOM.
export function markdownAHtml(testo) {
  const righe = escapeHtml(testo).split('\n');
  const html = [];
  let listaAperta = null; // 'ul' | 'ol' | null

  const chiudiLista = () => {
    if (listaAperta) {
      html.push(`</${listaAperta}>`);
      listaAperta = null;
    }
  };

  for (const riga of righe) {
    const r = riga.trim();
    const puntato = r.match(/^[-*•]\s+(.+)/);
    const numerato = r.match(/^\d+[.)]\s+(.+)/);
    const titolo = r.match(/^#{1,6}\s+(.+)/);

    if (puntato || numerato) {
      const tipo = puntato ? 'ul' : 'ol';
      if (listaAperta !== tipo) {
        chiudiLista();
        html.push(`<${tipo}>`);
        listaAperta = tipo;
      }
      html.push(`<li>${markdownInline(puntato ? puntato[1] : numerato[1])}</li>`);
    } else if (r === '') {
      chiudiLista();
    } else if (titolo) {
      chiudiLista();
      html.push(`<p><strong>${markdownInline(titolo[1])}</strong></p>`);
    } else {
      chiudiLista();
      html.push(`<p>${markdownInline(r)}</p>`);
    }
  }
  chiudiLista();
  return html.join('');
}

function markdownInline(testo) {
  return testo
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
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

// --- Tag ---

// Tag di posizione (usati anche per raggruppare la griglia del giardino)
export const TAG_LOCATION = [
  'olmo',
  'giardino',
  'cortile',
  'casa',
  'veranda',
  'balcone',
  'fuori',
  'dentro',
];

// Tutti i tag suggeriti: prima le location, poi le categorie
export const TAG_SUGGERITI = [
  ...TAG_LOCATION,
  'commestibili',
  'officinali',
  'grasse',
  'delicate',
  'pericolose',
  'annuali',
  'sempreverdi',
];

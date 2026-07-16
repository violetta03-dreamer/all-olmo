// Overlay "Che pianta è?": mostra le candidate proposte dall'AI per una foto.
// Mai un'etichetta secca: confidenza dichiarata per ciascuna, la scelta (o la
// correzione a mano) resta sempre alla persona. Usato dalla creazione pianta
// (giardino.js) e dall'album (pianta.js).

import { identificaPianta } from '../ai.js';
import { escapeHtml } from '../util.js';

const ETICHETTE_CONFIDENZA = {
  alta: 'confidenza alta',
  media: 'confidenza media',
  bassa: 'confidenza bassa',
};

/**
 * Apre l'overlay, interroga l'AI sulla foto e mostra le candidate.
 * onScelta(candidata) viene chiamata solo se la persona ne tocca una.
 */
export function apriIdentificazione(fotoB64, onScelta) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="foglio">
      <h2>Che pianta è?</h2>
      <div class="identifica-testata">
        <img class="identifica-foto" src="${fotoB64}" alt="foto da identificare" />
        <p class="identifica-attesa" id="identifica-attesa">Sto osservando la foto…</p>
      </div>
      <div id="identifica-esito"></div>
      <button type="button" class="btn btn-secondario btn-blocco" id="identifica-chiudi">Annulla</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#identifica-chiudi').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  identificaPianta(fotoB64)
    .then((esito) => {
      if (!document.body.contains(overlay)) return; // chiusa nell'attesa
      disegnaEsito(overlay, esito, onScelta);
    })
    .catch((errore) => {
      if (!document.body.contains(overlay)) return;
      overlay.querySelector('#identifica-attesa').textContent = '';
      overlay.querySelector('#identifica-esito').innerHTML =
        `<p class="identifica-nota">Non sono riuscita a interrogare l'AI: ${escapeHtml(errore.message)}</p>`;
    });
}

function disegnaEsito(overlay, esito, onScelta) {
  const attesa = overlay.querySelector('#identifica-attesa');
  const contenitore = overlay.querySelector('#identifica-esito');
  const bottoneChiudi = overlay.querySelector('#identifica-chiudi');

  if (esito.candidate.length === 0) {
    attesa.textContent = '';
    contenitore.innerHTML = `<p class="identifica-nota">${escapeHtml(
      esito.nota || "L'AI non ha saputo proporre candidate da questa foto. Prova con una foto più ravvicinata di foglie o fiori."
    )}</p>`;
    return;
  }

  attesa.textContent = "Ecco cosa potrebbe essere. L'AI può sbagliare: scegli tu, o correggi il nome a mano.";
  bottoneChiudi.textContent = 'Nessuna di queste';

  contenitore.innerHTML =
    esito.candidate
      .map(
        (c, i) => `
      <button type="button" class="candidata" data-indice="${i}">
        <div class="candidata__riga">
          <span class="candidata__nome">${escapeHtml(c.nome)}</span>
          <span class="badge-confidenza badge-confidenza--${c.confidenza || 'na'}">${
          ETICHETTE_CONFIDENZA[c.confidenza] || 'confidenza non indicata'
        }</span>
        </div>
        ${c.nomeScientifico ? `<div class="candidata__scientifico">${escapeHtml(c.nomeScientifico)}</div>` : ''}
        ${c.perche ? `<p class="candidata__dettaglio">${escapeHtml(c.perche)}</p>` : ''}
        ${c.distinguere ? `<p class="candidata__dettaglio"><strong>Per esserne sicura:</strong> ${escapeHtml(c.distinguere)}</p>` : ''}
      </button>`
      )
      .join('') + (esito.nota ? `<p class="identifica-nota">${escapeHtml(esito.nota)}</p>` : '');

  contenitore.querySelectorAll('.candidata').forEach((btn) => {
    btn.addEventListener('click', () => {
      const candidata = esito.candidate[Number(btn.dataset.indice)];
      overlay.remove();
      onScelta(candidata);
    });
  });
}

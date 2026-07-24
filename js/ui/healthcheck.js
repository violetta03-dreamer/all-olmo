// Healthcheck "Diamo un'occhiata": check-up visivo su una foto della pianta.
// Flusso: scelta foto → opzionale confronto dall'album → chiamata AI → risposta.
// Se l'AI nota qualcosa, ponte "Vuoi aprire un problema?" verso il flusso diagnosi.

import { chiediHealthcheck } from '../ai.js';
import { comprimiFoto } from '../foto.js';
import { apriSceltaFoto } from './scegli-foto.js';
import { escapeHtml, markdownAHtml, formattaData, mostraErrore } from '../util.js';

/**
 * Avvia il flusso healthcheck per una pianta.
 * @param {Object} pianta — documento pianta da Firestore
 * @param {Array} fotoAlbum — array di foto dell'album (con .id, .b64, .scattataIl)
 * @param {Array} problemiPassati — problemi della pianta (per lo storico AI)
 * @param {Function} onApriProblema — callback(rispostaAI) se l'utente vuole aprire un problema
 */
export function apriHealthcheck(pianta, fotoAlbum, problemiPassati, onApriProblema) {
  apriSceltaFoto(async (file) => {
    let fotoNuova;
    try {
      fotoNuova = await comprimiFoto(file);
    } catch (errore) {
      mostraErrore('Non sono riuscito a leggere la foto: ' + errore.message);
      return;
    }

    if (fotoAlbum.length > 0) {
      apriSceltaConfronto(pianta, fotoNuova, fotoAlbum, problemiPassati, onApriProblema);
    } else {
      mostraRisultato(pianta, fotoNuova, null, problemiPassati, onApriProblema);
    }
  });
}

// ---------- Passo 2: scelta foto di confronto dall'album ----------

function apriSceltaConfronto(pianta, fotoNuova, fotoAlbum, problemiPassati, onApriProblema) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="foglio">
      <h2>Vuoi confrontarla con una foto precedente?</h2>
      <p style="font-size:0.88rem; color:var(--testo-tenue); margin:0 0 0.8rem;">Scegli una foto dall'album, oppure salta.</p>
      <div class="healthcheck-griglia" id="hc-griglia">${fotoAlbum.map((f) => `<div class="healthcheck-griglia__slot" data-id="${f.id}"><img src="${f.b64}" alt="foto album" />${f.scattataIl ? `<span class="album__data">${formattaData(f.scattataIl)}</span>` : ''}</div>`).join('')}</div>
      <button type="button" class="btn btn-secondario btn-blocco" id="hc-salta">Salta il confronto</button>
      <button type="button" class="btn btn-secondario btn-blocco" id="hc-annulla">Annulla</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#hc-annulla').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#hc-salta').addEventListener('click', () => {
    overlay.remove();
    mostraRisultato(pianta, fotoNuova, null, problemiPassati, onApriProblema);
  });

  overlay.querySelectorAll('.healthcheck-griglia__slot').forEach((slot) => {
    slot.addEventListener('click', () => {
      const foto = fotoAlbum.find((f) => f.id === slot.dataset.id);
      overlay.remove();
      mostraRisultato(pianta, fotoNuova, foto?.b64 || null, problemiPassati, onApriProblema);
    });
  });
}

// ---------- Passo 3-4: chiamata AI e risultato ----------

function mostraRisultato(pianta, fotoNuova, fotoConfronto, problemiPassati, onApriProblema) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="foglio">
      <h2>Diamo un'occhiata</h2>
      <div class="healthcheck-testata">${fotoConfronto
        ? `<img class="healthcheck-foto" src="${fotoNuova}" alt="foto recente" /><img class="healthcheck-foto" src="${fotoConfronto}" alt="foto di confronto" />`
        : `<img class="healthcheck-foto" src="${fotoNuova}" alt="foto della pianta" />`}</div>
      <p class="identifica-attesa" id="hc-attesa">Sto osservando…</p>
      <div id="hc-esito"></div>
      <button type="button" class="btn btn-secondario btn-blocco" id="hc-chiudi">Chiudi</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#hc-chiudi').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  chiediHealthcheck(fotoNuova, fotoConfronto, pianta, problemiPassati)
    .then((risposta) => {
      if (!document.body.contains(overlay)) return;
      overlay.querySelector('#hc-attesa').style.display = 'none';
      const esito = overlay.querySelector('#hc-esito');

      esito.innerHTML = `<div class="healthcheck-risposta">${markdownAHtml(risposta)}</div>
        <div style="margin-top:1rem; padding-top:0.8rem; border-top:1px dashed var(--bordo);">
          <p style="font-size:0.88rem; color:var(--testo-tenue); margin:0 0 0.5rem;">Se c'è qualcosa che vuoi seguire:</p>
          <button type="button" class="btn btn-secondario btn-blocco" id="hc-apri-problema">Vuoi aprire un problema per seguirlo?</button>
        </div>`;

      overlay.querySelector('#hc-apri-problema').addEventListener('click', () => {
        overlay.remove();
        onApriProblema(risposta);
      });
    })
    .catch((errore) => {
      if (!document.body.contains(overlay)) return;
      overlay.querySelector('#hc-attesa').style.display = 'none';
      overlay.querySelector('#hc-esito').innerHTML =
        `<p class="identifica-nota">Non sono riuscito a fare il check-up: ${escapeHtml(errore.message)}</p>`;
    });
}

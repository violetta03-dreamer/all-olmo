// View "Problema (chat)": conversazione con l'AI su un problema di una pianta specifica.

import { ottieniPianta, osservaProblemi, ottieniProblema, aggiornaProblema, eliminaProblema, osservaMessaggi, aggiungiMessaggio } from '../db.js';
import { chiediAI, riassumiConversazione, costruisciContesto } from '../ai.js';
import { comprimiFoto } from '../foto.js';
import { apriSceltaFoto } from './scegli-foto.js';
import { vai, mostraErrore, mostraInfo, escapeHtml, markdownAHtml, formattaOra, registraCleanup, ETICHETTE_STATO } from '../util.js';

// Testo inviato dal bottone "Chiedi la diagnosi": dice al modello di smettere
// di fare domande e tirare le somme (la fase 2 del prompt lo prevede).
const TESTO_CHIEDI_DIAGNOSI = 'Tira le somme: dammi la tua diagnosi con le informazioni che hai.';

let stato = {}; // stato locale della view corrente

export async function renderProblema(container, piantaId, problemaId) {
  container.innerHTML = `<p class="placeholder">Apro la conversazione…</p>`;

  const [pianta, problema] = await Promise.all([ottieniPianta(piantaId), ottieniProblema(piantaId, problemaId)]);

  if (!pianta || !problema) {
    container.innerHTML = `
      <div class="schermata-centrata">
        <p>Questa conversazione non esiste più.</p>
        <button class="btn btn-secondario" id="btn-torna">Torna al giardino</button>
      </div>`;
    document.getElementById('btn-torna').addEventListener('click', () => vai('/'));
    return;
  }

  stato = {
    piantaId,
    problemaId,
    pianta,
    problema,
    problemiAltri: [],
    messaggi: [],
    elaborando: false,
    fotoAllegata: null,
    riassuntoAperto: !!problema.riassunto,
  };

  container.innerHTML = `
    <header class="chat-header">
      <button class="link-indietro" id="btn-indietro">‹ ${escapeHtml(pianta.nome)}</button>
      <div class="chat-header__titolo-riga">
        <h2 id="problema-titolo" style="margin:0; cursor:pointer;" title="Tocca per modificare il titolo">${escapeHtml(problema.titolo)}</h2>
      </div>
      <select id="problema-stato" style="margin-top:0.5rem; padding:0.4rem 0.6rem; border-radius:8px; border:1px solid var(--bordo);">
        ${Object.entries(ETICHETTE_STATO)
          .map(([valore, etichetta]) => `<option value="${valore}" ${valore === problema.stato ? 'selected' : ''}>${etichetta}</option>`)
          .join('')}
      </select>
    </header>

    <div id="riassunto-contenitore"></div>

    <div class="conversazione" id="conversazione">
      <p class="placeholder">Carico i messaggi…</p>
    </div>

    <p style="text-align:center; margin:0.2rem 0 0.4rem;">
      <button type="button" id="btn-elimina-problema"
        style="background:none; border:none; font-size:0.72rem; color:var(--bordo, #b8ab94); text-decoration:underline; padding:0.3rem;">
        Elimina questa conversazione
      </button>
    </p>

    <div class="anteprima-foto-allegata" id="anteprima-foto" hidden></div>

    <div class="chat-azioni" id="chat-azioni" hidden>
      <button type="button" class="btn btn-secondario" id="btn-chiedi-diagnosi" title="Basta domande: l'AI tira le somme con quello che sa">Chiedi la diagnosi</button>
    </div>

    <div class="barra-input">
      <button class="icon-btn" id="btn-allega-foto" aria-label="Allega foto" title="Allega una foto">📷</button>
      <textarea id="input-messaggio" rows="1" placeholder="Scrivi qui…"></textarea>
      <button class="icon-btn" id="btn-invia" aria-label="Invia messaggio">➤</button>
    </div>
  `;

  document.getElementById('btn-indietro').addEventListener('click', () => vai(`/pianta/${piantaId}`));

  document.getElementById('problema-titolo').addEventListener('click', () => modificaTitolo());

  document.getElementById('problema-stato').addEventListener('change', async (evento) => {
    const nuovoStato = evento.target.value;
    const vecchioStato = stato.problema.stato;
    try {
      await aggiornaProblema(piantaId, problemaId, { stato: nuovoStato });
      stato.problema.stato = nuovoStato;
      // "Chiusura" della conversazione: se si esce da "in_corso" verso un altro stato, aggiorna il riassunto.
      if (vecchioStato === 'in_corso' && nuovoStato !== 'in_corso' && stato.messaggi.some((m) => m.ruolo === 'utente')) {
        generaRiassunto();
      }
    } catch (errore) {
      mostraErrore('Non sono riuscita a cambiare lo stato: ' + errore.message);
      evento.target.value = vecchioStato;
    }
  });

  document.getElementById('btn-elimina-problema').addEventListener('click', async () => {
    const conferma = prompt(
      `Stai per eliminare per sempre "${stato.problema.titolo}" con tutta la conversazione e il riassunto. ` +
        `Non si può annullare. Per confermare scrivi: elimina`
    );
    if ((conferma || '').trim().toLowerCase() !== 'elimina') return;
    try {
      await eliminaProblema(piantaId, problemaId);
      mostraInfo('Conversazione eliminata.');
      vai(`/pianta/${piantaId}`);
    } catch (errore) {
      mostraErrore("Non sono riuscita a eliminarla: " + errore.message);
    }
  });

  document.getElementById('btn-allega-foto').addEventListener('click', gestisciAllegaFoto);
  document.getElementById('btn-invia').addEventListener('click', inviaMessaggio);
  document.getElementById('btn-chiedi-diagnosi').addEventListener('click', () => inviaTesto(TESTO_CHIEDI_DIAGNOSI, null));
  const textarea = document.getElementById('input-messaggio');
  textarea.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      inviaMessaggio();
    }
  });
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(120, textarea.scrollHeight) + 'px';
  });

  disegnaRiassunto();

  const unsubProblemi = osservaProblemi(piantaId, (problemi) => {
    stato.problemiAltri = problemi.filter((p) => p.id !== problemaId);
    const aggiornato = problemi.find((p) => p.id === problemaId);
    if (aggiornato) {
      stato.problema = aggiornato;
      disegnaRiassunto();
    }
  });

  const unsubMessaggi = osservaMessaggi(
    piantaId,
    problemaId,
    (messaggi) => {
      stato.messaggi = messaggi;
      disegnaConversazione();
    },
    (errore) => mostraErrore('Non riesco a caricare i messaggi: ' + errore.message)
  );

  registraCleanup(() => {
    unsubProblemi();
    unsubMessaggi();
  });
}

function disegnaRiassunto() {
  const contenitore = document.getElementById('riassunto-contenitore');
  if (!contenitore) return;
  const r = stato.problema.riassunto;
  if (!r) {
    contenitore.innerHTML = '';
    return;
  }

  contenitore.innerHTML = `
    <div class="riassunto">
      <div class="riassunto__intestazione" id="riassunto-toggle">
        <h3>Riassunto</h3>
        <span>${stato.riassuntoAperto ? '▾' : '▸'}</span>
      </div>
      ${
        stato.riassuntoAperto
          ? `
        <div class="riassunto__corpo">
          ${r.sintomi ? `<p><strong>Sintomi:</strong> ${escapeHtml(r.sintomi)}</p>` : ''}
          ${(r.ipotesi || [])
            .map(
              (ip) => `
            <div class="ipotesi-card">
              <div class="ipotesi-card__nome">${escapeHtml(ip.nome)} — confidenza ${escapeHtml(ip.confidenza || 'non indicata')}</div>
              ${ip.perche ? `<p>${escapeHtml(ip.perche)}</p>` : ''}
              ${ip.confermerebbe ? `<p><strong>Confermerebbe:</strong> ${escapeHtml(ip.confermerebbe)}</p>` : ''}
              ${ip.smentirebbe ? `<p><strong>Smentirebbe:</strong> ${escapeHtml(ip.smentirebbe)}</p>` : ''}
            </div>`
            )
            .join('')}
          ${
            (r.azioni || []).length
              ? `<p><strong>Azioni:</strong></p><ul>${r.azioni.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
              : ''
          }
          <button class="btn btn-secondario" id="btn-aggiorna-riassunto" style="margin-top:0.4rem; padding:0.4rem 0.8rem; font-size:0.85rem;">Aggiorna riassunto</button>
        </div>`
          : ''
      }
    </div>
  `;

  document.getElementById('riassunto-toggle').addEventListener('click', () => {
    stato.riassuntoAperto = !stato.riassuntoAperto;
    disegnaRiassunto();
  });

  const btnAggiorna = document.getElementById('btn-aggiorna-riassunto');
  if (btnAggiorna) btnAggiorna.addEventListener('click', generaRiassunto);
}

function disegnaConversazione() {
  const contenitore = document.getElementById('conversazione');
  if (!contenitore) return;

  aggiornaBottoneDiagnosi();

  if (stato.messaggi.length === 0 && !stato.elaborando) {
    contenitore.innerHTML = `<p class="placeholder">Racconta cosa hai notato: da lì si parte.</p>`;
    return;
  }

  contenitore.innerHTML =
    stato.messaggi
      .map(
        (m) => `
      <div class="bolla bolla--${m.ruolo === 'utente' ? 'utente' : 'ai'}">
        ${m.testo ? (m.ruolo === 'ai' ? markdownAHtml(m.testo) : escapeHtml(m.testo)) : ''}
        ${m.fotoB64 ? `<img class="bolla__foto" src="${m.fotoB64}" alt="foto allegata" />` : ''}
        <div style="font-size:0.68rem; opacity:0.65; margin-top:0.3rem;">${formattaOra(m.ts)}</div>
      </div>`
      )
      .join('') + (stato.elaborando ? `<div class="bolla bolla--pensando">Sto pensando…</div>` : '');

  contenitore.scrollTop = contenitore.scrollHeight;
}

// Il bottone "Chiedi la diagnosi" compare solo quando c'è una conversazione
// avviata (almeno un messaggio dell'utente) e non stiamo già aspettando l'AI.
function aggiornaBottoneDiagnosi() {
  const riga = document.getElementById('chat-azioni');
  const bottone = document.getElementById('btn-chiedi-diagnosi');
  if (!riga || !bottone) return;
  riga.hidden = !stato.messaggi.some((m) => m.ruolo === 'utente');
  bottone.disabled = stato.elaborando;
}

function modificaTitolo() {
  const titoloEl = document.getElementById('problema-titolo');
  const attuale = stato.problema.titolo;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = attuale;
  input.style.font = 'inherit';
  input.style.width = '100%';
  titoloEl.replaceWith(input);
  input.focus();
  input.select();

  const salva = async () => {
    const nuovo = input.value.trim() || attuale;
    try {
      if (nuovo !== attuale) {
        await aggiornaProblema(stato.piantaId, stato.problemaId, { titolo: nuovo });
        stato.problema.titolo = nuovo;
      }
    } catch (errore) {
      mostraErrore('Non sono riuscita a salvare il titolo: ' + errore.message);
    }
    const h2 = document.createElement('h2');
    h2.id = 'problema-titolo';
    h2.style.margin = '0';
    h2.style.cursor = 'pointer';
    h2.title = 'Tocca per modificare il titolo';
    h2.textContent = stato.problema.titolo;
    h2.addEventListener('click', () => modificaTitolo());
    input.replaceWith(h2);
  };

  input.addEventListener('blur', salva);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });
}

function gestisciAllegaFoto() {
  apriSceltaFoto(async (file) => {
    try {
      stato.fotoAllegata = await comprimiFoto(file);
      const anteprima = document.getElementById('anteprima-foto');
      anteprima.hidden = false;
      anteprima.innerHTML = `<img src="${stato.fotoAllegata}" alt="anteprima" /> <span>Foto pronta per l'invio</span> <button type="button" id="rimuovi-foto-allegata" class="icon-btn" aria-label="Rimuovi foto">✕</button>`;
      document.getElementById('rimuovi-foto-allegata').addEventListener('click', () => {
        stato.fotoAllegata = null;
        anteprima.hidden = true;
        anteprima.innerHTML = '';
      });
    } catch (errore) {
      mostraErrore('Non sono riuscita a leggere la foto: ' + errore.message);
    }
  });
}

async function inviaMessaggio() {
  const textarea = document.getElementById('input-messaggio');
  const testo = textarea.value.trim();
  if (!testo && !stato.fotoAllegata) return;
  if (stato.elaborando) return;

  const fotoDaInviare = stato.fotoAllegata;
  textarea.value = '';
  textarea.style.height = 'auto';
  stato.fotoAllegata = null;
  const anteprima = document.getElementById('anteprima-foto');
  if (anteprima) {
    anteprima.hidden = true;
    anteprima.innerHTML = '';
  }

  await inviaTesto(testo, fotoDaInviare);
}

async function inviaTesto(testo, fotoDaInviare) {
  if (stato.elaborando) return;

  try {
    await aggiungiMessaggio(stato.piantaId, stato.problemaId, { ruolo: 'utente', testo, fotoB64: fotoDaInviare });
  } catch (errore) {
    mostraErrore('Non sono riuscita a inviare il messaggio: ' + errore.message);
    return;
  }

  stato.elaborando = true;
  disegnaConversazione();

  try {
    const riaperto = !!stato.problema.riassunto;
    const contesto = costruisciContesto(stato.pianta, stato.problemiAltri, stato.problema, riaperto);
    const messaggiApi = [
      { ruolo: 'contesto', testo: contesto },
      ...stato.messaggi.map((m) => ({ ruolo: m.ruolo, testo: m.testo, fotoB64: m.fotoB64 })),
    ];
    const rispostaAi = await chiediAI(messaggiApi);
    await aggiungiMessaggio(stato.piantaId, stato.problemaId, { ruolo: 'ai', testo: rispostaAi });
  } catch (errore) {
    mostraErrore(errore.message + ' Puoi riprovare a inviare il messaggio.');
  } finally {
    stato.elaborando = false;
    disegnaConversazione();
  }
}

async function generaRiassunto() {
  if (stato.messaggi.length === 0) {
    mostraInfo('Non c\'è ancora niente da riassumere.');
    return;
  }
  mostraInfo('Sto aggiornando il riassunto…');
  try {
    const riassunto = await riassumiConversazione(stato.messaggi);
    const aggiornamenti = { riassunto };
    // Titolo breve automatico: sostituisce il titolo solo se è quello provvisorio
    // ("Problema del …") o una descrizione lunga; un titolo corto scritto a mano resta suo.
    const titoloAttuale = stato.problema.titolo || '';
    if (riassunto.titolo && (titoloAttuale.startsWith('Problema del ') || titoloAttuale.length > 40)) {
      aggiornamenti.titolo = riassunto.titolo;
    }
    await aggiornaProblema(stato.piantaId, stato.problemaId, aggiornamenti);
    stato.problema.riassunto = riassunto;
    if (aggiornamenti.titolo) {
      stato.problema.titolo = aggiornamenti.titolo;
      const titoloEl = document.getElementById('problema-titolo');
      if (titoloEl) titoloEl.textContent = aggiornamenti.titolo;
    }
    stato.riassuntoAperto = true;
    disegnaRiassunto();
    mostraInfo('Riassunto aggiornato.');
  } catch (errore) {
    mostraErrore('Non sono riuscita ad aggiornare il riassunto: ' + errore.message);
  }
}

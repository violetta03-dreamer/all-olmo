// View "Scheda pianta": foto + album, dati, note, elenco problemi, nuovo problema / riapertura.

import {
  ottieniPianta,
  aggiornaPianta,
  eliminaPianta,
  osservaFoto,
  aggiungiFoto,
  eliminaFoto,
  osservaProblemi,
  creaProblema,
  aggiornaProblema,
} from '../db.js';
import { comprimiFoto, thumbnailDaDataUrl, latoMaggioreImmagine } from '../foto.js';
import { generaSchedaCura, CAMPI_CURA } from '../ai.js';
import { apriIdentificazione } from './identifica.js';
import { apriSceltaFoto } from './scegli-foto.js';
import {
  vai,
  mostraErrore,
  mostraInfo,
  escapeHtml,
  formattaData,
  registraCleanup,
  ETICHETTE_STATO,
  TAG_SUGGERITI,
} from '../util.js';

export async function renderPianta(container, piantaId) {
  container.innerHTML = `<p class="placeholder">Sto aprendo la scheda…</p>`;

  const pianta = await ottieniPianta(piantaId);
  if (!pianta) {
    container.innerHTML = `
      <div class="schermata-centrata">
        <p>Questa pianta non esiste più.</p>
        <button class="btn btn-secondario" id="btn-torna">Torna al giardino</button>
      </div>`;
    document.getElementById('btn-torna').addEventListener('click', () => vai('/'));
    return;
  }

  container.innerHTML = `
    <header class="topbar">
      <button class="link-indietro" id="btn-indietro">‹ Giardino</button>
      <button class="icon-btn" id="btn-modifica" aria-label="Modifica pianta">✎</button>
    </header>
    <div class="sezione scheda-testata">
      <img class="scheda-testata__foto" id="foto-principale" src="${pianta.thumb || ''}" alt="${escapeHtml(pianta.nome)}"
        style="${pianta.thumb ? '' : 'display:none;'}" />
      <div class="scheda-testata__info">
        <h1 id="pianta-nome">${escapeHtml(pianta.nome || '(senza nome)')}</h1>
        <p id="pianta-posizione" style="color:var(--testo-tenue); margin:0 0 0.5rem;">${escapeHtml(pianta.posizione || '')}</p>
        <div class="card-pianta__tags" id="pianta-tags">
          ${(pianta.tags || []).map((t) => `<span class="mini-chip">${escapeHtml(t)}</span>`).join('')}
        </div>
        <button class="btn btn-primario scheda-testata__nuovo" id="btn-nuovo-problema">＋ Nuovo problema</button>
      </div>
    </div>
    ${pianta.note ? `<div class="sezione"><p id="pianta-note" style="margin:0;">${escapeHtml(pianta.note)}</p></div>` : ''}

    <div class="sezione">
      <h2 style="font-size:1rem;">Album foto</h2>
      <div class="album" id="album"><p class="placeholder">Carico le foto…</p></div>
    </div>

    <div class="sezione">
      <h2 style="font-size:1rem; margin:0;">Storico</h2>
      <div class="elenco-problemi" id="elenco-problemi" style="margin-top:0.7rem;"><p class="placeholder">Carico lo storico…</p></div>
    </div>

    <div class="sezione">
      <h2 style="font-size:1rem; margin:0;">Scheda di cura</h2>
      <div id="scheda-cura" style="margin-top:0.7rem;"></div>
    </div>
  `;

  document.getElementById('btn-indietro').addEventListener('click', () => vai('/'));
  document.getElementById('btn-modifica').addEventListener('click', () => apriModaleModificaPianta(pianta));
  document.getElementById('btn-nuovo-problema').addEventListener('click', () => apriModaleNuovoProblema(piantaId));

  disegnaSchedaCura(pianta);

  let thumbControllata = false;
  const unsubFoto = osservaFoto(
    piantaId,
    (foto) => {
      disegnaAlbum(pianta, foto);
      // In testata la foto va mostrata in qualità piena (la thumbnail
      // sgranerebbe): appena l'album arriva, si passa alla prima foto vera.
      const fotoPrincipale = document.getElementById('foto-principale');
      if (fotoPrincipale && foto.length) {
        fotoPrincipale.src = foto[0].b64;
        fotoPrincipale.style.display = '';
      }
      // Le copertine di vecchia generazione (220px) sgranavano nella griglia
      // del giardino: alla prima apertura della scheda si rigenerano dalla
      // foto di copertina, una volta sola.
      if (!thumbControllata && foto.length && pianta.thumb) {
        thumbControllata = true;
        rinfrescaThumbSeVecchia(piantaId, pianta.thumb, foto[0].b64);
      }
    },
    (errore) => mostraErrore('Non riesco a caricare le foto: ' + errore.message)
  );
  const unsubProblemi = osservaProblemi(
    piantaId,
    (problemi) => disegnaProblemi(piantaId, problemi),
    (errore) => mostraErrore('Non riesco a caricare i problemi: ' + errore.message)
  );

  registraCleanup(() => {
    unsubFoto();
    unsubProblemi();
  });
}

async function rinfrescaThumbSeVecchia(piantaId, thumbAttuale, fotoB64) {
  try {
    if ((await latoMaggioreImmagine(thumbAttuale)) >= 300) return;
    const thumb = await thumbnailDaDataUrl(fotoB64);
    await aggiornaPianta(piantaId, { thumb });
  } catch {
    // Non bloccante: la copertina vecchia resta finché non riesce la rigenerazione.
  }
}

function disegnaAlbum(pianta, foto) {
  const piantaId = pianta.id;
  const contenitore = document.getElementById('album');
  if (!contenitore) return;

  contenitore.innerHTML =
    `<button class="album__aggiungi" id="album-aggiungi" aria-label="Aggiungi foto">+</button>` +
    foto.map((f) => `<img class="album__foto" src="${f.b64}" alt="${escapeHtml(f.didascalia || 'foto pianta')}" data-id="${f.id}" />`).join('');

  document.getElementById('album-aggiungi').addEventListener('click', () => {
    apriSceltaFoto(async (file) => {
      mostraInfo('Sto comprimendo la foto…');
      try {
        const b64 = await comprimiFoto(file);
        await aggiungiFoto(piantaId, { b64 });

        // Se la pianta non ha ancora una thumbnail, usa questa foto come copertina.
        const piantaAttuale = await ottieniPianta(piantaId);
        if (piantaAttuale && !piantaAttuale.thumb) {
          const thumb = await thumbnailDaDataUrl(b64);
          await aggiornaPianta(piantaId, { thumb });
          const fotoPrincipale = document.getElementById('foto-principale');
          if (fotoPrincipale) {
            fotoPrincipale.src = thumb;
            fotoPrincipale.style.display = '';
          }
        }
        mostraInfo('Foto aggiunta.');
      } catch (errore) {
        mostraErrore('Non sono riuscita a salvare la foto: ' + errore.message);
      }
    });
  });

  contenitore.querySelectorAll('.album__foto').forEach((img) => {
    img.addEventListener('click', () => apriAzioniFoto(pianta, img.dataset.id, img.src));
  });
}

// Toccando una foto dell'album si sceglie cosa farne: identificare la pianta
// o eliminare la foto (prima il tocco eliminava e basta).
function apriAzioniFoto(pianta, fotoId, fotoB64) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="foglio">
      <img class="azioni-foto__anteprima" src="${fotoB64}" alt="foto della pianta" />
      <button type="button" class="btn btn-secondario btn-blocco" id="af-identifica">🔍 Che pianta è?</button>
      <button type="button" class="btn btn-pericolo btn-blocco" id="af-elimina">Elimina questa foto</button>
      <button type="button" class="btn btn-secondario btn-blocco" id="af-annulla">Annulla</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#af-annulla').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#af-identifica').addEventListener('click', () => {
    overlay.remove();
    apriIdentificazione(fotoB64, (candidata) => {
      // Il nome proposto si precompila nel modulo di modifica: salva sempre la persona.
      apriModaleModificaPianta({ ...pianta, nome: candidata.nome });
      mostraInfo('Nome proposto: controlla e salva tu.');
    });
  });

  overlay.querySelector('#af-elimina').addEventListener('click', () => {
    if (!confirm('Eliminare questa foto?')) return;
    overlay.remove();
    eliminaFoto(pianta.id, fotoId).catch((e) => mostraErrore('Non sono riuscita a eliminare la foto: ' + e.message));
  });
}

function disegnaProblemi(piantaId, problemi) {
  const contenitore = document.getElementById('elenco-problemi');
  if (!contenitore) return;

  if (problemi.length === 0) {
    contenitore.innerHTML = `<p class="placeholder">Nessun problema registrato: bene così.</p>`;
    return;
  }

  contenitore.innerHTML = problemi
    .map(
      (p) => `
      <div class="riga-problema" data-id="${p.id}">
        <button class="riga-problema__apri" data-apri="${p.id}" style="background:none;border:none;text-align:left;flex:1;padding:0;">
          <div class="riga-problema__data">${formattaData(p.apertoIl)}</div>
          <div class="riga-problema__titolo">${escapeHtml(p.titolo)}</div>
        </button>
        <span class="badge-stato badge-stato--${p.stato}">${ETICHETTE_STATO[p.stato] || p.stato}</span>
        ${
          p.stato !== 'in_corso'
            ? `<button class="icon-btn" data-riapri="${p.id}" title="Riapri: cosa è cambiato?" aria-label="Riapri problema">↺</button>`
            : ''
        }
      </div>`
    )
    .join('');

  contenitore.querySelectorAll('[data-apri]').forEach((btn) => {
    btn.addEventListener('click', () => vai(`/problema/${piantaId}/${btn.dataset.apri}`));
  });

  contenitore.querySelectorAll('[data-riapri]').forEach((btn) => {
    btn.addEventListener('click', async (evento) => {
      evento.stopPropagation();
      try {
        await aggiornaProblema(piantaId, btn.dataset.riapri, { stato: 'in_corso' });
        mostraInfo('Problema riaperto: raccontami cosa è cambiato.');
        vai(`/problema/${piantaId}/${btn.dataset.riapri}`);
      } catch (errore) {
        mostraErrore('Non sono riuscita a riaprire il problema: ' + errore.message);
      }
    });
  });
}

// ---------- Scheda di cura ----------

function disegnaSchedaCura(pianta) {
  const contenitore = document.getElementById('scheda-cura');
  if (!contenitore) return;
  const cura = pianta.cura;

  const bottoni = (primaVolta) => `
    <div class="cura-azioni">
      ${primaVolta ? '' : `<button class="btn btn-secondario" id="cura-modifica">Modifica</button>`}
      ${primaVolta ? `<button class="btn btn-secondario" id="cura-mano">Scrivi a mano</button>` : ''}
      <button class="btn btn-secondario" id="cura-genera">${primaVolta ? 'Genera con AI' : 'Rigenera con AI'}</button>
      <button class="btn btn-secondario" id="cura-incolla">Incolla un testo</button>
    </div>`;

  if (!cura) {
    contenitore.innerHTML = `
      <p class="placeholder" style="margin-bottom:0.6rem;">Indicazioni generali per la cura di questa pianta (non una diagnosi). Puoi farla scrivere all'AI, incollare un testo da strutturare, o scriverla tu.</p>
      ${bottoni(true)}`;
  } else {
    const campiPieni = CAMPI_CURA.filter(([chiave]) => cura[chiave]);
    contenitore.innerHTML = `
      <div class="cura-scheda">
        ${campiPieni
          .map(
            ([chiave, etichetta]) => `
          <p class="cura-scheda__campo"><strong>${etichetta}:</strong> ${escapeHtml(cura[chiave])}</p>`
          )
          .join('')}
        ${
          cura.fonte && /^https?:\/\//i.test(cura.fonte)
            ? `<p class="cura-scheda__campo"><strong>Fonte:</strong> <a href="${escapeHtml(cura.fonte)}" target="_blank" rel="noopener">${escapeHtml(cura.fonte)}</a></p>`
            : ''
        }
        ${cura.aggiornataIl ? `<p class="cura-scheda__aggiornata">Aggiornata il ${formattaData(cura.aggiornataIl)}</p>` : ''}
      </div>
      ${bottoni(false)}`;
  }

  const btnModifica = document.getElementById('cura-modifica');
  const btnMano = document.getElementById('cura-mano');
  if (btnModifica) btnModifica.addEventListener('click', () => apriModaleCura(pianta, pianta.cura || {}));
  if (btnMano) btnMano.addEventListener('click', () => apriModaleCura(pianta, {}));
  document.getElementById('cura-genera').addEventListener('click', () => generaCuraConAI(pianta, null));
  document.getElementById('cura-incolla').addEventListener('click', () => apriModaleIncollaTesto(pianta));
}

async function generaCuraConAI(pianta, testoIncollato) {
  mostraInfo(testoIncollato ? 'Sto strutturando il testo…' : 'Sto preparando la scheda…');
  try {
    const scheda = await generaSchedaCura(pianta, testoIncollato);
    if (!CAMPI_CURA.some(([chiave]) => scheda[chiave])) {
      mostraErrore("L'AI non ha prodotto una scheda leggibile. Riprova, o scrivila a mano.");
      return;
    }
    // La scheda NON si salva da sola: appare nel modulo e la salvi tu (giudizio umano sempre in mezzo).
    apriModaleCura(pianta, { ...scheda, fonte: pianta.cura?.fonte || '' });
  } catch (errore) {
    mostraErrore('Non sono riuscita a preparare la scheda: ' + errore.message);
  }
}

function apriModaleIncollaTesto(pianta) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="foglio">
      <h2>Incolla un testo</h2>
      <p style="font-size:0.88rem; color:var(--testo-tenue);">Incolla qui le indicazioni di cura (da un sito, un libro, appunti): l'AI le riordina nei campi della scheda, senza aggiungere nulla di suo. Poi le rivedi e salvi tu.</p>
      <form id="form-incolla-cura">
        <div class="campo">
          <textarea id="ic-testo" rows="8" required placeholder="Incolla qui il testo…"></textarea>
        </div>
        <button type="submit" class="btn btn-primario btn-blocco">Struttura nei campi</button>
        <button type="button" class="btn btn-secondario btn-blocco" id="ic-annulla">Annulla</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#ic-annulla').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#form-incolla-cura').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const testo = overlay.querySelector('#ic-testo').value.trim();
    if (!testo) return;
    overlay.remove();
    generaCuraConAI(pianta, testo);
  });
}

function apriModaleCura(pianta, valori) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="foglio">
      <h2>Scheda di cura</h2>
      <form id="form-cura">
        ${CAMPI_CURA.map(
          ([chiave, etichetta]) => `
        <div class="campo">
          <label for="cura-${chiave}">${etichetta}</label>
          <textarea id="cura-${chiave}" rows="2">${escapeHtml(valori[chiave] || '')}</textarea>
        </div>`
        ).join('')}
        <div class="campo">
          <label for="cura-fonte">Link fonte (facoltativo)</label>
          <input type="url" id="cura-fonte" placeholder="https://…" value="${escapeHtml(valori.fonte || '')}" />
        </div>
        <button type="submit" class="btn btn-primario btn-blocco">Salva scheda</button>
        <button type="button" class="btn btn-secondario btn-blocco" id="cura-annulla">Annulla</button>
      </form>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#cura-annulla').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#form-cura').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const pulsante = evento.target.querySelector('button[type="submit"]');
    pulsante.disabled = true;
    pulsante.textContent = 'Salvo…';
    const cura = { aggiornataIl: Date.now() };
    for (const [chiave] of CAMPI_CURA) {
      cura[chiave] = overlay.querySelector(`#cura-${chiave}`).value.trim();
    }
    cura.fonte = overlay.querySelector('#cura-fonte').value.trim();
    try {
      await aggiornaPianta(pianta.id, { cura });
      pianta.cura = cura;
      overlay.remove();
      disegnaSchedaCura(pianta);
      mostraInfo('Scheda di cura salvata.');
    } catch (errore) {
      pulsante.disabled = false;
      pulsante.textContent = 'Salva scheda';
      mostraErrore('Non sono riuscita a salvare la scheda: ' + errore.message);
    }
  });
}

function apriModaleModificaPianta(pianta) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="foglio">
      <h2>Modifica pianta</h2>
      <form id="form-modifica-pianta">
        <div class="campo">
          <label for="mp-nome">Nome</label>
          <input type="text" id="mp-nome" required value="${escapeHtml(pianta.nome || '')}" />
        </div>
        <div class="campo">
          <label for="mp-posizione">Posizione</label>
          <input type="text" id="mp-posizione" value="${escapeHtml(pianta.posizione || '')}" />
        </div>
        <div class="campo">
          <label>Tag</label>
          <div class="selettore-tag" id="mp-tag"></div>
        </div>
        <div class="campo">
          <label for="mp-note">Note</label>
          <textarea id="mp-note">${escapeHtml(pianta.note || '')}</textarea>
        </div>
        <button type="submit" class="btn btn-primario btn-blocco">Salva modifiche</button>
        <button type="button" class="btn btn-secondario btn-blocco" id="mp-annulla">Annulla</button>
        <button type="button" class="btn btn-pericolo btn-blocco" id="mp-elimina">Elimina pianta</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const tagScelti = new Set(pianta.tags || []);
  const contenitoreTag = overlay.querySelector('#mp-tag');
  const tuttiTag = [...new Set([...TAG_SUGGERITI, ...(pianta.tags || [])])];
  contenitoreTag.innerHTML = tuttiTag
    .map((t) => `<button type="button" class="chip ${tagScelti.has(t) ? 'chip--attivo' : ''}" data-tag="${t}">${t}</button>`)
    .join('');
  contenitoreTag.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const t = chip.dataset.tag;
      if (tagScelti.has(t)) {
        tagScelti.delete(t);
        chip.classList.remove('chip--attivo');
      } else {
        tagScelti.add(t);
        chip.classList.add('chip--attivo');
      }
    });
  });

  overlay.querySelector('#mp-annulla').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#mp-elimina').addEventListener('click', async () => {
    if (!confirm(`Eliminare "${pianta.nome}" e uscire dal giardino? L'operazione non si può annullare dall'app.`)) return;
    try {
      await eliminaPianta(pianta.id);
      overlay.remove();
      mostraInfo('Pianta eliminata.');
      vai('/');
    } catch (errore) {
      mostraErrore('Non sono riuscita a eliminare la pianta: ' + errore.message);
    }
  });

  overlay.querySelector('#form-modifica-pianta').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const pulsante = evento.target.querySelector('button[type="submit"]');
    pulsante.disabled = true;
    pulsante.textContent = 'Salvo…';
    try {
      await aggiornaPianta(pianta.id, {
        nome: overlay.querySelector('#mp-nome').value.trim(),
        posizione: overlay.querySelector('#mp-posizione').value.trim(),
        note: overlay.querySelector('#mp-note').value.trim(),
        tags: [...tagScelti],
      });
      overlay.remove();
      // Siamo già su #/pianta/<id>: vai() non farebbe scattare hashchange e la
      // pagina resterebbe coi dati vecchi. Il router va svegliato a mano.
      window.dispatchEvent(new Event('hashchange'));
    } catch (errore) {
      pulsante.disabled = false;
      pulsante.textContent = 'Salva modifiche';
      mostraErrore('Non sono riuscita a salvare: ' + errore.message);
    }
  });
}

function apriModaleNuovoProblema(piantaId) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="foglio">
      <h2>Nuovo problema</h2>
      <form id="form-nuovo-problema">
        <div class="campo">
          <label for="npr-titolo">Titolo breve (facoltativo)</label>
          <input type="text" id="npr-titolo" placeholder="Se lo lasci vuoto, lo scrive l'AI" />
        </div>
        <button type="submit" class="btn btn-primario btn-blocco">Apri conversazione</button>
        <button type="button" class="btn btn-secondario btn-blocco" id="npr-annulla">Annulla</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#npr-annulla').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#form-nuovo-problema').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const pulsante = evento.target.querySelector('button[type="submit"]');
    pulsante.disabled = true;
    pulsante.textContent = 'Apro…';
    try {
      // Titolo provvisorio se lasciato vuoto: il riassunto AI lo sostituirà
      // col suo "titolo in 2 parole" alla prima diagnosi.
      const titolo =
        overlay.querySelector('#npr-titolo').value.trim() ||
        `Problema del ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;
      const id = await creaProblema(piantaId, { titolo });
      overlay.remove();
      vai(`/problema/${piantaId}/${id}`);
    } catch (errore) {
      pulsante.disabled = false;
      pulsante.textContent = 'Apri conversazione';
      mostraErrore('Non sono riuscita ad aprire il problema: ' + errore.message);
    }
  });
}

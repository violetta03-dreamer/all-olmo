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
import { comprimiFoto, thumbnailDaDataUrl } from '../foto.js';
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
    <img class="foto-principale" id="foto-principale" src="${pianta.thumb || ''}" alt="${escapeHtml(pianta.nome)}"
      style="${pianta.thumb ? '' : 'display:none;'}" />
    <div class="sezione">
      <h1 id="pianta-nome">${escapeHtml(pianta.nome || '(senza nome)')}</h1>
      <p id="pianta-posizione" style="color:var(--testo-tenue); margin:0 0 0.5rem;">${escapeHtml(pianta.posizione || '')}</p>
      <div class="card-pianta__tags" id="pianta-tags">
        ${(pianta.tags || []).map((t) => `<span class="mini-chip">${escapeHtml(t)}</span>`).join('')}
      </div>
      ${pianta.note ? `<p id="pianta-note" style="margin-top:0.7rem;">${escapeHtml(pianta.note)}</p>` : ''}
    </div>

    <div class="sezione">
      <h2 style="font-size:1rem;">Album foto</h2>
      <div class="album" id="album"><p class="placeholder">Carico le foto…</p></div>
    </div>

    <div class="sezione">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h2 style="font-size:1rem; margin:0;">Problemi</h2>
        <button class="btn btn-primario" id="btn-nuovo-problema" style="padding:0.5rem 1rem; font-size:0.9rem;">+ Nuovo problema</button>
      </div>
      <div class="elenco-problemi" id="elenco-problemi" style="margin-top:0.7rem;"><p class="placeholder">Carico i problemi…</p></div>
    </div>
  `;

  document.getElementById('btn-indietro').addEventListener('click', () => vai('/'));
  document.getElementById('btn-modifica').addEventListener('click', () => apriModaleModificaPianta(pianta));
  document.getElementById('btn-nuovo-problema').addEventListener('click', () => apriModaleNuovoProblema(piantaId));

  const unsubFoto = osservaFoto(
    piantaId,
    (foto) => disegnaAlbum(piantaId, foto),
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

function disegnaAlbum(piantaId, foto) {
  const contenitore = document.getElementById('album');
  if (!contenitore) return;

  contenitore.innerHTML =
    `<button class="album__aggiungi" id="album-aggiungi" aria-label="Aggiungi foto">+</button>` +
    foto.map((f) => `<img class="album__foto" src="${f.b64}" alt="${escapeHtml(f.didascalia || 'foto pianta')}" data-id="${f.id}" />`).join('');

  document.getElementById('album-aggiungi').addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
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
    input.click();
  });

  contenitore.querySelectorAll('.album__foto').forEach((img) => {
    img.addEventListener('click', () => {
      if (confirm('Eliminare questa foto?')) {
        eliminaFoto(piantaId, img.dataset.id).catch((e) => mostraErrore('Non sono riuscita a eliminare la foto: ' + e.message));
      }
    });
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
          <div class="riga-problema__titolo">${escapeHtml(p.titolo)}</div>
          <div class="riga-problema__data">Aperto il ${formattaData(p.apertoIl)}</div>
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
      vai(`/pianta/${pianta.id}`);
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
          <label for="npr-titolo">Titolo breve</label>
          <input type="text" id="npr-titolo" required placeholder="es. Foglie che ingialliscono" />
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
      const titolo = overlay.querySelector('#npr-titolo').value.trim();
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

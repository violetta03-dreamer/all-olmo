// View "Giardino": griglia di piante, filtro per tag, FAB per aggiungere una pianta.
// In cima, separata da una riga sottile, la sezione "Da tenere d'occhio" con le
// piante che hanno problemi aperti (stato in_corso o peggiorato).

import { osservaPiante, osservaProblemaAttivo, creaPianta } from '../db.js';
import { comprimiFoto, generaThumbnail } from '../foto.js';
import { apriIdentificazione } from './identifica.js';
import { apriSceltaFoto } from './scegli-foto.js';
import { vai, mostraErrore, mostraInfo, escapeHtml, registraCleanup, TAG_SUGGERITI, TAG_LOCATION } from '../util.js';

let tagAttivo = null;
let pianteCorrenti = [];
// piantaId -> ha almeno un problema attivo. Sopravvive tra un montaggio e l'altro
// della view: alla riapertura la sezione appare subito, poi si riallinea coi dati.
const problemaAttivo = new Map();

export async function renderGiardino(container) {
  container.innerHTML = `
    <header class="topbar">
      <h1>Le mie piante</h1>
      <button id="btn-impostazioni" class="icon-btn" aria-label="Impostazioni">⚙️</button>
    </header>
    <div class="filtri-tag" id="filtri-tag"></div>
    <div id="zona-piante">
      <p class="placeholder">Sto raccogliendo le piante…</p>
    </div>
    <button id="fab-nuova-pianta" class="fab" aria-label="Nuova pianta">+</button>
  `;

  document.getElementById('btn-impostazioni').addEventListener('click', () => vai('/impostazioni'));
  document.getElementById('fab-nuova-pianta').addEventListener('click', apriModaleNuovaPianta);

  const listenerProblemi = new Map(); // piantaId -> unsubscribe

  const unsubscribePiante = osservaPiante(
    (piante) => {
      pianteCorrenti = piante;
      sincronizzaListenerProblemi(piante, listenerProblemi);
      disegnaFiltri();
      disegnaGriglia();
    },
    (errore) => mostraErrore('Non riesco a caricare l\'elenco: ' + errore.message)
  );

  registraCleanup(() => {
    unsubscribePiante();
    for (const unsub of listenerProblemi.values()) unsub();
    listenerProblemi.clear();
  });
}

// Un listener leggero per pianta: aggiorna la mappa e ridisegna la griglia solo
// quando lo stato cambia davvero (evita giri a vuoto a ogni snapshot).
function sincronizzaListenerProblemi(piante, listenerProblemi) {
  const presenti = new Set(piante.map((p) => p.id));
  for (const [id, unsub] of listenerProblemi) {
    if (!presenti.has(id)) {
      unsub();
      listenerProblemi.delete(id);
      problemaAttivo.delete(id);
    }
  }
  for (const p of piante) {
    if (listenerProblemi.has(p.id)) continue;
    listenerProblemi.set(
      p.id,
      osservaProblemaAttivo(p.id, (attivo) => {
        if (problemaAttivo.get(p.id) === attivo) return;
        problemaAttivo.set(p.id, attivo);
        disegnaGriglia();
      })
    );
  }
}

function disegnaFiltri() {
  const contenitore = document.getElementById('filtri-tag');
  if (!contenitore) return;
  const tagPresenti = new Set();
  for (const p of pianteCorrenti) for (const t of p.tags || []) tagPresenti.add(t);
  if (tagAttivo && !tagPresenti.has(tagAttivo)) tagAttivo = null;

  if (tagPresenti.size === 0) {
    contenitore.innerHTML = '';
    return;
  }

  contenitore.innerHTML = [...tagPresenti]
    .sort()
    .map((t) => `<button class="chip ${t === tagAttivo ? 'chip--attivo' : ''}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
    .join('');

  contenitore.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const tag = chip.dataset.tag;
      tagAttivo = tagAttivo === tag ? null : tag;
      disegnaFiltri();
      disegnaGriglia();
    });
  });
}

function ordinaPerNome(a, b) {
  return (a.nome || '').localeCompare(b.nome || '', 'it');
}

function disegnaGriglia() {
  const contenitore = document.getElementById('zona-piante');
  if (!contenitore) return;

  const filtrate = tagAttivo
    ? pianteCorrenti.filter((p) => (p.tags || []).includes(tagAttivo))
    : pianteCorrenti;

  if (pianteCorrenti.length === 0) {
    contenitore.innerHTML = `<p class="placeholder">Non hai ancora piante qui. Tocca "+" per aggiungere la prima.</p>`;
    return;
  }
  if (filtrate.length === 0) {
    contenitore.innerHTML = `<p class="placeholder">Nessuna pianta con questo tag.</p>`;
    return;
  }

  const problematiche = filtrate.filter((p) => problemaAttivo.get(p.id));
  const altre = filtrate.filter((p) => !problemaAttivo.get(p.id));

  let htmlAltre = '';

  // Senza filtro attivo: raggruppa per tag location, alfabetico dentro ogni gruppo.
  // Con filtro attivo: lista piatta.
  if (!tagAttivo && altre.length) {
    const giaMostrate = new Set();
    for (const loc of TAG_LOCATION) {
      const gruppo = altre.filter((p) => (p.tags || []).includes(loc)).sort(ordinaPerNome);
      if (gruppo.length === 0) continue;
      for (const p of gruppo) giaMostrate.add(p.id);
      htmlAltre += `<p class="titolo-gruppo-location">${escapeHtml(loc)}</p>
        <div class="griglia-piante">${gruppo.map(cardPianta).join('')}</div>`;
    }
    const senzaLocation = altre.filter((p) => !giaMostrate.has(p.id)).sort(ordinaPerNome);
    if (senzaLocation.length) {
      htmlAltre += `<p class="titolo-gruppo-location">altro</p>
        <div class="griglia-piante">${senzaLocation.map(cardPianta).join('')}</div>`;
    }
  } else if (altre.length) {
    htmlAltre = `<div class="griglia-piante">${altre.sort(ordinaPerNome).map(cardPianta).join('')}</div>`;
  }

  contenitore.innerHTML =
    (problematiche.length
      ? `<p class="titolo-problematiche">Da tenere d'occhio</p>
         <div class="griglia-piante griglia-piante--problematiche">${problematiche.sort(ordinaPerNome).map(cardPianta).join('')}</div>` +
        (altre.length ? `<div class="divisore-problematiche"></div>` : '')
      : '') +
    htmlAltre;

  contenitore.querySelectorAll('.card-pianta').forEach((card) => {
    card.addEventListener('click', () => vai(`/pianta/${card.dataset.id}`));
  });
}

function cardPianta(p) {
  return `
      <button class="card-pianta" data-id="${p.id}">
        ${
          p.thumb
            ? `<img class="card-pianta__thumb" src="${p.thumb}" alt="${escapeHtml(p.nome)}" />`
            : `<div class="card-pianta__thumb card-pianta__thumb--vuota">🌿</div>`
        }
        ${problemaAttivo.get(p.id) ? `<span class="badge-problema"></span>` : ''}
        <div class="card-pianta__corpo">
          <p class="card-pianta__nome">${escapeHtml(p.nome || '(da identificare)')}</p>
          <p class="card-pianta__posizione">${escapeHtml(p.posizione || '')}</p>
          <div class="card-pianta__tags">
            ${(p.tags || []).slice(0, 3).map((t) => `<span class="mini-chip">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      </button>`;
}

function apriModaleNuovaPianta() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="foglio">
      <h2>Nuova pianta</h2>
      <form id="form-nuova-pianta">
        <div class="campo">
          <label for="np-nome">Nome</label>
          <input type="text" id="np-nome" required placeholder="es. Basilico del balcone" />
        </div>
        <div class="campo">
          <label for="np-posizione">Posizione</label>
          <input type="text" id="np-posizione" placeholder="es. esposizione sud, sole solo al mattino, ombreggiato" />
        </div>
        <div class="campo">
          <label>Tag</label>
          <div class="selettore-tag" id="np-tag"></div>
        </div>
        <div class="campo">
          <label for="np-anno">Anno di arrivo</label>
          <input type="number" id="np-anno" placeholder="es. 2024" min="1900" max="2099" />
        </div>
        <div class="campo">
          <label for="np-note">Note</label>
          <textarea id="np-note" placeholder="Tutto ciò che è utile ricordare"></textarea>
        </div>
        <div class="campo">
          <label>Foto (facoltativa)</label>
          <button type="button" class="btn btn-secondario btn-blocco" id="np-foto-btn" style="margin-top:0;">📷 Aggiungi una foto</button>
          <div class="anteprima-foto-allegata" id="np-anteprima" hidden style="padding:0.5rem 0 0;"></div>
          <button type="button" class="btn btn-secondario btn-blocco" id="np-identifica" hidden>🔍 Che pianta è?</button>
        </div>
        <button type="submit" class="btn btn-primario btn-blocco">Aggiungi al giardino</button>
        <button type="button" class="btn btn-secondario btn-blocco" id="np-annulla">Annulla</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const tagScelti = new Set();
  const contenitoreTag = overlay.querySelector('#np-tag');
  contenitoreTag.innerHTML = TAG_SUGGERITI.map((t) => `<button type="button" class="chip" data-tag="${t}">${t}</button>`).join('');
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

  // Foto: la scelta fotocamera/galleria la offre l'app (il photo picker di
  // Android da solo mostrerebbe soltanto la galleria).
  let fileFoto = null;
  // Nome botanico della candidata scelta con "Che pianta è?": si salva con la
  // pianta (la scelta l'ha fatta la persona, l'app la sta solo ricordando).
  let nomeScientificoScelto = '';
  const btnFoto = overlay.querySelector('#np-foto-btn');
  const anteprimaFoto = overlay.querySelector('#np-anteprima');
  const btnIdentifica = overlay.querySelector('#np-identifica');
  btnFoto.addEventListener('click', () => {
    apriSceltaFoto((file) => {
      fileFoto = file;
      anteprimaFoto.hidden = false;
      anteprimaFoto.innerHTML = `<img src="${URL.createObjectURL(file)}" alt="anteprima" /> <span>Foto pronta</span>`;
      btnFoto.textContent = '📷 Cambia foto';
      btnIdentifica.hidden = false;
    });
  });

  // "Che pianta è?": compare appena c'è una foto, propone 2-3 candidate e
  // precompila il nome (che resta modificabile: l'ultima parola è di chi salva).
  btnIdentifica.addEventListener('click', async () => {
    if (!fileFoto) return;
    btnIdentifica.disabled = true;
    try {
      const b64 = await comprimiFoto(fileFoto);
      apriIdentificazione(b64, (candidata) => {
        const campoNome = overlay.querySelector('#np-nome');
        campoNome.value = candidata.nome;
        nomeScientificoScelto = candidata.nomeScientifico || '';
        mostraInfo('Nome proposto: puoi correggerlo prima di salvare.');
      });
    } catch (errore) {
      mostraErrore('Non sono riuscito a leggere la foto: ' + errore.message);
    } finally {
      btnIdentifica.disabled = false;
    }
  });

  overlay.querySelector('#np-annulla').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  overlay.querySelector('#form-nuova-pianta').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const pulsante = evento.target.querySelector('button[type="submit"]');
    pulsante.disabled = true;
    pulsante.textContent = 'Aggiungo…';
    try {
      const nome = overlay.querySelector('#np-nome').value.trim();
      const posizione = overlay.querySelector('#np-posizione').value.trim();
      const annoVal = overlay.querySelector('#np-anno').value.trim();
      const note = overlay.querySelector('#np-note').value.trim();

      let thumb = '';
      if (fileFoto) {
        thumb = await generaThumbnail(fileFoto);
      }

      const id = await creaPianta({
        nome,
        nomeScientifico: nomeScientificoScelto,
        posizione,
        tags: [...tagScelti],
        annoArrivo: annoVal ? parseInt(annoVal, 10) : '',
        note,
        thumb,
      });
      overlay.remove();
      mostraInfo('Pianta aggiunta al giardino.');
      vai(`/pianta/${id}`);
    } catch (errore) {
      pulsante.disabled = false;
      pulsante.textContent = 'Aggiungi al giardino';
      mostraErrore('Non sono riuscito a salvare la pianta: ' + errore.message);
    }
  });
}

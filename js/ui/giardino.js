// View "Giardino": griglia di piante, filtro per tag, FAB per aggiungere una pianta.

import { osservaPiante, osservaProblemaAttivo, creaPianta } from '../db.js';
import { comprimiFoto, generaThumbnail } from '../foto.js';
import { vai, mostraErrore, mostraInfo, escapeHtml, registraCleanup, TAG_SUGGERITI } from '../util.js';

let tagAttivo = null;

export async function renderGiardino(container) {
  container.innerHTML = `
    <header class="topbar">
      <h1>Il giardino</h1>
      <button id="btn-impostazioni" class="icon-btn" aria-label="Impostazioni">⚙️</button>
    </header>
    <div class="filtri-tag" id="filtri-tag"></div>
    <div id="griglia-piante" class="griglia-piante">
      <p class="placeholder">Sto raccogliendo le piante…</p>
    </div>
    <button id="fab-nuova-pianta" class="fab" aria-label="Nuova pianta">+</button>
  `;

  document.getElementById('btn-impostazioni').addEventListener('click', () => vai('/impostazioni'));
  document.getElementById('fab-nuova-pianta').addEventListener('click', apriModaleNuovaPianta);

  const listenerBadge = new Map(); // piantaId -> unsubscribe

  const unsubscribePiante = osservaPiante(
    (piante) => {
      disegnaFiltri(piante);
      disegnaGriglia(piante, listenerBadge);
    },
    (errore) => mostraErrore('Non riesco a caricare il giardino: ' + errore.message)
  );

  registraCleanup(() => {
    unsubscribePiante();
    for (const unsub of listenerBadge.values()) unsub();
    listenerBadge.clear();
  });
}

function disegnaFiltri(piante) {
  const contenitore = document.getElementById('filtri-tag');
  if (!contenitore) return;
  const tagPresenti = new Set();
  for (const p of piante) for (const t of p.tags || []) tagPresenti.add(t);
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
      disegnaFiltri(window.__ultimePiante || []);
      disegnaGriglia(window.__ultimePiante || [], window.__ultimoListenerBadge || new Map());
    });
  });
}

function disegnaGriglia(piante, listenerBadge) {
  window.__ultimePiante = piante;
  window.__ultimoListenerBadge = listenerBadge;

  const contenitore = document.getElementById('griglia-piante');
  if (!contenitore) return;

  const filtrate = tagAttivo ? piante.filter((p) => (p.tags || []).includes(tagAttivo)) : piante;

  if (piante.length === 0) {
    contenitore.innerHTML = `<p class="placeholder">Non hai ancora piante qui. Tocca "+" per aggiungere la prima.</p>`;
    return;
  }
  if (filtrate.length === 0) {
    contenitore.innerHTML = `<p class="placeholder">Nessuna pianta con questo tag.</p>`;
    return;
  }

  contenitore.innerHTML = filtrate
    .map(
      (p) => `
      <button class="card-pianta" data-id="${p.id}">
        ${
          p.thumb
            ? `<img class="card-pianta__thumb" src="${p.thumb}" alt="${escapeHtml(p.nome)}" />`
            : `<div class="card-pianta__thumb card-pianta__thumb--vuota">🌿</div>`
        }
        <span class="badge-problema" hidden data-badge="${p.id}"></span>
        <div class="card-pianta__corpo">
          <p class="card-pianta__nome">${escapeHtml(p.nome || '(senza nome)')}</p>
          <p class="card-pianta__posizione">${escapeHtml(p.posizione || '')}</p>
          <div class="card-pianta__tags">
            ${(p.tags || []).slice(0, 3).map((t) => `<span class="mini-chip">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
      </button>`
    )
    .join('');

  contenitore.querySelectorAll('.card-pianta').forEach((card) => {
    card.addEventListener('click', () => vai(`/pianta/${card.dataset.id}`));
  });

  // Badge "problema attivo": un piccolo listener per pianta visibile.
  for (const unsub of listenerBadge.values()) unsub();
  listenerBadge.clear();
  for (const p of filtrate) {
    const unsub = osservaProblemaAttivo(p.id, (attivo) => {
      const el = contenitore.querySelector(`[data-badge="${p.id}"]`);
      if (el) el.hidden = !attivo;
    });
    listenerBadge.set(p.id, unsub);
  }
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
          <input type="text" id="np-posizione" placeholder="es. Balcone, esposizione sud" />
        </div>
        <div class="campo">
          <label>Tag</label>
          <div class="selettore-tag" id="np-tag"></div>
        </div>
        <div class="campo">
          <label for="np-note">Note</label>
          <textarea id="np-note" placeholder="Tutto ciò che è utile ricordare"></textarea>
        </div>
        <div class="campo">
          <label for="np-foto">Foto (facoltativa)</label>
          <input type="file" id="np-foto" accept="image/*" capture="environment" />
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
      const note = overlay.querySelector('#np-note').value.trim();
      const fileFoto = overlay.querySelector('#np-foto').files[0];

      let thumb = '';
      if (fileFoto) {
        thumb = await generaThumbnail(fileFoto);
      }

      const id = await creaPianta({ nome, posizione, tags: [...tagScelti], note, thumb });
      overlay.remove();
      mostraInfo('Pianta aggiunta al giardino.');
      vai(`/pianta/${id}`);
    } catch (errore) {
      pulsante.disabled = false;
      pulsante.textContent = 'Aggiungi al giardino';
      mostraErrore('Non sono riuscita a salvare la pianta: ' + errore.message);
    }
  });
}

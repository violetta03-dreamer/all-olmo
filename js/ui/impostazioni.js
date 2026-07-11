// View "Impostazioni": stato login, chiavi/modelli AI, link a SETUP.md, versione.

import { esci } from '../firebase.js';
import { leggiImpostazioniAI, scriviImpostazioniAI } from '../ai.js';
import { vai, mostraErrore, mostraInfo } from '../util.js';
import { utenteCorrente, versioneApp } from '../main.js';

export async function renderImpostazioni(container) {
  const imp = leggiImpostazioniAI();

  container.innerHTML = `
    <header class="topbar">
      <button class="link-indietro" id="btn-indietro">‹ Giardino</button>
      <h1 style="font-size:1.2rem;">Impostazioni</h1>
      <span></span>
    </header>

    <div class="sezione">
      <h2 style="font-size:1rem;">Account</h2>
      <p>Accesso effettuato come <strong>${utenteCorrente?.email || ''}</strong></p>
      <button id="btn-esci" class="btn btn-secondario">Esci</button>
    </div>

    <div class="sezione">
      <h2 style="font-size:1rem;">Intelligenza artificiale</h2>
      <p style="color:var(--testo-tenue); font-size:0.85rem;">Le chiavi restano solo su questo telefono: non vengono mai salvate nel codice dell'app.</p>

      <form id="form-ai">
        <div class="campo">
          <label for="ai-provider-primario">Provider primario</label>
          <select id="ai-provider-primario">
            <option value="gemini" ${imp.providerPrimario === 'gemini' ? 'selected' : ''}>Gemini</option>
            <option value="openrouter" ${imp.providerPrimario === 'openrouter' ? 'selected' : ''}>OpenRouter</option>
          </select>
        </div>

        <div class="campo campo-checkbox">
          <input type="checkbox" id="ai-usa-riserva" ${imp.usaRiserva ? 'checked' : ''} />
          <label for="ai-usa-riserva" style="margin:0;">Usa la riserva se il primario fallisce</label>
        </div>

        <div class="filo-erbario"></div>

        <div class="campo">
          <label for="ai-gemini-chiave">Chiave Gemini</label>
          <input type="password" id="ai-gemini-chiave" value="${imp.geminiChiave}" placeholder="Incolla qui la chiave da aistudio.google.com" autocomplete="off" />
        </div>
        <div class="campo">
          <label for="ai-gemini-modello">Modello Gemini</label>
          <input type="text" id="ai-gemini-modello" value="${imp.geminiModello}" placeholder="gemini-flash-latest" />
        </div>

        <div class="filo-erbario"></div>

        <div class="campo">
          <label for="ai-openrouter-chiave">Chiave OpenRouter (riserva, facoltativa)</label>
          <input type="password" id="ai-openrouter-chiave" value="${imp.openrouterChiave}" placeholder="Incolla qui la chiave da openrouter.ai" autocomplete="off" />
        </div>
        <div class="campo">
          <label for="ai-openrouter-modello">Modello OpenRouter</label>
          <input type="text" id="ai-openrouter-modello" value="${imp.openrouterModello}" placeholder="es. anthropic/claude-3.5-sonnet" />
        </div>

        <button type="submit" class="btn btn-primario btn-blocco">Salva impostazioni AI</button>
      </form>
    </div>

    <div class="sezione">
      <h2 style="font-size:1rem;">Guida</h2>
      <a href="./SETUP.md" target="_blank" rel="noopener">Apri la guida SETUP.md</a>
    </div>

    <p class="versione">all'Olmo — versione ${versioneApp()}</p>
  `;

  document.getElementById('btn-indietro').addEventListener('click', () => vai('/'));

  document.getElementById('btn-esci').addEventListener('click', async () => {
    try {
      await esci();
    } catch (errore) {
      mostraErrore('Non sono riuscita a uscire: ' + errore.message);
    }
  });

  document.getElementById('form-ai').addEventListener('submit', (evento) => {
    evento.preventDefault();
    try {
      scriviImpostazioniAI({
        providerPrimario: document.getElementById('ai-provider-primario').value,
        usaRiserva: document.getElementById('ai-usa-riserva').checked,
        geminiChiave: document.getElementById('ai-gemini-chiave').value.trim(),
        geminiModello: document.getElementById('ai-gemini-modello').value.trim(),
        openrouterChiave: document.getElementById('ai-openrouter-chiave').value.trim(),
        openrouterModello: document.getElementById('ai-openrouter-modello').value.trim(),
      });
      mostraInfo('Impostazioni salvate.');
    } catch (errore) {
      mostraErrore('Non sono riuscita a salvare: ' + errore.message);
    }
  });
}

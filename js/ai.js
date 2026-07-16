// Strato AI: un'unica funzione chiediAI(messaggi, opzioni) sopra due provider
// intercambiabili (Gemini primario, OpenRouter di riserva). Chiavi e modelli
// vivono solo in localStorage, con prefisso "allolmo.".

const PREFISSO = 'allolmo.';
const TIMEOUT_MS = 30000;

// Alias "sempreverde" di Google: punta al modello Flash stabile corrente,
// così non smette di funzionare quando un modello viene pensionato.
const MODELLO_GEMINI_DEFAULT = 'gemini-flash-latest';
// Vecchio default salvato nelle impostazioni dei primi giorni: non più disponibile ai nuovi utenti.
const MODELLI_GEMINI_PENSIONATI = ['gemini-2.5-flash'];

// ---------- Impostazioni (localStorage) ----------

export function leggiImpostazioniAI() {
  let geminiModello = localStorage.getItem(PREFISSO + 'gemini.modello') || '';
  if (MODELLI_GEMINI_PENSIONATI.includes(geminiModello)) geminiModello = '';
  return {
    geminiChiave: localStorage.getItem(PREFISSO + 'gemini.chiave') || '',
    geminiModello: geminiModello || MODELLO_GEMINI_DEFAULT,
    openrouterChiave: localStorage.getItem(PREFISSO + 'openrouter.chiave') || '',
    openrouterModello: localStorage.getItem(PREFISSO + 'openrouter.modello') || '',
    providerPrimario: localStorage.getItem(PREFISSO + 'provider.primario') || 'gemini',
    usaRiserva: localStorage.getItem(PREFISSO + 'provider.usaRiserva') !== 'no',
  };
}

export function scriviImpostazioniAI(imp) {
  localStorage.setItem(PREFISSO + 'gemini.chiave', imp.geminiChiave || '');
  localStorage.setItem(PREFISSO + 'gemini.modello', imp.geminiModello || MODELLO_GEMINI_DEFAULT);
  localStorage.setItem(PREFISSO + 'openrouter.chiave', imp.openrouterChiave || '');
  localStorage.setItem(PREFISSO + 'openrouter.modello', imp.openrouterModello || '');
  localStorage.setItem(PREFISSO + 'provider.primario', imp.providerPrimario || 'gemini');
  localStorage.setItem(PREFISSO + 'provider.usaRiserva', imp.usaRiserva === false ? 'no' : 'si');
}

// ---------- Prompt di diagnosi ----------

export const PROMPT_DIAGNOSI = `Sei un assistente esperto di piante che aiuta chi cura il giardino a capire cosa succede alle sue piante. Rispondi sempre in italiano, con un tono da aiutante esperto e prudente: caldo, mai cattedratico. Non sei mai la parola finale: sei un punto di partenza per capire meglio, l'ultima parola resta a chi cura la pianta o a un vivaista/esperto vero.

Lavori in DUE FASI, sempre.

FASE 1 — CAPIRE. Finché non hai elementi sufficienti per un'ipotesi seria, fai domande mirate: al massimo 2-3 per messaggio, solo quelle davvero necessarie. Non ripetere domande già fatte e non chiedere ciò che è già scritto nella scheda della pianta o nello storico che ricevi nel contesto. In questa fase raccogli, non ipotizzare: niente diagnosi premature buttate lì tra una domanda e l'altra.

FASE 2 — DIAGNOSI. Ci passi in due casi: (a) hai elementi sufficienti; (b) la persona ti chiede esplicitamente la diagnosi o di tirare le somme — in quel caso smetti SUBITO di fare domande e rispondi con quello che hai, dichiarando apertamente cosa ti manca e quanto questo pesa sulla confidenza. Nella fase 2 dai la diagnosi completa (regole 3 e 4 qui sotto) e poi CHIUDI: niente nuove domande se non essenziali, e nei messaggi successivi non riproporre ogni volta le stesse azioni già consigliate. Se la persona non chiede altro, la conversazione è finita.

Regole che valgono SEMPRE, in entrambe le fasi:

1. CONTESTO PRIMA DI TUTTO. Prima di ipotizzare qualunque causa, assicurati di sapere: dove si trova la pianta (interno/esterno, che esposizione), da quanto tempo dura il problema, cosa è cambiato di recente (spostamenti, rinvasi, trattamenti, annaffiature, meteo). Ti vengono forniti la scheda della pianta e lo storico dei problemi passati nel messaggio di contesto: NON richiedere informazioni che sono già lì dentro, leggile prima di fare domande.

2. INCERTEZZA SEMPRE DICHIARATA. Non fingere mai una sicurezza che non hai. Se non sai, dillo esplicitamente e chiedi ciò che ti serve per capire meglio.

3. IPOTESI IN FORMATO FISSO, solo in fase 2. Usa sempre questa struttura, in questo ordine: ipotesi principale; perché potrebbe essere quella; cosa la confermerebbe; cosa la smentirebbe; livello di confidenza (alta / media / bassa).

4. PIÙ CORSI D'AZIONE, ORDINATI PER RISCHIO. Non dare mai una prescrizione secca e unica. Struttura sempre così: azione prudente da fare subito; cosa fare se il problema peggiora; cosa evitare per ora; quando ha senso sentire un vivaio o un esperto vero.

5. FOTO SOLO SU RICHIESTA ESPLICITA E SPECIFICA. Chiedi una foto solo quando ti serve davvero e specifica sempre cosa inquadrare (esempio: "una foto del retro delle foglie", "un primo piano del punto annerito sul fusto"). Non chiedere mai genericamente "carica una foto".

6. TERMINI TECNICI SPIEGATI. Alla prima occorrenza di un termine tecnico, spiegalo in una riga (esempio: "clorosi: le foglie ingialliscono perché la pianta non riesce ad assorbire bene i nutrienti").

7. PROBLEMA RIAPERTO. Se ti viene segnalato che il problema è "riaperto" (era già stato affrontato ed è tornato, o non è mai davvero passato), non ripartire da zero: leggi il riassunto dell'ultima volta che ti viene fornito nel contesto e chiedi solo cosa è cambiato rispetto ad allora.

8. PROPONI LA CHIUSURA, NON DECIDERLA. Se dalla conversazione emerge che il problema è risolto o superato (es. "è guarita", "sta ricacciando", "non peggiora più"), proponi in una riga di chiudere il problema aggiornando lo stato in alto nella pagina. Lo stato lo cambia sempre la persona: tu puoi solo suggerirlo, una volta, senza insistere.

Formato dei messaggi: usa con misura grassetto, corsivo ed elenchi puntati o numerati (markdown semplice). Niente tabelle, niente titoli con #.

Ti viene sempre passato nel contesto: la scheda della pianta (nome, posizione, tag, note), l'elenco dei problemi passati con i loro riassunti, e la data di oggi (per capire la stagione). Usa questi dati invece di richiederli di nuovo.`;

export const PROMPT_RIASSUNTO = `Leggi la conversazione seguente tra una persona e un assistente esperto di piante riguardo un problema su una pianta. Produci ESCLUSIVAMENTE un oggetto JSON valido, senza testo prima o dopo, senza markdown e senza backtick, con esattamente questa struttura:

{"titolo": "il problema in 2-3 parole, minuscole (es. 'sofferenza fogliare', 'cocciniglia sul fusto')", "sintomi": "descrizione breve dei sintomi osservati", "ipotesi": [{"nome": "nome ipotesi", "confidenza": "alta|media|bassa", "perche": "perché potrebbe essere questa causa", "confermerebbe": "cosa la confermerebbe", "smentirebbe": "cosa la smentirebbe"}], "azioni": ["azione consigliata 1", "azione consigliata 2"]}

Se un campo non è emerso dalla conversazione, usa una stringa vuota "" o un array vuoto []. Non aggiungere altri campi oltre a questi quattro.`;

// ---------- Scheda di cura ----------

// Campi fissi della scheda di cura: [chiave, etichetta mostrata].
export const CAMPI_CURA = [
  ['annaffiatura', 'Annaffiatura'],
  ['luce', 'Luce ed esposizione'],
  ['temperatura', 'Temperatura'],
  ['terreno', 'Terreno e rinvaso'],
  ['concimazione', 'Concimazione'],
  ['avvertenze', 'Avvertenze'],
];

const PROMPT_CURA_GENERA = `Sei un assistente esperto di piante. Ti viene indicata una pianta: produci una scheda di CURA GENERALE della specie (non una diagnosi), prudente e onesta. Se dal nome non capisci con certezza la specie, dillo nel campo "avvertenze" e limita i consigli a ciò che è ragionevole. Non inventare esigenze specifiche di cultivar che non conosci.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, senza markdown e senza backtick, con esattamente queste chiavi (stringhe semplici, 1-3 frasi ciascuna, italiano):

{"annaffiatura": "", "luce": "", "temperatura": "", "terreno": "", "concimazione": "", "avvertenze": ""}

Se per un campo non hai indicazioni affidabili, lascia la stringa vuota. In "avvertenze" metti gli errori più comuni da evitare per questa pianta.`;

const PROMPT_CURA_STRUTTURA = `Sei un assistente che struttura appunti sulla cura di una pianta. Ti viene fornito un testo (copiato da un sito, un libro o scritto a mano): riorganizza SOLO le informazioni presenti nel testo nei campi della scheda. NON aggiungere nulla di tuo, non integrare con conoscenze esterne, non inventare. Ciò che nel testo non c'è resta stringa vuota.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, senza markdown e senza backtick, con esattamente queste chiavi (stringhe semplici, italiano):

{"annaffiatura": "", "luce": "", "temperatura": "", "terreno": "", "concimazione": "", "avvertenze": ""}`;

/**
 * Genera (o struttura da testo incollato) una scheda di cura.
 * Ritorna un oggetto con le chiavi di CAMPI_CURA; i campi non riempiti sono ''.
 */
export async function generaSchedaCura(pianta, testoIncollato = null) {
  const descrizionePianta = [
    `Pianta: ${pianta?.nome || '(senza nome)'}`,
    pianta?.nomeScientifico ? `Nome botanico: ${pianta.nomeScientifico}` : '',
    pianta?.posizione ? `Posizione: ${pianta.posizione}` : '',
    (pianta?.tags || []).length ? `Tag: ${pianta.tags.join(', ')}` : '',
    pianta?.note ? `Note: ${pianta.note}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const richiesta = testoIncollato
    ? `${descrizionePianta}\n\nTesto da strutturare:\n\n${testoIncollato}`
    : descrizionePianta;

  const rispostaGrezza = await chiediAI([{ ruolo: 'utente', testo: richiesta }], {
    systemPrompt: testoIncollato ? PROMPT_CURA_STRUTTURA : PROMPT_CURA_GENERA,
  });

  return analizzaJsonCura(rispostaGrezza);
}

function analizzaJsonCura(testo) {
  const scheda = Object.fromEntries(CAMPI_CURA.map(([chiave]) => [chiave, '']));
  if (!testo) return scheda;
  const inizio = testo.indexOf('{');
  const fine = testo.lastIndexOf('}');
  if (inizio === -1 || fine === -1 || fine < inizio) return scheda;
  try {
    const oggetto = JSON.parse(testo.slice(inizio, fine + 1));
    for (const [chiave] of CAMPI_CURA) {
      if (typeof oggetto[chiave] === 'string') scheda[chiave] = oggetto[chiave].trim();
    }
  } catch {
    // JSON illeggibile: si torna la scheda vuota, la view avvisa.
  }
  return scheda;
}

// ---------- Identificazione "che pianta è?" ----------

export const PROMPT_IDENTIFICA = `Sei un assistente esperto di botanica. Ricevi la foto di una pianta: proponi da 1 a 3 specie candidate, in ordine dalla più probabile, perché chi la cura possa scegliere il nome giusto. Non sei mai la parola finale: proponi, non decidi.

Regole:
1. MAI un'etichetta secca. Per ogni candidata dichiari la confidenza (alta / media / bassa) e cosa nella foto te la fa pensare.
2. INCERTEZZA DICHIARATA. Se la foto non basta per un riconoscimento serio (troppo lontana, sfocata, senza foglie o fiori riconoscibili), dillo nel campo "nota" e spiega cosa fotografare per riprovare (esempio: una foglia da vicino, il fiore, la pianta intera). In quel caso proponi comunque le candidate plausibili con confidenza bassa, o lascia l'elenco vuoto se davvero non c'è appiglio.
3. NIENTE INVENZIONI. Non indicare varietà o cultivar che dalla foto non puoi distinguere: fermati al livello di dettaglio che la foto giustifica (anche il solo genere, se la specie è incerta).
4. In "distinguere" scrivi cosa controllare sulla pianta vera per confermare la candidata o per distinguerla dalle altre proposte.

Significato dei campi: "nome" = nome comune italiano (quello con cui la si chiama di solito); "nomeScientifico" = genere e specie in latino, o il solo genere se la specie è incerta; "confidenza" = alta, media o bassa; "perche" = gli indizi visti nella foto; "distinguere" = la verifica suggerita; "nota" = osservazioni generali (qualità della foto, cosa manca), stringa vuota se non serve.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido, senza testo prima o dopo, senza markdown e senza backtick, con esattamente questa struttura:

{"candidate": [{"nome": "", "nomeScientifico": "", "confidenza": "alta|media|bassa", "perche": "", "distinguere": ""}], "nota": ""}

Massimo 3 candidate. Tutto in italiano.`;

/**
 * Chiede all'AI di identificare la pianta nella foto.
 * Ritorna { candidate: [{nome, nomeScientifico, confidenza, perche, distinguere}], nota }.
 */
export async function identificaPianta(fotoB64) {
  const rispostaGrezza = await chiediAI(
    [{ ruolo: 'utente', testo: 'Che pianta è quella nella foto?', fotoB64 }],
    { systemPrompt: PROMPT_IDENTIFICA }
  );
  return analizzaJsonIdentificazione(rispostaGrezza);
}

function analizzaJsonIdentificazione(testo) {
  const vuoto = { candidate: [], nota: '' };
  if (!testo) return vuoto;
  const inizio = testo.indexOf('{');
  const fine = testo.lastIndexOf('}');
  if (inizio === -1 || fine === -1 || fine < inizio) return vuoto;
  try {
    const oggetto = JSON.parse(testo.slice(inizio, fine + 1));
    const candidate = (Array.isArray(oggetto.candidate) ? oggetto.candidate : [])
      .filter((c) => c && typeof c.nome === 'string' && c.nome.trim())
      .slice(0, 3)
      .map((c) => ({
        nome: c.nome.trim(),
        nomeScientifico: typeof c.nomeScientifico === 'string' ? c.nomeScientifico.trim() : '',
        confidenza: ['alta', 'media', 'bassa'].includes(c.confidenza) ? c.confidenza : '',
        perche: typeof c.perche === 'string' ? c.perche.trim() : '',
        distinguere: typeof c.distinguere === 'string' ? c.distinguere.trim() : '',
      }));
    return { candidate, nota: typeof oggetto.nota === 'string' ? oggetto.nota.trim() : '' };
  } catch {
    return vuoto;
  }
}

// ---------- Costruzione del contesto ----------

/** Costruisce il messaggio di contesto (scheda pianta + storico problemi + data) da anteporre alla conversazione. */
export function costruisciContesto(pianta, problemiPassati, problemaCorrente, riaperto) {
  const righe = [];
  righe.push(`Data di oggi: ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.`);
  righe.push('');
  righe.push('SCHEDA PIANTA');
  righe.push(`Nome: ${pianta?.nome || '(senza nome)'}`);
  if (pianta?.nomeScientifico) righe.push(`Nome botanico: ${pianta.nomeScientifico}`);
  righe.push(`Posizione: ${pianta?.posizione || 'non indicata'}`);
  righe.push(`Tag: ${(pianta?.tags || []).join(', ') || 'nessuno'}`);
  if (pianta?.note) righe.push(`Note: ${pianta.note}`);

  const altriProblemi = (problemiPassati || []).filter((p) => p.id !== problemaCorrente?.id);
  if (altriProblemi.length) {
    righe.push('');
    righe.push('STORICO PROBLEMI PASSATI SU QUESTA PIANTA');
    for (const p of altriProblemi) {
      righe.push(`- "${p.titolo}" (stato: ${p.stato})`);
      if (p.riassunto?.sintomi) righe.push(`  sintomi: ${p.riassunto.sintomi}`);
      if (p.riassunto?.azioni?.length) righe.push(`  azioni consigliate: ${p.riassunto.azioni.join('; ')}`);
    }
  }

  if (riaperto && problemaCorrente?.riassunto) {
    righe.push('');
    righe.push('QUESTO PROBLEMA È STATO RIAPERTO. Ultimo riassunto disponibile:');
    righe.push(`Sintomi: ${problemaCorrente.riassunto.sintomi || '(non registrati)'}`);
    if (problemaCorrente.riassunto.ipotesi?.length) {
      righe.push('Ipotesi discusse in precedenza:');
      for (const ip of problemaCorrente.riassunto.ipotesi) {
        righe.push(`  - ${ip.nome} (confidenza ${ip.confidenza}): ${ip.perche}`);
      }
    }
    if (problemaCorrente.riassunto.azioni?.length) {
      righe.push(`Azioni già consigliate: ${problemaCorrente.riassunto.azioni.join('; ')}`);
    }
    righe.push('Chiedi solo cosa è cambiato rispetto a questo riassunto, non ripartire da zero.');
  }

  return righe.join('\n');
}

// ---------- Funzione unica ----------

/**
 * messaggi: array di { ruolo: 'contesto'|'utente'|'ai', testo, fotoB64? }
 * "contesto" viene inviato come istruzione di sistema aggiuntiva (dopo il prompt fisso).
 * opzioni: { provider?, systemPrompt? }
 */
export async function chiediAI(messaggi, opzioni = {}) {
  const imp = leggiImpostazioniAI();
  const primario = opzioni.provider || imp.providerPrimario;

  try {
    return await chiamaProvider(primario, messaggi, imp, opzioni);
  } catch (erroreP) {
    const secondario = primario === 'gemini' ? 'openrouter' : 'gemini';
    const secondarioConfigurato =
      secondario === 'gemini' ? !!imp.geminiChiave : !!(imp.openrouterChiave && imp.openrouterModello);
    if (imp.usaRiserva && secondarioConfigurato) {
      try {
        return await chiamaProvider(secondario, messaggi, imp, opzioni);
      } catch (erroreS) {
        throw new Error(
          `${nomeProvider(primario)}: ${traduciErrore(erroreP, primario)} ` +
            `Anche la riserva ${nomeProvider(secondario)} ha fallito: ${traduciErrore(erroreS, secondario)}`
        );
      }
    }
    throw new Error(traduciErrore(erroreP, primario));
  }
}

/** Chiama l'AI dedicata al riassunto e fa il parse robusto del JSON prodotto. */
export async function riassumiConversazione(messaggi) {
  const testoConversazione = messaggi
    .filter((m) => m.ruolo === 'utente' || m.ruolo === 'ai')
    .map((m) => `${m.ruolo === 'utente' ? 'Persona' : 'Assistente'}: ${m.testo}`)
    .join('\n');

  const rispostaGrezza = await chiediAI(
    [{ ruolo: 'utente', testo: `Conversazione da riassumere:\n\n${testoConversazione}` }],
    { systemPrompt: PROMPT_RIASSUNTO }
  );

  return analizzaJsonRiassunto(rispostaGrezza);
}

function analizzaJsonRiassunto(testo) {
  const vuoto = { titolo: '', sintomi: '', ipotesi: [], azioni: [] };
  if (!testo) return vuoto;
  const inizio = testo.indexOf('{');
  const fine = testo.lastIndexOf('}');
  if (inizio === -1 || fine === -1 || fine < inizio) return vuoto;
  try {
    const oggetto = JSON.parse(testo.slice(inizio, fine + 1));
    return {
      titolo: typeof oggetto.titolo === 'string' ? oggetto.titolo.trim() : '',
      sintomi: typeof oggetto.sintomi === 'string' ? oggetto.sintomi : '',
      ipotesi: Array.isArray(oggetto.ipotesi) ? oggetto.ipotesi : [],
      azioni: Array.isArray(oggetto.azioni) ? oggetto.azioni : [],
    };
  } catch {
    return vuoto;
  }
}

// ---------- Provider ----------

async function chiamaProvider(provider, messaggi, imp, opzioni) {
  if (provider === 'gemini') return chiamaGemini(messaggi, imp, opzioni);
  if (provider === 'openrouter') return chiamaOpenRouter(messaggi, imp, opzioni);
  throw new Error(`Provider AI sconosciuto: ${provider}`);
}

function nomeProvider(p) {
  return p === 'gemini' ? 'Gemini' : 'OpenRouter';
}

async function chiamaGemini(messaggi, imp, opzioni) {
  if (!imp.geminiChiave) throw new Error('Manca la chiave Gemini nelle Impostazioni.');
  const modello = imp.geminiModello || MODELLO_GEMINI_DEFAULT;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    modello
  )}:generateContent`;

  const contents = messaggi
    .filter((m) => m.ruolo !== 'contesto')
    .map((m) => messaggioAGemini(m));

  const systemPrompt = opzioni.systemPrompt || PROMPT_DIAGNOSI;
  const contesto = messaggi.find((m) => m.ruolo === 'contesto');
  const istruzioniSistema = contesto ? `${systemPrompt}\n\n---\n${contesto.testo}` : systemPrompt;

  const body = {
    contents,
    systemInstruction: { role: 'system', parts: [{ text: istruzioniSistema }] },
  };

  const risposta = await fetchConTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': imp.geminiChiave },
    body: JSON.stringify(body),
  });

  if (!risposta.ok) {
    throw new Error(await erroreHttpLeggibile(risposta, 'gemini'));
  }

  const dati = await risposta.json();
  const testo = dati?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  if (!testo) throw new Error('Gemini ha risposto senza testo utilizzabile.');
  return testo.trim();
}

function messaggioAGemini(m) {
  const parts = [];
  if (m.testo) parts.push({ text: m.testo });
  if (m.fotoB64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: estraiBase64Puro(m.fotoB64) } });
  return { role: m.ruolo === 'ai' ? 'model' : 'user', parts };
}

async function chiamaOpenRouter(messaggi, imp, opzioni) {
  if (!imp.openrouterChiave) throw new Error('Manca la chiave OpenRouter nelle Impostazioni.');
  if (!imp.openrouterModello) throw new Error('Manca il nome del modello OpenRouter nelle Impostazioni.');

  const systemPrompt = opzioni.systemPrompt || PROMPT_DIAGNOSI;
  const contesto = messaggi.find((m) => m.ruolo === 'contesto');
  const istruzioniSistema = contesto ? `${systemPrompt}\n\n---\n${contesto.testo}` : systemPrompt;

  const messages = [{ role: 'system', content: istruzioniSistema }];
  for (const m of messaggi) {
    if (m.ruolo === 'contesto') continue;
    messages.push(messaggioAOpenAI(m));
  }

  const risposta = await fetchConTimeout('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${imp.openrouterChiave}`,
    },
    body: JSON.stringify({ model: imp.openrouterModello, messages }),
  });

  if (!risposta.ok) {
    throw new Error(await erroreHttpLeggibile(risposta, 'openrouter'));
  }

  const dati = await risposta.json();
  const testo = dati?.choices?.[0]?.message?.content || '';
  if (!testo) throw new Error('OpenRouter ha risposto senza testo utilizzabile.');
  return testo.trim();
}

function messaggioAOpenAI(m) {
  const ruolo = m.ruolo === 'ai' ? 'assistant' : 'user';
  if (!m.fotoB64) return { role: ruolo, content: m.testo || '' };
  return {
    role: ruolo,
    content: [
      { type: 'text', text: m.testo || '' },
      { type: 'image_url', image_url: { url: assicuraDataUri(m.fotoB64) } },
    ],
  };
}

// ---------- Utilità di rete ----------

async function fetchConTimeout(url, opzioni) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opzioni, signal: controller.signal });
  } catch (errore) {
    if (errore.name === 'AbortError') {
      throw new Error('La richiesta ha impiegato troppo tempo (timeout).');
    }
    throw new Error('Problema di connessione: controlla la rete e riprova.');
  } finally {
    clearTimeout(timer);
  }
}

async function erroreHttpLeggibile(risposta, provider) {
  let dettaglio = '';
  try {
    const dati = await risposta.json();
    dettaglio = dati?.error?.message || dati?.message || '';
  } catch {
    // corpo non-JSON, ignoriamo
  }
  if (risposta.status === 401 || risposta.status === 403) {
    return `Chiave ${nomeProvider(provider)} non valida o senza permessi. Controllala nelle Impostazioni.`;
  }
  if (risposta.status === 429) {
    return `${nomeProvider(provider)} ha raggiunto il limite di richieste. Riprova tra poco.${dettaglio ? ' Dettaglio: ' + dettaglio : ''}`;
  }
  return `${nomeProvider(provider)} ha risposto con un errore (${risposta.status}).${dettaglio ? ' ' + dettaglio : ''}`;
}

function traduciErrore(errore, provider) {
  const messaggio = errore?.message || String(errore);
  return messaggio || `Errore imprevisto con ${nomeProvider(provider)}.`;
}

function estraiBase64Puro(dataUrlOBase64) {
  const indice = dataUrlOBase64.indexOf(',');
  return indice === -1 ? dataUrlOBase64 : dataUrlOBase64.slice(indice + 1);
}

function assicuraDataUri(dataUrlOBase64) {
  return dataUrlOBase64.startsWith('data:') ? dataUrlOBase64 : `data:image/jpeg;base64,${dataUrlOBase64}`;
}

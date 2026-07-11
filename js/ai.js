// Strato AI: un'unica funzione chiediAI(messaggi, opzioni) sopra due provider
// intercambiabili (Gemini primario, OpenRouter di riserva). Chiavi e modelli
// vivono solo in localStorage, con prefisso "allolmo.".

const PREFISSO = 'allolmo.';
const TIMEOUT_MS = 30000;

const MODELLO_GEMINI_DEFAULT = 'gemini-2.5-flash';

// ---------- Impostazioni (localStorage) ----------

export function leggiImpostazioniAI() {
  return {
    geminiChiave: localStorage.getItem(PREFISSO + 'gemini.chiave') || '',
    geminiModello: localStorage.getItem(PREFISSO + 'gemini.modello') || MODELLO_GEMINI_DEFAULT,
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

Regole che devi seguire SEMPRE, senza eccezioni:

1. CONTESTO PRIMA DI TUTTO. Prima di ipotizzare qualunque causa, assicurati di sapere: dove si trova la pianta (interno/esterno, che esposizione), da quanto tempo dura il problema, cosa è cambiato di recente (spostamenti, rinvasi, trattamenti, annaffiature, meteo). Ti vengono forniti la scheda della pianta e lo storico dei problemi passati nel messaggio di contesto: NON richiedere informazioni che sono già lì dentro, leggile prima di fare domande.

2. UNA DOMANDA ALLA VOLTA. Se ti mancano informazioni, fai una sola domanda per volta. Mai elenchi di domande in un solo messaggio.

3. INCERTEZZA SEMPRE DICHIARATA. Non fingere mai una sicurezza che non hai. Se non sai, dillo esplicitamente e chiedi ciò che ti serve per capire meglio.

4. IPOTESI IN FORMATO FISSO, solo quando hai dati sufficienti per proporne una. Quando lo fai, usa sempre questa struttura, in questo ordine: ipotesi principale; perché potrebbe essere quella; cosa la confermerebbe; cosa la smentirebbe; livello di confidenza (alta / media / bassa).

5. PIÙ CORSI D'AZIONE, ORDINATI PER RISCHIO. Non dare mai una prescrizione secca e unica. Struttura sempre così: azione prudente da fare subito; cosa fare se il problema peggiora; cosa evitare per ora; quando ha senso sentire un vivaio o un esperto vero.

6. FOTO SOLO SU RICHIESTA ESPLICITA E SPECIFICA. Chiedi una foto solo quando ti serve davvero e specifica sempre cosa inquadrare (esempio: "una foto del retro delle foglie", "un primo piano del punto annerito sul fusto"). Non chiedere mai genericamente "carica una foto".

7. TERMINI TECNICI SPIEGATI. Alla prima occorrenza di un termine tecnico, spiegalo in una riga (esempio: "clorosi: le foglie ingialliscono perché la pianta non riesce ad assorbire bene i nutrienti").

8. PROBLEMA RIAPERTO. Se ti viene segnalato che il problema è "riaperto" (era già stato affrontato ed è tornato, o non è mai davvero passato), non ripartire da zero: leggi il riassunto dell'ultima volta che ti viene fornito nel contesto e chiedi solo cosa è cambiato rispetto ad allora.

Ti viene sempre passato nel contesto: la scheda della pianta (nome, posizione, tag, note), l'elenco dei problemi passati con i loro riassunti, e la data di oggi (per capire la stagione). Usa questi dati invece di richiederli di nuovo.`;

export const PROMPT_RIASSUNTO = `Leggi la conversazione seguente tra una persona e un assistente esperto di piante riguardo un problema su una pianta. Produci ESCLUSIVAMENTE un oggetto JSON valido, senza testo prima o dopo, senza markdown e senza backtick, con esattamente questa struttura:

{"sintomi": "descrizione breve dei sintomi osservati", "ipotesi": [{"nome": "nome ipotesi", "confidenza": "alta|media|bassa", "perche": "perché potrebbe essere questa causa", "confermerebbe": "cosa la confermerebbe", "smentirebbe": "cosa la smentirebbe"}], "azioni": ["azione consigliata 1", "azione consigliata 2"]}

Se un campo non è emerso dalla conversazione, usa una stringa vuota "" o un array vuoto []. Non aggiungere altri campi oltre a questi tre.`;

// ---------- Costruzione del contesto ----------

/** Costruisce il messaggio di contesto (scheda pianta + storico problemi + data) da anteporre alla conversazione. */
export function costruisciContesto(pianta, problemiPassati, problemaCorrente, riaperto) {
  const righe = [];
  righe.push(`Data di oggi: ${new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.`);
  righe.push('');
  righe.push('SCHEDA PIANTA');
  righe.push(`Nome: ${pianta?.nome || '(senza nome)'}`);
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
    if (imp.usaRiserva) {
      const secondario = primario === 'gemini' ? 'openrouter' : 'gemini';
      try {
        return await chiamaProvider(secondario, messaggi, imp, opzioni);
      } catch (erroreS) {
        throw new Error(
          `Non sono riuscita a contattare né ${nomeProvider(primario)} né ${nomeProvider(secondario)}. ` +
            `Controlla la connessione e le chiavi API nelle Impostazioni, poi riprova.`
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
  const vuoto = { sintomi: '', ipotesi: [], azioni: [] };
  if (!testo) return vuoto;
  const inizio = testo.indexOf('{');
  const fine = testo.lastIndexOf('}');
  if (inizio === -1 || fine === -1 || fine < inizio) return vuoto;
  try {
    const oggetto = JSON.parse(testo.slice(inizio, fine + 1));
    return {
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
    return `${nomeProvider(provider)} ha raggiunto il limite di richieste. Riprova tra poco.`;
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

// Compressione foto lato client: da File a data-URL JPEG entro una dimensione target.
// Niente librerie: canvas + toDataURL con ricerca semplice della qualità giusta.

export async function comprimiFoto(file) {
  return caricaEComprimi(file, { maxDim: 1600, qualitaIniziale: 0.78, targetByte: 190 * 1024, minQualita: 0.35 });
}

// Le card della griglia arrivano a ~500px reali sugli schermi ad alta densità:
// sotto i 480px la copertina sgrana.
const OPZIONI_THUMB = { maxDim: 480, qualitaIniziale: 0.75, targetByte: 70 * 1024, minQualita: 0.5 };

export async function generaThumbnail(file) {
  return caricaEComprimi(file, OPZIONI_THUMB);
}

/** Genera una thumbnail a partire da un data-URL già esistente (es. da una foto già compressa). */
export async function thumbnailDaDataUrl(dataUrl, opzioni = {}) {
  const img = await caricaImmagineDaUrl(dataUrl);
  return comprimiCanvas(img, { ...OPZIONI_THUMB, ...opzioni });
}

/** Lato maggiore di un'immagine data-URL (per riconoscere le thumbnail di vecchia generazione). */
export async function latoMaggioreImmagine(dataUrl) {
  const img = await caricaImmagineDaUrl(dataUrl);
  return Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height);
}

async function caricaEComprimi(file, opzioni) {
  const img = await caricaImmagineDaFile(file);
  return comprimiCanvas(img, opzioni);
}

function comprimiCanvas(img, opzioni) {
  const { maxDim, qualitaIniziale, targetByte, minQualita } = opzioni;
  const { larghezza, altezza } = scala(img.naturalWidth || img.width, img.naturalHeight || img.height, maxDim);

  const canvas = document.createElement('canvas');
  canvas.width = larghezza;
  canvas.height = altezza;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, larghezza, altezza);

  let qualita = qualitaIniziale;
  let dataUrl = canvas.toDataURL('image/jpeg', qualita);
  let tentativi = 0;
  while (dimensioneBase64(dataUrl) > targetByte && qualita > minQualita && tentativi < 6) {
    qualita = Math.max(minQualita, qualita - 0.12);
    dataUrl = canvas.toDataURL('image/jpeg', qualita);
    tentativi++;
  }
  return dataUrl;
}

function caricaImmagineDaFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Non riesco a leggere questa immagine. Prova con un'altra foto."));
    };
    img.src = url;
  });
}

function caricaImmagineDaUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Non riesco a leggere questa immagine.'));
    img.src = url;
  });
}

function scala(larghezzaOriginale, altezzaOriginale, maxDim) {
  if (larghezzaOriginale <= maxDim && altezzaOriginale <= maxDim) {
    return { larghezza: larghezzaOriginale, altezza: altezzaOriginale };
  }
  const rapporto =
    larghezzaOriginale > altezzaOriginale ? maxDim / larghezzaOriginale : maxDim / altezzaOriginale;
  return {
    larghezza: Math.max(1, Math.round(larghezzaOriginale * rapporto)),
    altezza: Math.max(1, Math.round(altezzaOriginale * rapporto)),
  };
}

function dimensioneBase64(dataUrl) {
  const base64 = dataUrl.split(',')[1] || '';
  return Math.round((base64.length * 3) / 4);
}

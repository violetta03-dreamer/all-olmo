// Service worker: network-first per la shell statica dell'app (aggiornamenti subito
// visibili, cache usata solo se offline); mai intercettate le chiamate ad API esterne
// (Firebase, Gemini, OpenRouter).

const NOME_CACHE = 'allolmo-shell-v6';

const FILE_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/main.js',
  './js/firebase.js',
  './js/firebase-config.js',
  './js/db.js',
  './js/ai.js',
  './js/foto.js',
  './js/util.js',
  './js/ui/giardino.js',
  './js/ui/identifica.js',
  './js/ui/scegli-foto.js',
  './js/ui/pianta.js',
  './js/ui/problema.js',
  './js/ui/impostazioni.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches
      .open(NOME_CACHE)
      .then((cache) => cache.addAll(FILE_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chiavi) => Promise.all(chiavi.filter((k) => k !== NOME_CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

function eDaLasciarPassareInRete(url) {
  // Tutto ciò che non è la nostra stessa origine (Firebase, Google Fonts, Gemini, OpenRouter, gstatic…)
  return url.origin !== self.location.origin;
}

self.addEventListener('fetch', (evento) => {
  const richiesta = evento.request;
  if (richiesta.method !== 'GET') return;

  const url = new URL(richiesta.url);
  if (eDaLasciarPassareInRete(url)) return; // network, mai intercettato

  evento.respondWith(
    // cache: 'no-cache' = rivalida sempre col server (ETag): senza questo, la cache HTTP
    // di GitHub Pages (10 minuti) farebbe arrivare aggiornamenti in ritardo.
    fetch(richiesta, { cache: 'no-cache' })
      .then((rispostaRete) => {
        const copia = rispostaRete.clone();
        caches.open(NOME_CACHE).then((cache) => cache.put(richiesta, copia)).catch(() => {});
        return rispostaRete;
      })
      .catch(() =>
        caches.match(richiesta).then((rispostaCache) => rispostaCache || caches.match('./index.html'))
      )
  );
});

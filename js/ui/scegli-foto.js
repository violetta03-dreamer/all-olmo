// Scelta esplicita fotocamera/galleria. Il selettore di sistema Android
// (photo picker) mostra solo la galleria e non offre più la fotocamera,
// quindi le due vie le proponiamo noi: "capture" per scattare, input
// semplice per la galleria. Usato da album, creazione pianta e chat.

export function apriSceltaFoto(onFile) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="foglio">
      <h2>Aggiungi una foto</h2>
      <button type="button" class="btn btn-primario btn-blocco" id="sf-scatta">📷 Scatta una foto</button>
      <button type="button" class="btn btn-secondario btn-blocco" id="sf-galleria">🖼️ Scegli dalla galleria</button>
      <button type="button" class="btn btn-secondario btn-blocco" id="sf-annulla">Annulla</button>
    </div>`;
  document.body.appendChild(overlay);

  const chiudi = () => overlay.remove();
  overlay.querySelector('#sf-annulla').addEventListener('click', chiudi);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) chiudi();
  });

  const scegli = (conFotocamera) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (conFotocamera) input.capture = 'environment';
    input.addEventListener('change', () => {
      const file = input.files[0];
      chiudi();
      if (file) onFile(file);
    });
    input.click();
  };
  overlay.querySelector('#sf-scatta').addEventListener('click', () => scegli(true));
  overlay.querySelector('#sf-galleria').addEventListener('click', () => scegli(false));
}

/**
 * Lettore PDF Libero - App Android PWA
 * 100% Gratuito, Senza Pubblicità, Funzionamento Offline
 */

// Imposta il worker locale per PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = './lib/pdf.worker.min.js';

// Stato globale dell'applicazione
const state = {
  currentPdfDoc: null,
  currentDocId: null,
  currentDocName: '',
  currentPageNum: 1,
  totalPages: 0,
  pageRendering: false,
  pageNumPending: null,
  scale: 1.0,
  fitMode: 'width', // 'width', 'custom'
  readingMode: 'single', // 'single', 'continuous'
  colorFilter: 'normal', // 'normal', 'dark', 'sepia'
  toolbarsVisible: true,
  theme: localStorage.getItem('pdf_theme') || 'dark'
};

// ==================== INDEXEDDB (Salvataggio Locale PDF) ====================
const DB_NAME = 'PdfLibreLocalDB';
const DB_VERSION = 1;
const STORE_NAME = 'recent_docs';

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('dateOpened', 'dateOpened', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveDocToDB(id, name, size, arrayBuffer, lastPage, totalPages) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    // Se non passiamo arrayBuffer nuovo, manteniamo quello vecchio
    if (!arrayBuffer) {
      const existing = await new Promise((res) => {
        const req = store.get(id);
        req.onsuccess = () => res(req.result);
        req.onerror = () => res(null);
      });
      if (existing) {
        arrayBuffer = existing.data;
      }
    }

    const docRecord = {
      id,
      name,
      size,
      data: arrayBuffer,
      lastPage: lastPage || 1,
      totalPages: totalPages || 1,
      dateOpened: Date.now()
    };

    store.put(docRecord);
    return new Promise((res) => {
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    });
  } catch (err) {
    console.error('Errore salvataggio IndexedDB:', err);
  }
}

async function getRecentDocs() {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = req.result || [];
        list.sort((a, b) => b.dateOpened - a.dateOpened);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

async function deleteDocFromDB(id) {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((res) => {
    tx.oncomplete = () => res(true);
  });
}

async function clearAllDocsFromDB() {
  const db = await openDatabase();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).clear();
  return new Promise((res) => {
    tx.oncomplete = () => res(true);
  });
}

// ==================== GESTIONE ELEMENTI DOM ====================
const elements = {
  // Schermate
  libraryView: document.getElementById('library-view'),
  readerView: document.getElementById('reader-view'),
  // File inputs
  fileInput: document.getElementById('pdf-file-input'),
  dropZone: document.getElementById('drop-zone'),
  recentsList: document.getElementById('recents-list'),
  clearRecentsBtn: document.getElementById('clear-recents-btn'),
  // Reader Header
  topToolbar: document.getElementById('top-toolbar'),
  backBtn: document.getElementById('back-to-library-btn'),
  docTitle: document.getElementById('doc-title'),
  readingModeBadge: document.getElementById('reading-mode-badge'),
  filterBtn: document.getElementById('filter-btn'),
  filterModal: document.getElementById('filter-modal'),
  layoutToggleBtn: document.getElementById('layout-toggle-btn'),
  fullscreenBtn: document.getElementById('fullscreen-btn'),
  themeBtn: document.getElementById('theme-btn'),
  // Viewer area
  viewerContainer: document.getElementById('viewer-container'),
  renderArea: document.getElementById('pdf-render-area'),
  singleCanvas: document.getElementById('single-canvas'),
  // Touch zones
  prevTapZone: document.getElementById('prev-tap-zone'),
  centerTapZone: document.getElementById('center-tap-zone'),
  nextTapZone: document.getElementById('next-tap-zone'),
  // Bottom Toolbar
  bottomToolbar: document.getElementById('bottom-toolbar'),
  prevPageBtn: document.getElementById('prev-page-btn'),
  nextPageBtn: document.getElementById('next-page-btn'),
  pageNumInput: document.getElementById('page-num-input'),
  pageCount: document.getElementById('page-count'),
  pageSlider: document.getElementById('page-slider'),
  zoomOutBtn: document.getElementById('zoom-out-btn'),
  zoomFitBtn: document.getElementById('zoom-fit-btn'),
  zoomInBtn: document.getElementById('zoom-in-btn'),
  // Toast
  toast: document.getElementById('toast')
};

// ==================== INIZIALIZZAZIONE ====================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadRecentsUI();
  setupEventListeners();
  registerServiceWorker();
});

function initTheme() {
  document.body.className = `theme-${state.theme}`;
  elements.themeBtn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 2500);
}

// ==================== REGISTRAZIONE EVENTI ====================
function setupEventListeners() {
  // Cambio tema chiaro/scuro app
  elements.themeBtn.addEventListener('click', () => {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('pdf_theme', state.theme);
    initTheme();
  });

  // Selezione file da input
  elements.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file && file.type === 'application/pdf') {
      openLocalPdfFile(file);
    }
  });

  // Drag & Drop
  elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
  });
  elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('dragover');
  });
  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      openLocalPdfFile(file);
    }
  });

  // Paginazione
  elements.prevPageBtn.addEventListener('click', prevPage);
  elements.nextPageBtn.addEventListener('click', nextPage);
  elements.prevTapZone.addEventListener('click', prevPage);
  elements.nextTapZone.addEventListener('click', nextPage);

  // Tocca al centro per mostrare/nascondere le barre degli strumenti
  elements.centerTapZone.addEventListener('click', toggleToolbars);

  // Salto pagina input
  elements.pageNumInput.addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val >= 1 && val <= state.totalPages) {
      queueRenderPage(val);
    } else {
      elements.pageNumInput.value = state.currentPageNum;
    }
  });

  // Slider pagina
  elements.pageSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    queueRenderPage(val);
  });

  // Zoom
  elements.zoomInBtn.addEventListener('click', () => {
    state.fitMode = 'custom';
    state.scale = Math.min(state.scale + 0.25, 3.5);
    renderCurrentPage();
  });
  elements.zoomOutBtn.addEventListener('click', () => {
    state.fitMode = 'custom';
    state.scale = Math.max(state.scale - 0.25, 0.5);
    renderCurrentPage();
  });
  elements.zoomFitBtn.addEventListener('click', () => {
    state.fitMode = 'width';
    renderCurrentPage();
  });

  // Torna alla libreria
  elements.backBtn.addEventListener('click', () => {
    showLibrary();
  });

  // Alterna layout Singolo / Continuo
  elements.layoutToggleBtn.addEventListener('click', toggleReadingLayout);

  // Filtri colore lettura (Giorno / Notte / Seppia)
  elements.filterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.filterModal.style.display = elements.filterModal.style.display === 'none' ? 'flex' : 'none';
  });

  document.addEventListener('click', (e) => {
    if (!elements.filterModal.contains(e.target) && e.target !== elements.filterBtn) {
      elements.filterModal.style.display = 'none';
    }
  });

  elements.filterModal.querySelectorAll('.filter-option').forEach(btn => {
    btn.addEventListener('click', () => {
      elements.filterModal.querySelectorAll('.filter-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter');
      setColorFilter(filter);
      elements.filterModal.style.display = 'none';
    });
  });

  // Schermo intero
  elements.fullscreenBtn.addEventListener('click', toggleFullscreen);

  // Cancella tutti i recenti
  elements.clearRecentsBtn.addEventListener('click', async () => {
    if (confirm('Vuoi cancellare la lista dei documenti recenti?')) {
      await clearAllDocsFromDB();
      loadRecentsUI();
      showToast('Cronologia cancellata');
    }
  });

  // Gestione Swipe Touch per cambiare pagina sui telefoni
  let touchStartX = 0;
  let touchStartY = 0;
  elements.viewerContainer.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  elements.viewerContainer.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].screenX;
    const touchEndY = e.changedTouches[0].screenY;
    const diffX = touchEndX - touchStartX;
    const diffY = touchEndY - touchStartY;

    // Solo se lo swipe è orizzontale significativo e non verticale
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      if (diffX < 0) {
        nextPage(); // Swipe verso sinistra -> Pagina successiva
      } else {
        prevPage(); // Swipe verso destra -> Pagina precedente
      }
    }
  }, { passive: true });

  // Tasti freccia su tastiera
  document.addEventListener('keydown', (e) => {
    if (elements.readerView.classList.contains('active')) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') nextPage();
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') prevPage();
      if (e.key === 'Escape') showLibrary();
    }
  });
}

// ==================== APERTURA E RENDERING PDF ====================
async function openLocalPdfFile(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const docId = `${file.name}_${file.size}_${file.lastModified}`;
    state.currentDocId = docId;
    state.currentDocName = file.name;

    await loadPdfFromBuffer(arrayBuffer, file.name);
    
    // Salva in IndexedDB per ritrovarlo nei recenti
    await saveDocToDB(docId, file.name, file.size, arrayBuffer, state.currentPageNum, state.totalPages);
    loadRecentsUI();
  } catch (err) {
    alert('Errore nel caricamento del file PDF: ' + err.message);
  }
}

async function loadPdfFromBuffer(arrayBuffer, docName, targetPage = 1) {
  try {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    state.currentPdfDoc = await loadingTask.promise;
    state.totalPages = state.currentPdfDoc.numPages;
    state.currentDocName = docName;
    state.currentPageNum = targetPage <= state.totalPages ? targetPage : 1;

    // Aggiorna interfaccia
    elements.docTitle.textContent = docName;
    elements.pageCount.textContent = state.totalPages;
    elements.pageSlider.max = state.totalPages;
    elements.pageNumInput.max = state.totalPages;

    // Passa alla schermata lettore
    elements.libraryView.classList.remove('active');
    elements.readerView.classList.add('active');

    // Rendering prima pagina
    renderCurrentPage();
  } catch (err) {
    alert('Impossibile aprire il documento: ' + err.message);
  }
}

async function renderCurrentPage() {
  if (!state.currentPdfDoc) return;
  state.pageRendering = true;

  try {
    const page = await state.currentPdfDoc.getPage(state.currentPageNum);
    const canvas = elements.singleCanvas;
    const ctx = canvas.getContext('2d');

    // Calcolo scala per adattare allo schermo dello smartphone
    const containerWidth = elements.viewerContainer.clientWidth - 20;
    const unscaledViewport = page.getViewport({ scale: 1.0 });

    let finalScale = state.scale;
    if (state.fitMode === 'width') {
      finalScale = containerWidth / unscaledViewport.width;
      state.scale = finalScale;
    }

    // Risoluzione Retina / Display HD Android
    const pixelRatio = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: finalScale * pixelRatio });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / pixelRatio}px`;
    canvas.style.height = `${viewport.height / pixelRatio}px`;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    state.pageRendering = false;
    if (state.pageNumPending !== null) {
      const pending = state.pageNumPending;
      state.pageNumPending = null;
      queueRenderPage(pending);
    }

    // Aggiorna numeri di pagina
    elements.pageNumInput.value = state.currentPageNum;
    elements.pageSlider.value = state.currentPageNum;

    // Salva posizione di lettura in IndexedDB
    if (state.currentDocId) {
      saveDocToDB(state.currentDocId, state.currentDocName, 0, null, state.currentPageNum, state.totalPages);
    }
  } catch (err) {
    console.error('Errore rendering pagina:', err);
    state.pageRendering = false;
  }
}

function queueRenderPage(num) {
  if (state.pageRendering) {
    state.pageNumPending = num;
  } else {
    state.currentPageNum = num;
    renderCurrentPage();
  }
}

function prevPage() {
  if (state.currentPageNum <= 1) return;
  queueRenderPage(state.currentPageNum - 1);
}

function nextPage() {
  if (state.currentPageNum >= state.totalPages) return;
  queueRenderPage(state.currentPageNum + 1);
}

// ==================== INTERFACCIA E CONTROLLI ====================
function toggleToolbars() {
  state.toolbarsVisible = !state.toolbarsVisible;
  elements.topToolbar.classList.toggle('hidden', !state.toolbarsVisible);
  elements.bottomToolbar.classList.toggle('hidden', !state.toolbarsVisible);
}

function toggleReadingLayout() {
  // Modalità scorrimento / singola
  if (state.readingMode === 'single') {
    state.readingMode = 'continuous';
    elements.readingModeBadge.textContent = 'Scorrimento continuo';
    showToast('Scorrimento verticale');
  } else {
    state.readingMode = 'single';
    elements.readingModeBadge.textContent = 'Pagina singola';
    showToast('Pagina singola');
  }
}

function setColorFilter(filter) {
  state.colorFilter = filter;
  elements.renderArea.className = `pdf-render-area filter-${filter}`;
  showToast(`Tema lettura: ${filter === 'dark' ? 'Notte' : filter === 'sepia' ? 'Seppia' : 'Giorno'}`);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

function showLibrary() {
  elements.readerView.classList.remove('active');
  elements.libraryView.classList.add('active');
  loadRecentsUI();
}

// ==================== CARICAMENTO RECENTI ====================
async function loadRecentsUI() {
  const recents = await getRecentDocs();
  elements.recentsList.innerHTML = '';

  if (recents.length === 0) {
    elements.clearRecentsBtn.style.display = 'none';
    elements.recentsList.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📖</span>
        <p>Nessun documento recente</p>
        <small>I PDF aperti rimarranno salvati sul tuo dispositivo per continuare a leggere offline.</small>
      </div>
    `;
    return;
  }

  elements.clearRecentsBtn.style.display = 'block';

  recents.forEach(doc => {
    const card = document.createElement('div');
    card.className = 'recent-card';
    
    const percentage = Math.round((doc.lastPage / doc.totalPages) * 100) || 0;
    const formattedSize = doc.size ? (doc.size / (1024 * 1024)).toFixed(1) + ' MB' : '';

    card.innerHTML = `
      <div class="recent-info">
        <div class="recent-name" title="${doc.name}">${doc.name}</div>
        <div class="recent-meta">
          <span>📄 Pagina ${doc.lastPage} di ${doc.totalPages} (${percentage}%)</span>
          ${formattedSize ? `<span>• ${formattedSize}</span>` : ''}
        </div>
      </div>
      <div class="recent-actions">
        <button class="delete-recent-btn" title="Rimuovi dai recenti">🗑️</button>
      </div>
    `;

    // Clic per riaprire il documento
    card.addEventListener('click', (e) => {
      if (e.target.closest('.delete-recent-btn')) return;
      if (doc.data) {
        state.currentDocId = doc.id;
        loadPdfFromBuffer(doc.data, doc.name, doc.lastPage);
      } else {
        alert('File non disponibile nella memoria locale.');
      }
    });

    // Clic per eliminare dai recenti
    const delBtn = card.querySelector('.delete-recent-btn');
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteDocFromDB(doc.id);
      loadRecentsUI();
      showToast('Documento rimosso dai recenti');
    });

    elements.recentsList.appendChild(card);
  });
}

// ==================== SERVICE WORKER (OFFLINE) ====================
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js')
      .then(() => console.log('Service Worker registrato con successo'))
      .catch((err) => console.log('Registrazione Service Worker fallita:', err));
  }
}

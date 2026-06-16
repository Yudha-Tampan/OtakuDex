/* ── NHBrowser — script.js ───────────────────────── */

const API_HOME     = 'https://api.theresav.biz.id/anime/nhentai/home?apikey=mykey111';
const API_POPULAR  = (page) => `https://api.theresav.biz.id/anime/nhentai/popular?page=${page}&apikey=mykey111`;
const API_LATEST   = (page) => `https://api.theresav.biz.id/anime/nhentai/latest?page=${page}&apikey=mykey111`;
const API_DOWNLOAD = (url)  => `https://api.theresav.biz.id/anime/nhentai/download?url=${encodeURIComponent(url)}&apikey=mykey111`;
const API_GENRE    = (genre, page) => `https://api.theresav.biz.id/anime/nhentai/genres?genre=${encodeURIComponent(genre)}&page=${page}&apikey=mykey111`;
const AGE_KEY      = 'nhb_age_verified';

const GENRE_LIST = [
  'Big Breasts','Sole Female','Sole Male','Stockings','Schoolgirl Uniform',
  'Nakadashi','Blowjob','Defloration','Loli','Anal','Glasses','Incest',
  'Ahegao','Paizuri','Impregnation','X-ray','Milf','Femdom','Group','Yaoi','Yuri'
];

/* ── Helpers ─────────────────────────────────────── */
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function isValid(item) {
  return item &&
    item.id    != null && String(item.id).trim()    !== '' &&
    item.url   != null && String(item.url).trim()   !== '' &&
    item.title != null && String(item.title).trim() !== '';
}

// ── Single global addUnique (no duplicate declaration) ──
function addUnique(seenSet, items) {
  return items.filter(i => {
    const key = String(i.id);
    if (seenSet.has(key)) return false;
    seenSet.add(key);
    return true;
  });
}

/* ── Data Store ─────────────────────────────────── */
let allData = {
  popular:    [],
  latest:     [],
  popularAll: [],
  genre:      [],
};
let latestPage    = 1;
let latestLoading = false;
let latestHasMore = true;
let activeTab     = 'home';

/* ── Genre State ─────────────────────────────────── */
let genrePage      = 1;
let genreLoading   = false;
let genreHasMore   = true;
let activeGenre    = GENRE_LIST[0];
let genreRetries   = 0;
const MAX_GENRE_RETRIES = 5;

/* ── Popular State ───────────────────────────────── */
let popularPage    = 1;
let popularLoading = false;
let popularHasMore = true;
const seenPopular  = new Set();

/* ── Global Seen Sets ────────────────────────────── */
const seenLatest = new Set();
const seenGenre  = new Set();

/* ── Reader State ───────────────────────────────── */
let readerPages   = [];
let readerCurrent = 0;
let readerMode    = 'single';
let currentItem   = null;


document.addEventListener('DOMContentLoaded', function() {

/* ── DOM ────────────────────────────────────────── */
const ageGate        = document.getElementById('age-gate');
const ageYes         = document.getElementById('age-yes');
const ageNo          = document.getElementById('age-no');
const searchInput    = document.getElementById('search-input');
const popularGrid    = document.getElementById('popular-grid');
const latestGrid     = document.getElementById('latest-grid');
const popularAllGrid = document.getElementById('popular-all-grid');
const popularAllCount= document.getElementById('popular-all-count');
const genreGrid      = document.getElementById('genre-grid');
const genreSelect    = document.getElementById('genre-select');
const genreCount     = document.getElementById('genre-count');
const errorBanner    = document.getElementById('error-banner');
const errorMsg       = document.getElementById('error-msg');
const retryBtn       = document.getElementById('retry-btn');
const noResults      = document.getElementById('no-results');
const searchTerm     = document.getElementById('search-term');
const tabBtns        = document.querySelectorAll('.tab-btn');
const tabPanels      = document.querySelectorAll('.tab-panel');

// Info modal
const modal      = document.getElementById('modal');
const modalClose = document.getElementById('modal-close');
const modalThumb = document.getElementById('modal-thumb');
const modalTitle = document.getElementById('modal-title');
const modalId    = document.getElementById('modal-id');
const modalLink  = document.getElementById('modal-link');
const modalRead  = document.getElementById('modal-read');

// Reader
const reader           = document.getElementById('reader');
const readerBack       = document.getElementById('reader-back');
const readerTitleEl    = document.getElementById('reader-title');
const readerProgressEl = document.getElementById('reader-progress');
const readerProgress2El= document.getElementById('reader-progress2');
const readerLoading    = document.getElementById('reader-loading');
const readerError      = document.getElementById('reader-error');
const readerErrorMsg   = document.getElementById('reader-error-msg');
const readerRetry      = document.getElementById('reader-retry');
const readerPages_el   = document.getElementById('reader-pages');
const readerPrev       = document.getElementById('reader-prev');
const readerNext       = document.getElementById('reader-next');
const readerPrev2      = document.getElementById('reader-prev2');
const readerNext2      = document.getElementById('reader-next2');

/* ══════════════════════════════════════════════════
   AGE GATE
══════════════════════════════════════════════════ */
function initAgeGate() {
  if (localStorage.getItem(AGE_KEY) === '1') { ageGate.classList.add('hidden'); return; }
  ageGate.classList.remove('hidden');
}
ageYes.addEventListener('click', () => { localStorage.setItem(AGE_KEY,'1'); ageGate.classList.add('hidden'); });
ageNo.addEventListener('click',  () => { window.location.href = 'https://www.google.com'; });

/* ══════════════════════════════════════════════════
   TABS
══════════════════════════════════════════════════ */
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab === activeTab) return;
    activeTab = tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tabPanels.forEach(p => p.classList.add('hidden'));
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    if (tab === 'popular' && allData.popularAll.length === 0) fetchPopularAll(true);
    if (tab === 'genre'   && allData.genre.length === 0)      fetchGenre(true);
    applySearch(searchInput.value);
  });
});

/* ══════════════════════════════════════════════════
   SKELETON
══════════════════════════════════════════════════ */
function renderSkeletons(container, count = 8) {
  container.innerHTML = Array.from({ length: count }, () => `
    <div class="skeleton">
      <div class="skeleton__thumb"></div>
      <div class="skeleton__body">
        <div class="skeleton__line skeleton__line--short"></div>
        <div class="skeleton__line skeleton__line--mid"></div>
        <div class="skeleton__line"></div>
        <div class="skeleton__line skeleton__line--mid"></div>
      </div>
    </div>`).join('');
}

/* ══════════════════════════════════════════════════
   CARD
══════════════════════════════════════════════════ */
function createCard(item) {
  const card = document.createElement('div');
  card.className = 'card';
  card.innerHTML = `
    <div class="card__thumb-wrap">
      <img class="card__thumb" src="${item.thumb}" alt="${escHtml(item.title)}" loading="lazy"
        onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%231e293b\\'/></svg>'" />
      <div class="card__overlay">
        <button class="btn btn--primary card__overlay-btn">View</button>
      </div>
    </div>
    <div class="card__body">
      <span class="card__id">#${item.id}</span>
      <p class="card__title">${escHtml(item.title)}</p>
    </div>`;
  card.addEventListener('click', () => openInfoModal(item));
  return card;
}

function appendToGrid(container, items) {
  const frag = document.createDocumentFragment();
  items.forEach(i => frag.appendChild(createCard(i)));
  container.appendChild(frag);
}

function renderGrid(container, items) {
  container.innerHTML = '';
  appendToGrid(container, items);
}

/* ══════════════════════════════════════════════════
   LOAD MORE BUTTONS
══════════════════════════════════════════════════ */
function ensureLoadMoreBtn() {
  const btn = document.getElementById('load-more-btn');
  if (btn && !btn._bound) {
    btn._bound = true;
    btn.addEventListener('click', () => fetchMoreLatest());
  }
  return btn;
}

function setLoadMoreState(state) {
  const btn  = document.getElementById('load-more-btn');
  if (!btn) return;
  const wrap = btn.parentElement;
  if (state === 'loading') {
    btn.textContent = 'Loading…';
    btn.disabled = true;
    wrap.classList.remove('hidden');
  } else if (state === 'ready') {
    btn.textContent = 'Load More Latest';
    btn.disabled = false;
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
  }
}

function setGenreLoadMore(state) {
  const btn  = document.getElementById('genre-load-more-btn');
  if (!btn) return;
  const wrap = btn.parentElement;
  if (state === 'loading') {
    btn.textContent = 'Loading…';
    btn.disabled = true;
    wrap.classList.remove('hidden');
  } else if (state === 'ready') {
    btn.textContent = 'Load More';
    btn.disabled = false;
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
  }
}

function setPopularLoadMore(state) {
  const btn  = document.getElementById('popular-load-more-btn');
  if (!btn) return;
  const wrap = btn.parentElement;
  if (state === 'loading') {
    btn.textContent = 'Loading…';
    btn.disabled = true;
    wrap.classList.remove('hidden');
  } else if (state === 'ready') {
    btn.textContent = 'Load More';
    btn.disabled = false;
    wrap.classList.remove('hidden');
  } else {
    wrap.classList.add('hidden');
  }
}

/* ══════════════════════════════════════════════════
   FILTER / SEARCH
══════════════════════════════════════════════════ */
function applySearch(query) {
  const q = query.trim().toLowerCase();
  if (activeTab === 'home') {
    const fp = allData.popular.filter(i => !q || i.title.toLowerCase().includes(q));
    const fl = allData.latest.filter(i  => !q || i.title.toLowerCase().includes(q));
    renderGrid(popularGrid, fp);
    renderGrid(latestGrid, fl);
    document.getElementById('popular-section').style.display = fp.length ? '' : 'none';
    document.getElementById('latest-section').style.display  = fl.length ? '' : 'none';
    if (fl.length && !q) { ensureLoadMoreBtn(); setLoadMoreState(latestHasMore ? 'ready' : 'done'); }
    const none = fp.length === 0 && fl.length === 0;
    noResults.classList.toggle('hidden', !none);
    if (none) searchTerm.textContent = query.trim();
  } else if (activeTab === 'genre') {
    const fg = allData.genre.filter(i => !q || i.title.toLowerCase().includes(q));
    renderGrid(genreGrid, fg);
    document.getElementById('genre-section').style.display = fg.length ? '' : 'none';
    const none = fg.length === 0 && allData.genre.length > 0;
    noResults.classList.toggle('hidden', !none);
    if (none) searchTerm.textContent = query.trim();
    else noResults.classList.add('hidden');
  } else {
    const fa = allData.popularAll.filter(i => !q || i.title.toLowerCase().includes(q));
    renderGrid(popularAllGrid, fa);
    document.getElementById('popular-all-section').style.display = fa.length ? '' : 'none';
    if (fa.length && !q) setPopularLoadMore(popularHasMore ? 'ready' : 'done');
    const none = fa.length === 0 && allData.popularAll.length > 0;
    noResults.classList.toggle('hidden', !none);
    if (none) searchTerm.textContent = query.trim();
    else noResults.classList.add('hidden');
  }
}
searchInput.addEventListener('input', () => applySearch(searchInput.value));

/* ══════════════════════════════════════════════════
   INFO MODAL
══════════════════════════════════════════════════ */
function openInfoModal(item) {
  currentItem = item;
  modalThumb.src = item.thumb;
  modalThumb.alt = item.title;
  modalTitle.textContent = item.title;
  modalId.textContent    = item.id;
  modalLink.href = item.url;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeInfoModal() {
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeInfoModal);
modal.querySelector('.modal__backdrop').addEventListener('click', closeInfoModal);
modalRead.addEventListener('click', () => { closeInfoModal(); openReader(currentItem); });

/* ══════════════════════════════════════════════════
   READER
══════════════════════════════════════════════════ */
function openReader(item) {
  currentItem   = item;
  readerPages   = [];
  readerCurrent = 0;
  readerMode    = 'single';

  readerTitleEl.textContent = item.title;
  updateProgress();

  readerLoading.classList.remove('hidden');
  readerError.classList.add('hidden');
  readerPages_el.classList.add('hidden');
  readerPages_el.innerHTML = '';
  readerPages_el.classList.remove('single-page');

  reader.classList.remove('hidden');
  reader.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  if (!document.getElementById('view-toggle-wrap')) {
    const wrap = document.createElement('div');
    wrap.id = 'view-toggle-wrap';
    wrap.className = 'reader__view-toggle';
    wrap.innerHTML = `
      <button class="view-mode-btn active" data-mode="single">📄 Page</button>
      <button class="view-mode-btn" data-mode="scroll">📜 Scroll</button>`;
    wrap.querySelectorAll('.view-mode-btn').forEach(b => {
      b.addEventListener('click', () => {
        readerMode = b.dataset.mode;
        wrap.querySelectorAll('.view-mode-btn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        applyViewMode();
      });
    });
    document.querySelector('.reader__nav').before(wrap);
  }

  fetchPages(item);
}

/* ── FIX: Build download URL correctly from item.url ── */
async function fetchPages(item) {
  // item.url is like "https://nhentai.to/g/653160/" — pass it directly
  const apiUrl = API_DOWNLOAD(item.url);
  try {
    const res  = await fetch(apiUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} — Tidak bisa memuat halaman manga`);
    const json = await res.json();

    // API returns: { status: true, total: N, result: ["url1", "url2", ...] }
    // result is a direct array of image URL strings
    let pages = [];
    if (Array.isArray(json.result)) {
      pages = json.result.filter(u => typeof u === 'string' && u.trim() !== '');
    }

    if (!pages.length) throw new Error('Tidak ada halaman ditemukan');

    readerPages = pages;
    buildPageElements();
    readerLoading.classList.add('hidden');
    readerPages_el.classList.remove('hidden');
    readerPages_el.classList.add('single-page');
    applyViewMode();
    updateProgress();
  } catch (err) {
    readerLoading.classList.add('hidden');
    readerErrorMsg.textContent = err.message;
    readerError.classList.remove('hidden');
  }
}

function buildPageElements() {
  readerPages_el.innerHTML = '';
  readerPages.forEach((url, idx) => {
    const wrap = document.createElement('div');
    wrap.className = 'reader__page-wrap';
    wrap.dataset.index = idx;
    const img = document.createElement('img');
    img.className = 'reader__page-img loading-img';
    img.alt = `Page ${idx + 1}`;
    img.loading = 'lazy';
    img.onload  = () => img.classList.replace('loading-img', 'loaded-img');
    img.onerror = () => { img.classList.replace('loading-img', 'loaded-img'); };
    img.src = url;
    const num = document.createElement('span');
    num.className = 'reader__page-num';
    num.textContent = `${idx + 1} / ${readerPages.length}`;
    wrap.appendChild(img);
    wrap.appendChild(num);
    readerPages_el.appendChild(wrap);
  });
}

function applyViewMode() {
  const wraps = readerPages_el.querySelectorAll('.reader__page-wrap');
  if (readerMode === 'scroll') {
    readerPages_el.classList.remove('single-page');
    wraps.forEach(w => { w.style.display = 'block'; });
  } else {
    readerPages_el.classList.add('single-page');
    showPage(readerCurrent);
  }
  updateProgress();
}

function showPage(idx) {
  const wraps = readerPages_el.querySelectorAll('.reader__page-wrap');
  if (!wraps.length) return;
  idx = Math.max(0, Math.min(idx, wraps.length - 1));
  readerCurrent = idx;
  wraps.forEach((w, i) => w.classList.toggle('active-page', i === idx));
  readerPages_el.scrollTop = 0;
  updateProgress();
}

function updateProgress() {
  const total = readerPages.length;
  const txt = total
    ? (readerMode === 'scroll' ? `${total} pages` : `Page ${readerCurrent + 1} / ${total}`)
    : '—';
  readerProgressEl.textContent   = txt;
  readerProgress2El.textContent  = txt;
  readerPrev.disabled  = readerCurrent === 0;
  readerPrev2.disabled = readerCurrent === 0;
  readerNext.disabled  = readerCurrent >= readerPages.length - 1;
  readerNext2.disabled = readerCurrent >= readerPages.length - 1;
}

function readerGoNext() { if (readerMode !== 'scroll' && readerCurrent < readerPages.length - 1) showPage(readerCurrent + 1); }
function readerGoPrev() { if (readerMode !== 'scroll' && readerCurrent > 0) showPage(readerCurrent - 1); }

readerNext.addEventListener('click',  readerGoNext);
readerNext2.addEventListener('click', readerGoNext);
readerPrev.addEventListener('click',  readerGoPrev);
readerPrev2.addEventListener('click', readerGoPrev);

document.addEventListener('keydown', e => {
  if (reader.classList.contains('hidden')) return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') readerGoNext();
  if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   readerGoPrev();
  if (e.key === 'Escape') closeReader();
});

readerBack.addEventListener('click', closeReader);
readerRetry.addEventListener('click', () => {
  readerError.classList.add('hidden');
  readerLoading.classList.remove('hidden');
  fetchPages(currentItem);
});

function closeReader() {
  reader.classList.add('hidden');
  reader.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  readerPages_el.innerHTML = '';
  readerPages = [];
}

/* ══════════════════════════════════════════════════
   FETCH HOME
══════════════════════════════════════════════════ */
async function fetchHome() {
  errorBanner.classList.add('hidden');
  renderSkeletons(popularGrid, 5);
  renderSkeletons(latestGrid, 25);
  seenLatest.clear();
  try {
    const res  = await fetch(API_HOME);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (!json.status || !json.result) throw new Error('Invalid API response');

    allData.popular = addUnique(seenLatest, (json.result.popular || []).filter(isValid));
    allData.latest  = addUnique(seenLatest, (json.result.latest  || []).filter(isValid));
    latestPage = 1;
    latestHasMore = true;

    renderGrid(popularGrid, allData.popular);
    renderGrid(latestGrid, allData.latest);
    ensureLoadMoreBtn();
    setLoadMoreState('ready');
    // FIX: DO NOT auto-call fetchMoreLatest here — let user click Load More
  } catch (err) {
    popularGrid.innerHTML = '';
    latestGrid.innerHTML  = '';
    errorMsg.textContent  = `Gagal memuat: ${err.message}`;
    errorBanner.classList.remove('hidden');
  }
}

/* ══════════════════════════════════════════════════
   FETCH MORE LATEST — paginated
   FIX: increment page AFTER successful fetch, not before
══════════════════════════════════════════════════ */
async function fetchMoreLatest() {
  if (latestLoading || !latestHasMore) return;
  latestLoading = true;
  setLoadMoreState('loading');

  const nextPage = latestPage + 1;
  try {
    const res  = await fetch(API_LATEST(nextPage));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // API /latest returns: { status: true, total: N, result: [{title,thumb,url,id}, ...] }
    let raw = [];
    if (Array.isArray(json.result))                            raw = json.result;
    else if (json.result && Array.isArray(json.result.latest)) raw = json.result.latest;
    else if (json.result && Array.isArray(json.result.data))   raw = json.result.data;
    else if (Array.isArray(json))                              raw = json;

    const newItems = addUnique(seenLatest, raw.filter(isValid));

    if (raw.length === 0) {
      latestHasMore = false;
      setLoadMoreState('done');
    } else if (newItems.length === 0) {
      // Semua duplikat halaman ini — coba halaman berikutnya otomatis
      latestPage = nextPage;
      latestLoading = false;
      fetchMoreLatest();
      return;
    } else {
      latestPage = nextPage; // commit page increment only on success
      allData.latest = [...allData.latest, ...newItems];
      appendToGrid(latestGrid, newItems);
      setLoadMoreState('ready');
    }
  } catch (err) {
    // Jangan tandai hasMore=false karena error jaringan sementara
    setLoadMoreState('ready');
    console.warn('Could not load more latest:', err.message);
  } finally {
    latestLoading = false;
  }
}

/* ══════════════════════════════════════════════════
   FETCH POPULAR ALL — paginated
   Auto-load beberapa halaman sekaligus sampai 100+ manga
══════════════════════════════════════════════════ */
const POPULAR_AUTO_PAGES = 5; // auto-fetch 5 halaman sekaligus per klik (biasanya 25/halaman = 125 manga)

async function fetchPopularAll(reset = false) {
  if (popularLoading) return;

  if (reset) {
    allData.popularAll = [];
    popularPage        = 1;
    popularHasMore     = true;
    seenPopular.clear();
    renderSkeletons(popularAllGrid, 12);
    setPopularLoadMore('loading');
  } else {
    if (!popularHasMore) return;
    setPopularLoadMore('loading');
  }

  popularLoading = true;

  // Fetch beberapa halaman sekaligus
  const pagesToLoad = reset ? POPULAR_AUTO_PAGES : 1;
  let loadedCount = 0;

  for (let p = 0; p < pagesToLoad; p++) {
    if (!popularHasMore) break;
    try {
      const res  = await fetch(API_POPULAR(popularPage));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.status || !json.result) throw new Error('Invalid API response');

      // API /popular returns: { status: true, total: N, result: [{title,thumb,url,id}, ...] }
      let raw = [];
      if (Array.isArray(json.result)) raw = json.result;
      else if (json.result && Array.isArray(json.result.popular)) raw = json.result.popular;
      else if (json.result && Array.isArray(json.result.data))    raw = json.result.data;

      const unique = addUnique(seenPopular, raw.filter(isValid));

      if (raw.length === 0) {
        popularHasMore = false;
        break;
      } else if (unique.length > 0) {
        allData.popularAll = [...allData.popularAll, ...unique];
        loadedCount += unique.length;
        popularPage++;
      } else {
        // All dupes — lewati halaman ini
        popularPage++;
      }
    } catch (err) {
      console.warn('Popular fetch error:', err.message);
      break;
    }
  }

  if (reset) renderGrid(popularAllGrid, allData.popularAll);
  else appendToGrid(popularAllGrid, allData.popularAll.slice(-loadedCount));

  if (popularAllCount) popularAllCount.textContent = `${allData.popularAll.length} titles`;
  setPopularLoadMore(popularHasMore ? 'ready' : 'done');
  popularLoading = false;
}

retryBtn.addEventListener('click', () => {
  seenLatest.clear();
  fetchHome();
  if (activeTab === 'popular') fetchPopularAll(true);
});

/* ══════════════════════════════════════════════════
   FETCH GENRE — paginated, auto-load beberapa halaman
══════════════════════════════════════════════════ */
async function fetchGenre(reset = false) {
  if (genreLoading) return;

  if (reset) {
    allData.genre  = [];
    genrePage      = 1;
    genreHasMore   = true;
    genreRetries   = 0;
    seenGenre.clear();
    renderSkeletons(genreGrid, 12);
    setGenreLoadMore('loading');
  } else {
    if (!genreHasMore) return;
    setGenreLoadMore('loading');
  }

  genreLoading = true;
  try {
    const res  = await fetch(API_GENRE(activeGenre, genrePage));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    // API /genres returns: { status: true, total: N, genre: "...", result: [{title,thumb,url,id}, ...] }
    let raw = [];
    if (Array.isArray(json.result))                              raw = json.result;
    else if (json.result && Array.isArray(json.result.result))   raw = json.result.result;
    else if (json.result && Array.isArray(json.result.data))     raw = json.result.data;

    const unique = addUnique(seenGenre, raw.filter(isValid));

    if (raw.length === 0) {
      genreHasMore = false;
      if (reset) renderGrid(genreGrid, []);
      setGenreLoadMore('done');
    } else if (unique.length === 0) {
      genreRetries++;
      genrePage++;
      if (genreRetries >= MAX_GENRE_RETRIES) {
        genreHasMore = false;
        setGenreLoadMore('done');
      } else {
        genreLoading = false;
        fetchGenre(false); // coba halaman berikutnya otomatis
        return;
      }
    } else {
      genreRetries = 0;
      allData.genre = [...allData.genre, ...unique];
      if (reset) renderGrid(genreGrid, allData.genre);
      else appendToGrid(genreGrid, unique);
      if (genreCount) genreCount.textContent = `${allData.genre.length} titles`;
      genrePage++;
      setGenreLoadMore('ready');
    }
  } catch (err) {
    genreHasMore = false;
    setGenreLoadMore('done');
    if (reset) genreGrid.innerHTML = `<p style="color:var(--danger);padding:1rem">⚠️ ${err.message}</p>`;
    console.warn('Genre fetch error:', err.message);
  } finally {
    genreLoading = false;
  }
}

/* ══════════════════════════════════════════════════
   INIT
══════════════════════════════════════════════════ */
GENRE_LIST.forEach(g => {
  const opt = document.createElement('option');
  opt.value = g;
  opt.textContent = g;
  genreSelect.appendChild(opt);
});

genreSelect.addEventListener('change', () => {
  activeGenre = genreSelect.value;
  if (genreCount) genreCount.textContent = '';
  fetchGenre(true);
});

document.getElementById('popular-load-more-btn').addEventListener('click', () => {
  if (!popularLoading && popularHasMore) fetchPopularAll(false);
});

document.getElementById('genre-load-more-btn').addEventListener('click', () => {
  if (!genreLoading && genreHasMore) fetchGenre(false);
});

initAgeGate();
fetchHome();

}); // end DOMContentLoaded

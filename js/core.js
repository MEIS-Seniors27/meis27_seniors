/* Shared pieces: data loading, nav, footer, lightbox, music. */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const enc = p => String(p).split('/').map(encodeURIComponent).join('/');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const tilt = i => (((i * 37) % 7) - 3) * 0.9; // steady pseudo-random tilt, same on every visit

  const M = window.MEIS = { $, $$, enc, esc, shuffle, tilt, pages: {}, data: null };

  const PAGES = [
    ['index.html', 'Home', 'home'],
    ['gallery.html', 'Gallery', 'gallery'],
    ['kids.html', 'Little Us', 'kids'],
    ['trips.html', 'Trips', 'trips'],
    ['memories.html', 'Memories', 'memories'],
    ['members.html', 'The Crew', 'members']
  ];

  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error(url + ' ' + r.status);
    return r.json();
  }

  const EMPTY = () => ({ cover: [], gallery: { albums: [], loose: [] }, kids: [], trips: [], memories: [], members: [], sizes: {}, missing: true });

  async function loadData() {
    const [info, man] = await Promise.all([
      getJSON('data/info.json').catch(() => ({})),
      getJSON('data/manifest.json').catch(() => null)
    ]);
    const m = Object.assign(EMPTY(), man || {});
    m.missing = !man;
    return { info, man: m };
  }

  /* ---------- helpers used by pages ---------- */
  M.img = function (src, alt, cls) {
    const s = M.data.man.sizes[src];
    const wh = s ? ' width="' + s[0] + '" height="' + s[1] + '"' : '';
    return '<img' + (cls ? ' class="' + cls + '"' : '') + ' src="' + enc(src) + '" alt="' + esc(alt || '') + '" loading="lazy" decoding="async"' + wh + '>';
  };

  M.head = function (eyebrow, title, sub) {
    return '<section class="page-head"><div class="wrap">' +
      (eyebrow ? '<p class="eyebrow">' + esc(eyebrow) + '</p>' : '') +
      '<h1>' + title + '</h1>' + (sub ? '<p class="lead">' + esc(sub) + '</p>' : '') + '</div></section>';
  };

  M.empty = function (title, hint) {
    return '<div class="empty"><b>' + esc(title) + '</b><p>' + hint + '</p></div>';
  };

  M.missingNotice = function () {
    return '<div class="wrap"><div class="notice"><b>The photo list could not be loaded.</b><p>If this is the live site, wait a minute and refresh. ' +
      'If you opened the file straight from your computer, run <code>python scripts/build_manifest.py</code> and view the site through a local server (<code>python -m http.server</code>).</p></div></div>';
  };

  M.fmtDate = function (d) {
    if (!d) return '';
    const p = d.split('-').map(Number);
    if (p.length === 3) return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    if (p.length === 2) return new Date(p[0], p[1] - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    return d;
  };

  M.galleryAlbums = function () {
    const g = M.data.man.gallery;
    const out = g.albums.slice();
    if (g.loose.length) out.push({ name: out.length ? 'More' : 'All photos', images: g.loose });
    return out;
  };

  M.galleryAll = function () {
    return M.galleryAlbums().reduce((a, al) => a.concat(al.images), []);
  };

  M.trips = function () {
    const { man, info } = M.data;
    const extra = Array.isArray(info.trips) ? info.trips : [];
    const byFolder = new Map();
    const out = [];
    man.trips.forEach(t => { const o = Object.assign({ place: '', story: '' }, t); byFolder.set(t.folder.toLowerCase(), o); out.push(o); });
    extra.forEach(e => {
      if (!e || typeof e !== 'object') return;
      const o = e.folder && byFolder.get(String(e.folder).toLowerCase());
      if (o) { ['name', 'date', 'place', 'story'].forEach(f => { if (e[f]) o[f] = e[f]; }); }
      else if (e.name) out.push({ folder: '', date: e.date || '', name: e.name, place: e.place || '', story: e.story || '', images: [] });
    });
    out.sort((a, b) => (a.date === '') - (b.date === '') || (a.date || '').localeCompare(b.date || '') || a.name.localeCompare(b.name));
    return out;
  };

  /* ---------- lightbox ---------- */
  let box, items = [], idx = 0, touchX = null;

  function buildLightbox() {
    box = document.createElement('div');
    box.className = 'lb';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Photo viewer');
    box.innerHTML = '<button class="lb-x" aria-label="Close">&times;</button>' +
      '<button class="lb-nav lb-prev" aria-label="Previous photo">&#8249;</button>' +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button class="lb-nav lb-next" aria-label="Next photo">&#8250;</button>' +
      '<div class="lb-bar"><span class="lb-count"></span><a class="lb-dl" download>Download photo</a></div>';
    document.body.appendChild(box);
    $('.lb-x', box).addEventListener('click', close);
    $('.lb-prev', box).addEventListener('click', () => step(-1));
    $('.lb-next', box).addEventListener('click', () => step(1));
    box.addEventListener('click', e => { if (e.target === box || e.target.tagName === 'FIGURE') close(); });
    box.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', e => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].clientX - touchX; touchX = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });
    document.addEventListener('keydown', e => {
      if (!box.classList.contains('on')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
    window.addEventListener('popstate', () => { if (box.classList.contains('on')) closeUI(); });
  }

  function show() {
    const it = items[idx];
    const im = $('img', box);
    im.src = enc(it.src);
    im.alt = it.caption || '';
    $('figcaption', box).textContent = it.caption || '';
    $('.lb-count', box).textContent = (idx + 1) + ' / ' + items.length;
    const dl = $('.lb-dl', box);
    dl.href = enc(it.src);
    dl.setAttribute('download', it.src.split('/').pop());
    [idx - 1, idx + 1].forEach(i => { if (items[i]) new Image().src = enc(items[i].src); });
  }

  function step(d) { idx = (idx + d + items.length) % items.length; show(); }
  function closeUI() { box.classList.remove('on'); document.body.classList.remove('lock'); }
  function close() {
    if (!box || !box.classList.contains('on')) return;
    if (history.state && history.state.lb) history.back(); else closeUI();
  }

  M.openLightbox = function (list, i) {
    if (!list.length) return;
    if (!box) buildLightbox();
    items = list; idx = i || 0;
    box.classList.toggle('one', list.length < 2);
    show();
    box.classList.add('on');
    document.body.classList.add('lock');
    history.pushState({ lb: true }, '');
    $('.lb-x', box).focus();
  };

  /* ---------- nav, footer, music ---------- */
  function chrome(info) {
    const page = document.body.dataset.page;
    const short = esc(info.shortName || 'MEIS');
    const label = esc(info.classLabel || 'Seniors');
    document.body.insertAdjacentHTML('afterbegin',
      '<header class="nav"><div class="wrap">' +
      '<a class="brand" href="index.html"><span class="brand-mark">' + short.charAt(0) + '</span><span>' + short + ' <em>' + label + '</em></span></a>' +
      '<nav class="nav-links" id="menu" aria-label="Main">' +
      PAGES.map(p => '<a href="' + p[0] + '"' + (p[2] === page ? ' class="active" aria-current="page"' : '') + '>' + p[1] + '</a>').join('') +
      '</nav>' +
      '<button class="burger" aria-label="Menu" aria-expanded="false" aria-controls="menu"><span></span></button>' +
      '</div></header>');
    const nav = $('.nav'), burger = $('.burger');
    burger.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      burger.setAttribute('aria-expanded', open);
      document.body.classList.toggle('lock', open);
    });

    const wa = String(info.whatsapp || '').replace(/\D/g, '');
    const year = info.classYear ? ' · Class of ' + esc(info.classYear) : '';
    document.body.insertAdjacentHTML('beforeend',
      '<footer class="foot"><div class="wrap"><div class="foot-grid"><div>' +
      '<h2>Missing a photo?</h2><p style="margin-top:10px;max-width:42ch">Send it to the class and we will add it. The QR on the hoodie always opens the latest version.</p>' +
      (wa ? '<p style="margin-top:18px"><a class="btn" href="https://wa.me/' + wa + '?text=' + encodeURIComponent('Hi! I have a photo for the ' + (info.shortName || 'MEIS') + ' memory site') + '">Send us a photo on WhatsApp</a></p>' : '') +
      '</div><ul class="foot-links">' +
      PAGES.map(p => '<li><a href="' + p[0] + '">' + p[1] + '</a></li>').join('') +
      '</ul></div><p class="fine">' + esc(info.schoolName || '') + year + '. Made by the seniors, for the seniors.</p></div></footer>');

    if (info.song && info.song.file) {
      const a = new Audio(enc(info.song.file)); a.loop = true;
      const b = document.createElement('button');
      b.className = 'music'; b.setAttribute('aria-pressed', 'false');
      b.textContent = 'Play ' + (info.song.title || 'our song');
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', on);
        b.textContent = (on ? 'Pause ' : 'Play ') + (info.song.title || 'our song');
        on ? a.play().catch(() => {}) : a.pause();
      });
      document.body.appendChild(b);
    }
  }

  M.countUp = function (el) {
    const to = +el.dataset.count || 0;
    if (!to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to.toLocaleString(); return; }
    const t0 = performance.now(), dur = 1100;
    (function f(t) {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString();
      if (p < 1) requestAnimationFrame(f);
    })(t0);
  };

  M.boot = async function () {
    const app = $('#app');
    try {
      M.data = await loadData();
    } catch (e) {
      app.innerHTML = '<div class="wrap"><div class="notice">Something went wrong loading this page. Refresh and try again.</div></div>';
      return;
    }
    chrome(M.data.info);
    const fn = M.pages[document.body.dataset.page];
    if (fn) fn(M.data, app);
    if (M.data.man.missing) app.insertAdjacentHTML('afterbegin', M.missingNotice());
  };
})();

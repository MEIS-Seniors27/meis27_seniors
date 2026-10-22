/* One renderer per page. Content comes from data/manifest.json (photos) and data/info.json (text). */
(function () {
  'use strict';
  const M = window.MEIS;
  const { $, $$, esc, enc, shuffle, tilt, img, head, empty } = M;

  const PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>';

  /* ================= HOME ================= */
  M.pages.home = function ({ info, man }, app) {
    const short = esc(info.shortName || 'MEIS');
    const cover = man.cover[0];
    const year = info.classYear;
    const gallery = M.galleryAll();
    const trips = M.trips();
    const kidsPhotos = man.kids.reduce((n, k) => n + (k.then ? 1 : 0) + (k.now ? 1 : 0), 0);
    const tripPhotos = trips.reduce((n, t) => n + t.images.length, 0);
    const photoTotal = man.cover.length + gallery.length + kidsPhotos + tripPhotos + man.memories.length + man.members.length;

    const ticker = [(info.shortName || 'MEIS') + ' ' + (info.classLabel || 'Seniors')]
      .concat(year ? ['Class of ' + year] : [], ['Still here, still iconic', 'Memories for life', 'Scan. Smile. Remember.']);
    const track = ticker.map(t => '<span>' + esc(t) + '</span>').join('');

    // countdown
    let count = '';
    if (info.graduationDate && !isNaN(new Date(info.graduationDate))) {
      const days = Math.round((new Date(info.graduationDate + 'T00:00:00') - new Date()) / 864e5);
      const abs = Math.abs(days);
      count = '<div class="count-card"><div class="big" data-count="' + abs + '">0</div><p>' +
        (days > 0 ? 'days until we graduate' : days === 0 ? 'It is graduation day' : 'days since we graduated') + '</p></div>';
    }

    const pics = shuffle(gallery.concat(trips.reduce((a, t) => a.concat(t.images), []), man.memories.map(m => m.src))).slice(0, 6);

    const tiles = [
      ['gallery.html', 'The Gallery', 'Every photo, sorted into albums.', gallery.length + ' photos', 'navy'],
      ['kids.html', 'Little Us', 'Who is who? Flip the card to see.', man.kids.length + ' cards', 'baby'],
      ['trips.html', 'The Trips', 'Every trip with its date and photos.', trips.length + ' trips', 'yellow'],
      ['memories.html', 'Memory Lane', 'Quotes, inside jokes and polaroids.', (man.memories.length + (info.memories || []).length) + ' memories', 'white'],
      ['members.html', 'The Crew', 'Everyone who made it ' + (info.shortName || 'MEIS') + '.', man.members.length + ' people', 'pink']
    ];

    app.innerHTML =
      '<section class="hero"><div class="wrap hero-grid">' +
      '<div><p class="eyebrow">' + esc(info.schoolName || '') + '</p>' +
      '<h1 class="mega"><span>' + short + '</span><span class="sub">' + esc(info.classLabel || 'Seniors') + '</span></h1>' +
      (year ? '<p class="pill">Class of ' + esc(year) + '</p>' : '') +
      '<p class="lead">' + esc(info.tagline || '') + '</p>' +
      '<div class="cta"><a class="btn" href="#explore">Open the memories</a><a class="btn ghost" href="gallery.html">Jump to the photos</a></div></div>' +
      '<figure class="pol hero-pol">' +
      (cover ? '<img class="ph" src="' + enc(cover) + '" alt="The whole class together" fetchpriority="high"' + (man.sizes[cover] ? ' width="' + man.sizes[cover][0] + '" height="' + man.sizes[cover][1] + '"' : '') + '>'
        : '<div class="ph-empty">Your group photo goes here<br>images/cover</div>') +
      '<figcaption class="cap">' + esc(info.heroCaption || '') + '</figcaption></figure>' +
      '</div></section>' +
      '<div class="ticker" aria-hidden="true"><div class="ticker-track">' + track + track + track + track + '</div></div>' +

      '<section class="section"><div class="wrap"><div class="facts' + (count ? ' has-count' : '') + '">' + count +
      '<div class="numbers">' +
      '<div class="num"><b data-count="' + photoTotal + '">0</b><span>photos</span></div>' +
      '<div class="num"><b data-count="' + trips.length + '">0</b><span>trips</span></div>' +
      '<div class="num"><b data-count="' + man.members.length + '">0</b><span>of us</span></div>' +
      '</div></div></div></section>' +

      (pics.length ? '<section class="section"><div class="wrap"><div class="section-head"><h2>Fresh from the camera roll</h2><p>A new mix every time you open the page. Tap one to zoom.</p></div>' +
        '<div class="collage">' + pics.map((p, i) => '<button class="pol sq" style="--r:' + tilt(i + 2) + 'deg" data-i="' + i + '" aria-label="Open photo">' + img(p, '') + '</button>').join('') + '</div></div></section>' : '') +

      '<section class="section" id="explore"><div class="wrap"><div class="section-head"><h2>Pick a page</h2></div><div class="tiles">' +
      tiles.map(t => '<a class="tile t-' + t[4] + '" href="' + t[0] + '"><div><h3>' + esc(t[1]) + '</h3><p>' + esc(t[2]) + '</p></div><span class="count">' + esc(t[3]) + '</span></a>').join('') +
      '</div></div></section>';

    $$('[data-count]', app).forEach(M.countUp);
    $$('.collage [data-i]', app).forEach(b => b.addEventListener('click', () =>
      M.openLightbox(pics.map(p => ({ src: p, caption: '' })), +b.dataset.i)));
  };

  /* ================= GALLERY ================= */
  M.pages.gallery = function ({ man }, app) {
    const albums = M.galleryAlbums();
    const all = M.galleryAll();
    app.innerHTML = head('Every photo', 'The Gallery', 'Pick an album, tap a photo to zoom, swipe to see the next one.') +
      '<div class="wrap page-body">' +
      (all.length ?
        '<div class="toolbar" id="chips"></div><p class="status" id="status" aria-live="polite"></p><div class="masonry" id="grid"></div>' :
        empty('No photos yet', 'Drop photos into <code>images/gallery</code>. Make a sub-folder for each album, like <code>images/gallery/Graduation-Rehearsal</code>.')) +
      '</div>';
    if (!all.length) return;

    let current = 'all';
    const chips = $('#chips'), grid = $('#grid'), status = $('#status');
    const draw = () => {
      const list = current === 'all' ? all : albums[+current].images;
      grid.innerHTML = list.map((p, i) => '<button data-i="' + i + '" aria-label="Open photo ' + (i + 1) + '">' + img(p, '') + '</button>').join('');
      status.textContent = list.length + (list.length === 1 ? ' photo' : ' photos');
      $$('button', grid).forEach(b => b.addEventListener('click', () => M.openLightbox(list.map(p => ({ src: p, caption: '' })), +b.dataset.i)));
      $$('.chip', chips).forEach(c => c.setAttribute('aria-pressed', c.dataset.k === String(current)));
    };
    if (albums.length > 1) {
      chips.innerHTML = '<button class="chip" data-k="all">All (' + all.length + ')</button>' +
        albums.map((a, i) => '<button class="chip" data-k="' + i + '">' + esc(a.name) + ' (' + a.images.length + ')</button>').join('');
      chips.addEventListener('click', e => { const c = e.target.closest('.chip'); if (c) { current = c.dataset.k; draw(); } });
    } else chips.remove();
    draw();
  };

  /* ================= LITTLE US ================= */
  M.pages.kids = function ({ man }, app) {
    const kids = man.kids;
    app.innerHTML = head('Then and now', 'Little Us', 'Tap a card to flip it and see who we became.') +
      '<div class="wrap page-body">' +
      (kids.length ?
        '<div class="toolbar"><button class="chip" id="guess" aria-pressed="false">Guess who? mode</button><button class="chip" id="shuf">Shuffle</button>' +
        '<span class="hint">Guess who? hides the names until you flip.</span></div><div class="flips" id="flips"></div>' :
        empty('No cards yet', 'Add two photos per person to <code>images/kids</code>: <code>ahmed-ali-then.jpg</code> (childhood) and <code>ahmed-ali-now.jpg</code> (today).')) +
      '</div>';
    if (!kids.length) return;

    let list = kids.slice();
    const wrap = $('#flips');
    const draw = () => {
      wrap.innerHTML = list.map((k, i) => {
        const front = k.then || k.now;
        const back = k.then && k.now ? k.now : null;
        return '<button class="flip-card' + (back ? '' : ' single') + '" style="--r:' + tilt(i) + 'deg" aria-label="' + esc(k.name) + (back ? ', flip card' : '') + '">' +
          '<span class="flip-photo"><span class="flip-in">' +
          '<span class="face front">' + img(front, k.name + (back ? ' as a kid' : '')) + (back ? '<span class="tag">Then</span>' : '') + '</span>' +
          (back ? '<span class="face back">' + img(back, k.name + ' today') + '<span class="tag">Now</span></span>' : '') +
          '</span></span><span class="flip-name">' + esc(k.name) + '</span></button>';
      }).join('');
      $$('.flip-card', wrap).forEach(c => c.addEventListener('click', () => { if (!c.classList.contains('single')) c.classList.toggle('flipped'); }));
    };
    $('#guess').addEventListener('click', e => {
      const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
      e.currentTarget.setAttribute('aria-pressed', on);
      wrap.classList.toggle('guess', on);
      if (on) { list = shuffle(list); draw(); }
    });
    $('#shuf').addEventListener('click', () => { list = shuffle(list); draw(); });
    draw();
  };

  /* ================= TRIPS ================= */
  M.pages.trips = function (d, app) {
    const trips = M.trips();
    app.innerHTML = head('Where we went', 'The Trips', 'Every trip in order, with the date and the photos.') +
      '<div class="wrap page-body">' +
      (trips.length ?
        '<div class="toolbar"><button class="chip" id="order" aria-pressed="false">Newest first</button><span class="status">' + trips.length + (trips.length === 1 ? ' trip' : ' trips') + '</span></div><ol class="timeline" id="line"></ol>' :
        empty('No trips yet', 'Make a folder for each trip inside <code>images/trips</code>, named like <code>2026-03-12_Sharm-Trip</code> (date, underscore, name), and put its photos inside.')) +
      '</div>';
    if (!trips.length) return;

    let newest = false;
    const line = $('#line');
    const draw = () => {
      const list = newest ? trips.slice().reverse() : trips;
      line.innerHTML = list.map((t, ti) => {
        const p = (t.date || '').split('-');
        const mon = p[1] ? new Date(2000, +p[1] - 1, 1).toLocaleDateString('en-GB', { month: 'short' }) : '';
        const badge = '<div class="trip-date">' + (p[2] ? '<b>' + +p[2] + '</b>' : '<b>' + (mon || '?') + '</b>') +
          (p[2] ? '<span>' + mon + '</span>' : '') + '<small>' + (p[0] || '') + '</small></div>';
        const shown = t.images.slice(0, 4);
        const strip = shown.length ? '<div class="strip">' + shown.map((s, i) =>
          '<button data-t="' + ti + '" data-i="' + i + '" aria-label="Open photo ' + (i + 1) + ' of ' + esc(t.name) + '">' + img(s, t.name) +
          (i === shown.length - 1 && t.images.length > shown.length ? '<span class="more">+' + (t.images.length - shown.length) + '</span>' : '') + '</button>').join('') + '</div>' : '';
        return '<li class="trip">' + badge + '<article class="trip-card"><h3>' + esc(t.name) + '</h3><div class="chips">' +
          (t.date ? '<span>' + esc(M.fmtDate(t.date)) + '</span>' : '') +
          (t.place ? '<span>' + PIN + esc(t.place) + '</span>' : '') +
          (t.images.length ? '<span>' + t.images.length + (t.images.length === 1 ? ' photo' : ' photos') + '</span>' : '') +
          '</div>' + (t.story ? '<p class="story">' + esc(t.story) + '</p>' : '') + strip + '</article></li>';
      }).join('');
      $$('.strip button', line).forEach(b => b.addEventListener('click', () => {
        const t = list[+b.dataset.t];
        M.openLightbox(t.images.map(s => ({ src: s, caption: t.name })), +b.dataset.i);
      }));
    };
    $('#order').addEventListener('click', e => {
      newest = !newest;
      e.currentTarget.setAttribute('aria-pressed', newest);
      e.currentTarget.textContent = newest ? 'Oldest first' : 'Newest first';
      draw();
    });
    draw();
  };

  /* ================= MEMORIES ================= */
  M.pages.memories = function ({ info, man }, app) {
    const quotes = Array.isArray(info.memories) ? info.memories.filter(q => q && q.text) : [];
    const caps = info.memoryCaptions || {};
    const photos = man.memories.map(m => ({ src: m.src, caption: caps[m.src.split('/').pop()] || m.caption }));
    const classes = ['q0', 'q1', 'q2', 'q3', 'q4'];

    app.innerHTML = head('Inside jokes and snapshots', 'Memory Lane', 'The things only we understand.') +
      '<div class="wrap page-body">' +
      (quotes.length ? '<div class="quotes">' + quotes.map((q, i) =>
        '<blockquote class="q ' + classes[i % classes.length] + '"><p>' + esc(q.text) + '</p><footer>' +
        (q.by ? '<span>' + esc(q.by) + '</span>' : '') + (q.tag ? '<i>' + esc(q.tag) + '</i>' : '') + '</footer></blockquote>').join('') + '</div>' : '') +
      (photos.length ? '<div class="section-head" style="margin-top:' + (quotes.length ? 40 : 0) + 'px"><h2>The memory wall</h2></div><div class="wall">' +
        photos.map((p, i) => '<button class="pol" style="--r:' + tilt(i) + 'deg" data-i="' + i + '">' + img(p.src, p.caption) + '<span class="cap">' + esc(p.caption) + '</span></button>').join('') + '</div>' : '') +
      (!quotes.length && !photos.length ? empty('Nothing here yet', 'Add photos to <code>images/memories</code> (the file name becomes the caption, like <code>last-bus-home.jpg</code>) and quotes in <code>data/info.json</code>.') : '') +
      '</div>';
    $$('.wall .pol', app).forEach(b => b.addEventListener('click', () => M.openLightbox(photos, +b.dataset.i)));
  };

  /* ================= THE CREW ================= */
  M.pages.members = function ({ info, man }, app) {
    const people = man.members;
    const extra = info.members || {};
    app.innerHTML = head('Everyone', 'The Crew', 'The people who made ' + (info.shortName || 'MEIS') + ' what it was.') +
      '<div class="wrap page-body">' +
      (people.length ?
        '<div class="toolbar"><label class="sr" for="find">Search by name</label><input class="search" id="find" type="search" placeholder="Find someone by name" autocomplete="off"><span class="status" id="count"></span></div><div class="crew" id="crew"></div>' :
        empty('No one here yet', 'Add one photo per person to <code>images/members</code>. The file name is the name, like <code>ahmed-ali.jpg</code>.')) +
      '</div>';
    if (!people.length) return;

    const crew = $('#crew');
    crew.innerHTML = people.map((p, i) => {
      const x = extra[p.key] || {};
      return '<article class="person" data-name="' + esc(p.name.toLowerCase()) + '"><button data-i="' + i + '" aria-label="Open photo of ' + esc(p.name) + '">' + img(p.src, p.name) + '</button>' +
        '<div class="person-info"><h3>' + esc(p.name) + '</h3>' + (x.title ? '<span class="title">' + esc(x.title) + '</span>' : '') +
        (x.quote ? '<blockquote>' + esc(x.quote) + '</blockquote>' : '') + '</div></article>';
    }).join('');
    $$('button', crew).forEach(b => b.addEventListener('click', () =>
      M.openLightbox(people.map(p => ({ src: p.src, caption: p.name })), +b.dataset.i)));

    const count = $('#count');
    const filter = () => {
      const q = $('#find').value.trim().toLowerCase();
      let n = 0;
      $$('.person', crew).forEach(c => { const hit = !q || c.dataset.name.includes(q); c.hidden = !hit; if (hit) n++; });
      count.textContent = q ? n + ' found' : people.length + (people.length === 1 ? ' person' : ' people');
    };
    $('#find').addEventListener('input', filter);
    filter();
  };

  M.boot();
})();

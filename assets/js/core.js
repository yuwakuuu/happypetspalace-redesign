/* Happy Pets Palace — shared site engine (every page).
   Each feature only runs when its markup exists on the current page. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer:fine)').matches;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const sfx = (n, p, k) => window.HPPSfx && window.HPPSfx.play(n, p, k);
  const on = (sel, fn) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) fn(el); };

  /* ================= shared business data (also used by chat.js) ================= */
  const HPP = window.HPP = {
    phone: '480-207-1852', tel: '+14802071852',
    locs: {
      mesa: { key: 'mesa', name: 'Mesa', addr: '1918 East McKellips Road<br>Mesa, AZ 85203', q: '1918 E McKellips Rd, Mesa, AZ 85203',
        near: 'North Mesa — easy reach of Tempe, north Scottsdale and Apache Junction.', page: 'mesa.html',
        book: 'book.html?loc=mesa', moego: 'https://booking.moego.pet/ol/HappyPetsPalaceMesa/book?utm_medium=embed',
        moegoLanding: 'https://booking.moego.pet/ol/HappyPetsPalaceMesa/landing', mail: 'happypetspalacemesa@gmail.com',
        fb: 'https://www.facebook.com/happypetspalacemesa', ig: 'https://www.instagram.com/happypetspalacemesa' },
      chandler: { key: 'chandler', name: 'Chandler', addr: '1080 E Pecos Road, Suite 16<br>Chandler, AZ 85225', q: '1080 E Pecos Rd Suite 16, Chandler, AZ 85225',
        near: 'Close to the Gilbert border — handy for Gilbert, Ahwatukee, Sun Lakes and south Tempe.', page: 'chandler.html',
        book: 'book.html?loc=chandler', moego: 'https://booking.moego.pet/ol/HappyPetsPalaceChandler/book?utm_medium=embed',
        moegoLanding: 'https://booking.moego.pet/ol/HappyPetsPalaceChandler/landing', mail: 'happypetschandler@gmail.com',
        fb: 'https://www.facebook.com/happypetspalacechandler', ig: 'https://www.instagram.com/happypetspalacechandler' }
    },
    price: { board: { 1: 48, 2: 44, 3: 43, 4: 42 }, deluxe: 25, cam: 10, play: 24, late: 24, holiday: 20,
      daycare: { full: 38, half: 33, puppyWed: 33, puppy: 30 } },
    // minutes from midnight, Arizona time (no DST). 0 = Sunday
    sched: { 0: [[480, 630], [960, 1110]], 1: [[360, 1110]], 2: [[360, 1110]], 3: [[360, 1110]], 4: [[360, 1110]], 5: [[360, 1110]], 6: [[480, 1110]] },
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  };

  /** Boarding estimate using the published rate card. Discounts don't stack: best single one wins. */
  HPP.estimate = ({ dogs = 1, nights = 1, deluxe = false, cam = false, play = false, late = false, military = false }) => {
    dogs = Math.min(4, Math.max(1, dogs));
    const p = HPP.price, rate = p.board[dogs], base = rate * dogs * nights;
    const opts = [];
    if (dogs === 1 && nights >= 11) opts.push({ label: 'Extended stay (5%)', amt: Math.round(base * .05) });
    if (military) opts.push({ label: 'U.S. Military (10%)', amt: Math.round(base * .10) });
    const disc = opts.sort((a, b) => b.amt - a.amt)[0] || null;
    const add = (deluxe ? p.deluxe * dogs * nights : 0) + (cam ? p.cam * nights : 0) + (play ? p.play * dogs * nights : 0) + (late ? p.late : 0);
    return { rate, base, disc, add, total: base - (disc ? disc.amt : 0) + add };
  };
  const azNow = () => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Phoenix', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false })
      .formatToParts(new Date()).map(p => [p.type, p.value]));
    return { d: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), m: (+parts.hour % 24) * 60 + +parts.minute };
  };
  const fmt = mins => { let h = Math.floor(mins / 60) % 24, m = Math.round(mins % 60); const ap = h >= 12 ? 'PM' : 'AM'; return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + ' ' + ap; };
  const t12 = m => fmt(m).replace(':00', '');
  HPP.status = () => {
    const { d, m } = azNow(), S = HPP.sched;
    const open = S[d].find(([a, b]) => m >= a && m < b);
    if (open) return { open: true, text: `Open now · until ${t12(open[1])}` };
    const later = S[d].find(([a]) => a > m);
    if (later) return { open: false, text: `Closed · opens ${t12(later[0])} today` };
    const nd = (d + 1) % 7;
    return { open: false, text: `Closed · opens ${HPP.days[nd]} ${t12(S[nd][0][0])}` };
  };
  HPP.ics = (title, start, end, location, desc) => {
    const f = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Happy Pets Palace//EN', 'BEGIN:VEVENT',
      'UID:' + Date.now() + '@happypetspalace.com', 'DTSTAMP:' + f(new Date()), 'DTSTART:' + f(start), 'DTEND:' + f(end),
      'SUMMARY:' + title, 'LOCATION:' + location.replace(/,/g, '\\,'), 'DESCRIPTION:' + (desc || '').replace(/\n/g, '\\n'), 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
    a.download = title.replace(/[^\w]+/g, '-').toLowerCase() + '.ics';
    document.body.append(a); a.click(); a.remove();
  };
  HPP.azDate = (y, mo, d, h = 0, mi = 0) => new Date(Date.UTC(y, mo, d, h + 7, mi)); // Arizona = UTC-7 year-round

  /* ================= loader ================= */
  let readyResolve; HPP.ready = new Promise(r => readyResolve = r);
  const titleJobs = [];   // promises the loader waits for (above-the-fold 3D titles)
  (() => {
    const ld = $('#loader');
    let visited = false; try { visited = !!sessionStorage.getItem('hpp-visited'); sessionStorage.setItem('hpp-visited', '1'); } catch {}
    if (!ld) { readyResolve(); return; }
    if (visited) ld.classList.add('quick');
    const bar = $('.bar i', ld), paw = $('.bar b', ld), pct = $('.pct', ld), msg = visited ? $('.tag', ld) : $('.msg', ld);
    const lines = ['Fetching the fun…', 'Inflating the letters…', 'Fluffing the fur…', 'Filling the splash pools…', 'Blowing bubbles…', 'Waking up the pack…'];
    let li = 0, shown = 0, target = 0;
    const mi = setInterval(() => { if (msg) msg.textContent = lines[li = (li + 1) % lines.length]; }, 900);
    const set = v => { target = Math.max(target, v); };
    const anim = () => { shown += (target - shown) * .12; const p = Math.min(100, shown); if (bar) bar.style.width = p + '%'; if (paw) paw.style.left = Math.max(4, p - 2) + '%'; if (pct) pct.textContent = Math.round(p) + '%'; if (!done) requestAnimationFrame(anim); };
    let done = false; requestAnimationFrame(anim);
    const t0 = performance.now(), min = visited ? 350 : 1500;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const domReady = document.readyState !== 'loading' ? Promise.resolve() : new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
    const finish = async () => {
      set(100); await wait(Math.max(0, min - (performance.now() - t0)) + 250);
      done = true; clearInterval(mi);
      const fab = $('#dogFab'); if (fab) { const r = fab.getBoundingClientRect(); ld.style.setProperty('--lx', r.left + r.width / 2 + 'px'); ld.style.setProperty('--ly', r.top + r.height / 2 + 'px'); }
      ld.classList.add('out'); sfx('whoosh');
      root.classList.add('loaded'); readyResolve();
      setTimeout(() => ld.remove(), 950);
    };
    (async () => {
      await domReady; set(25);
      try { await Promise.race([Promise.all([document.fonts.load('700 1em Fredoka'), document.fonts.ready]), wait(2500)]); } catch {}
      set(55);
      await Promise.race([Promise.allSettled(titleJobs), wait(5000)]); set(85);
      const imgs = $$('main img').filter(i => i.getBoundingClientRect().top < innerHeight * 1.2).slice(0, 6);
      await Promise.race([Promise.allSettled(imgs.map(i => i.decode ? i.decode() : 0)), wait(2500)]);
      finish();
    })();
    setTimeout(() => { if (!done) finish(); }, 9000);
  })();

  /* ================= theme / sound / menu ================= */
  on('#yr', el => el.textContent = new Date().getFullYear());
  on('#theme', themeBtn => {
    const isDark = () => root.dataset.theme === 'dark';
    try { const t = localStorage.getItem('hpp-theme'); if (t) root.dataset.theme = t; } catch {}
    const syncIcon = () => themeBtn.textContent = isDark() ? '☀️' : '🌙';
    syncIcon();
    themeBtn.onclick = () => {
      const flip = () => { root.dataset.theme = isDark() ? 'light' : 'dark'; syncIcon(); try { localStorage.setItem('hpp-theme', root.dataset.theme); } catch {} };
      document.startViewTransition && !reduce ? document.startViewTransition(flip) : flip();
    };
  });
  on('#snd', b => {
    const sync = () => { const s = window.HPPSfx ? HPPSfx.on : false; b.setAttribute('aria-pressed', s); b.textContent = s ? '🔊' : '🔈'; b.title = s ? 'Sound on' : 'Sound off'; };
    sync(); b.onclick = () => { window.HPPSfx && HPPSfx.toggle(); sync(); };
  });
  on('#mus', b => {
    const M = window.HPPMusic; if (!M) { b.hidden = true; return; }
    const hint = $('#musicHint'); let hinted = false;
    try { hinted = !!sessionStorage.getItem('hpp-music-hint'); } catch {}
    M.subscribe(m => {
      b.setAttribute('aria-pressed', m.on && m.playing); b.title = m.on ? (m.playing ? 'Music on — tap to mute' : 'Music will start on your first tap') : 'Music off';
      if (m.playing && m.firstStart && !hinted && hint) {   // tell people once per visit, with an easy mute
        hinted = true; try { sessionStorage.setItem('hpp-music-hint', '1'); } catch {}
        hint.classList.add('show'); setTimeout(() => hint.classList.remove('show'), 5500);
      }
    });
    b.onclick = e => { e.stopPropagation(); M.toggle(); };
    on('#musicHintMute', m => m.onclick = () => { if (M.on) M.toggle(); hint.classList.remove('show'); });
  });
  on('#burger', burger => {
    const menu = $('#menu');
    burger.onclick = () => { const o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); burger.textContent = o ? '✕' : '☰'; sfx('click'); };
    $$('#menu > li > button').forEach(b => b.addEventListener('click', () => { if (innerWidth <= 1080) b.parentNode.classList.toggle('x-open'); }));
  });

  /* ================= paw cursor: closes into a grabbing fist while the mouse button is held ================= */
  {
    const root = document.documentElement, up = () => root.classList.remove('paw-down');
    addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) root.classList.add('paw-down'); }, true);
    addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true); addEventListener('blur', up); addEventListener('dragend', up);
  }

  /* ================= page-to-page paw wipe ================= */
  const FUN_LINES = ['Fetching the fun…', 'Sniffing out the page…', 'Chasing bubbles…', 'Wagging over…', 'Zooming to the next yard…', 'Grabbing a squeaky toy…'];
  on('#wipe', wipe => {
    document.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.target || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!/^[\w-]+\.html([?#].*)?$/.test(href)) return;               // only our own pages
      const here = location.pathname.split('/').pop() || 'index.html';
      if (href.split(/[?#]/)[0] === here && href.includes('#')) return;  // same-page anchor
      e.preventDefault();
      wipe.style.setProperty('--wx', e.clientX + 'px'); wipe.style.setProperty('--wy', e.clientY + 'px');
      on($('.tag', wipe), t => t.textContent = FUN_LINES[Math.random() * FUN_LINES.length | 0]);
      wipe.classList.add('in'); sfx('whoosh');
      setTimeout(() => location.href = href, reduce ? 0 : 480);
    });
    addEventListener('pageshow', e => { if (e.persisted) wipe.classList.remove('in'); });
  });

  /* ================= interaction sounds (delegated) ================= */
  const SOUND_HOVER = '.btn,.chip,.menu>li>a,.menu>li>button,.drop a,.tabs button,.seg button,.loc-pick button,.step,.socials a,.topics a';
  document.addEventListener('pointerover', e => {
    const el = e.target.closest && e.target.closest(SOUND_HOVER);
    if (el && !el.contains(e.relatedTarget)) sfx('hover', .9 + Math.random() * .3);
  });
  // a happy "arf arf!" for anything that books
  const bookish = t => t.closest('a[href*="book.html"],a[href*="booking.moego"],#sBook') || (b => b && /\bbook\b/i.test(b.textContent) ? b : null)(t.closest('a,button'));
  document.addEventListener('click', e => {
    const t = e.target;
    if (e.barked) return;                                   // already barked (dog count went up)
    if (bookish(t)) { sfx('bark', 1.05 + Math.random() * .1, 2); return; }
    if (t.closest('.btn,.chip,.tabs button,.seg button,.loc-pick button,.step')) sfx('click', .95 + Math.random() * .15);
    else if (t.matches('input[type=checkbox]')) sfx(t.checked ? 'pop' : 'squish');
    else if (t.closest('summary')) sfx('pop', .9);
  });
  document.addEventListener('input', e => { if (e.target.type === 'range') sfx('tick'); });
  document.addEventListener('focusin', e => { if (e.target.matches('select[name="dogs"]')) e.target.dataset.prev = e.target.value; });
  document.addEventListener('change', e => {   // more dogs in the chat booking form -> one arf per new pup
    const t = e.target; if (!t.matches('select[name="dogs"]')) return;
    const add = +t.value - +(t.dataset.prev || 1); t.dataset.prev = t.value;
    if (add > 0) sfx('bark', 1.1, Math.min(3, add));
  });

  /* ================= reveals & counters ================= */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -30px 0px' });
  const observe = el => io.observe(el);
  $$('.svc').forEach((el, i) => el.style.setProperty('--i', i % 3));
  HPP.ready.then(() => $$('[data-reveal]').forEach(observe));   // start once the loader lifts so it's seen
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now(), dur = 1500;
    const tick = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))) + suf; if (p < 1) requestAnimationFrame(tick); };
    reduce ? el.textContent = end + suf : requestAnimationFrame(tick);
    cio.unobserve(el);
  }), { threshold: .6 });
  HPP.ready.then(() => $$('[data-count]').forEach(el => cio.observe(el)));
  $$('.track').forEach(t => t.innerHTML += t.innerHTML);

  /* ================= 3D puffy + fur headings ================= */
  const H3 = window.HPP3D || {};
  const can3d = !!H3.ok, canFur = !!H3.fur;
  /** split a heading into words; text -> puffy 3D, <span class="s"> -> accent-coloured 3D,
      <span class="s fluffy"> -> fluffy fur (used sparingly, only where "fluffy" means something) */
  const wordsOf = h => {
    const out = [];
    h.childNodes.forEach(n => {
      const accent = n.nodeType === 1 && n.classList.contains('s');
      const fur = accent && n.classList.contains('fluffy');
      const txt = (n.textContent || '').trim();
      if (!txt) return;
      txt.split(/\s+/).forEach(w => out.push({ w, fur, accent }));
    });
    return out;
  };
  const placeWord = (r, cls, word) => {
    const s = document.createElement('span'); s.className = cls; s.setAttribute('aria-hidden', 'true'); s.dataset.word = word;
    const cv = r.canvas; cv.style.cssText = `display:block;width:${r.em.w}em;height:${r.em.h}em`;
    const e = r.em, top = Math.max(0, e.h - e.base - .95), bot = Math.max(0, e.base - .24);
    s.style.margin = `-${top.toFixed(3)}em -${(e.padR * .72).toFixed(3)}em -${bot.toFixed(3)}em -${(e.padL * .72).toFixed(3)}em`;
    s.style.verticalAlign = '-.24em';
    s.append(cv);
    return s;
  };
  const dress = h => {
    if (h.dataset.dressed || (!can3d && !canFur)) return;
    h.dataset.dressed = '1';
    const fs = parseFloat(getComputedStyle(h).fontSize) || 64, px = Math.max(80, Math.min(120, fs));
    const C = H3.colors || {}, color = C[h.dataset.color || 'plum'] || '#c23a8c', hue = h.dataset.fur || 'pink';
    const accentColor = C[h.dataset.accent || h.dataset.fur || 'teal'] || C.teal;
    const words = wordsOf(h); if (!words.length) return;
    const src = document.createElement('span'); src.className = 't-src'; src.textContent = h.textContent.trim().replace(/\s+/g, ' ');
    const parts = [];
    for (const { w, fur, accent } of words) {
      let r = null;
      try { r = fur && canFur ? H3.fur(w, { px, hue }) : can3d ? H3.word(w, { color: accent ? accentColor : color, px }) : null; } catch (err) { console.warn('title render', err); }
      if (!r) return;   // give up gracefully, keep the plain heading
      parts.push(placeWord(r, fur ? 'wfur' : 'w3d', w), document.createTextNode(' '));
    }
    h.textContent = ''; h.append(src, ...parts); h.classList.add('t-ready');
  };
  const titleHeads = $$('main h2:not([data-plain]), main .dress');
  const fontsReady = () => Promise.race([Promise.all([document.fonts.load('700 1em Fredoka'), document.fonts.ready]), new Promise(r => setTimeout(r, 2500))]).catch(() => {});
  if (titleHeads.length && (can3d || canFur)) {
    const ready = fontsReady();
    const above = titleHeads.filter(h => h.getBoundingClientRect().top < innerHeight * 1.3);
    titleJobs.push(ready.then(() => new Promise(r => { let i = 0; const next = () => { if (i >= above.length) return r(); dress(above[i++]); setTimeout(next, 0); }; next(); })));
    const lio = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { lio.unobserve(e.target); ready.then(() => dress(e.target)); } }), { rootMargin: '900px 0px' });
    titleHeads.forEach(h => lio.observe(h));
  }
  // hover / click play on rendered words
  document.addEventListener('pointerover', e => {
    const w = e.target.closest && e.target.closest('.w3d,.wfur');
    if (w && !w.contains(e.relatedTarget)) sfx(w.classList.contains('wfur') ? 'fluff' : 'pop', .85 + Math.random() * .35);
  });
  document.addEventListener('click', e => {
    const w = e.target.closest && e.target.closest('.w3d,.wfur'); if (!w) return;
    w.classList.remove('boing'); void w.offsetWidth; w.classList.add('boing');
    if (w.classList.contains('wfur')) {
      sfx('fluff'); sfx('pop', 1.3);
      // re-fluff: brush the fur a new way
      const h = w.closest('h1,h2,.dress'), fs = parseFloat(getComputedStyle(h).fontSize) || 64;
      try { const r = H3.fur(w.dataset.word, { px: Math.max(80, Math.min(120, fs)), hue: h.dataset.fur || 'pink', seed: Math.random() * 1e9 | 0 }); const cv = w.querySelector('canvas'); r.canvas.style.cssText = cv.style.cssText; cv.replaceWith(r.canvas); } catch {}
    } else sfx('boing', .9 + Math.random() * .3);
  });

  /* live interactive 3D titles (hero h1s) */
  $$('.live-title').forEach(el => {
    if (!can3d) return;
    const words = [];
    el.childNodes.forEach(n => {
      const accent = n.nodeType === 1 && n.classList.contains('s');
      (n.textContent || '').trim().split(/\s+/).filter(Boolean).forEach(w => words.push({ text: w, color: H3.colors[accent ? (el.dataset.accent || 'teal') : (el.dataset.color || 'plum')] }));
    });
    const src = document.createElement('span'); src.className = 't-src'; src.textContent = el.textContent.trim().replace(/\s+/g, ' ');
    const job = fontsReady().then(() => {
      el.textContent = ''; el.append(src);
      let lands = 0;
      const bubble = el.dataset.style === 'bubble' && H3.bubbles;
      const ctl = (bubble ? H3.bubbles : H3.live)(el, words, {
        onHit(kind, l) {
          if (kind === 'hover') sfx(bubble ? 'bloop' : 'pop', .8 + (l.i % 8) * .06);
          else if (kind === 'pop') sfx('bubblePop', .9 + Math.random() * .3);
          else if (kind === 'click') sfx('boing', .85 + Math.random() * .3);
          else if (kind === 'land' && lands++ % 2 === 0) sfx('land', .9 + (l.i % 6) * .05);
        }
      });
      el.classList.add('on'); el._ctl = ctl;
      HPP.ready.then(() => setTimeout(() => ctl.start(), 120));
      el.addEventListener('dblclick', () => { ctl.jiggle(); sfx('boing', 1.2); });
    }).catch(err => console.warn('live title', err));
    titleJobs.push(job);
  });

  /* ================= scroll wheel: fast navigation of the homepage =================
     A dial on the left edge shows how far down the page you are and which section you're in. Scroll over it to
     hop section to section; click it to open the big wheel: every section sits around the rim — drag around the
     ring to scrub through the page, or tap a stop to jump straight there. */
  on('#about', () => {
    const STOPS = [['top', '🏰', 'Welcome'], ['about', '🐾', 'About us'], ['instagram', '📸', 'Instagram'], ['trophy', '🏆', 'Voted best 6×'],
      ['services', '🛎️', 'Services'], ['why', '💜', 'Why us'], ['pricing', '🏷️', 'Pricing'], ['day', '☀️', 'A day here'],
      ['plan', '🧮', 'Plan a stay'], ['new-clients', '📋', 'New clients'], ['staff', '👋', 'Meet the pack'], ['reviews', '⭐', 'Reviews'],
      ['story', '📖', 'Our story'], ['events', '🎉', 'Events'], ['webcams', '🎥', 'Webcams'], ['locations', '📍', 'Locations'],
      ['faq', '❓', 'FAQ'], ['cta', '📅', 'Book a stay']]
      .map(([id, e, label]) => ({ id, e, label, el: document.getElementById(id) })).filter(s => s.el);
    if (STOPS.length < 3) return;
    const N = STOPS.length, SLOT = 360 / N, SPAN = SLOT * (N - 1);   // stops evenly round the rim; the last slot is the start/end gap
    const maxY = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const pad = () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const targetY = s => s.id === 'top' ? 0 : Math.min(maxY(), Math.max(0, s.el.getBoundingClientRect().top + scrollY - pad()));
    let tops = [];
    const measure = () => { tops = STOPS.map(targetY); for (let i = 1; i < N; i++) tops[i] = Math.max(tops[i], tops[i - 1] + 1); };
    const yToPos = y => { let i = 0; while (i < N - 1 && y >= tops[i + 1]) i++; if (i >= N - 1) return N - 1; return i + Math.min(1, Math.max(0, (y - tops[i]) / (tops[i + 1] - tops[i]))); };
    const posToY = p => { const i = Math.min(N - 2, Math.floor(p)); return tops[i] + (tops[i + 1] - tops[i]) * Math.min(1, Math.max(0, p - i)); };
    const cur = () => Math.min(N - 1, Math.floor(yToPos(scrollY + 2) + 1e-6));
    const go = (y, smooth) => scrollTo({ top: y, behavior: smooth && !reduce ? 'smooth' : 'instant' });

    // the small dial
    const knob = document.createElement('button');
    knob.className = 'nw-knob'; knob.type = 'button'; knob.setAttribute('aria-label', 'Open the quick navigation wheel'); knob.setAttribute('aria-haspopup', 'dialog');
    knob.innerHTML = '<span class="nw-ring" aria-hidden="true"></span><span class="nw-e" aria-hidden="true"></span><span class="nw-tip"></span>';
    // the big wheel
    const pop = document.createElement('div');
    pop.className = 'nw-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-modal', 'true'); pop.setAttribute('aria-label', 'Quick navigation wheel'); pop.hidden = true;
    pop.innerHTML = `<div class="nw-wheel"><div class="nw-track" aria-hidden="true"></div><div class="nw-fill" aria-hidden="true"></div>
      <div class="nw-marker" aria-hidden="true"><i>🐾</i></div>
      ${STOPS.map((s, i) => `<button type="button" class="nw-stop" data-i="${i}" style="--a:${i * SLOT}deg" aria-label="${s.label}"><i>${s.e}</i></button>`).join('')}
      <div class="nw-hub"><b class="nw-he"></b><strong class="nw-hl"></strong><small class="nw-hp"></small><em>Drag around the wheel · tap a stop</em></div>
      <button type="button" class="nw-x" aria-label="Close">✕</button></div>`;
    document.body.append(knob, pop);
    const wheel = $('.nw-wheel', pop), stops = $$('.nw-stop', pop), marker = $('.nw-marker', pop);
    let last = -1, preview = -1;
    const paint = () => {
      const p = yToPos(scrollY + 2), i = cur(), frac = scrollY / maxY();
      knob.style.setProperty('--p', frac); pop.style.setProperty('--ang', (Math.min(p, N - 1) * SLOT) + 'deg');
      if (i !== last) {
        last = i; $('.nw-e', knob).textContent = STOPS[i].e; $('.nw-tip', knob).textContent = STOPS[i].label;
        stops.forEach((b, k) => b.classList.toggle('on', k === i));
      }
      const show = STOPS[preview >= 0 ? preview : i];
      $('.nw-he', pop).textContent = show.e; $('.nw-hl', pop).textContent = show.label;
      $('.nw-hp', pop).textContent = preview >= 0 ? 'Tap to jump here' : `${Math.round(frac * 100)}% down the page`;
    };
    let raf = 0; const queue = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); }); };
    measure(); paint();
    addEventListener('scroll', queue, { passive: true });
    addEventListener('resize', () => { measure(); queue(); });
    addEventListener('load', () => { measure(); queue(); });
    setTimeout(() => { measure(); queue(); }, 2500);   // images and 3D titles settle

    // scroll over the dial (or the open wheel) = hop one section at a time
    let wheelLock = 0;
    const hop = e => {
      e.preventDefault(); const now = performance.now(); if (now < wheelLock) return; wheelLock = now + 260;
      measure(); const i = Math.min(N - 1, Math.max(0, cur() + (e.deltaY > 0 ? 1 : -1)));
      go(tops[i], true); sfx('tick'); sfx('hover', .8 + i * .03);
    };
    knob.addEventListener('wheel', hop, { passive: false });
    wheel.addEventListener('wheel', hop, { passive: false });

    // open / close
    const open = () => { measure(); preview = -1; paint(); pop.hidden = false; requestAnimationFrame(() => pop.classList.add('in')); knob.setAttribute('aria-expanded', 'true'); sfx('open'); setTimeout(() => stops[cur()].focus({ preventScroll: true }), 60); };
    const close = () => { if (pop.hidden) return; pop.classList.remove('in'); knob.setAttribute('aria-expanded', 'false'); sfx('close'); setTimeout(() => { pop.hidden = true; }, reduce ? 0 : 260); knob.focus({ preventScroll: true }); };
    knob.addEventListener('click', open);
    $('.nw-x', pop).addEventListener('click', close);
    pop.addEventListener('click', e => { if (e.target === pop) close(); });
    addEventListener('keydown', e => {
      if (pop.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      if (/^Arrow(Right|Down|Left|Up)$/.test(e.key)) { e.preventDefault(); const i = Math.min(N - 1, Math.max(0, cur() + (/Right|Down/.test(e.key) ? 1 : -1))); go(tops[i], true); stops[i].focus({ preventScroll: true }); sfx('tick'); }
    });

    // drag around the ring to scrub; a tap on a stop jumps there
    const angleAt = e => { const r = wheel.getBoundingClientRect(); return (Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))) * 180 / Math.PI + 360) % 360; };
    let drag = null;
    wheel.addEventListener('pointerdown', e => {
      if (e.target.closest('.nw-x,.nw-hub')) return;
      measure(); drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, stop: e.target.closest('.nw-stop'), last: yToPos(scrollY + 2) };
      wheel.setPointerCapture(e.pointerId); e.preventDefault();
    });
    wheel.addEventListener('pointermove', e => {
      const over = e.target.closest && e.target.closest('.nw-stop'); preview = over && !drag ? +over.dataset.i : -1;
      if (!drag || e.pointerId !== drag.id) { queue(); return; }
      if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      drag.moved = true; wheel.classList.add('dragging');
      let p = Math.min(SPAN, angleAt(e)) / SLOT;
      if (angleAt(e) > SPAN + SLOT / 2) p = 0;                                       // in the start/end gap, past the top: stay at the start
      if (Math.abs(p - drag.last) > N / 2) p = drag.last < N / 2 ? 0 : N - 1;          // no wrapping from the end to the start
      if (Math.floor(p) !== Math.floor(drag.last)) sfx('tick');
      drag.last = p; go(posToY(p), false);
    });
    const end = e => {
      if (!drag || e.pointerId !== drag.id) return;
      wheel.classList.remove('dragging');
      if (!drag.moved && drag.stop) { const i = +drag.stop.dataset.i; sfx('click'); go(tops[i], true); setTimeout(close, reduce ? 0 : 420); }
      drag = null;
    };
    wheel.addEventListener('pointerup', end); wheel.addEventListener('pointercancel', end);
    wheel.addEventListener('pointerleave', () => { if (!drag) { preview = -1; queue(); } });
    stops.forEach(b => b.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const i = +b.dataset.i; go(tops[i], true); setTimeout(close, reduce ? 0 : 420); } }));
  });

  /* ================= Instagram embeds (both locations) ================= */
  on('#instagram', sec => {
    const load = panel => $$('iframe[data-src]', panel).forEach(f => { f.src = f.dataset.src; f.removeAttribute('data-src'); });
    let near = false;
    new IntersectionObserver(es => { if (es[0].isIntersecting && !near) { near = true; load($('.ig-panel.on', sec)); } }, { rootMargin: '700px 0px' }).observe(sec);
    $$('.ig-switch button', sec).forEach(b => b.addEventListener('click', () => {
      $$('.ig-switch button', sec).forEach(x => x.setAttribute('aria-selected', x === b));
      $$('.ig-panel', sec).forEach(p => p.classList.toggle('on', p.dataset.igPanel === b.dataset.ig));
      if (near) load($('.ig-panel.on', sec));
    }));
  });

  /* ================= 3D trophy stage ================= */
  on('#trophy3d', host => {
    const stage = $('#trophyStage');
    const lightYears = () => $$('.years span', stage).forEach((y, i) => setTimeout(() => { y.style.transitionDelay = '0s'; y.style.opacity = 1; y.style.transform = 'none'; sfx('pop', 1 + i * .08); }, 250 + i * 160));
    const ctl = window.HPPTrophy ? window.HPPTrophy(host, {
      onEvent(kind, to) {
        if (kind === 'on') { sfx('click', .6); setTimeout(() => sfx('whoosh'), 120); }
        if (kind === 'lit') { stage.classList.add('lit'); lightYears(); }
        if (kind === 'morph') { sfx('sparkle'); sfx('whoosh'); }
      }
    }) : null;
    if (!ctl) { on($('.fallback', host), f => f.hidden = false); new IntersectionObserver(es => { if (es[0].isIntersecting) { stage.classList.add('lit'); lightYears(); } }, { threshold: .4 }).observe(stage); }
  });

  /* ================= scroll-linked motion ================= */
  {
    const prog = $('#progress'), nav = $('#nav'), blob = $('#blob');
    const day = $('#day'), dayTrack = $('#dayTrack'), dayBar = $('#dayBar'), clock = $('#clock'), sun = $('#sun'), moments = $$('.moment');
    let ticking = false;
    const onScroll = () => {
      const y = scrollY, Hh = document.documentElement.scrollHeight - innerHeight;
      if (prog) prog.style.transform = `scaleX(${Hh > 0 ? y / Hh : 0})`;
      if (nav) nav.classList.toggle('scrolled', y > 60);
      if (blob && !reduce && y < innerHeight * 1.3) blob.style.transform = `translateY(${y * .1}px) rotate(${y * .012}deg)`;
      if (day && dayTrack) {
        const r = day.getBoundingClientRect(), total = day.offsetHeight - innerHeight;
        const p = Math.min(1, Math.max(0, -r.top / total));
        const maxX = Math.max(0, dayTrack.scrollWidth - innerWidth + 40);
        dayTrack.style.transform = `translateX(${-p * maxX}px)`;
        dayBar.style.transform = `scaleX(${p})`;
        const mins = 360 + p * 960;
        clock.textContent = fmt(Math.round(mins / 15) * 15);
        sun.textContent = mins > 1140 ? '🌙' : mins > 1050 ? '🌇' : '☀️';
        sun.style.transform = `rotate(${p * 360}deg)`;
        const active = Math.min(moments.length - 1, Math.floor(p * moments.length));
        moments.forEach((m, i) => { if (i === active && !m.classList.contains('on')) sfx('tick'); m.classList.toggle('on', i === active); m.style.opacity = Math.abs(i - active) > 2 ? .5 : 1; });
      }
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    addEventListener('resize', onScroll);
    onScroll();
  }

  /* ================= pointer motion ================= */
  if (!reduce && fine) {
    on('.hero', hero => {
      const floats = $$('[data-depth]');
      hero.addEventListener('pointermove', e => {
        const cx = e.clientX / innerWidth - .5, cy = e.clientY / innerHeight - .5;
        floats.forEach(f => f.style.transform = `translate(${cx * f.dataset.depth}px, ${cy * f.dataset.depth}px)`);
      });
    });
    document.addEventListener('pointermove', e => {
      const b = e.target.closest && e.target.closest('.magnetic'); if (!b) return;
      const r = b.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      b.style.setProperty('--mx', x + 'px'); b.style.setProperty('--my', y + 'px');
      b.style.transform = `translate(${(x - r.width / 2) * .15}px, ${(y - r.height / 2) * .25}px)`;
    });
    document.addEventListener('pointerout', e => { const b = e.target.closest && e.target.closest('.magnetic'); if (b && !b.contains(e.relatedTarget)) b.style.transform = ''; });
    $$('.tilt').forEach(c => {
      c.addEventListener('pointermove', e => {
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.transform = `perspective(900px) rotateY(${(x - .5) * 9}deg) rotateX(${(.5 - y) * 9}deg) translateY(-6px)`;
        c.style.setProperty('--gx', x * 100 + '%'); c.style.setProperty('--gy', y * 100 + '%');
      });
      c.addEventListener('pointerleave', () => c.style.transform = '');
    });
  }

  /* ================= service filter (FLIP) ================= */
  on('#svcGrid', () => {
    const cards = $$('.svc');
    $$('.chip').forEach(ch => ch.onclick = () => {
      $$('.chip').forEach(c => c.setAttribute('aria-pressed', c === ch));
      const f = ch.dataset.f, first = new Map(cards.map(c => [c, c.getBoundingClientRect()]));
      cards.forEach(c => { c.classList.toggle('hide', f !== 'all' && !c.dataset.cat.split(' ').includes(f)); c.classList.toggle('big', f === 'all' && c === cards[0]); });
      if (reduce) return;
      cards.forEach(c => {
        if (c.classList.contains('hide')) return;
        const a = first.get(c), b = c.getBoundingClientRect();
        if (!a.width) return c.animate([{ opacity: 0, scale: .85 }, { opacity: 1, scale: 1 }], { duration: 450, easing: 'cubic-bezier(.34,1.56,.64,1)' });
        c.animate([{ translate: `${a.left - b.left}px ${a.top - b.top}px` }, { translate: '0 0' }], { duration: 550, easing: 'cubic-bezier(.2,.8,.2,1)' });
      });
    });
  });

  /* ================= sliding-pill tabs ================= */
  const pillTabs = (wrap, pill, onPick) => {
    const btns = $$('button', wrap);
    const move = b => { if (!b) return; pill.style.left = b.offsetLeft + 'px'; pill.style.top = b.offsetTop + 'px'; pill.style.width = b.offsetWidth + 'px'; pill.style.height = b.offsetHeight + 'px'; };
    const pick = (b, anim) => { btns.forEach(x => x.setAttribute('aria-selected', x === b)); move(b); onPick(b, anim); };
    btns.forEach(b => b.addEventListener('click', () => pick(b, true)));
    const cur = () => btns.find(b => b.getAttribute('aria-selected') === 'true');
    addEventListener('resize', () => move(cur()));
    document.fonts && document.fonts.ready.then(() => move(cur()));
    HPP.ready.then(() => move(cur()));
    return { pick, btns };
  };
  const vt = (fn, anim) => anim && document.startViewTransition && !reduce ? document.startViewTransition(fn) : fn();
  on('#ptabs', w => pillTabs(w, $('#ppill'), (b, anim) => vt(() => $$('.price-panel').forEach(p => p.classList.toggle('on', p.dataset.panel === b.dataset.p)), anim)).pick($('button', w), false));

  /* ================= status / hours / locations ================= */
  const paint = (dot, txt, pre = '') => { if (!dot || !txt) return; const s = HPP.status(); dot.classList.toggle('closed', !s.open); txt.textContent = pre + s.text; };
  const paintAll = () => { paint($('#topDot'), $('#topStatus'), 'Both locations · '); paint($('#locDot'), $('#locStatus')); $$('[data-status]').forEach(el => paint($('.dot', el), $('.txt', el))); };
  const today = azNow().d;
  const hoursRows = [['Monday – Friday', '6:00 AM – 6:30 PM', [1, 2, 3, 4, 5]], ['Saturday', '8:00 AM – 6:30 PM', [6]], ['Sunday &amp; holidays', '8–10:30 AM · 4–6:30 PM', [0]]]
    .map(([a, b, ds]) => `<tr class="${ds.includes(today) ? 'today' : ''}"><td>${a}</td><td>${b}</td></tr>`).join('');
  $$('.hours,[data-hours]').forEach(t => t.innerHTML = hoursRows);
  const setLoc = key => {
    const L = HPP.locs[key];
    const set = (id, fn) => on(id, fn);
    set('#locName', el => el.textContent = L.name); set('#locAddr', el => el.innerHTML = L.addr); set('#locNear', el => el.textContent = L.near);
    set('#locBook', el => { el.href = L.book; el.firstChild.textContent = `Book ${L.name} `; });
    set('#locPage', el => { el.href = L.page; });
    set('#locDir', el => el.href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(L.q));
    set('#locMail', el => { el.href = 'mailto:' + L.mail; el.textContent = L.mail; });
    set('#locFb', el => el.href = L.fb); set('#locIg', el => el.href = L.ig);
    set('#map', el => el.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(L.q) + '&z=15&output=embed');
    paintAll();
  };
  on('#ltabs', w => {
    const lt = pillTabs(w, $('#lpill'), (b, anim) => vt(() => setLoc(b.dataset.loc), anim));
    lt.pick(lt.btns[0], false);
  });
  $$('[data-map]').forEach(f => f.src = 'https://maps.google.com/maps?q=' + encodeURIComponent(HPP.locs[f.dataset.map].q) + '&z=15&output=embed');
  paintAll(); setInterval(paintAll, 60000);

  /* ================= estimator ================= */
  on('#nights', () => {
    const P = { loc: 'mesa', dogs: 1 };
    const seg = (id, key, cast) => $$('#' + id + ' button').forEach(b => b.onclick = ev => {
      const old = P[key];
      $$('#' + id + ' button').forEach(x => x.setAttribute('aria-pressed', x === b)); P[key] = cast(b.dataset.v); plan(true);
      if (key === 'dogs' && P.dogs > old) { sfx('bark', 1.15 - P.dogs * .03, Math.min(3, P.dogs - old)); ev.barked = true; }   // one arf per pup added
    });
    seg('pLoc', 'loc', String); seg('pDogs', 'dogs', Number);
    ['nights', 'deluxe', 'cam', 'play', 'late', 'mil'].forEach(id => $('#' + id).addEventListener('input', () => plan(id !== 'nights')));
    const pup = $('#pup'); let shown = 0;
    const money = n => '$' + n.toLocaleString();
    const plan = hop => {
      const n = +$('#nights').value;
      const e = HPP.estimate({ dogs: P.dogs, nights: n, deluxe: $('#deluxe').checked, cam: $('#cam').checked, play: $('#play').checked, late: $('#late').checked, military: $('#mil').checked });
      $('#nightsOut').textContent = n + (n > 1 ? ' nights' : ' night');
      $('#sBaseL').textContent = `${P.dogs} dog${P.dogs > 1 ? 's' : ''} × ${n} night${n > 1 ? 's' : ''} @ $${e.rate}`;
      $('#sBase').textContent = money(e.base);
      $('#sDiscRow').hidden = !e.disc;
      if (e.disc) { $('#sDiscL').textContent = e.disc.label; $('#sDisc').textContent = '−' + money(e.disc.amt); }
      $('#sAdd').textContent = money(e.add);
      $('#sLoc').textContent = HPP.locs[P.loc].name;
      const from = shown, to = e.total, t0 = performance.now();
      const step = t => { const p = Math.min(1, (t - t0) / 500); shown = Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))); $('#sTotal').textContent = money(shown); if (p < 1) requestAnimationFrame(step); };
      reduce ? ($('#sTotal').textContent = money(shown = to)) : requestAnimationFrame(step);
      const book = $('#sBook'); book.href = HPP.locs[P.loc].book; book.firstChild.textContent = `Book in ${HPP.locs[P.loc].name} `;
      pup.textContent = ['🐶', '🐶🐕', '🐶🐕🐩', '🐶🐕🐩🐕‍🦺'][P.dogs - 1];
      if (hop && !reduce) { pup.classList.remove('hop'); void pup.offsetWidth; pup.classList.add('hop'); }
    };
    plan(false);
  });

  /* ================= pre-screen steps + checklist ================= */
  on('#steps', () => {
    const STEPS = [
      '<b>Say hello.</b> We see how your dog is with us and our staff, and how they handle being guided by the collar. We love a happy, loose, wiggly dog — and shy or timid pups are welcome too; we give them time to see we\'re all about fun.',
      '<b>Leash introductions.</b> Your dog meets two other dogs on leash, one at a time — one of the same sex and one of the opposite sex. If we want a clearer read, we\'ll introduce a couple more.',
      '<b>Join the group.</b> Your dog heads outside to sniff and potty, then joins the dogs they already met. We gradually add a couple more dogs at a time while staff watch closely.',
      '<b>Pack feedback.</b> Our regulars get a say! Dogs sense vibes just like people do, and we respect our pack\'s choice for everyone\'s safety.',
      '<b>Two-staff sign-off.</b> At least two staff members working with the dogs must approve. Then your pup is welcome for daycare and boarding as long as they keep up the good behavior. 🎉'
    ];
    const stepBtns = $$('#steps .step'), stepDetail = $('#stepDetail');
    const pickStep = (i, anim) => vt(() => { stepBtns.forEach((b, j) => b.setAttribute('aria-selected', i === j)); stepDetail.innerHTML = STEPS[i]; }, anim);
    stepBtns.forEach((b, i) => b.onclick = () => pickStep(i, true));
    pickStep(0, false);
  });
  on('#meter', meter => {
    const reqs = $$('.req input');
    reqs.forEach(r => r.addEventListener('change', () => {
      const n = reqs.filter(x => x.checked).length;
      meter.style.width = (n / reqs.length * 100) + '%';
      $('#readyTxt').textContent = n === reqs.length ? '🎉 All set — let\'s book!' : `${n} of ${reqs.length} ready`;
      if (n === reqs.length) sfx('sparkle');
    }));
  });

  /* ================= staff ================= */
  on('#staffGrid', grid => {
    const STAFF = [['Linda', 1], ['Amber', 1], ['Lucy', 1], ['Andrea'], ['Angela'], ['Askyla'], ['Ben'], ['Caity'], ['Calvin'], ['Charlie'], ['David'], ['Ella'], ['Flor'], ['Hailey'],
      ['Jayde'], ['Kate'], ['Katie'], ['Keara'], ['Leah'], ['Lindsay'], ['Luca'], ['Makenzie'], ['Marcus'], ['Mia'], ['Roxane'], ['Scott'], ['Sophia'], ['Will']];
    const limit = +grid.dataset.limit || STAFF.length;
    grid.innerHTML = STAFF.slice(0, limit).map(([n, mgr], i) => `
      <div class="member${mgr ? ' mgr' : ''}" data-reveal="pop" style="--i:${i % 6};--rot:${i % 2 ? 3 : -3}deg" tabindex="0" role="button" aria-label="Send ${n} some love">
        <div class="ph"><span class="fallback">${n[0]}</span><img src="assets/img/staff-${n.toLowerCase()}.webp" alt="${n}" loading="lazy" onerror="this.remove()"></div>
        <h4>${n}</h4><span>${mgr ? 'Manager' : 'Pet Care Specialist'}</span><span class="heart">💜</span>
      </div>`).join('');
    HPP.ready.then(() => $$('[data-reveal]', grid).forEach(observe));
    $$('.member', grid).forEach((m, i) => {
      const love = () => { const h = $('.heart', m); h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop'); sfx('pop', 1 + (i % 5) * .08); };
      m.addEventListener('click', love); m.addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), love()));
    });
  });

  /* ================= events countdown + ics ================= */
  const opener = HPP.azDate(2026, 10, 21, 8, 0);
  on('#countdown', cd => {
    const tickCd = () => {
      const ms = opener - Date.now();
      if (ms <= 0) { cd.innerHTML = '<div><b>🎉</b><span>Season is on!</span></div>'; return; }
      const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
      cd.innerHTML = [[d, 'days'], [h, 'hours'], [m, 'mins'], [s, 'secs']].map(([v, l]) => `<div><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('');
    };
    tickCd(); setInterval(tickCd, 1000);
  });
  $$('[data-ics-opener]').forEach(b => b.onclick = () => { sfx('sparkle'); HPP.ics('Happy Pets Palace Saturday Meetup — Season Opener', opener, HPP.azDate(2026, 10, 21, 13, 30),
    'Ruff Ranch Dog Park, Painted Sky Park, Apache Junction, AZ',
    'Free supervised meetups. 8-9:30 Toy Breeds, 10-11:30 Arctic breeds, 12-1:30 Large-Breed Puppy Social. Bring water and treats. Check the events calendar for the exact address.'); });
  on('#camTs', camTs => setInterval(() => camTs.textContent = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Phoenix' }) + ' AZ', 1000));

  /* ================= FAQ search ================= */
  on('#faqQ', q => {
    const faqs = $$('#faqList details');
    q.addEventListener('input', e => {
      const v = e.target.value.trim().toLowerCase(); let n = 0;
      faqs.forEach(d => { const hit = !v || d.textContent.toLowerCase().includes(v); d.classList.toggle('hide', !hit); if (hit) n++; if (v && hit) d.open = true; if (!v) d.open = false; });
      on('#noRes', el => el.style.display = n ? 'none' : 'block');
    });
  });

  /* ================= booking page ================= */
  on('#bookFrame', frame => {
    const params = new URLSearchParams(location.search);
    let loc = params.get('loc') === 'chandler' ? 'chandler' : 'mesa';
    const btns = $$('.loc-pick button');
    const set = (k, user) => {
      loc = k; const L = HPP.locs[k];
      btns.forEach(b => b.setAttribute('aria-pressed', b.dataset.loc === k));
      frame.src = L.moego;
      $$('[data-bk]').forEach(el => { const f = el.dataset.bk; if (f === 'name') el.textContent = L.name; if (f === 'addr') el.innerHTML = L.addr; if (f === 'mail') { el.href = 'mailto:' + L.mail; el.textContent = L.mail; } if (f === 'open') el.href = L.moegoLanding; if (f === 'page') el.href = L.page; });
      if (user) { history.replaceState(null, '', '?loc=' + k); sfx('sparkle'); }
    };
    btns.forEach(b => b.addEventListener('click', () => set(b.dataset.loc, true)));
    set(loc, false);
  });

  /* ================= CTA bubbles ================= */
  if (!reduce) $$('.bubbles').forEach(bub => {
    const em = ['🐾', '🦴', '🎾', '💜', '👑', '🫧'];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span'); s.textContent = em[i % em.length];
      s.style.left = Math.random() * 100 + '%';
      s.style.animationDuration = 9 + Math.random() * 10 + 's'; s.style.animationDelay = -Math.random() * 18 + 's';
      s.style.fontSize = 22 + Math.random() * 30 + 'px'; bub.append(s);
    }
  });

  /* ================= raining paw prints ================= */
  on('#paws', cv => {
    const ctx = cv.getContext('2d');
    let W, Hh, dpr;
    const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * dpr; Hh = cv.height = innerHeight * dpr; };
    size(); addEventListener('resize', size);
    const PAL = ['#c23a8c', '#1fb2c9', '#ff8fc6', '#f2b233', '#521034'];
    const drawPaw = (x, y, ang, s, alpha, color) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
      ctx.globalAlpha = alpha; ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(0, 6, 9, 7.5, 0, 0, Math.PI * 2); ctx.fill();
      [[-10, -5, 3.6, 4.6, -.35], [-3.6, -11, 3.8, 4.9, -.1], [3.6, -11, 3.8, 4.9, .1], [10, -5, 3.6, 4.6, .35]]
        .forEach(([tx, ty, rx, ry, r]) => { ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, r, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
    };
    const paws = [];
    const make = (x, y, burst) => {
      const depth = Math.random();                 // 0 = far (small, faint, slow) .. 1 = near
      return { x, y, depth, s: (.55 + depth * 1.1) * dpr, vx: burst ? (Math.random() - .5) * 420 * dpr : 0, vy: burst ? -(160 + Math.random() * 260) * dpr : (24 + depth * 52) * dpr,
        rot: Math.random() * 6.28, vr: (Math.random() - .5) * (burst ? 8 : 1.2), sway: Math.random() * 6.28, sw: .6 + Math.random(), color: PAL[Math.random() * PAL.length | 0],
        a: burst ? .5 : .07 + depth * .13, burst };
    };
    let mx = -1e4, my = -1e4;
    addEventListener('pointermove', e => { mx = e.clientX * dpr; my = e.clientY * dpr; }, { passive: true });
    addEventListener('pointerleave', () => { mx = my = -1e4; });
    // click on empty background -> confetti of paws
    document.addEventListener('pointerdown', e => {
      if (e.target.closest('a,button,input,select,textarea,label,summary,iframe,canvas,.chat,.w3d,.wfur,.live-title,.member,.svc,.pcard,.ptable,.map')) return;
      for (let i = 0; i < 9; i++) paws.push(make(e.clientX * dpr, e.clientY * dpr, true));
      sfx('pop', 1.1 + Math.random() * .3);
    });
    const target = () => Math.round(innerWidth * innerHeight / (innerWidth < 700 ? 52000 : 34000));
    // seed the screen so it's already raining
    for (let i = 0; i < target(); i++) paws.push(make(Math.random() * W, Math.random() * Hh));
    let last = performance.now();
    const frame = t => {
      const dt = Math.min(.05, (t - last) / 1000); last = t;
      ctx.clearRect(0, 0, W, Hh);
      const want = target(); let falling = 0;
      for (let i = paws.length - 1; i >= 0; i--) {
        const p = paws[i];
        if (p.burst) { p.vy += 900 * dpr * dt; p.vx *= .985; p.a *= .985; if (p.vy > 90 * dpr) { p.burst = false; } }
        else {
          falling++;
          p.sway += dt * p.sw;
          const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy), R = 150 * dpr;
          if (d < R && d > 1) { const f = (1 - d / R) * 900 * dpr * dt; p.vx += dx / d * f; p.vr += (dx > 0 ? 1 : -1) * dt * 6; }
          p.vx *= .94;
          p.vy += ((24 + p.depth * 52) * dpr - p.vy) * dt * 2;
        }
        p.x += (p.vx + Math.sin(p.sway) * 14 * dpr * (p.burst ? 0 : 1)) * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.vr *= .99;
        drawPaw(p.x, p.y, p.rot, p.s, Math.min(.55, p.a), p.color);
        if (p.y > Hh + 40 * dpr || p.a < .01 || p.x < -80 * dpr || p.x > W + 80 * dpr) paws.splice(i, 1);
      }
      if (falling < want && Math.random() < .5) paws.push(make(Math.random() * W, -30 * dpr));
      requestAnimationFrame(frame);   // paused automatically by the browser when the tab is hidden
    };
    if (reduce) { paws.forEach(p => drawPaw(p.x, p.y, p.rot, p.s, p.a, p.color)); }
    else {
      requestAnimationFrame(frame);
    }
  });
})();

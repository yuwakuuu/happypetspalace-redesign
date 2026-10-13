/* Happy Pets Palace — site interactions & motion */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(pointer:fine)').matches;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ================= shared business data (also used by chat.js) ================= */
  const HPP = window.HPP = {
    phone: '480-207-1852', tel: '+14802071852',
    locs: {
      mesa: { key: 'mesa', name: 'Mesa', addr: '1918 East McKellips Road<br>Mesa, AZ 85203', q: '1918 E McKellips Rd, Mesa, AZ 85203',
        near: 'North Mesa — easy reach of Tempe, north Scottsdale and Apache Junction.',
        book: 'https://booking.moego.pet/ol/HappyPetsPalaceMesa/landing', mail: 'happypetspalacemesa@gmail.com',
        fb: 'https://www.facebook.com/happypetspalacemesa', ig: 'https://www.instagram.com/happypetspalacemesa' },
      chandler: { key: 'chandler', name: 'Chandler', addr: '1080 E Pecos Road, Suite 16<br>Chandler, AZ 85225', q: '1080 E Pecos Rd Suite 16, Chandler, AZ 85225',
        near: 'Close to the Gilbert border — handy for Gilbert, Ahwatukee, Sun Lakes and south Tempe.',
        book: 'https://booking.moego.pet/ol/HappyPetsPalaceChandler/landing', mail: 'happypetschandler@gmail.com',
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
  // Arizona is UTC-7 year-round
  HPP.azDate = (y, mo, d, h = 0, mi = 0) => new Date(Date.UTC(y, mo, d, h + 7, mi));

  /* ================= bulldog SVG ================= */
  const BULLDOG = `<svg viewBox="0 0 100 100" aria-hidden="true">
    <g class="bd-head">
      <g class="bd-ear-l"><path d="M30 30 Q12 20 10 40 Q18 44 30 40Z" fill="#7a4a2e"/><path d="M27 32 Q16 27 15 38 Q20 40 27 38Z" fill="#c98e74"/></g>
      <g class="bd-ear-r"><path d="M70 30 Q88 20 90 40 Q82 44 70 40Z" fill="#7a4a2e"/><path d="M73 32 Q84 27 85 38 Q80 40 73 38Z" fill="#c98e74"/></g>
      <path d="M50 22 C76 22 88 40 86 60 C84 80 68 90 50 90 C32 90 16 80 14 60 C12 40 24 22 50 22Z" fill="#e7b98c"/>
      <path d="M44 24 Q50 21 56 24 L55 52 Q50 56 45 52Z" fill="#fff6ea"/>
      <path d="M30 40 Q36 36 42 40 M58 40 Q64 36 70 40" stroke="#b07e5a" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M40 30 Q50 27 60 30" stroke="#c99a74" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <g class="bd-eyes">
        <circle cx="35" cy="49" r="6" fill="#2a1a12"/><circle cx="65" cy="49" r="6" fill="#2a1a12"/>
        <circle cx="37" cy="47" r="2" fill="#fff"/><circle cx="67" cy="47" r="2" fill="#fff"/>
      </g>
      <ellipse cx="34" cy="71" rx="16" ry="12" fill="#fff6ea"/><ellipse cx="66" cy="71" rx="16" ry="12" fill="#fff6ea"/>
      <circle cx="28" cy="68" r="1" fill="#b07e5a"/><circle cx="32" cy="72" r="1" fill="#b07e5a"/><circle cx="72" cy="68" r="1" fill="#b07e5a"/><circle cx="68" cy="72" r="1" fill="#b07e5a"/>
      <path d="M40 60 Q50 54 60 60 Q58 66 50 67 Q42 66 40 60Z" fill="#2a1a12"/>
      <ellipse cx="46" cy="59" rx="2.4" ry="1.3" fill="#5a4034"/>
      <path class="bd-tongue" d="M45 76 Q45 86 50 86 Q55 86 55 76Z" fill="#f2738f"/>
      <path d="M36 76 Q50 84 64 76" stroke="#2a1a12" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M41 77 L43 72 L45 78Z M55 78 L57 72 L59 77Z" fill="#fff"/>
      <g class="bd-crown">
        <path d="M37 22 L39 9 L45 16 L50 6 L55 16 L61 9 L63 22Z" fill="#9fd0dc" stroke="#521034" stroke-width="2" stroke-linejoin="round"/>
        <circle cx="50" cy="16" r="2.2" fill="#521034"/><circle cx="42" cy="18" r="1.4" fill="#521034"/><circle cx="58" cy="18" r="1.4" fill="#521034"/>
      </g>
    </g></svg>`;
  $$('[data-bulldog]').forEach(el => el.innerHTML = BULLDOG);

  /* ================= misc boot ================= */
  $('#yr').textContent = new Date().getFullYear();
  const root = document.documentElement, themeBtn = $('#theme');
  const isDark = () => root.dataset.theme === 'dark';
  try { const t = localStorage.getItem('hpp-theme'); if (t) root.dataset.theme = t; } catch {}
  const syncIcon = () => themeBtn.textContent = isDark() ? '☀️' : '🌙';
  syncIcon();
  themeBtn.onclick = () => {
    const flip = () => { root.dataset.theme = isDark() ? 'light' : 'dark'; syncIcon(); try { localStorage.setItem('hpp-theme', root.dataset.theme); } catch {} };
    document.startViewTransition && !reduce ? document.startViewTransition(flip) : flip();
  };

  /* mobile menu */
  const burger = $('#burger'), menu = $('#menu');
  burger.onclick = () => { const o = menu.classList.toggle('open'); burger.setAttribute('aria-expanded', o); burger.textContent = o ? '✕' : '☰'; };
  $$('#menu > li > button').forEach(b => b.addEventListener('click', () => { if (innerWidth <= 1080) b.parentNode.classList.toggle('x-open'); }));
  $$('#menu a').forEach(a => a.addEventListener('click', () => { menu.classList.remove('open'); burger.textContent = '☰'; }));

  /* headline split */
  const h = $('#headline');
  [...h.childNodes].forEach(n => {
    if (n.nodeType === 3) {
      const frag = document.createDocumentFragment();
      n.textContent.split(/(\s+)/).forEach(t => {
        if (!t.trim()) return frag.append(t);
        const w = document.createElement('span'); w.className = 'w';
        const i = document.createElement('span'); i.textContent = t; w.append(i); frag.append(w);
      });
      n.replaceWith(frag);
    } else {
      const w = document.createElement('span'); w.className = 'w'; w.append(n.cloneNode(true)); n.replaceWith(w);
    }
  });
  $$('.w > span', h).forEach((s, i) => s.style.transitionDelay = (i * 75 + 150) + 'ms');
  requestAnimationFrame(() => requestAnimationFrame(() => $('.hero').classList.add('go')));

  /* reveals */
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -30px 0px' });
  const observe = el => io.observe(el);
  $$('.svc').forEach((el, i) => el.style.setProperty('--i', i % 3));
  $$('[data-reveal]').forEach(observe);

  /* counters */
  const cio = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target, end = +el.dataset.count, suf = el.dataset.suffix || '', t0 = performance.now(), dur = 1500;
    const tick = t => { const p = Math.min(1, (t - t0) / dur); el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4))) + suf; if (p < 1) requestAnimationFrame(tick); };
    reduce ? el.textContent = end + suf : requestAnimationFrame(tick);
    cio.unobserve(el);
  }), { threshold: .6 });
  $$('[data-count]').forEach(el => cio.observe(el));

  $$('.track').forEach(t => t.innerHTML += t.innerHTML);

  /* ================= scroll-linked motion ================= */
  const prog = $('#progress'), nav = $('#nav'), blob = $('#blob');
  const day = $('#day'), dayTrack = $('#dayTrack'), dayBar = $('#dayBar'), clock = $('#clock'), sun = $('#sun'), moments = $$('.moment');
  let ticking = false;
  const onScroll = () => {
    const y = scrollY, H = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = `scaleX(${H > 0 ? y / H : 0})`;
    nav.classList.toggle('scrolled', y > 60);
    if (!reduce && y < innerHeight * 1.3) blob.style.transform = `translateY(${y * .1}px) rotate(${y * .012}deg)`;
    const r = day.getBoundingClientRect(), total = day.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, -r.top / total));
    const maxX = Math.max(0, dayTrack.scrollWidth - innerWidth + 40);
    dayTrack.style.transform = `translateX(${-p * maxX}px)`;
    dayBar.style.transform = `scaleX(${p})`;
    const mins = 360 + p * 960; // 6 AM → 10 PM
    clock.textContent = fmt(Math.round(mins / 15) * 15);
    sun.textContent = mins > 1140 ? '🌙' : mins > 1050 ? '🌇' : '☀️';
    sun.style.transform = `rotate(${p * 360}deg)`;
    const active = Math.min(moments.length - 1, Math.floor(p * moments.length));
    moments.forEach((m, i) => { m.classList.toggle('on', i === active); m.style.opacity = Math.abs(i - active) > 2 ? .5 : 1; });
    ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ================= pointer motion ================= */
  if (!reduce && fine) {
    const hero = $('.hero'), floats = $$('[data-depth]');
    let last = 0;
    hero.addEventListener('pointermove', e => {
      const cx = e.clientX / innerWidth - .5, cy = e.clientY / innerHeight - .5;
      floats.forEach(f => f.style.transform = `translate(${cx * f.dataset.depth}px, ${cy * f.dataset.depth}px)`);
      const now = performance.now(); if (now - last < 110) return; last = now;
      const p = document.createElement('span'); p.className = 'trail'; p.textContent = '🐾';
      p.style.left = e.clientX + 'px'; p.style.top = e.clientY + 'px'; p.style.rotate = (Math.random() * 60 - 30) + 'deg';
      document.body.append(p); setTimeout(() => p.remove(), 1000);
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

  /* ================= sliding-pill tabs ================= */
  const pillTabs = (wrap, pill, onPick) => {
    const btns = $$('button', wrap);
    const move = b => { pill.style.left = b.offsetLeft + 'px'; pill.style.top = b.offsetTop + 'px'; pill.style.width = b.offsetWidth + 'px'; pill.style.height = b.offsetHeight + 'px'; };
    const pick = (b, anim) => { btns.forEach(x => x.setAttribute('aria-selected', x === b)); move(b); onPick(b, anim); };
    btns.forEach(b => b.addEventListener('click', () => pick(b, true)));
    addEventListener('resize', () => move(btns.find(b => b.getAttribute('aria-selected') === 'true')));
    document.fonts && document.fonts.ready.then(() => move(btns.find(b => b.getAttribute('aria-selected') === 'true')));
    return { pick, btns };
  };
  const vt = (fn, anim) => anim && document.startViewTransition && !reduce ? document.startViewTransition(fn) : fn();

  pillTabs($('#ptabs'), $('#ppill'), (b, anim) => vt(() => $$('.price-panel').forEach(p => p.classList.toggle('on', p.dataset.panel === b.dataset.p)), anim))
    .pick($('#ptabs button'), false);

  /* ================= status / hours / locations ================= */
  const paint = (dot, txt, pre = '') => { const s = HPP.status(); dot.classList.toggle('closed', !s.open); txt.textContent = pre + s.text; };
  const paintAll = () => { paint($('#topDot'), $('#topStatus'), 'Both locations · '); paint($('#locDot'), $('#locStatus')); };
  const today = azNow().d;
  $('#hours').innerHTML = [['Monday – Friday', '6:00 AM – 6:30 PM', [1, 2, 3, 4, 5]], ['Saturday', '8:00 AM – 6:30 PM', [6]], ['Sunday &amp; holidays', '8–10:30 AM · 4–6:30 PM', [0]]]
    .map(([a, b, ds]) => `<tr class="${ds.includes(today) ? 'today' : ''}"><td>${a}</td><td>${b}</td></tr>`).join('');
  const setLoc = key => {
    const L = HPP.locs[key];
    $('#locName').textContent = L.name; $('#locAddr').innerHTML = L.addr; $('#locNear').textContent = L.near;
    $('#locBook').href = L.book; $('#locBook').firstChild.textContent = `Book ${L.name} `;
    $('#locDir').href = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(L.q);
    $('#locMail').href = 'mailto:' + L.mail; $('#locMail').textContent = L.mail;
    $('#locFb').href = L.fb; $('#locIg').href = L.ig;
    $('#map').src = 'https://maps.google.com/maps?q=' + encodeURIComponent(L.q) + '&z=15&output=embed';
    paintAll();
  };
  const lt = pillTabs($('#ltabs'), $('#lpill'), (b, anim) => vt(() => setLoc(b.dataset.loc), anim));
  lt.pick(lt.btns[0], false);
  $$('[data-loc-link]').forEach(a => a.addEventListener('click', () => lt.pick(lt.btns.find(b => b.dataset.loc === a.dataset.locLink), true)));
  setInterval(paintAll, 60000);

  /* ================= estimator ================= */
  const P = { loc: 'mesa', dogs: 1 };
  const seg = (id, key, cast) => $$('#' + id + ' button').forEach(b => b.onclick = () => {
    $$('#' + id + ' button').forEach(x => x.setAttribute('aria-pressed', x === b)); P[key] = cast(b.dataset.v); plan(true);
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

  /* ================= pre-screen steps ================= */
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

  /* checklist */
  const reqs = $$('.req input');
  const syncReady = () => {
    const n = reqs.filter(r => r.checked).length;
    $('#meter').style.width = (n / reqs.length * 100) + '%';
    $('#readyTxt').textContent = n === reqs.length ? '🎉 All set — let\'s book!' : `${n} of ${reqs.length} ready`;
  };
  reqs.forEach(r => r.addEventListener('change', syncReady));

  /* ================= staff ================= */
  const STAFF = [
    ['Linda', 1], ['Amber', 1], ['Lucy', 1],
    ['Andrea'], ['Angela'], ['Askyla'],
    ['Ben'], ['Caity'], ['Calvin'],
    ['Charlie'], ['David'], ['Ella'],
    ['Flor'], ['Hailey'], ['Jayde'],
    ['Kate'], ['Katie'], ['Keara'],
    ['Leah'], ['Lindsay'], ['Luca'],
    ['Makenzie'], ['Marcus'], ['Mia'],
    ['Roxane'], ['Scott'], ['Sophia'],
    ['Will']
  ];
  const grid = $('#staffGrid');
  grid.innerHTML = STAFF.map(([n, mgr], i) => `
    <div class="member${mgr ? ' mgr' : ''}" data-reveal="pop" style="--i:${i % 6};--rot:${i % 2 ? 3 : -3}deg" tabindex="0" role="button" aria-label="Send ${n} some love">
      <div class="ph"><span class="fallback">${n[0]}</span><img src="assets/img/staff-${n.toLowerCase()}.webp" alt="${n}" loading="lazy" onerror="this.remove()"></div>
      <h4>${n}</h4><span>${mgr ? 'Manager' : 'Pet Care Specialist'}</span><span class="heart">💜</span>
    </div>`).join('');
  $$('[data-reveal]', grid).forEach(observe);
  $$('.member', grid).forEach(m => {
    const love = () => { const h = $('.heart', m); h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop'); };
    m.addEventListener('click', love); m.addEventListener('keydown', e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), love()));
  });

  /* ================= events countdown + ics ================= */
  const opener = HPP.azDate(2026, 10, 21, 8, 0);
  const cd = $('#countdown');
  const tickCd = () => {
    const ms = opener - Date.now();
    if (ms <= 0) { cd.innerHTML = '<div><b>🎉</b><span>Season is on!</span></div>'; return; }
    const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
    cd.innerHTML = [[d, 'days'], [h, 'hours'], [m, 'mins'], [s, 'secs']].map(([v, l]) => `<div><b>${String(v).padStart(2, '0')}</b><span>${l}</span></div>`).join('');
  };
  tickCd(); setInterval(tickCd, 1000);
  $('#icsBtn').onclick = () => HPP.ics('Happy Pets Palace Saturday Meetup — Season Opener', opener, HPP.azDate(2026, 10, 21, 13, 30),
    'Ruff Ranch Dog Park, Painted Sky Park, Apache Junction, AZ',
    'Free supervised meetups. 8-9:30 Toy Breeds, 10-11:30 Arctic breeds, 12-1:30 Large-Breed Puppy Social. Bring water and treats. Check happypetspalace.com/events for the exact address.');

  /* fake cam timestamp */
  const camTs = $('#camTs');
  setInterval(() => camTs.textContent = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Phoenix' }) + ' AZ', 1000);

  /* ================= FAQ search ================= */
  const faqs = $$('#faqList details');
  $('#faqQ').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase(); let shownN = 0;
    faqs.forEach(d => { const hit = !q || d.textContent.toLowerCase().includes(q); d.classList.toggle('hide', !hit); if (hit) shownN++; if (q && hit) d.open = true; if (!q) d.open = false; });
    $('#noRes').style.display = shownN ? 'none' : 'block';
  });

  /* ================= CTA bubbles ================= */
  if (!reduce) {
    const bub = $('#bubbles'), em = ['🐾', '🦴', '🎾', '💜', '👑', '🫧'];
    for (let i = 0; i < 16; i++) {
      const s = document.createElement('span'); s.textContent = em[i % em.length];
      s.style.left = Math.random() * 100 + '%';
      s.style.animationDuration = 9 + Math.random() * 10 + 's'; s.style.animationDelay = -Math.random() * 18 + 's';
      s.style.fontSize = 22 + Math.random() * 30 + 'px'; bub.append(s);
    }
  }

  /* ================= walking paw-print background ================= */
  const cv = $('#paws'), ctx = cv.getContext('2d');
  let W, Hh, dpr;
  const size = () => { dpr = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * dpr; Hh = cv.height = innerHeight * dpr; };
  size(); addEventListener('resize', size);
  const css = v => getComputedStyle(root).getPropertyValue(v).trim();
  let colors = [];
  const syncColors = () => colors = [css('--teal'), css('--plum')];
  syncColors(); new MutationObserver(syncColors).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  const drawPaw = (x, y, ang, s, alpha, color) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang + Math.PI / 2); ctx.scale(s, s);
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 6, 9, 7.5, 0, 0, Math.PI * 2); ctx.fill();
    [[-10, -5, 3.6, 4.6, -.35], [-3.6, -11, 3.8, 4.9, -.1], [3.6, -11, 3.8, 4.9, .1], [10, -5, 3.6, 4.6, .35]]
      .forEach(([tx, ty, rx, ry, r]) => { ctx.beginPath(); ctx.ellipse(tx, ty, rx, ry, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.restore();
  };
  const trails = [];
  const spawn = () => {
    const edge = Math.floor(Math.random() * 4), m = 40 * dpr;
    let x, y, a;
    if (edge === 0) { x = -m; y = Math.random() * Hh; a = (Math.random() - .5) * 1.2; }
    else if (edge === 1) { x = W + m; y = Math.random() * Hh; a = Math.PI + (Math.random() - .5) * 1.2; }
    else if (edge === 2) { x = Math.random() * W; y = -m; a = Math.PI / 2 + (Math.random() - .5) * 1.2; }
    else { x = Math.random() * W; y = Hh + m; a = -Math.PI / 2 + (Math.random() - .5) * 1.2; }
    trails.push({ x, y, a, turn: (Math.random() - .5) * .05, step: 0, prints: [], next: 0,
      s: (.8 + Math.random() * .7) * dpr, color: colors[Math.floor(Math.random() * colors.length)], gap: 300 + Math.random() * 160 });
  };
  const LIFE = 5200, MAXA = .13;
  let lastT = performance.now(), spawnAt = 0;
  const frame = t => {
    const dt = t - lastT; lastT = t;
    ctx.clearRect(0, 0, W, Hh);
    if (t > spawnAt && trails.length < (innerWidth < 700 ? 2 : 4)) { spawn(); spawnAt = t + 1400 + Math.random() * 2200; }
    for (let i = trails.length - 1; i >= 0; i--) {
      const tr = trails[i];
      tr.next -= dt;
      const inside = tr.x > -80 * dpr && tr.x < W + 80 * dpr && tr.y > -80 * dpr && tr.y < Hh + 80 * dpr;
      if (tr.next <= 0 && (inside || tr.step < 3)) {
        tr.a += tr.turn + (Math.random() - .5) * .08;
        const stride = 34 * tr.s, side = tr.step % 2 ? 1 : -1, off = 11 * tr.s;
        tr.x += Math.cos(tr.a) * stride; tr.y += Math.sin(tr.a) * stride;
        tr.prints.push({ x: tr.x + Math.cos(tr.a + Math.PI / 2) * off * side, y: tr.y + Math.sin(tr.a + Math.PI / 2) * off * side, a: tr.a, born: t });
        tr.step++; tr.next = tr.gap;
      }
      tr.prints = tr.prints.filter(p => t - p.born < LIFE);
      tr.prints.forEach(p => {
        const age = (t - p.born) / LIFE, alpha = age < .08 ? age / .08 : 1 - (age - .08) / .92;
        drawPaw(p.x, p.y, p.a, tr.s * (age < .08 ? .7 + age / .08 * .3 : 1), alpha * MAXA, tr.color);
      });
      if (!inside && tr.step >= 3 && !tr.prints.length) trails.splice(i, 1);
    }
    if (!document.hidden) requestAnimationFrame(frame); else running = false;
  };
  let running = false;
  if (reduce) {
    // static scatter of prints
    syncColors();
    for (let i = 0; i < 18; i++) drawPaw(Math.random() * W, Math.random() * Hh, Math.random() * 6.28, dpr, .07, colors[i % 2]);
  } else {
    running = true; requestAnimationFrame(frame);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !running) { running = true; lastT = performance.now(); requestAnimationFrame(frame); } });
  }
})();

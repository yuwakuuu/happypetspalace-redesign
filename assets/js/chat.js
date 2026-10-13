/* Duke — the pup concierge.
   Answers FAQs from the Palace's published policies, runs guided booking + pre-screen scheduling,
   and hands off to MoeGo booking / email / phone. No server needed.

   Optional: set window.HPP_AI_ENDPOINT = 'https://your-endpoint' before this script loads to send
   questions Duke can't answer to an AI backend. It receives POST {question, history} and should
   return JSON {answer: "<html or text>"}. Keep API keys on that server, never in this file. */
(() => {
  const HPP = window.HPP, $ = s => document.querySelector(s);
  const sfx = (n, p) => window.HPPSfx && window.HPPSfx.play(n, p);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fab = $('#dogFab'), chat = $('#chat'), body = $('#chatBody'), form = $('#chatForm'), input = $('#chatIn'), nudge = $('#nudge');
  const L = HPP.locs, P = HPP.price;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '$' + n.toLocaleString();
  const history = [];
  let flow = null, busy = false, started = false;

  /* ---------------- UI primitives ---------------- */
  const scroll = () => { const go = () => body.scrollTop = body.scrollHeight; go(); setTimeout(go, 60); setTimeout(go, 400); };
  const add = el => { body.append(el); scroll(); return el; };
  const el = (cls, html, tag = 'div') => { const d = document.createElement(tag); d.className = cls; d.innerHTML = html; return d; };
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const retireChips = () => body.querySelectorAll('.qr:not(.used)').forEach(q => q.classList.add('used'));

  const bot = async (html, delay) => {
    const t = add(el('msg bot typing', '<i></i><i></i><i></i>'));
    fab.classList.add('talk');
    await wait(delay ?? Math.min(1100, 350 + html.replace(/<[^>]+>/g, '').length * 6));
    t.remove(); fab.classList.remove('talk'); sfx('type');
    history.push({ role: 'assistant', text: html.replace(/<[^>]+>/g, ' ') });
    return add(el('msg bot', html));
  };
  const me = text => { sfx('pop', 1.2); history.push({ role: 'user', text }); return add(el('msg me', esc(text))); };
  const chips = list => {
    const q = el('qr', '');
    list.forEach(([label, act]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.onclick = () => { if (busy) return; q.classList.add('used'); typeof act === 'function' ? (me(label), act()) : send(act || label, label); };
      q.append(b);
    });
    return add(q);
  };
  /** inline form: fields = [{name,label,type,required,options,min,value,half}] */
  const askForm = (fields, submitLabel, validate) => new Promise(resolve => {
    const f = el('cform', '', 'form');
    let row = null;
    fields.forEach(fd => {
      const lab = document.createElement('label'); lab.textContent = fd.label;
      let inp;
      if (fd.type === 'select') { inp = document.createElement('select'); fd.options.forEach(([v, t]) => inp.add(new Option(t, v))); }
      else { inp = document.createElement('input'); inp.type = fd.type || 'text'; if (fd.min) inp.min = fd.min; if (fd.placeholder) inp.placeholder = fd.placeholder; }
      inp.name = fd.name; if (fd.required) inp.required = true; if (fd.value != null) inp.value = fd.value;
      lab.append(inp);
      if (fd.half) { if (!row) { row = el('row', ''); f.append(row); } row.append(lab); if (row.children.length === 2) row = null; }
      else { row = null; f.append(lab); }
    });
    const err = el('err', ''); f.append(err);
    const btn = el('btn sm', submitLabel, 'button'); btn.type = 'submit'; f.append(btn);
    f.onsubmit = e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(f));
      const msg = validate && validate(data);
      if (msg) { err.textContent = msg; err.style.display = 'block'; return; }
      [...f.elements].forEach(x => x.disabled = true); btn.remove();
      resolve(data);
    };
    add(f);
    setTimeout(() => f.querySelector('input,select')?.focus({ preventScroll: true }), 50);
  });
  const choose = (opts) => new Promise(resolve => chips(opts.map(([label, v]) => [label, () => resolve(v ?? label)])));
  const multi = (opts, doneLabel = 'Done ✓') => new Promise(resolve => {
    const q = el('qr', ''), picked = new Set();
    opts.forEach(([label, v]) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = label;
      b.onclick = () => { picked.has(v) ? picked.delete(v) : picked.add(v); b.style.background = picked.has(v) ? 'var(--teal-d)' : ''; b.style.color = picked.has(v) ? '#fff' : ''; };
      q.append(b);
    });
    const d = document.createElement('button'); d.type = 'button'; d.textContent = doneLabel; d.style.borderColor = 'var(--plum)';
    d.onclick = () => { q.classList.add('used'); me(picked.size ? opts.filter(o => picked.has(o[1])).map(o => o[0]).join(', ') : 'No extras'); resolve(picked); };
    q.append(d); add(q);
  });

  /* ---------------- dates ---------------- */
  const azToday = () => { const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Phoenix' }).format(new Date()); return s; }; // YYYY-MM-DD
  const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const nice = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const nthDow = (y, m, dow, n) => { const d = new Date(y, m, 1); let c = 0; while (true) { if (d.getDay() === dow && ++c === n) return d; d.setDate(d.getDate() + 1); } };
  const lastDow = (y, m, dow) => { const d = new Date(y, m + 1, 0); while (d.getDay() !== dow) d.setDate(d.getDate() - 1); return d; };
  const holidays = y => ({ [iso(new Date(y, 0, 1))]: "New Year's Day", [iso(lastDow(y, 4, 1))]: 'Memorial Day', [iso(new Date(y, 6, 4))]: 'July 4th',
    [iso(nthDow(y, 8, 1, 1))]: 'Labor Day', [iso(nthDow(y, 10, 4, 4))]: 'Thanksgiving', [iso(new Date(y, 11, 25))]: 'Christmas Day' });
  const holidayOf = d => holidays(d.getFullYear())[iso(d)];

  /* ---------------- handoff helpers ---------------- */
  const mailto = (loc, subject, lines) => `mailto:${L[loc].mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  const recap = (title, rows, totalHtml, actions, note) => {
    sfx('sparkle');
    const r = el('recap', `<h4>${title}</h4>${rows.map(([a, b]) => `<div class="rl"><span>${a}</span><span>${b}</span></div>`).join('')}
      ${totalHtml ? `<div class="tot">${totalHtml}</div>` : ''}${note ? `<p class="mini" style="margin-top:6px;font-size:13px;color:var(--ink-2)">${note}</p>` : ''}<div class="acts"></div>`);
    const acts = r.querySelector('.acts');
    actions.forEach(([label, href, cls, onClick]) => {
      const a = document.createElement(href ? 'a' : 'button'); a.className = 'btn sm ' + (cls || ''); a.innerHTML = label;
      if (href) { a.href = href; if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; } }
      if (onClick) a.addEventListener('click', onClick);
      acts.append(a);
    });
    return add(r);
  };

  /* ---------------- flows ---------------- */
  const runFlow = async fn => { flow = fn.name; busy = false; try { await fn(); } finally { flow = null; } };

  async function booking() {
    await bot("Let's get your pup booked! 🐾 What are we planning?");
    const svc = await choose([['🏰 Overnight boarding', 'board'], ['🎾 Daycare', 'day'], ['🐶 Puppy daycare', 'puppy'], ['🛁 Spa / bath', 'spa'], ['🎓 AKC training', 'train'], ['📋 First-visit pre-screen', 'pre']]);
    if (svc === 'pre') return prescreen();
    if (svc === 'spa' || svc === 'train') return simpleService(svc);

    await bot('Has your dog already passed our pre-screening evaluation with us?');
    const vet = await choose([['Yes, we\'re regulars 💜', 'y'], ['No, we\'re new', 'n']]);
    if (vet === 'n') {
      await bot('Welcome! Every new dog starts with a friendly <b>pre-screening</b> on their first day of daycare (3–4 hours, regular daycare rates). Boarding dogs do it too. Want me to set that up first?');
      const go = await choose([['📋 Schedule pre-screen', 'pre'], ['Continue anyway', 'go']]);
      if (go === 'pre') return prescreen();
    }
    await bot('Which location works best for you?');
    const loc = await choose([['📍 Mesa', 'mesa'], ['📍 Chandler', 'chandler']]);
    if (svc === 'board') return boardingDetails(loc, vet === 'n');
    return daycareDetails(loc, svc === 'puppy', vet === 'n');
  }

  async function boardingDetails(loc, isNew) {
    await bot(`Great — <b>${L[loc].name}</b>! Tell me about the stay. Check-out is 10:30 AM.`);
    const today = azToday();
    const d = await askForm([
      { name: 'in', label: 'Check-in', type: 'date', required: true, min: today, half: true },
      { name: 'out', label: 'Check-out', type: 'date', required: true, min: today, half: true },
      { name: 'dogs', label: 'Dogs sharing a villa', type: 'select', options: [['1', '1 dog'], ['2', '2 dogs'], ['3', '3 dogs'], ['4', '4 dogs']], half: true },
      { name: 'pets', label: "Dog name(s)", required: true, placeholder: 'e.g. Biscuit', half: true },
      { name: 'name', label: 'Your name', required: true, half: true },
      { name: 'phone', label: 'Phone', type: 'tel', placeholder: 'optional', half: true }
    ], 'Next →', v => {
      if (v.in < today) return 'Check-in can’t be in the past.';
      if (v.out <= v.in) return 'Check-out needs to be after check-in.';
      if ((parseD(v.out) - parseD(v.in)) / 864e5 > 60) return 'For stays over 60 nights, please call us at ' + HPP.phone + '.';
    });
    const inD = parseD(d.in), outD = parseD(d.out), nights = Math.round((outD - inD) / 864e5), dogs = +d.dogs;
    me(`${nice(inD)} → ${nice(outD)} · ${dogs} dog${dogs > 1 ? 's' : ''} · ${d.pets}`);
    await bot(`${nights} night${nights > 1 ? 's' : ''} — ${esc(d.pets)} is going to love it! Any extras?`);
    const ex = await multi([['⭐ Deluxe (+$25/night)', 'deluxe'], ['📹 Camera Villa (+$10/night)', 'cam'], ['🎾 Group play ($24/day)', 'play'], ['🕡 Late checkout ($24)', 'late'], ['🎖️ Military discount', 'military']]);
    const opts = { dogs, nights, deluxe: ex.has('deluxe'), cam: ex.has('cam'), play: ex.has('play'), late: ex.has('late'), military: ex.has('military') };
    const e = HPP.estimate(opts);
    const hol = holidayOf(outD), notes = [];
    if (hol) notes.push(`Pickup falls on ${hol}: holiday hours 8–10:30 AM / 4–6:30 PM, plus a $20 lobby fee.`);
    if (outD.getDay() === 0 && !hol) notes.push('Sunday pickup hours are 8–10:30 AM and 4–6:30 PM.');
    if (isNew) notes.push('New dogs need a pre-screen before their first night.');
    notes.push('Estimate before tax — our team confirms your final price.');
    const extrasTxt = [...ex].filter(x => x !== 'military').map(x => ({ deluxe: 'Deluxe', cam: 'Camera Villa', play: 'Group play', late: 'Late checkout' }[x])).join(', ') || 'None';
    await bot('Here’s your stay — tap <b>Book online</b> to lock it in, or send it to the front desk. 👑');
    const lines = [`Hi ${L[loc].name} team! I'd like to request a boarding stay.`, '', `Name: ${d.name}`, `Phone: ${d.phone || '-'}`, `Dog(s): ${d.pets} (${dogs})`,
      `Check-in: ${nice(inD)}`, `Check-out: ${nice(outD)} (${nights} nights)`, `Extras: ${extrasTxt}${opts.military ? ' + military discount' : ''}`, `Website estimate: ${money(e.total)}`, isNew ? '\nWe are new clients and will need a pre-screen.' : '', '', 'Sent from the website concierge'];
    recap(`🏰 Boarding · ${L[loc].name}`, [
      ['Dates', `${nice(inD)} → ${nice(outD)}`], ['Dogs', `${esc(d.pets)} (${dogs})`],
      [`${dogs} × ${nights} nights @ $${e.rate}`, money(e.base)], ...(e.disc ? [[e.disc.label, '−' + money(e.disc.amt)]] : []),
      ['Extras', `${extrasTxt} · ${money(e.add)}`]
    ], `Est. ${money(e.total)}`, [
      ['Book online →', L[loc].book],
      ['✉️ Email this request', mailto(loc, `Boarding request: ${d.pets}, ${nice(inD)} to ${nice(outD)}`, lines), 'teal'],
      ['📅 Add to my calendar', null, 'ghost', () => HPP.ics(`${d.pets} boarding at Happy Pets Palace ${L[loc].name}`, new Date(inD.getFullYear(), inD.getMonth(), inD.getDate(), 8), new Date(outD.getFullYear(), outD.getMonth(), outD.getDate(), 10, 30), L[loc].q, `Check-out by 10:30 AM. Call ${HPP.phone}`)],
      [`📞 Call ${HPP.phone}`, 'tel:' + HPP.tel, 'ghost']
    ], notes.join(' '));
    chips([['What should I pack?', 'what should I pack'], ['Cancellation policy', 'cancellation'], ['Start over', () => runFlow(booking)]]);
  }

  async function daycareDetails(loc, puppy, isNew) {
    await bot(`${puppy ? 'Puppy playdate' : 'Daycare'} at <b>${L[loc].name}</b> — which day?`);
    const today = azToday();
    const d = await askForm([
      { name: 'date', label: 'Day', type: 'date', required: true, min: today, half: true },
      { name: 'len', label: 'Length', type: 'select', options: puppy ? [['pw', 'Puppy Wednesday (6mo–1yr) · $33'], ['pd', 'Puppy Day (under 6mo) · $30']] : [['full', 'Full day · $38'], ['half', 'Half day · $33']], half: true },
      { name: 'pets', label: 'Dog name', required: true, half: true },
      { name: 'name', label: 'Your name', required: true, half: true }
    ], 'Next →', v => { if (v.date < today) return 'Please choose today or a future date.'; if (v.len === 'pw' && parseD(v.date).getDay() !== 3) return 'Puppy Wednesday pricing is only on Wednesdays 😉'; });
    const day = parseD(d.date), dow = day.getDay();
    const price = { full: P.daycare.full, half: P.daycare.half, pw: P.daycare.puppyWed, pd: P.daycare.puppy }[d.len];
    const label = { full: 'Full day (up to 12 hrs)', half: 'Half day (up to 5 hrs, pickup by 3 PM)', pw: 'Puppy Wednesday', pd: 'Puppy Day' }[d.len];
    me(`${nice(day)} · ${label} · ${d.pets}`);
    const notes = [];
    if (dow === 0) notes.push('Sunday daycare is limited — please call ahead to check availability.');
    if (dow === 6) notes.push('Daycare runs Monday–Friday — please call to check Saturday availability.');
    if (holidayOf(day)) notes.push(`${holidayOf(day)} has holiday hours — please call ahead.`);
    if (!isNew && dow >= 1 && dow <= 5) notes.push('Good news: once pre-screened, regular weekday daycare needs no reservation — just drop by between 6 AM and 6:30 PM!');
    if (isNew) notes.push('This will be your pre-screen day (3–4 hrs). Pre-screens run Mon, Tue, Thu & Fri with advance notice.');
    if (d.len === 'full' || d.len === 'pw') notes.push('High-energy pups do best dropped off by 9 AM.');
    await bot(`All set to send! 🎾`);
    recap(`🎾 ${puppy ? 'Puppy daycare' : 'Daycare'} · ${L[loc].name}`, [['Day', nice(day)], ['Dog', esc(d.pets)], ['Plan', label]], money(price), [
      ['Book online →', L[loc].book],
      ['✉️ Email this request', mailto(loc, `Daycare: ${d.pets} on ${nice(day)}`, [`Hi ${L[loc].name} team!`, '', `Name: ${d.name}`, `Dog: ${d.pets}`, `Day: ${nice(day)}`, `Plan: ${label}`, isNew ? 'We are new and need a pre-screen.' : '', '', 'Sent from the website concierge']), 'teal'],
      ['📅 Add to my calendar', null, 'ghost', () => HPP.ics(`${d.pets} daycare at Happy Pets Palace`, new Date(day.getFullYear(), day.getMonth(), day.getDate(), 8), new Date(day.getFullYear(), day.getMonth(), day.getDate(), d.len === 'half' ? 13 : 17), L[loc].q, label)],
      [`📞 Call ${HPP.phone}`, 'tel:' + HPP.tel, 'ghost']
    ], notes.join(' '));
    chips([['Daycare packages', 'daycare packages'], ['Start over', () => runFlow(booking)]]);
  }

  async function prescreen() {
    await bot('Let’s schedule your pup’s <b>pre-screening</b> 📋 It happens on their first day of daycare and takes about 3–4 hours. Which location?');
    const loc = await choose([['📍 Mesa', 'mesa'], ['📍 Chandler', 'chandler']]);
    await bot('Tell me a little about your dog:');
    const d = await askForm([
      { name: 'pets', label: "Dog's name", required: true, half: true },
      { name: 'breed', label: 'Breed', required: true, half: true },
      { name: 'age', label: 'Age', required: true, placeholder: 'e.g. 2 years', half: true },
      { name: 'fixed', label: 'Spayed / neutered?', type: 'select', options: [['yes', 'Yes'], ['no', 'Not yet'], ['young', 'Under 2 — not yet']], half: true },
      { name: 'name', label: 'Your name', required: true, half: true },
      { name: 'phone', label: 'Phone', type: 'tel', required: true, half: true }
    ], 'Next →');
    me(`${d.pets} · ${d.breed} · ${d.age}`);
    if (d.fixed === 'no') await bot('Quick heads-up: dogs need to be spayed/neutered by <b>2 years old</b> to join group play. If your pup is over 2, please give us a call first. 💜');
    // next 8 eligible days: Mon, Tue, Thu, Fri (not today — advance notice required)
    const opts = [], cur = parseD(azToday());
    while (opts.length < 8) { cur.setDate(cur.getDate() + 1); if ([1, 2, 4, 5].includes(cur.getDay()) && !holidayOf(cur)) opts.push(new Date(cur)); }
    await bot(`Pre-screens run <b>Mon, Tue, Thu & Fri</b>. Which day works for ${esc(d.pets)}?`);
    const day = await choose(opts.map(o => [nice(o), o]));
    await bot('And how long should the first day be?');
    const len = await choose([['Half day · $33 (pickup by 3 PM)', 'half'], ['Full day · $38', 'full']]);
    await bot('Arrival time?');
    const arr = await choose([['Early (by 9 AM) — recommended', '8:30 AM'], ['Mid-morning (by 10 AM)', '10:00 AM']]);
    const lines = [`Hi ${L[loc].name} team! I'd like to schedule a pre-screening.`, '', `Name: ${d.name}`, `Phone: ${d.phone}`, `Dog: ${d.pets} (${d.breed}, ${d.age})`, `Spayed/neutered: ${d.fixed}`,
      `Preferred day: ${nice(day)}, arriving ~${arr}`, `Plan: ${len === 'half' ? 'Half day' : 'Full day'}`, '', 'Sent from the website concierge'];
    await bot('Pawsome! Pre-screens need advance notice, so <b>send this request or give us a call</b> and the team will confirm your time. 🐾');
    const h = arr.startsWith('8') ? [8, 30] : [10, 0];
    recap(`📋 Pre-screen request · ${L[loc].name}`, [['Dog', `${esc(d.pets)} (${esc(d.breed)})`], ['Day', nice(day)], ['Arrival', arr], ['Plan', len === 'half' ? 'Half day' : 'Full day']],
      money(len === 'half' ? P.daycare.half : P.daycare.full), [
      ['✉️ Send request', mailto(loc, `Pre-screen request: ${d.pets} on ${nice(day)}`, lines)],
      [`📞 Call to confirm`, 'tel:' + HPP.tel, 'teal'],
      ['📅 Hold it on my calendar', null, 'ghost', () => HPP.ics(`${d.pets} pre-screen at Happy Pets Palace (pending)`, new Date(day.getFullYear(), day.getMonth(), day.getDate(), h[0], h[1]), new Date(day.getFullYear(), day.getMonth(), day.getDate(), h[0] + 4, h[1]), L[loc].q, 'Pending confirmation from Happy Pets Palace. Bring vaccine records and a quick-release collar.')],
      ['📝 New client forms', 'new-clients.html', 'ghost']
    ], 'Bring: rabies & distemper records, a plastic quick-release collar. Puppies under 6 months need a clear fecal test.');
    chips([['What should I bring?', 'what to bring for pre-screen'], ['Vaccines', 'vaccines']]);
  }

  async function simpleService(svc) {
    const info = svc === 'spa'
      ? ['🛁 Spa services', 'Baths and grooming to send your pup home fresh and fluffy.', 'spa.html']
      : ['🎓 AKC training', 'AKC training courses — class dates live on our events calendar.', 'dog-training.html'];
    await bot(`<b>${info[0]}</b> — ${info[1]} Which location?`);
    const loc = await choose([['📍 Mesa', 'mesa'], ['📍 Chandler', 'chandler']]);
    recap(`${info[0]} · ${L[loc].name}`, [['Details & pricing', 'See service page']], '', [
      ['Book online →', L[loc].book], ['See details', info[2], 'teal'], [`📞 Call ${HPP.phone}`, 'tel:' + HPP.tel, 'ghost']]);
  }

  /* ---------------- knowledge base ---------------- */
  const hoursHtml = () => { const s = HPP.status(); return `<b>${s.open ? '🟢' : '🔴'} ${s.text}</b> (both locations)<ul><li>Mon–Fri: 6:00 AM – 6:30 PM</li><li>Saturday: 8:00 AM – 6:30 PM</li><li>Sunday & holidays: 8–10:30 AM and 4–6:30 PM</li></ul><div class="mini">Boarding pickup/drop-off is available 365 days a year.</div>`; };
  const KB = [
    { k: [/^(hi|hey|hello|howdy|yo|sup)\b/, /good (morning|afternoon|evening)/], a: () => 'Woof woof! 🐶 I’m Duke. Ask me anything about the Palace, or let me help you book.', c: 'home' },
    { k: [/^(thanks|thank you|thx|ty)\b|thanks!?$|awesome|perfect/], a: 'Anytime! *happy tail wag* 🐾 Anything else?', c: 'home' },
    { k: [/where|address|located|location|directions|map|near me/], a: () => `We have two palaces:<ul><li><b>Mesa</b> — 1918 E McKellips Rd, Mesa 85203</li><li><b>Chandler</b> — 1080 E Pecos Rd, Suite 16, Chandler 85225</li></ul>Same services, same rates — pick the shorter drive! <a href="mesa.html">Mesa</a> · <a href="chandler.html">Chandler</a>` },
    { k: [/phone|call|contact|email|reach|number/], a: () => `📞 <a href="tel:${HPP.tel}">${HPP.phone}</a> (both locations)<br>✉️ Mesa: <a href="mailto:${L.mesa.mail}">${L.mesa.mail}</a><br>✉️ Chandler: <a href="mailto:${L.chandler.mail}">${L.chandler.mail}</a>` },
    { k: [/board/, /overnight/, /per night|nightly|a night/, /stay/], a: () => `🏰 <b>Boarding</b> (per dog, per night):<ul><li>1 dog — $48</li><li>2 dogs — $44 each</li><li>3 dogs — $43 each</li><li>4 dogs — $42 each</li></ul>Add-ons: Deluxe +$25/night · Camera Villa +$10/night · Group play $24/day · Late checkout $24. Meds are free!`, c: 'board' },
    { k: [/daycare|day care|full day|half day/], a: () => `🎾 <b>Daycare</b>:<ul><li>Full day (up to 12 hrs) — $38</li><li>Half day (up to 5 hrs, pickup by 3 PM) — $33</li><li>Puppy Wednesdays (6mo–1yr) — $33</li><li>Puppy Days (under 6mo) — $30</li></ul>Mon–Fri 6 AM – 6:30 PM. After pre-screening, no reservation needed!`, c: 'day' },
    { k: [/package|bulk|punch|royal invitation/], a: '👑 <b>Royal Invitation Packages</b> (full days, expire in 3 months):<ul><li>5 days $175 ($35/day)</li><li>10 days $330 ($33/day)</li><li>15 days $465 ($31/day)</li><li>20 days $600 ($30/day)</li><li>30 days $870 ($29/day)</li><li>40 days $1,120 ($28/day)</li></ul>' },
    { k: [/pupp(y|ies)/, /wednesday/, /young/, /weeks? old/], a: '🐶 Puppies can join from <b>10 weeks old</b>! Puppy Days (under 6 months) are $30 any day, and <b>Puppy Wednesdays</b> give puppies 6mo–1yr a full day for $33. Puppies need one set of vaccines at least 7 days before their first visit and a clear fecal test if under 6 months.' },
    { k: [/vacc|shot|rabies|distemper|bordetella|titer|parvo/], a: '💉 All dogs need current <b>rabies and distemper</b>, documented by a licensed vet. We suggest at least one <b>Bordetella</b> for puppies, and we happily accept <b>titers</b> for distemper to avoid over-vaccinating.' },
    { k: [/spay|neuter|fixed|intact|in heat|in season/], a: '✂️ Dogs must be spayed or neutered by <b>2 years old</b>, and females can’t be in season during their visit.' },
    { k: [/collar|harness|sweater|leash/], a: '🔗 We require a <b>plastic quick-release (snap-and-go) collar</b> — buckle collars are dangerous in group play. Harnesses come off during play and boarding. Sweaters are welcome!' },
    { k: [/pre.?screen|evaluat|assess|meet (and|&) greet|temperament test|first (day|visit|time)|new (client|customer|dog)/], a: '📋 Every new dog does a <b>5-step pre-screen</b> on their first daycare day (3–4 hrs, regular daycare rates): say hello → leash intros → join the group → pack feedback → two-staff sign-off. Pre-screens run <b>Mon, Tue, Thu & Fri</b> with advance notice.', c: 'pre' },
    { k: [/tour|visit|look around|see the facility/], a: '🏰 Yes — we <b>LOVE</b> giving tours! Stop by any time we’re open, no appointment needed.' },
    { k: [/check.?out|pick.?up|late/], a: '🕡 Boarding checkout is <b>10:30 AM</b>. Late checkout until 6:30 PM is <b>$24</b>. Half-day daycare pickup is by 3 PM; full-day by 6:30 PM.' },
    { k: [/check.?in|drop.?off|early/], a: '🌅 Drop-off/check-in starts at <b>6 AM</b> weekdays and <b>8 AM</b> weekends & holidays — no early drop-off fee.' },
    { k: [/holiday|christmas|thanksgiving|new year|july 4|labor day|memorial/], a: '🎉 We’re open 365 days for boarding pickup & drop-off. Holiday hours are 8–10:30 AM and 4–6:30 PM. Pickup on New Year’s, Memorial Day, July 4th, Labor Day, Thanksgiving or Christmas has a <b>$20</b> lobby fee.' },
    { k: [/cancel|refund|reschedul/], a: '📆 For boarding, please cancel at least <b>48 hours</b> before the first night.' },
    { k: [/military|veteran|discount|multi.?dog|deal|coupon|sale/], a: '💸 Discounts: <ul><li>Multi-dog villa rates ($44/$43/$42)</li><li>5% off 11+ consecutive nights</li><li>10% U.S. Military (with government ID) on boarding & full-price daycare</li></ul>Discounts can’t be combined, and military doesn’t apply to baths, add-ons or packages.' },
    { k: [/med(s|ication|icine)|pill|insulin/], a: '💊 Medications are given at <b>no extra charge</b>. Pack an extra day’s worth in case travel plans change.' },
    { k: [/food|feed|\beat\b|meal|diet/], a: '🥣 Please bring your dog’s own food to keep their diet consistent — a little extra for active players. In-house food is available at $2/cup.' },
    { k: [/pack|bring|need to bring/], a: '🎒 For boarding bring: their own food (+ an extra day), any meds, and a plastic quick-release collar. For a pre-screen: vaccine records (rabies & distemper) and the collar. Harnesses come off during play.' },
    { k: [/\bcam(era)?s?\b|webcam|watch|video|live stream|see my dog/], a: '📹 Live-stream webcams run at both locations! Add a <b>Camera View Villa</b> to boarding for 24/7 viewing (+$10/night), or get a 30-second video texted for $10. <a href="webcams.html">About our webcams →</a>' },
    { k: [/deluxe|one.?on.?one|1.?on.?1|cuddle/], a: '⭐ <b>Deluxe boarding</b> adds daily one-on-one time and a short video for +$25/night. À la carte: Cuddles in Villa $15, 1-on-1 Fetch $15, Enrichment $15, Treadmill $20.' },
    { k: [/sick|ill|kennel cough|disease|clean|sanit|hygien/], a: '🧼 Risk is low for healthy dogs. We require vaccines, sanitize indoors daily, clean yards twice daily, and use air scrubbers and solid-wall villas. Ask for extra rest during boarding if your pup needs it.' },
    { k: [/flea|tick|parasite|mite/], a: '🐛 Dogs must be free of fleas, ticks and ear mites. If we find any, the bath and removal can cost up to $80 depending on severity and size.' },
    { k: [/bully|pit ?bull|breed|small dog|teacup|tiny|big dog|large dog|aggressive|reactive/], a: '⚖️ Dogs are grouped by size and temperament across separate yards. Teacup pups (10 lb and under) have their own space. We’re one of the few facilities that welcome <b>bully breeds</b>! All dogs must be suitable for group play.' },
    { k: [/\bforms?\b|paperwork|waiver|sign.?up|register/], a: '📝 You’ll need a <b>Client Profile</b>, <b>Pet Profile</b> and <b>Waiver & Release</b>. <a href="new-clients.html">Start new client sign-up →</a>' },
    { k: [/event|meetup|meet up|dog park|social|saturday/], a: '🎉 <b>Free Saturday meetups</b> start Nov 21 at Ruff Ranch Dog Park (Painted Sky Park, Apache Junction):<ul><li>8–9:30 AM Toy Breeds (up to 20 lb)</li><li>10–11:30 AM Featured Breed Group</li><li>12–1:30 PM Large-Breed Puppy Social (under 6mo)</li></ul>You stay with your dog. <a href="events.html">Details →</a>' },
    { k: [/train|akc|obedien|class|manners/], a: '🎓 We offer <b>AKC training courses</b> plus our Canine Enrichment daycare program. <a href="dog-training.html">See courses →</a>' },
    { k: [/spa|bath|groom|nail|wash|de-?shed|doodle|facial/], a: '🛁 Spa services are added to a daycare or boarding day. Baths by weight:<ul><li><b>Dog bath</b> $35 (≤20 lb) · $45 (≤40) · $60 (≤80) · $70 (≤95) · $80 (95+)</li><li><b>Doodle bath</b> $55 · $65 · $85 · $115 · inquire</li><li><b>De-shed bath</b> $55 · $80 · $110 · $125 · $140</li></ul>Nail trim $20 · teeth brushing $10 · blueberry facial $15 · paw balm $15. Coat condition can affect price. <a href="spa.html">Full spa menu →</a>' },
    { k: [/\brv\b|camper|road trip|adventure/], a: '🚐 Yes, we rent an <b>Adventure RV</b>! <a href="adventure-rv.html">Learn more →</a>' },
    { k: [/portrait|photo|picture/], a: '📸 Our <b>Portrait Studio</b> does seasonal shoots. <a href="portrait-studio.html">See the studio →</a>' },
    { k: [/academy|career|job|hiring|work (here|for you)|employ/], a: '🏅 Check out our <b>Pet Professional Academy</b> for pet-care careers. <a href="pet-professional-academy.html">Learn more →</a>' },
    { k: [/staff|team|manager|employee|who works|linda|amber|lucy/], a: '👋 Our managers are <b>Linda, Amber and Lucy</b>, leading a pack of 25+ pet care specialists — all trained in pet CPR, first aid and canine body language. <a href="staff.html">Meet the team →</a>' },
    { k: [/\bpay|credit|cash|\bchecks?\b(?![- ]?(in|out))|visa|amex|card/], a: '💳 We accept cash, check, Visa, American Express, Mastercard & Discover.' },
    { k: [/treat|kong|ice cream|trachea|snack/], a: '🍦 Treats: PB Pumpkin Frozen Kong $5 · Doggy Ice Cream $6 · Beef Trachea $7.' },
    { k: [/story|owner|founder|history|started|ria/], a: '💜 It all began with Ria, an abandoned Lab–Border Collie puppy. Our founder opened her first facility in 2008, then Mesa on Aug 22, 2014 and Chandler on Dec 12, 2018. <a href="about.html">Read more →</a>' },
    { k: [/potty|10 ?pm|night time|overnight check|sleep/], a: '🌙 Every boarder gets an outdoor potty break around <b>10 PM</b> and a check by late-night staff.' },
    { k: [/pool|swim|bubble|agility|play|activit/], a: '🏊 Daily fun: above-ground splash pools, playground & agility gear, chasing bubbles and afternoon <b>story hour</b> — plus fresh water every hour.' },
    { k: [/\bcats?\b|kitten|rabbit|bird/], a: '🐾 Our programs are built around dogs. For other pets, please give us a call at ' + HPP.phone + '.' },
    { k: [/review|rating|google|best/], a: '⭐ Voted <b>Best Pet Boarding Services in Mesa</b> six years running, and top-rated on Google. <a href="reviews.html">Read reviews →</a>' },
    { k: [/\bhours?\b/, /\bopen\b/, /\bclose[sd]?\b/, /what time/, /today/], a: hoursHtml }
  ];
  const FOLLOW = {
    home: [['📅 Book a stay', 'book'], ['💲 Prices', 'prices'], ['🕐 Hours', 'hours'], ['📋 New client?', 'pre-screen']],
    board: [['📅 Book boarding', 'book'], ['🧮 Estimate 3 nights', 'estimate 3 nights 1 dog']],
    day: [['📅 Book daycare', 'book'], ['Packages', 'packages']],
    pre: [['📅 Schedule a pre-screen', 'schedule pre-screen'], ['Requirements', 'vaccines']]
  };

  const answer = async raw => {
    const t = raw.toLowerCase().trim();
    // flows run detached so chat input stays responsive while they wait on the user
    if (/(schedul|book|set up|make).*(pre.?screen|evaluat|meet (and|&) greet|first day)|^schedule pre/.test(t)) return void runFlow(prescreen);
    if (/\b(book|booking|reserve|reservation|schedule|appointment|sign me up)\b/.test(t) && !/policy|cancel/.test(t)) return void runFlow(booking);
    // quick estimate
    const nm = t.match(/(\d+)\s*(nights?|days?)/);
    if (nm && /(estimate|cost|price|how much|board|night)/.test(t)) {
      const nights = Math.min(60, +nm[1]), dm = t.match(/(\d+)\s*dogs?/), dogs = dm ? Math.min(4, Math.max(1, +dm[1])) : 1;
      const e = HPP.estimate({ dogs, nights, military: /military|veteran/.test(t) });
      await bot(`🧮 ${dogs} dog${dogs > 1 ? 's' : ''} × ${nights} night${nights > 1 ? 's' : ''} @ $${e.rate} = <b>${money(e.base)}</b>${e.disc ? `<br>${e.disc.label}: −${money(e.disc.amt)}` : ''}<br><b>Estimated ${money(e.total)}</b> before add-ons.<div class="mini">Group play +$24/dog/day · Camera Villa +$10/night · Deluxe +$25/night</div>`);
      return chips([['📅 Book this', 'book'], ['Add-on prices', 'deluxe']]);
    }
    // score KB: most regex hits wins, ties go to the earlier (more specific) entry
    let best = null, bestScore = 0;
    KB.forEach(e => { const s = e.k.reduce((n, r) => n + (r.test(t) ? 1 : 0), 0); if (s > bestScore) { best = e; bestScore = s; } });
    if (!best && /price|pricing|rate|cost|how much|fee/.test(t)) {
      await bot('Happy to help! Which prices?');
      return chips([['🏰 Boarding', 'boarding price'], ['🎾 Daycare', 'daycare price'], ['👑 Packages', 'packages'], ['🍦 Treats & extras', 'treats']]);
    }
    if (best) {
      await bot(typeof best.a === 'function' ? best.a() : best.a);
      return chips(FOLLOW[best.c] || FOLLOW.home);
    }
    if (window.HPP_AI_ENDPOINT) {
      try {
        const r = await fetch(window.HPP_AI_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: raw, history: history.slice(-12) }) });
        const j = await r.json();
        if (j && j.answer) { await bot(j.answer); return chips(FOLLOW.home); }
      } catch {}
    }
    await bot(`Ruh-roh, I’m not sure about that one! 🐶 Our team can help at <a href="tel:${HPP.tel}">${HPP.phone}</a>, or try one of these:`);
    chips([['📅 Book a stay', 'book'], ['💲 Prices', 'prices'], ['💉 Requirements', 'vaccines'], ['🕐 Hours', 'hours'], ['📍 Locations', 'locations']]);
  };

  const send = async (text, shown) => {
    if (!text.trim() || busy) return;
    retireChips();
    body.querySelectorAll('.cform').forEach(f => [...f.elements].forEach(x => x.disabled = true)); // abandon any open flow form
    flow = null;
    me(shown || text);
    busy = true;
    try { await answer(text); } finally { busy = false; }
  };
  form.addEventListener('submit', e => { e.preventDefault(); const v = input.value; input.value = ''; send(v); });

  /* ---------------- open / close ---------------- */
  const greet = async () => {
    started = true;
    await bot('Woof! 🐶 I’m <b>Duke</b>, the Palace concierge. I can answer questions, estimate prices, and help you book a stay or schedule a first-visit pre-screen.', 500);
    chips(FOLLOW.home);
  };
  const open = async intent => {
    chat.classList.add('open'); fab.classList.add('open'); fab.setAttribute('aria-expanded', 'true'); sfx('open');
    nudge.classList.remove('show'); fab.querySelector('.badge-n')?.remove();
    try { sessionStorage.setItem('hpp-nudged', '1'); } catch {}
    if (intent) {
      if (!started) started = true;
      retireChips();
      if (intent === 'book') { me('I’d like to book'); runFlow(booking); }
      else if (intent === 'prescreen') { me('Schedule a pre-screen'); runFlow(prescreen); }
    } else if (!started) greet();
    setTimeout(() => input.focus({ preventScroll: true }), 300);
  };
  const close = () => { sfx('close'); chat.classList.remove('open'); fab.classList.remove('open'); fab.setAttribute('aria-expanded', 'false'); fab.focus(); };
  fab.addEventListener('click', () => chat.classList.contains('open') ? close() : open());
  $('#chatClose').addEventListener('click', close);
  $('#chatReset').addEventListener('click', () => { body.innerHTML = ''; history.length = 0; flow = null; busy = false; greet(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && chat.classList.contains('open')) close(); });
  document.querySelectorAll('[data-open-chat]').forEach(b => b.addEventListener('click', e => { e.preventDefault(); open(b.dataset.openChat); }));

  // friendly nudge once per session
  let nudged = false; try { nudged = !!sessionStorage.getItem('hpp-nudged'); } catch {}
  if (!nudged) setTimeout(() => {
    if (chat.classList.contains('open')) return;
    nudge.classList.add('show');
    const b = document.createElement('span'); b.className = 'badge-n'; b.textContent = '1'; fab.append(b);
    setTimeout(() => nudge.classList.remove('show'), 7000);
  }, 6000);
})();

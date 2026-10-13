/* Soft "elevator lounge" background music — generated live with Web Audio (no audio files).
   A gentle I–vi–ii–V loop in D (Dmaj9 · Bm9 · Em9 · A13) on a Rhodes-style electric piano, a mellow bass,
   whisper-quiet brushed hats and an improvised vibraphone line, through a soft reverb.
   Browsers only allow sound after the visitor's first tap/click, so it fades in then. Mute state persists. */
(() => {
  const M = window.HPPMusic = { on: true, playing: false };
  try { M.on = localStorage.getItem('hpp-music') !== 'off'; } catch {}
  const BPM = 74, BEAT = 60 / BPM, EIGHTH = BEAT / 2, SWING = EIGHTH * .32, VOL = .17;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const BARS = [ // [bass root, chord voicing]
    [38, [54, 57, 61, 64]],   // Dmaj9
    [35, [57, 61, 62, 66]],   // Bm9
    [40, [55, 59, 62, 66]],   // Em9
    [33, [55, 59, 61, 66]],   // A13
  ];
  const SCALE = [62, 64, 66, 69, 71, 74, 76, 78];   // D major pentatonic
  let ac, master, epBus, vibBus, verbSend, timer, nextT = 0, step = 0, melodyIdx = 3, listeners = [];
  const notify = () => listeners.forEach(f => f(M));
  M.subscribe = f => { listeners.push(f); f(M); };

  function build() {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0;
    const soft = ac.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 5200;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -20; comp.ratio.value = 3;
    master.connect(soft); soft.connect(comp); comp.connect(ac.destination);
    // reverb from a generated impulse
    const verb = ac.createConvolver(), len = ac.sampleRate * 2.6, ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir; verbSend = ac.createGain(); verbSend.gain.value = .32; verbSend.connect(verb); verb.connect(master);
    // electric piano bus with slow auto-pan
    epBus = ac.createGain(); epBus.gain.value = 1;
    const epTone = ac.createBiquadFilter(); epTone.type = 'lowpass'; epTone.frequency.value = 2300;
    const pan = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
    if (pan.pan) { const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = .18; lg.gain.value = .35; lfo.connect(lg); lg.connect(pan.pan); lfo.start(); }
    epBus.connect(epTone); epTone.connect(pan); pan.connect(master); pan.connect(verbSend);
    vibBus = ac.createGain(); vibBus.gain.value = 1; vibBus.connect(master); vibBus.connect(verbSend);
    return true;
  }

  const env = (g, t, a, peak, hold, rel) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(peak * .35, t + a, hold); g.gain.setTargetAtTime(0, t + a + hold * 2.2, rel); };
  function rhodes(t, midi, dur, vel) {
    const f = mtof(midi), car = ac.createOscillator(), mod = ac.createOscillator(), mg = ac.createGain(), g = ac.createGain();
    car.frequency.value = f; mod.frequency.value = f;
    mg.gain.setValueAtTime(f * 1.1 * vel, t); mg.gain.setTargetAtTime(f * .04, t, .18);   // bright "tine" attack that mellows
    mod.connect(mg); mg.connect(car.frequency);
    env(g, t, .012, .085 * vel, dur * .35, .5);
    car.connect(g); g.connect(epBus);
    car.start(t); mod.start(t); car.stop(t + dur + 2.5); mod.stop(t + dur + 2.5);
  }
  function bass(t, midi, dur) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = o2.frequency.value = mtof(midi);
    lp.type = 'lowpass'; lp.frequency.value = 420;
    env(g, t, .025, .2, dur * .4, .25);
    o.connect(g); o2.connect(lp); lp.connect(g); g.connect(master);
    o.start(t); o2.start(t); o.stop(t + dur + 1.5); o2.stop(t + dur + 1.5);
  }
  let noiseBuf;
  function brush(t, vel) {
    if (!noiseBuf) { noiseBuf = ac.createBuffer(1, ac.sampleRate * .3, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = 7200; bp.Q.value = .8;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.018 * vel, t + .008); g.gain.setTargetAtTime(0, t + .01, .05);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t); s.stop(t + .3);
  }
  function vibes(t, midi, dur) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), trem = ac.createOscillator(), tg = ac.createGain(), out = ac.createGain();
    o.frequency.value = mtof(midi); o2.frequency.value = mtof(midi) * 4.0; o2.type = 'sine';
    const g2 = ac.createGain(); g2.gain.value = .12;
    trem.frequency.value = 5.2; tg.gain.value = .35; out.gain.value = .65; trem.connect(tg); tg.connect(out.gain);
    env(g, t, .006, .06, dur * .5, .7);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out); out.connect(vibBus);
    [o, o2, trem].forEach(n => { n.start(t); n.stop(t + dur + 3); });
  }

  function schedule() {
    while (nextT < ac.currentTime + .25) {
      const bar = Math.floor(step / 8) % BARS.length, e = step % 8, [root, chord] = BARS[bar];
      const t = nextT + (e % 2 ? SWING : 0);
      // electric piano: soft chord on 1, a light "and-of-2" stab, occasional echo on 4
      if (e === 0) chord.forEach((n, i) => rhodes(t + i * .012, n, BEAT * 2.2, .9 - i * .08));
      if (e === 3) chord.slice(1).forEach((n, i) => rhodes(t + i * .01, n, BEAT * .7, .55));
      if (e === 6 && Math.random() < .5) chord.slice(2).forEach(n => rhodes(t, n + 12, BEAT * .5, .35));
      // bass: root on 1, fifth on 3, walking approach into the next bar
      if (e === 0) bass(t, root, BEAT * 1.6);
      if (e === 4) bass(t, root + 7, BEAT * 1.2);
      if (e === 7) bass(t, BARS[(bar + 1) % BARS.length][0] + (Math.random() < .5 ? 1 : -1), BEAT * .45);
      // brushed hats on every eighth, accents on 2 and 4
      brush(t, e === 2 || e === 6 ? 1 : .55);
      // vibraphone melody: a little improvised phrase, resting often
      const phraseBar = Math.floor(step / 8) % 8;
      if ((e === 0 || e === 3 || e === 5) && phraseBar < 6 && Math.random() < .42) {
        melodyIdx = Math.max(0, Math.min(SCALE.length - 1, melodyIdx + [-2, -1, -1, 1, 1, 2][Math.random() * 6 | 0]));
        vibes(t, SCALE[melodyIdx], BEAT * (Math.random() < .5 ? 1 : 2));
      }
      nextT += EIGHTH; step++;
    }
  }

  function start() {
    if (M.playing || !M.on) return;
    if (!ac && !build()) return;
    if (ac.state === 'suspended') ac.resume();
    nextT = ac.currentTime + .1; step = 0;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(master.gain.value, ac.currentTime);
    master.gain.linearRampToValueAtTime(VOL, ac.currentTime + 3.5);   // gentle fade-in
    timer = setInterval(schedule, 40); schedule();
    M.playing = true; notify();
  }
  function stop() {
    if (!M.playing) return;
    clearInterval(timer);
    const t = ac.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(0, t + .6);
    M.playing = false; notify();
  }
  M.toggle = () => {
    if (M.on && !M.playing) { start(); return true; }   // allowed but not started yet: the button starts it
    M.on = !M.on; try { localStorage.setItem('hpp-music', M.on ? 'on' : 'off'); } catch {}
    M.on ? start() : stop(); notify(); return M.on;
  };
  M.start = start;
  // first interaction anywhere starts the music (browser autoplay rules)
  const first = e => {
    if (e.target && e.target.closest && e.target.closest('#mus')) return;   // the music button handles itself
    removeEventListener('pointerdown', first, true); removeEventListener('keydown', first, true);
    if (M.on && !M.playing) { M.firstStart = true; start(); }
  };
  addEventListener('pointerdown', first, true);
  addEventListener('keydown', first, true);
  // pause with the tab
  document.addEventListener('visibilitychange', () => { if (!ac) return; document.hidden ? ac.suspend() : (M.playing && ac.resume()); });
})();

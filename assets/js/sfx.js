/* Tiny synthesized sound kit (Web Audio, no files). Browsers only allow audio after the first
   click/tap, so nothing plays until then. Toggle persists per visitor. */
(() => {
  const S = window.HPPSfx = { on: true };
  try { S.on = localStorage.getItem('hpp-sound') !== 'off'; } catch {}
  let ac = null, master = null, unlocked = false;
  const ctx = () => {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ac = new AC(); master = ac.createGain(); master.gain.value = .55;
      const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
    return ac;
  };
  const unlock = () => { unlocked = true; ctx(); };
  addEventListener('pointerdown', unlock, { once: true, capture: true });
  addEventListener('keydown', unlock, { once: true, capture: true });

  const env = (g, t, a, peak, d) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); };
  const tone = ({ type = 'sine', f0, f1, dur = .12, vol = .2, a = .005, delay = 0, q }) => {
    const c = ctx(); if (!c) return; const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    let node = o;
    if (q) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = q; o.connect(f); node = f; }
    node.connect(g); g.connect(master); env(g, t, a, vol, dur); o.start(t); o.stop(t + a + dur + .05);
  };
  let noiseBuf = null;
  const noise = ({ dur = .4, vol = .12, f0 = 400, f1 = 2400, delay = 0 }) => {
    const c = ctx(); if (!c) return; const t = c.currentTime + delay;
    if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); s.connect(f); f.connect(g); g.connect(master); env(g, t, dur * .35, vol, dur * .65);
    s.start(t); s.stop(t + dur + .05);
  };

  const lib = {
    hover: (p = 1) => tone({ type: 'triangle', f0: 880 * p, f1: 1100 * p, dur: .05, vol: .035 }),
    pop: (p = 1) => { tone({ f0: 620 * p, f1: 240 * p, dur: .09, vol: .16 }); tone({ type: 'triangle', f0: 1300 * p, dur: .03, vol: .04 }); },
    click: (p = 1) => { tone({ f0: 300 * p, f1: 900 * p, dur: .08, vol: .14 }); tone({ f0: 900 * p, f1: 500 * p, dur: .06, vol: .07, delay: .05 }); },
    boing: (p = 1) => {
      const c = ctx(); if (!c) return; const t = c.currentTime;
      const o = c.createOscillator(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(150 * p, t); o.frequency.exponentialRampToValueAtTime(460 * p, t + .12); o.frequency.exponentialRampToValueAtTime(210 * p, t + .5);
      lfo.frequency.value = 17; lg.gain.value = 38 * p; lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(master); env(g, t, .01, .2, .55); o.start(t); lfo.start(t); o.stop(t + .6); lfo.stop(t + .6);
    },
    squish: (p = 1) => { tone({ type: 'sawtooth', f0: 220 * p, f1: 90 * p, dur: .14, vol: .07, q: 900 }); noise({ dur: .12, vol: .05, f0: 900, f1: 300 }); },
    squeak: () => { tone({ type: 'square', f0: 1400, f1: 2100, dur: .07, vol: .05, q: 3200 }); tone({ type: 'square', f0: 2000, f1: 1300, dur: .09, vol: .05, q: 3200, delay: .08 }); },
    whoosh: () => noise({ dur: .55, vol: .14, f0: 300, f1: 2600 }),
    land: (p = 1) => { tone({ f0: 180 * p, f1: 70 * p, dur: .12, vol: .14 }); tone({ type: 'triangle', f0: 660 * p, f1: 990 * p, dur: .05, vol: .03, delay: .02 }); },
    fluff: () => noise({ dur: .3, vol: .07, f0: 2500, f1: 5000 }),
    sparkle: () => [1046, 1318, 1568, 2093].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: .16, vol: .07, delay: i * .07 })),
    type: () => tone({ type: 'triangle', f0: 1500 + Math.random() * 400, dur: .02, vol: .025 }),
    tick: () => tone({ type: 'square', f0: 2400, dur: .012, vol: .015, q: 4000 }),
    open: () => { lib.squeak(); tone({ f0: 500, f1: 900, dur: .15, vol: .08, delay: .12 }); },
    close: () => tone({ f0: 700, f1: 300, dur: .14, vol: .08 }),
  };
  let lastHover = 0;
  S.play = (name, p) => {
    if (!S.on || !unlocked || !lib[name]) return;
    if (name === 'hover') { const n = performance.now(); if (n - lastHover < 60) return; lastHover = n; }
    try { lib[name](p); } catch {}
  };
  S.toggle = v => { S.on = v ?? !S.on; try { localStorage.setItem('hpp-sound', S.on ? 'on' : 'off'); } catch {} if (S.on) { unlock(); lib.sparkle(); } return S.on; };
})();

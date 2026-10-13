/* Fluffy fur lettering — draws each word hair-by-hair on a canvas.
   HPP3D.fur(text, {px, hue}) -> {canvas, em} (same contract as HPP3D.word, so headings can mix both).
   1. rasterise the word (Fredoka 700) into a mask
   2. blur the mask into a height map -> its gradient gives each hair an "outward" direction + lighting
   3. lay down thousands of short curved strands in passes: dark under-fur, body, bright tips */
(() => {
  const H = window.HPP3D = window.HPP3D || {};
  const PAL = {
    pink: { root: [196, 86, 134], mid: [238, 140, 184], tip: [255, 222, 236] },
    teal: { root: [22, 120, 140], mid: [72, 190, 208], tip: [214, 248, 252] },
    butter: { root: [196, 140, 40], mid: [250, 200, 90], tip: [255, 244, 210] },
    white: { root: [200, 178, 196], mid: [246, 236, 244], tip: [255, 255, 255] },
  };
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const hash = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  H.fur = (text, { px = 96, hue = 'pink', family = 'Fredoka', weight = 700, seed = 0 } = {}) => {
    const dpr = Math.min(2, devicePixelRatio || 1), fs = px * dpr;
    const pal = PAL[hue] || PAL.pink, R = rng(hash(text) + seed);
    const fontCss = `${weight} ${fs}px "${family}", system-ui, sans-serif`;
    const m = document.createElement('canvas').getContext('2d');
    const spacing = Math.round(fs * .07);
    m.font = fontCss; m.letterSpacing = spacing + 'px';
    const tm = m.measureText(text);
    const pad = Math.round(fs * .22);
    const asc = fs * .95, desc = fs * .3;
    const W = Math.ceil(tm.width + pad * 2), Hh = Math.ceil(asc + desc + pad * 2);
    const base = pad + asc;

    // 1. mask
    const mask = document.createElement('canvas'); mask.width = W; mask.height = Hh;
    const mc = mask.getContext('2d', { willReadFrequently: true });
    mc.font = fontCss; mc.letterSpacing = spacing + 'px'; mc.fillStyle = '#000'; mc.fillText(text, pad, base);
    const A = mc.getImageData(0, 0, W, Hh).data;
    // 2. blurred height map
    const blur = document.createElement('canvas'); blur.width = W; blur.height = Hh;
    const bc = blur.getContext('2d', { willReadFrequently: true });
    bc.filter = `blur(${Math.round(fs * .045)}px)`; bc.drawImage(mask, 0, 0);
    const B = bc.getImageData(0, 0, W, Hh).data;
    const a = (x, y) => (x < 0 || y < 0 || x >= W || y >= Hh) ? 0 : A[(y * W + x) * 4 + 3];
    const h = (x, y) => (x < 1 || y < 1 || x >= W - 1 || y >= Hh - 1) ? 0 : B[(y * W + x) * 4 + 3] / 255;

    // collect interior sample points
    const pts = [];
    for (let y = 0; y < Hh; y += 2) for (let x = 0; x < W; x += 2) if (a(x, y) > 120) pts.push(x, y);
    const n = pts.length / 2;

    const out = document.createElement('canvas'); out.width = W; out.height = Hh;
    const c = out.getContext('2d');
    c.lineCap = 'round';
    // soft body underneath so no gaps show through
    c.filter = `blur(${Math.max(1, fs * .012)}px)`;
    c.fillStyle = `rgb(${pal.root})`; c.font = fontCss; c.letterSpacing = spacing + 'px'; c.fillText(text, pad, base);
    c.filter = 'none';

    const LX = -.6, LY = -.8; // light from upper-left
    const strand = (len, width, tRoot, tTip, alpha, spread) => {
      const i = Math.floor(R() * n) * 2;
      const x = pts[i] + (R() - .5) * 2, y = pts[i + 1] + (R() - .5) * 2;
      let gx = h(x + 2 | 0, y | 0) - h(x - 2 | 0, y | 0), gy = h(x | 0, y + 2 | 0) - h(x | 0, y - 2 | 0);
      const g = Math.hypot(gx, gy);
      // outward (down-slope) direction near edges, swirly combed direction inside
      let ang = g > .02 ? Math.atan2(-gy, -gx) : R() * Math.PI * 2;
      ang += Math.sin(x * .021 + y * .013) * .9 + (R() - .5) * spread;
      const edge = Math.min(1, g * 7);
      const L = len * (.5 + R() * .6) * (1 + edge * .9);   // edge hairs stick out further, interior stays tight
      const bend = (R() - .5) * L * .6;
      const ex = x + Math.cos(ang) * L, ey = y + Math.sin(ang) * L;
      const mx = (x + ex) / 2 - Math.sin(ang) * bend, my = (y + ey) / 2 + Math.cos(ang) * bend;
      const vol = h(x | 0, y | 0);                       // ~1 in the middle of a stroke, ~.5 at its edge
      const lit = Math.max(0, Math.min(1, (vol - .45) * 1.6 + (gx * LX + gy * LY) / (g || 1) * edge * .35 + (1 - y / Hh) * .15));
      const col = mix(mix(pal.root, pal.mid, Math.min(1, tRoot + lit * .55)), pal.tip, Math.max(0, tTip * lit));
      c.strokeStyle = `rgba(${col},${alpha})`; c.lineWidth = width;
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(mx, my, ex, ey); c.stroke();
    };
    const L = fs * .055, wBase = Math.max(1, dpr * .8);
    const N = Math.min(90000, n * 2.2);
    for (let i = 0; i < N * .45; i++) strand(L * .7, wBase * 1.4, 0, 0, .6, 1.4);     // dense dark under-fur
    for (let i = 0; i < N * .6; i++) strand(L, wBase * 1.05, .45, .2, .65, 1);       // main coat
    for (let i = 0; i < N * .3; i++) strand(L * 1.1, wBase * .8, .75, .85, .75, .7); // bright tips
    return { canvas: out, em: { w: W / fs, h: Hh / fs, base: (Hh - base) / fs, padL: pad / fs, padR: pad / fs } };
  };
})();

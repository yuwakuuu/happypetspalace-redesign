/* Puffy 3D lettering — real-time three.js render of inflated, glossy letters.
   - HPP3D.word(text, opts)  -> <canvas> of one word, rendered once (used for section headings)
   - HPP3D.live(el, opts)    -> interactive hero title: letters drop in, squish on hover, bounce on click
   Needs three r147 classic build + FontLoader + TextGeometry + RoomEnvironment + BufferGeometryUtils,
   and a typeface from assets/fonts/*.js (window.HPP_FONTS). */
(() => {
  const T = window.THREE;
  const H = window.HPP3D = { ok: false };
  if (!T || !T.TextGeometry || !window.HPP_FONTS) return;
  try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) return; } catch { return; }

  if (T.ColorManagement) T.ColorManagement.legacyMode = false;   // treat hex colours as sRGB so they don't wash out
  const SIZE = 100;                       // world units per em
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  H.colors = { plum: '#c23a8c', teal: '#1fb2c9', pink: '#ff8fc6', white: '#fff4fb', butter: '#ffc23d', grape: '#8a5cff' };

  /* ---------- shared building blocks ---------- */
  const fonts = {};
  const font = name => fonts[name] || (fonts[name] = new T.Font(window.HPP_FONTS[name]));
  const geoCache = new Map();
  /** Inflated letter: shape is inset then bevelled back out with a deep round profile, so the whole face domes like a balloon. */
  H.inflate = { fredoka: [.3, .07, -.04] };   // [bevelThickness, bevelSize, bevelOffset] × size — tuned: puffy without self-intersections
  function glyphGeo(ch, fontName = 'fredoka') {
    const key = fontName + ch + H.inflate[fontName];
    const [bt, bs, bo] = H.inflate[fontName] || H.inflate.fredoka;
    if (geoCache.has(key)) return geoCache.get(key);
    let g = new T.TextGeometry(ch, {
      font: font(fontName), size: SIZE, height: SIZE * .02, curveSegments: 16,
      bevelEnabled: true, bevelThickness: SIZE * bt, bevelSize: SIZE * bs, bevelOffset: SIZE * bo, bevelSegments: 16
    });
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = T.BufferGeometryUtils.mergeVertices(g, .02);
    g.computeVertexNormals();               // smooth normals across the bevel = soft pillow shading
    g.computeBoundingBox();
    const b = g.boundingBox, cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
    g.translate(-cx, -cy, 0);               // pivot at glyph centre so squish/rotate looks natural
    g.userData = { cx, cy, adv: (font(fontName).data.glyphs[ch] || { ha: SIZE * 6 }).ha * SIZE / 1000 };
    geoCache.set(key, g);
    return g;
  }
  const matCache = new Map();
  function candy(hex) {
    if (matCache.has(hex)) return matCache.get(hex);
    const c = new T.Color(hex), sheen = c.clone().lerp(new T.Color('#fff'), .6);
    const m = new T.MeshPhysicalMaterial({
      color: c, roughness: .38, metalness: 0, clearcoat: 1, clearcoatRoughness: .08,
      sheen: .35, sheenColor: sheen, sheenRoughness: .6, envMapIntensity: .7
    });
    matCache.set(hex, m);
    return m;
  }
  function stage(renderer) {
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .95;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.VSMShadowMap;
    const scene = new T.Scene();
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new T.RoomEnvironment(), .04).texture;
    const key = new T.DirectionalLight('#ffffff', 2.6);
    key.position.set(-200, 340, 640); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 14; key.shadow.blurSamples = 20; key.shadow.bias = -.002;
    scene.add(key, key.target);
    const rim = new T.DirectionalLight('#ffd9ee', .9); rim.position.set(400, -150, 300); scene.add(rim);
    scene.add(new T.HemisphereLight('#ffffff', '#e6d4ff', .7));
    const floor = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShadowMaterial({ opacity: .17 }));
    floor.position.z = -SIZE * .26; floor.receiveShadow = true; scene.add(floor);
    return { scene, key, floor };
  }
  const fitShadow = (key, floor, x0, x1, y0, y1) => {
    const w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    floor.scale.set(w * 1.6, h * 1.8, 1); floor.position.x = cx; floor.position.y = cy;
    const s = key.shadow.camera, r = Math.max(w, h) * .75;
    s.left = -r; s.right = r; s.top = r; s.bottom = -r; s.near = 1; s.far = 3000; s.updateProjectionMatrix();
    key.target.position.set(cx, cy, 0); key.position.set(cx - 200, cy + 340, 640);
  };

  /* ---------- static word renders (one shared offscreen renderer) ---------- */
  let off;
  function offscreen() {
    if (off) return off;
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1); renderer.setClearColor(0, 0);
    const st = stage(renderer);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, -2000, 2000); cam.position.z = 1000;
    return (off = { renderer, cam, ...st, group: new T.Group() });
  }
  /** returns {canvas, em: {w, h, base}} — canvas sized in em so it scales with the heading's font-size */
  H.word = (text, { color = H.colors.plum, px = 96, fontName = 'fredoka', tilt = true } = {}) => {
    const o = offscreen(), f = font(fontName), meta = f.data;
    o.scene.remove(o.group); o.group = new T.Group(); o.scene.add(o.group);
    let x = 0; const mat = candy(color);
    for (const ch of text) {
      const g = glyphGeo(ch, fontName);
      if (ch.trim()) { const m = new T.Mesh(g, mat); m.position.set(x + g.userData.cx, g.userData.cy, 0); m.castShadow = true; o.group.add(m); }
      x += g.userData.adv * .97;
    }
    if (tilt) { o.group.rotation.x = -.16; o.group.rotation.y = .05; }
    const pad = SIZE * .2, asc = meta.ascender * SIZE / 1000, desc = meta.descender * SIZE / 1000;
    const x0 = -pad, x1 = x + pad, y0 = desc - pad * 1.1, y1 = asc + pad * .3;
    fitShadow(o.key, o.floor, x0, x1, y0, y1);
    const dpr = Math.min(2, devicePixelRatio || 1), scale = px * dpr / SIZE;
    const W = Math.ceil((x1 - x0) * scale), Hh = Math.ceil((y1 - y0) * scale);
    o.renderer.setSize(W, Hh, false);
    Object.assign(o.cam, { left: x0, right: x1, top: y1, bottom: y0 }); o.cam.updateProjectionMatrix();
    o.renderer.render(o.scene, o.cam);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    cv.getContext('2d').drawImage(o.renderer.domElement, 0, 0);
    return { canvas: cv, em: { w: (x1 - x0) / SIZE, h: (y1 - y0) / SIZE, base: -y0 / SIZE, padL: pad / SIZE, padR: pad / SIZE } };
  };

  /* ---------- live interactive title ---------- */
  /** words: [{text, color}] ; el: container element; returns controller */
  H.live = (el, words, { fontName = 'fredoka', onHit } = {}) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'live3d'; canvas.setAttribute('aria-hidden', 'true');
    el.append(canvas);
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0, 0);
    const { scene, key, floor } = stage(renderer);
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, -2000, 2000); cam.position.z = 1000;
    const group = new T.Group(); scene.add(group);
    const meta = font(fontName).data, asc = meta.ascender * SIZE / 1000, desc = meta.descender * SIZE / 1000;
    let letters = [], W = 0, Hh = 0, px = 100, lineH = SIZE * 1.12;
    const ray = new T.Raycaster(), ptr = new T.Vector2(-9, -9);
    let hover = null, tx = 0, ty = 0, t0 = performance.now(), intro = true;

    function layout() {
      const cs = getComputedStyle(el);
      px = parseFloat(cs.fontSize) || 100;
      W = el.clientWidth;
      const maxW = W / px * SIZE;             // available width in world units
      const space = (font(fontName).data.glyphs[' '] || { ha: 260 }).ha * SIZE / 1000;
      const lines = [[]]; let lx = 0;
      words.forEach(w => {
        const wW = [...w.text].reduce((s, ch) => s + glyphGeo(ch, fontName).userData.adv * .97, 0);
        if (lx > 0 && lx + wW > maxW) { lines.push([]); lx = 0; }
        lines[lines.length - 1].push({ ...w, x: lx, w: wW }); lx += wW + space;
      });
      group.clear(); const old = letters; letters = [];
      lines.forEach((ln, li) => ln.forEach(w => {
        let x = w.x; const mat = candy(w.color);
        [...w.text].forEach(ch => {
          const g = glyphGeo(ch, fontName);
          if (ch.trim()) {
            const m = new T.Mesh(g, mat); m.castShadow = true;
            const home = new T.Vector3(x + g.userData.cx, -li * lineH + g.userData.cy, 0);
            const prev = old[letters.length];
            const s = prev ? prev.s : { y: intro ? 900 + letters.length * 70 : 0, vy: 0, sx: 1, vsx: 0, sy: 1, vsy: 0, rz: 0, vrz: 0, z: 0, vz: 0, landed: !intro };
            m.position.copy(home); group.add(m);
            letters.push({ m, home, s, i: letters.length, ch });
          }
          x += g.userData.adv * .97;
        });
      }));
      const contentH = lines.length * lineH;
      Hh = Math.ceil(contentH / SIZE * px + px * .35);
      canvas.style.width = W + 'px'; canvas.style.height = Hh + 'px';
      el.style.height = Hh + 'px';
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      renderer.setSize(W, Hh, false);
      const top = asc + SIZE * .12, units = Hh / px * SIZE;
      Object.assign(cam, { left: -SIZE * .06, right: maxW - SIZE * .06, top, bottom: top - units }); cam.updateProjectionMatrix();
      fitShadow(key, floor, 0, maxW, top - units, top);
    }

    const toLocal = e => { const r = canvas.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); tx = ptr.x; ty = ptr.y; };
    const pick = () => { ray.setFromCamera(ptr, cam); const hit = ray.intersectObjects(group.children, false)[0]; return hit && letters.find(l => l.m === hit.object); };
    el.addEventListener('pointermove', e => {
      toLocal(e); const l = pick();
      if (l && l !== hover) { l.s.vsy -= 5.5; l.s.vsx += 4; l.s.vz += 60; onHit && onHit('hover', l); }
      hover = l || null; canvas.style.cursor = l ? 'pointer' : '';
    });
    el.addEventListener('pointerleave', () => { hover = null; tx = ty = 0; ptr.set(-9, -9); });
    el.addEventListener('pointerdown', e => {
      toLocal(e); const l = pick(); if (!l) return;
      l.s.vy += 520; l.s.vrz += (Math.random() - .5) * 9; l.s.vsy += 6; l.s.vsx -= 3;
      // neighbours get a sympathetic wobble
      letters.forEach(o => { const d = Math.abs(o.i - l.i); if (d && d < 3) { o.s.vy += 200 / d; o.s.vrz += (Math.random() - .5) * 3; } });
      onHit && onHit('click', l);
    });

    let visible = true, raf = 0, last = performance.now(), running = false;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && running && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }).observe(el);
    function tick(now) {
      raf = 0;
      const dt = Math.min(.033, (now - last) / 1000); last = now;
      const t = (now - t0) / 1000;
      group.rotation.y += ((reduce ? 0 : tx * .14) - group.rotation.y) * .06;
      group.rotation.x += ((reduce ? 0 : -ty * .1) - group.rotation.x) * .06;
      let settling = false;
      letters.forEach(l => {
        const s = l.s, k = 170, c = 11;
        // y spring with landing squash
        const ay = -k * s.y - c * s.vy; s.vy += ay * dt; s.y += s.vy * dt;
        if (!s.landed && s.y < 8) { s.landed = true; s.vsy -= 7; s.vsx += 5; onHit && onHit('land', l); }
        s.vsx += (-260 * (s.sx - 1) - 9 * s.vsx) * dt; s.sx += s.vsx * dt;
        s.vsy += (-260 * (s.sy - 1) - 9 * s.vsy) * dt; s.sy += s.vsy * dt;
        s.vrz += (-120 * s.rz - 8 * s.vrz) * dt; s.rz += s.vrz * dt;
        s.vz += (-200 * s.z - 14 * s.vz) * dt; s.z += s.vz * dt;
        const bob = reduce ? 0 : Math.sin(t * 2 + l.i * .55) * 2.2;
        l.m.position.set(l.home.x, l.home.y + s.y + bob, s.z);
        l.m.scale.set(s.sx, s.sy, (s.sx + s.sy) / 2);
        l.m.rotation.z = s.rz;
        if (Math.abs(s.vy) + Math.abs(s.y) + Math.abs(s.vsy) > .5) settling = true;
      });
      if (intro && !settling) intro = false;
      renderer.render(scene, cam);
      if (visible && !document.hidden) raf = requestAnimationFrame(tick);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && running && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } });
    layout();
    renderer.render(scene, cam);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
    return {
      start() { running = true; last = t0 = performance.now(); if (!raf) raf = requestAnimationFrame(tick); },
      relayout: layout,
      jiggle() { letters.forEach((l, i) => setTimeout(() => { l.s.vy += 260; l.s.vsy += 4; }, i * 35)); }
    };
  };

  H.ok = true;
})();

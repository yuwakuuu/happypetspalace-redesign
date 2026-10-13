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
  const MOBILE = matchMedia('(max-width: 700px), (pointer: coarse)').matches;   // lighter geometry + resolution on phones
  H.colors = { plum: '#c23a8c', teal: '#1fb2c9', pink: '#ff8fc6', white: '#fff4fb', butter: '#ffc23d', grape: '#8a5cff' };

  /* ---------- shared building blocks ---------- */
  const fonts = {};
  const font = name => fonts[name] || (fonts[name] = new T.Font(window.HPP_FONTS[name]));
  const geoCache = new Map();
  /** Inflated letter: shape is inset then bevelled back out with a deep round profile, so the whole face domes like a balloon. */
  /* The "look" — everything that decides how soft and bouncy the letters feel. */
  H.look = {
    inflate: [.5, .1, -.03],    // [bevelThickness, bevelSize, bevelOffset] × size — fat, marshmallow-soft domes
    depth: .02,
    mat: { roughness: .58, clearcoat: .35, clearcoatRoughness: .42, sheen: 1, sheenRoughness: .9, env: .52 },  // soft rubbery balloon, no hard glare
    light: { key: 1.7, hemi: 1.4, rim: .5, exposure: 1.02, shadow: .11 },                                       // big soft lighting
    track: .9,                  // letters squeeze together like balloons
    bounce: { rot: .09, y: .035, s: .04 } // each letter gets its own playful tilt, hop and size
  };
  const jit = (i, k) => Math.sin(i * 12.9898 + k * 78.233) * 43758.5453 % 1;   // stable pseudo-random in (-1,1)
  function glyphGeo(ch, fontName = 'fredoka', inflate = H.look.inflate) {
    const L = H.look, key = fontName + ch + inflate + L.depth;
    const [bt, bs, bo] = inflate;
    if (geoCache.has(key)) return geoCache.get(key);
    let g = new T.TextGeometry(ch, {
      font: font(fontName), size: SIZE, height: SIZE * H.look.depth, curveSegments: MOBILE ? 10 : 18,
      bevelEnabled: true, bevelThickness: SIZE * bt, bevelSize: SIZE * bs, bevelOffset: SIZE * bo, bevelSegments: MOBILE ? 10 : 20
    });
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = T.BufferGeometryUtils.mergeVertices(g, .02);
    g.computeVertexNormals();               // smooth normals across the bevel = soft pillow shading
    g.computeBoundingBox();
    { // the flat front/back caps should face exactly forward/back — averaging them with the bevel causes streaks
      const P = g.attributes.position, N = g.attributes.normal, zmax = g.boundingBox.max.z, zmin = g.boundingBox.min.z;
      for (let i = 0; i < P.count; i++) { const z = P.getZ(i); if (z > zmax - .01) N.setXYZ(i, 0, 0, 1); else if (z < zmin + .01) N.setXYZ(i, 0, 0, -1); }
      N.needsUpdate = true;
    }
    const b = g.boundingBox, cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
    g.translate(-cx, -cy, 0);               // pivot at glyph centre so squish/rotate looks natural
    g.userData = { cx, cy, adv: (font(fontName).data.glyphs[ch] || { ha: SIZE * 6 }).ha * SIZE / 1000 };
    geoCache.set(key, g);
    return g;
  }
  const matCache = new Map();
  function candy(hex) {
    const M = H.look.mat, key = hex + JSON.stringify(M);
    if (matCache.has(key)) return matCache.get(key);
    const c = new T.Color(hex), sheen = c.clone().lerp(new T.Color('#fff'), .65);
    const m = new T.MeshPhysicalMaterial({
      color: c, roughness: M.roughness, metalness: 0, clearcoat: M.clearcoat, clearcoatRoughness: M.clearcoatRoughness,
      sheen: M.sheen, sheenColor: sheen, sheenRoughness: M.sheenRoughness, envMapIntensity: M.env
    });
    matCache.set(key, m);
    return m;
  }
  function stage(renderer) {
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    const Lt = H.look.light;
    renderer.toneMappingExposure = Lt.exposure;
    renderer.physicallyCorrectLights = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.VSMShadowMap;
    const scene = new T.Scene();
    const pm = new T.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new T.RoomEnvironment(), .04).texture;
    const key = new T.DirectionalLight('#ffffff', Lt.key);
    key.position.set(-200, 340, 640); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 14; key.shadow.blurSamples = 20; key.shadow.bias = -.002;
    scene.add(key, key.target);
    const rim = new T.DirectionalLight('#ffd9ee', Lt.rim); rim.position.set(400, -150, 300); scene.add(rim);
    scene.add(new T.HemisphereLight('#ffffff', '#f3dcff', Lt.hemi));
    const floor = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShadowMaterial({ opacity: Lt.shadow }));
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
    let x = 0, i = 0; const mat = candy(color), L = H.look, B = L.bounce;
    for (const ch of text) {
      const g = glyphGeo(ch, fontName);
      if (ch.trim()) {
        const m = new T.Mesh(g, mat); m.castShadow = true;
        m.position.set(x + g.userData.cx, g.userData.cy + jit(i, 1) * B.y * SIZE, jit(i, 3) * 4);
        m.rotation.z = jit(i, 2) * B.rot; m.scale.setScalar(1 + jit(i, 4) * B.s);
        o.group.add(m);
      }
      x += g.userData.adv * L.track; i++;
    }
    if (tilt) { o.group.rotation.x = -.16; o.group.rotation.y = .05; }
    const pad = SIZE * .26, asc = meta.ascender * SIZE / 1000, desc = meta.descender * SIZE / 1000;
    const padR = pad * 1.6, padB = pad * 1.7;              // the shadow falls down and to the right — give it room so it isn't clipped
    const x0 = -pad, x1 = x + padR, y0 = desc - padB, y1 = asc + pad * .75;
    fitShadow(o.key, o.floor, x0, x1, y0, y1);
    const dpr = Math.min(2, devicePixelRatio || 1), scale = px * dpr / SIZE;
    const W = Math.ceil((x1 - x0) * scale), Hh = Math.ceil((y1 - y0) * scale);
    o.renderer.setSize(W, Hh, false);
    Object.assign(o.cam, { left: x0, right: x1, top: y1, bottom: y0 }); o.cam.updateProjectionMatrix();
    o.renderer.render(o.scene, o.cam);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = Hh;
    cv.getContext('2d').drawImage(o.renderer.domElement, 0, 0);
    return { canvas: cv, em: { w: (x1 - x0) / SIZE, h: (y1 - y0) / SIZE, base: -y0 / SIZE, padL: pad / SIZE, padR: padR / SIZE } };
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
    let letters = [], W = 0, Hh = 0, px = 100, lineH = SIZE * 1.24;   // roomy lines so fat letters don't collide
    const ray = new T.Raycaster(), ptr = new T.Vector2(-9, -9);
    let hover = null, tx = 0, ty = 0, t0 = performance.now(), intro = true;

    function layout() {
      const cs = getComputedStyle(el);
      px = parseFloat(cs.fontSize) || 100;
      W = el.clientWidth;
      const maxW = W / px * SIZE;             // available width in world units
      const space = (font(fontName).data.glyphs[' '] || { ha: 260 }).ha * SIZE / 1000 * 1.7;   // fat letters need a wider word gap
      const lines = [[]]; let lx = 0;
      words.forEach(w => {
        const wW = [...w.text].reduce((s, ch) => s + glyphGeo(ch, fontName).userData.adv * H.look.track, 0);
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
            const B = H.look.bounce, n = letters.length;
            const home = new T.Vector3(x + g.userData.cx, -li * lineH + g.userData.cy + jit(n, 1) * B.y * SIZE, jit(n, 3) * 4);
            home.rz = jit(n, 2) * B.rot; home.sc = 1 + jit(n, 4) * B.s;
            const prev = old[letters.length];
            const s = prev ? prev.s : { y: intro ? 900 + letters.length * 70 : 0, vy: 0, sx: 1, vsx: 0, sy: 1, vsy: 0, rz: 0, vrz: 0, z: 0, vz: 0, landed: !intro };
            m.position.copy(home); group.add(m);
            letters.push({ m, home, s, i: letters.length, ch });
          }
          x += g.userData.adv * H.look.track;
        });
      }));
      const contentH = lines.length * lineH;
      Hh = Math.ceil(contentH / SIZE * px + px * .5);
      el.style.height = Hh + 'px';
      // the canvas overhangs its box so shadows and hops never clip at the edges (pointer events go to the element)
      const oL = px * .15, oR = px * .6, oT = px * .25, oB = px * .6, u = SIZE / px;
      canvas.style.cssText = `left:${-oL}px;top:${-oT}px;width:${W + oL + oR}px;height:${Hh + oT + oB}px`;
      renderer.setPixelRatio(Math.min(MOBILE ? 1.5 : 2, devicePixelRatio || 1));
      renderer.setSize(W + oL + oR, Hh + oT + oB, false);
      const top = asc + SIZE * .3, units = Hh / px * SIZE, x0 = -SIZE * .06;
      Object.assign(cam, { left: x0 - oL * u, right: x0 + maxW + oR * u, top: top + oT * u, bottom: top - units - oB * u }); cam.updateProjectionMatrix();
      fitShadow(key, floor, x0 - oL * u, x0 + maxW + oR * u, top - units - oB * u, top + oT * u);
    }

    const toLocal = e => { const r = canvas.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); tx = ptr.x; ty = ptr.y; };
    const pick = () => { ray.setFromCamera(ptr, cam); const hit = ray.intersectObjects(group.children, false)[0]; return hit && letters.find(l => l.m === hit.object); };
    el.addEventListener('pointermove', e => {
      toLocal(e); const l = pick();
      if (l && l !== hover) { l.s.vsy -= 7; l.s.vsx += 5.5; l.s.vz += 70; onHit && onHit('hover', l); }
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
      const elapsed = Math.min(.5, Math.max(0, (now - last) / 1000)); last = now;   // real time, so low frame rates don't mean slow motion
      const t = (now - t0) / 1000;
      group.rotation.y += ((reduce ? 0 : tx * .14) - group.rotation.y) * .06;
      group.rotation.x += ((reduce ? 0 : -ty * .1) - group.rotation.x) * .06;
      let settling = false;
      letters.forEach(l => {
        const s = l.s, k = 170, c = 11;
        for (let left = elapsed; left > 1e-6; left -= 1 / 120) {      // fixed 120 Hz physics steps
          const dt = Math.min(left, 1 / 120);
          s.vy += (-k * s.y - c * s.vy) * dt; s.y += s.vy * dt;        // drop-in spring
          if (!s.landed && s.y < 8) { s.landed = true; s.vsy -= 7; s.vsx += 5; onHit && onHit('land', l); }
          s.vsx += (-190 * (s.sx - 1) - 5.5 * s.vsx) * dt; s.sx += s.vsx * dt;   // soft, under-damped = jelly wobble
          s.vsy += (-190 * (s.sy - 1) - 5.5 * s.vsy) * dt; s.sy += s.vsy * dt;
          s.vrz += (-120 * s.rz - 8 * s.vrz) * dt; s.rz += s.vrz * dt;
          s.vz += (-200 * s.z - 14 * s.vz) * dt; s.z += s.vz * dt;
        }
        const ph = t * 2.2 + l.i * .6, bob = reduce ? 0 : Math.sin(ph) * 2.6, breathe = reduce ? 0 : Math.sin(ph * 1.3) * .022;
        const sc = l.home.sc || 1;
        l.m.position.set(l.home.x, l.home.y + s.y + bob, l.home.z + s.z);
        l.m.scale.set(sc * (s.sx - breathe), sc * (s.sy + breathe), sc * (s.sx + s.sy) / 2);
        l.m.rotation.z = (l.home.rz || 0) + s.rz + (reduce ? 0 : Math.sin(ph * .7) * .025);
        if (Math.abs(s.vy) + Math.abs(s.y) + Math.abs(s.vsy) > .5) settling = true;
      });
      if (intro && !settling) intro = false;
      renderer.render(scene, cam);
      if (visible) raf = requestAnimationFrame(tick);   // the browser itself pauses rAF in hidden tabs
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && running && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } });
    layout();
    renderer.render(scene, cam);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
    return {
      start() { running = true; last = t0 = performance.now(); if (!raf) raf = requestAnimationFrame(tick); },
      relayout: layout,
      debug: () => ({ running, visible, raf, n: letters.length, first: letters[0] && { sy: letters[0].s.y, pos: letters[0].m.position.toArray(), sc: letters[0].m.scale.toArray() }, cam: [cam.left, cam.right, cam.top, cam.bottom] }),
      jiggle() { letters.forEach((l, i) => setTimeout(() => { l.s.vy += 260; l.s.vsy += 4; }, i * 35)); }
    };
  };

  /* ---------- soap-bubble title (homepage hero) ----------
     Custom shader: thin-film iridescence that shifts with viewing angle, glassy window reflections,
     see-through centres with defined rims (so it still reads on a white page), and a wobbling surface. */
  const BUBBLE_VS = `
    uniform float uTime; uniform float uWob;
    varying vec3 vN; varying vec3 vP;
    void main() {
      vec3 p = position;
      float w = sin(p.x * .09 + uTime * 2.7) * sin(p.y * .08 + uTime * 2.1) + .5 * sin(p.z * .15 + uTime * 3.3);
      p += normal * w * uWob;
      vec4 wp = modelMatrix * vec4(p, 1.0);
      vN = normalize(mat3(modelMatrix) * normal);
      vP = wp.xyz;
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const BUBBLE_FS = `
    uniform float uTime; uniform vec3 uTint; uniform float uFade;
    varying vec3 vN; varying vec3 vP;
    void main() {
      vec3 n = normalize(vN);
      vec3 v = vec3(0.0, 0.0, 1.0);
      float ndv = clamp(dot(n, v), 0.0, 1.0);
      float fr = smoothstep(.93, .12, ndv);                // clear in the flat middle, building toward the rims (hides mesh seams)
      // thin-film colours: hue rides the viewing angle plus a slow swirl
      float h = fr * 1.6 + n.x * .25 - n.y * .18 + vP.x * .0025 + uTime * .06;
      vec3 film = .5 + .5 * cos(6.2831 * (h + vec3(0.0, .33, .67)));
      film = mix(vec3(1.0), film, .85);
      // the environment it reflects: soft studio — bright above, cool grey below (gives the darker streaks)
      vec3 r = reflect(-v, n);
      vec3 env = mix(vec3(.42, .46, .55), vec3(1.0), smoothstep(-.55, .65, r.y));
      float win = smoothstep(.5, .9, r.y) * smoothstep(-.05, .5, -r.x);
      float spec = pow(max(dot(r, normalize(vec3(-.45, .65, .6))), 0.0), 70.0) + .6 * pow(max(dot(r, normalize(vec3(.55, .25, .8))), 0.0), 120.0);
      vec3 col = env * mix(vec3(1.0), film, .65);
      col = mix(col, uTint, .2);                          // a whisper of brand colour
      float edge = smoothstep(.26, .0, ndv);              // defined silhouette so it reads on white
      col = mix(col, vec3(.36, .4, .5) * mix(vec3(1.0), film, .5), edge * .55);
      float a = .025 + fr * .66 + edge * .22 + win * .22 * fr + spec * fr;
      col += spec * .8;
      gl_FragColor = vec4(col, clamp(a, 0.0, .95) * uFade);
    }`;
  const bubbleMat = tint => new T.ShaderMaterial({
    vertexShader: BUBBLE_VS, fragmentShader: BUBBLE_FS, transparent: true, depthWrite: false, side: T.FrontSide,
    uniforms: { uTime: { value: 0 }, uWob: { value: .6 }, uTint: { value: new T.Color(tint) }, uFade: { value: 1 } }
  });

  const BUBBLE_INFLATE = [.47, .072, -.055];   // fat tubes, but no growing into the letter holes (no folds when see-through)
  H.bubbles = (el, words, { fontName = 'fredoka', onHit } = {}) => {
    const canvas = document.createElement('canvas');
    canvas.className = 'live3d'; canvas.setAttribute('aria-hidden', 'true');
    el.append(canvas);
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setClearColor(0, 0);
    const scene = new T.Scene();
    const cam = new T.OrthographicCamera(-1, 1, 1, -1, -2000, 2000); cam.position.z = 1000;
    const group = new T.Group(); scene.add(group);
    const meta = font(fontName).data, asc = meta.ascender * SIZE / 1000;
    let letters = [], W = 0, Hh = 0, px = 100, lineH = SIZE * 1.24, view = { l: 0, r: 1, t: 1, b: 0 };
    const allMats = [];
    const ray = new T.Raycaster(), ptr = new T.Vector2(-9, -9);
    let hover = null, tx = 0, ty = 0, t0 = performance.now();

    // free-floating little bubbles (like the loose bubbles in the reference)
    const sphere = new T.SphereGeometry(1, MOBILE ? 18 : 28, MOBILE ? 14 : 20);
    const floaters = [], pops = [];
    const floaterMat = () => { const m = bubbleMat('#bfe6ee'); m.uniforms.uWob.value = 0; allMats.push(m); return m; };
    const spawnFloater = initial => {
      const m = new T.Mesh(sphere, floaterMat()), s = 4 + Math.random() * 14;
      m.scale.setScalar(s);
      m.position.set(view.l + Math.random() * (view.r - view.l), initial ? view.b + Math.random() * (view.t - view.b) : view.b - 20, (Math.random() - .5) * 120);
      m.userData = { vy: 10 + Math.random() * 16, ph: Math.random() * 6.28, s };
      scene.add(m); floaters.push(m);
    };

    function layout() {
      px = parseFloat(getComputedStyle(el).fontSize) || 100;
      W = el.clientWidth;
      const maxW = W / px * SIZE;
      const space = (font(fontName).data.glyphs[' '] || { ha: 260 }).ha * SIZE / 1000 * 1.7;
      const lines = [[]]; let lx = 0;
      words.forEach(w => {
        const wW = [...w.text].reduce((s, ch) => s + glyphGeo(ch, fontName, BUBBLE_INFLATE).userData.adv * H.look.track, 0);
        if (lx > 0 && lx + wW > maxW) { lines.push([]); lx = 0; }
        lines[lines.length - 1].push({ ...w, x: lx }); lx += wW + space;
      });
      group.clear(); const old = letters; letters = [];
      lines.forEach((ln, li) => ln.forEach(w => {
        let x = w.x;
        [...w.text].forEach(ch => {
          const g = glyphGeo(ch, fontName, BUBBLE_INFLATE);
          if (ch.trim()) {
            const n = letters.length, mat = bubbleMat(w.color); allMats.push(mat);
            const m = new T.Mesh(g, mat);
            const home = new T.Vector3(x + g.userData.cx, -li * lineH + g.userData.cy, 0);
            // start low and scattered, like bubbles drifting up from below
            const s = old[n] ? old[n].s : { ox: (Math.random() - .5) * 160, oy: -260 - Math.random() * 260, vx: 0, vy: 0, sc: .2, vsc: 0,
              rz: (Math.random() - .5) * 1.2, vrz: 0, delay: n * .055, wob: 2.4, popT: -1 };
            m.position.copy(home); group.add(m);
            letters.push({ m, home, s, i: n });
          }
          x += g.userData.adv * H.look.track;
        });
      }));
      Hh = Math.ceil(lines.length * lineH / SIZE * px + px * .5);
      el.style.height = Hh + 'px';
      const oL = px * .15, oR = px * .5, oT = px * .3, oB = px * .4, u = SIZE / px;
      canvas.style.cssText = `left:${-oL}px;top:${-oT}px;width:${W + oL + oR}px;height:${Hh + oT + oB}px`;
      renderer.setPixelRatio(Math.min(MOBILE ? 1.5 : 2, devicePixelRatio || 1));
      renderer.setSize(W + oL + oR, Hh + oT + oB, false);
      const top = asc + SIZE * .3, units = Hh / px * SIZE, x0 = -SIZE * .06;
      view = { l: x0 - oL * u, r: x0 + maxW + oR * u, t: top + oT * u, b: top - units - oB * u };
      Object.assign(cam, { left: view.l, right: view.r, top: view.t, bottom: view.b }); cam.updateProjectionMatrix();
      if (!floaters.length) for (let i = 0; i < (MOBILE ? 6 : 11); i++) spawnFloater(true);
    }

    const toLocal = e => { const r = canvas.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); tx = ptr.x; ty = ptr.y; };
    const pick = () => { ray.setFromCamera(ptr, cam); const hit = ray.intersectObjects(group.children, false)[0]; return hit && letters.find(l => l.m === hit.object); };
    const burst = (pos, n) => {
      for (let i = 0; i < n; i++) {
        const m = new T.Mesh(sphere, floaterMat()), s = 2 + Math.random() * 6; m.scale.setScalar(s); m.position.copy(pos); m.position.z += 30;
        const a = Math.random() * 6.28, sp = 60 + Math.random() * 120; m.userData = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + 60, life: 1 };
        scene.add(m); pops.push(m);
      }
    };
    el.addEventListener('pointermove', e => {
      toLocal(e); const l = pick();
      if (l && l !== hover) { l.s.wob = 4; l.s.vsc += 1.5; onHit && onHit('hover', l); }
      hover = l || null; el.style.cursor = l ? 'pointer' : '';
    });
    el.addEventListener('pointerleave', () => { hover = null; tx = ty = 0; ptr.set(-9, -9); });
    el.addEventListener('pointerdown', e => {
      toLocal(e); const l = pick(); if (!l || l.s.popT >= 0) return;
      l.s.popT = 0; burst(l.m.getWorldPosition(new T.Vector3()), 9);   // pop! then it re-inflates
      onHit && onHit('pop', l);
    });

    let visible = true, raf = 0, last = performance.now(), running = false;
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && running && !raf) { last = performance.now(); raf = requestAnimationFrame(tick); } }).observe(el);
    function tick(now) {
      raf = 0;
      const elapsed = Math.min(.5, Math.max(0, (now - last) / 1000)); last = now;
      const t = (now - t0) / 1000;
      allMats.forEach(m => m.uniforms.uTime.value = t);
      group.rotation.y += ((reduce ? 0 : tx * .16) - group.rotation.y) * .05;
      group.rotation.x += ((reduce ? 0 : -ty * .12) - group.rotation.x) * .05;
      letters.forEach(l => {
        const s = l.s;
        for (let left = elapsed; left > 1e-6; left -= 1 / 120) {
          const dt = Math.min(left, 1 / 120);
          if (t < s.delay) continue;
          // soft, floaty springs: bubbles drift into place rather than snap
          s.vx += (-38 * s.ox - 5 * s.vx) * dt; s.ox += s.vx * dt;
          s.vy += (-38 * s.oy - 5 * s.vy) * dt; s.oy += s.vy * dt;
          s.vrz += (-30 * s.rz - 4 * s.vrz) * dt; s.rz += s.vrz * dt;
          let target = 1;
          if (s.popT >= 0) { s.popT += dt; target = s.popT < .08 ? 1.35 : s.popT < .7 ? 0 : 1; if (s.popT > 1.4) s.popT = -1; }
          s.vsc += (-90 * (s.sc - target) - 7 * s.vsc) * dt; s.sc += s.vsc * dt;
          s.wob += (.6 - s.wob) * dt * 1.5;
        }
        const ph = t * 1.1 + l.i * .7, floatY = reduce ? 0 : Math.sin(ph) * 5, sway = reduce ? 0 : Math.sin(ph * .8) * .05;
        l.m.position.set(l.home.x + s.ox, l.home.y + s.oy + floatY, Math.sin(ph * .6) * 10);
        l.m.rotation.z = s.rz + sway;
        l.m.scale.setScalar(Math.max(.001, s.sc));
        l.m.material.uniforms.uWob.value = reduce ? 0 : s.wob;
        l.m.material.uniforms.uFade.value = Math.min(1, Math.max(0, s.sc));
      });
      floaters.forEach(f => {
        const d = f.userData; f.position.y += d.vy * elapsed; f.position.x += Math.sin(t * .9 + d.ph) * 8 * elapsed;
        f.scale.setScalar(d.s * (1 + Math.sin(t * 3 + d.ph) * .04));
        if (f.position.y > view.t + 30) { f.position.y = view.b - 20; f.position.x = view.l + Math.random() * (view.r - view.l); }
      });
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i], d = p.userData; d.life -= elapsed * 1.4; d.vy -= 40 * elapsed;
        p.position.x += d.vx * elapsed; p.position.y += d.vy * elapsed; p.material.uniforms.uFade.value = Math.max(0, d.life);
        if (d.life <= 0) { scene.remove(p); p.material.dispose(); allMats.splice(allMats.indexOf(p.material), 1); pops.splice(i, 1); }
      }
      renderer.render(scene, cam);
      if (visible) raf = requestAnimationFrame(tick);
    }
    layout();
    renderer.render(scene, cam);
    let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 150); });
    return {
      start() { running = true; last = t0 = performance.now(); if (!raf) raf = requestAnimationFrame(tick); },
      relayout: layout,
      jiggle() { letters.forEach((l, i) => setTimeout(() => { l.s.vy += 120; l.s.wob = 4; }, i * 35)); }
    };
  };

  H.reset = () => { if (off) off.renderer.dispose(); off = null; geoCache.clear(); matCache.clear(); };   // after changing H.look
  H.ok = true;
})();

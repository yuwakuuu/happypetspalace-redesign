/* 3D trophy stage — a gold trophy on a velvet podium under a spotlight that bursts into sparkles and re-forms as a giant "6×"
   (Voted Best Pet Boarding in Mesa, six years running). With autoStart:false the page starts it (after its curtain
   reveal) by calling .start(); otherwise it starts when scrolled into view. Tap to replay the morph.
   Uses three r147 + MeshSurfaceSampler + the Fredoka typeface already loaded for the titles. */
(() => {
  const T = window.THREE;
  window.HPPTrophy = (host, { onEvent = () => {}, autoStart = true } = {}) => {
    if (!T || !T.MeshSurfaceSampler || !window.HPP_FONTS) return null;
    try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) return null; } catch { return null; }
    if (T.ColorManagement) T.ColorManagement.legacyMode = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const MOBILE = matchMedia('(max-width: 700px), (pointer: coarse)').matches;

    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(MOBILE ? 1.5 : 2, devicePixelRatio || 1));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.3;
    renderer.physicallyCorrectLights = true; renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.setClearColor(0, 0);
    host.prepend(renderer.domElement);
    const scene = new T.Scene();
    scene.environment = new T.PMREMGenerator(renderer).fromScene(new T.RoomEnvironment(), .04).texture;   // reflections that make the gold shine
    const cam = new T.PerspectiveCamera(34, 1, 1, 3000); cam.position.set(0, 88, 360); cam.lookAt(0, 58, 0);   // framed below the curtain valance

    /* lights: dim fill + the spotlight that "clicks on" */
    const hemi = new T.HemisphereLight('#f6eaf1', '#2a0819', .25); scene.add(hemi);
    const spot = new T.SpotLight('#fff3d6', 0, 900, .36, .55, 1);
    spot.position.set(0, 420, 120); spot.target.position.set(0, 40, 0); spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -.0005; scene.add(spot, spot.target);
    const rim = new T.DirectionalLight('#a9dbe4', 0);   // pink rim light: the theme's second tone rim.position.set(-200, 120, -150); scene.add(rim);
    // visible light cone
    const coneH = 430, coneGeo = new T.CylinderGeometry(8, Math.tan(.36) * coneH * .95, coneH, 48, 1, true);
    const coneMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
      uniforms: { uOn: { value: 0 } },
      vertexShader: 'varying float vY; varying vec3 vN; void main(){ vY = uv.y; vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform float uOn; varying float vY; varying vec3 vN; void main(){ float edge = pow(1.0-abs(vN.z), 1.5); float a = (1.0-edge*.7) * pow(vY, 1.4) * .34 * uOn; gl_FragColor = vec4(vec3(1.0,.93,.78)*a, a); }'
    });
    const cone = new T.Mesh(coneGeo, coneMat); cone.position.set(0, 40 + coneH / 2 - 8, 30); cone.rotation.x = Math.atan2(80, 380) * .5; scene.add(cone);
    // stage floor that catches the spotlight pool + shadow
    const fade = document.createElement('canvas'); fade.width = fade.height = 256;
    { const g = fade.getContext('2d'), gr = g.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, '#fff'); gr.addColorStop(.55, '#bbb'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); }
    const floor = new T.Mesh(new T.CircleGeometry(320, 64), new T.MeshStandardMaterial({ color: '#3a0c26', roughness: .55, metalness: .1, transparent: true, alphaMap: new T.CanvasTexture(fade) }));   // soft edge, no hard line
    floor.rotation.x = -Math.PI / 2; floor.position.y = -16; floor.receiveShadow = true; scene.add(floor);
    // round velvet podium with a gold rim; the trophy stands on top of it (its top is at y = 0)
    const velvet = new T.MeshPhysicalMaterial({ color: '#6b1c47', roughness: .85, sheen: 1, sheenColor: new T.Color('#7fcad7'), sheenRoughness: .5 });
    const podium = new T.Mesh(new T.CylinderGeometry(58, 62, 16, MOBILE ? 48 : 80), velvet); podium.position.y = -8; podium.receiveShadow = podium.castShadow = true; scene.add(podium);
    const rimGold = new T.Mesh(new T.TorusGeometry(58.5, 1.6, 12, MOBILE ? 48 : 96), new T.MeshPhysicalMaterial({ color: '#ffc845', metalness: 1, roughness: .25 }));
    rimGold.rotation.x = Math.PI / 2; scene.add(rimGold);

    /* the trophy */
    const gold = new T.MeshPhysicalMaterial({ color: '#ffd35a', metalness: 1, roughness: .16, clearcoat: .7, clearcoatRoughness: .1, envMapIntensity: 2.2 });
    const marble = new T.MeshPhysicalMaterial({ color: '#521034', roughness: .28, metalness: .05, clearcoat: 1, clearcoatRoughness: .1 });
    const trophy = new T.Group();
    const prof = [[0, 18], [10, 18], [12, 22], [7, 28], [5, 38], [6, 46], [12, 50], [16, 52], [27, 60], [34, 74], [38, 92], [40, 108], [42, 120], [39, 121], [36, 110], [33, 94], [28, 80], [20, 70], [10, 66], [0, 65]]
      .map(([x, y]) => new T.Vector2(x, y));
    const cup = new T.Mesh(new T.LatheGeometry(prof, MOBILE ? 48 : 80), gold); cup.castShadow = true; trophy.add(cup);
    const ARC = Math.PI * 1.15, handle = side => { const h = new T.Mesh(new T.TorusGeometry(15, 3.4, 18, 48, ARC), gold); h.position.set(side * 37, 96, 0); h.rotation.z = side > 0 ? -ARC / 2 : Math.PI - ARC / 2; h.castShadow = true; return h; };
    trophy.add(handle(1), handle(-1));
    const star = new T.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 13, a = i / 10 * Math.PI * 2 + Math.PI / 2; star[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
    const starM = new T.Mesh(new T.ExtrudeGeometry(star, { depth: 3, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.2, bevelSegments: 3 }), gold);
    starM.position.set(0, 88, 34); starM.rotation.x = -.18; trophy.add(starM);
    const base1 = new T.Mesh(new T.BoxGeometry(70, 12, 44), marble); base1.position.y = 6; base1.castShadow = base1.receiveShadow = true;
    const base2 = new T.Mesh(new T.BoxGeometry(52, 8, 32), marble); base2.position.y = 16; base2.castShadow = true;
    const plaque = new T.Mesh(new T.BoxGeometry(38, 6, 1.5), gold); plaque.position.set(0, 6, 22.5);
    trophy.add(base1, base2, plaque);
    scene.add(trophy);

    /* the big puffy "6" */
    const font = new T.Font(window.HPP_FONTS.fredoka);
    /* "6×": a big 6 and a smaller x beside it (the 3D font has no × glyph), merged into one puffy shape */
    const puff = (ch, size, bev) => { let g = new T.TextGeometry(ch, { font, size, height: 8, curveSegments: 18, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * .32, bevelOffset: -2, bevelSegments: 14 });
      g.deleteAttribute('normal'); g.deleteAttribute('uv'); g.computeBoundingBox(); return g; };
    const g6 = puff('6', 120, 22), gx = puff('x', 66, 14);
    gx.translate(g6.boundingBox.max.x + 16 - gx.boundingBox.min.x, 0, 0);
    let sixGeo = T.BufferGeometryUtils.mergeBufferGeometries([g6, gx]);
    sixGeo = T.BufferGeometryUtils.mergeVertices(sixGeo, .02); sixGeo.computeVertexNormals();
    sixGeo.computeBoundingBox(); { const b = sixGeo.boundingBox; sixGeo.translate(-(b.min.x + b.max.x) / 2, -b.min.y + 18, -(b.min.z + b.max.z) / 2); }
    const six = new T.Mesh(sixGeo, gold); six.castShadow = true; six.scale.setScalar(.001); scene.add(six);

    /* sparkle particles sampled from both shapes */
    const N = MOBILE ? 1100 : 2200;
    const sampleFrom = meshes => {
      const geos = meshes.map(m => { m.updateMatrixWorld(true); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); g.applyMatrix4(m.matrixWorld); ['normal', 'uv'].forEach(a => g.deleteAttribute(a)); return g; });
      const merged = T.BufferGeometryUtils.mergeBufferGeometries(geos), s = new T.MeshSurfaceSampler(new T.Mesh(merged)).build(), out = new Float32Array(N * 3), v = new T.Vector3();
      for (let i = 0; i < N; i++) { s.sample(v); out.set([v.x, v.y, v.z], i * 3); }
      return out;
    };
    const fromT = sampleFrom([cup, ...trophy.children.filter(c => c !== cup)]);
    six.scale.setScalar(1); six.updateMatrixWorld(true); const fromS = sampleFrom([six]); six.scale.setScalar(.001);
    const pGeo = new T.BufferGeometry(), pPos = new Float32Array(N * 3), seeds = new Float32Array(N);
    for (let i = 0; i < N; i++) seeds[i] = Math.random();
    pGeo.setAttribute('position', new T.BufferAttribute(pPos, 3)); pGeo.setAttribute('seed', new T.BufferAttribute(seeds, 1));
    const pMat = new T.ShaderMaterial({
      transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      uniforms: { uA: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uT: { value: 0 } },
      vertexShader: 'attribute float seed; uniform float uPx; uniform float uT; varying float vS; void main(){ vS = seed; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = (2.2 + seed*3.8) * uPx * (330.0 / -mv.z) * (0.75 + 0.25*sin(uT*9.0 + seed*40.0)); }',
      fragmentShader: 'uniform float uA; varying float vS; void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); float a = smoothstep(.5, .0, d) * uA; vec3 col = mix(vec3(1.0,.78,.3), vec3(1.0,.97,.85), vS); gl_FragColor = vec4(col*a, a); }'
    });
    const points = new T.Points(pGeo, pMat); scene.add(points);
    // a few glints that twinkle on the gold while it's under the light (they ride along with the trophy)
    const G = 26, gGeo = new T.BufferGeometry(), gPos = new Float32Array(G * 3), gSeed = new Float32Array(G);
    for (let i = 0; i < G; i++) { const j = (Math.random() * N | 0) * 3; gPos.set([fromT[j] * 1.02, fromT[j + 1], fromT[j + 2] * 1.02 + 2], i * 3); gSeed[i] = Math.random(); }
    gGeo.setAttribute('position', new T.BufferAttribute(gPos, 3)); gGeo.setAttribute('seed', new T.BufferAttribute(gSeed, 1));
    const gMat = pMat.clone(); gMat.uniforms.uA.value = 0; gMat.uniforms.uPx.value = renderer.getPixelRatio() * 1.8;
    const glints = new T.Points(gGeo, gMat); trophy.add(glints);

    /* layout */
    const size = () => { const w = host.clientWidth, h = host.clientHeight; renderer.setSize(w, h, false); renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'; cam.aspect = w / h; baseZ = w / h < .9 ? 500 : 395; cam.position.z = baseZ + dolly; cam.updateProjectionMatrix(); pMat.uniforms.uPx.value = renderer.getPixelRatio(); };
    let baseZ = 360, dolly = 0;   // dolly: extra camera distance, eased away as the trophy is revealed
    size(); addEventListener('resize', size);

    /* timeline: off -> spotlight on -> trophy spins -> burst into sparkles -> "6" -> back ... */
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    let state = 'idle', st = 0, lightOn = 0, shape = 'trophy', morph = 0, morphDir = 1, raf = 0, last = 0, started = false, visible = false;
    const startMorph = () => { if (state === 'morph') return; state = 'morph'; st = 0; morphDir = shape === 'trophy' ? 1 : -1; onEvent('morph', shape === 'trophy' ? 'six' : 'trophy'); };
    host.addEventListener('click', () => { if (started) startMorph(); });
    function frame(now) {
      raf = 0;
      const dt = Math.min(.25, (now - (last || now)) / 1000); last = now; st += dt;   // real time, so slow devices don't play in slow motion
      const t = now / 1000;
      pMat.uniforms.uT.value = t; gMat.uniforms.uT.value = t * 1.3;
      gMat.uniforms.uA.value = shape === 'trophy' && state !== 'morph' ? lightOn * (.55 + .45 * Math.sin(t * 2.3)) : 0;
      // spotlight warms up with a little flicker
      if (state !== 'idle') lightOn = Math.min(1, lightOn + dt * 2.2);
      const flick = lightOn < 1 ? (Math.sin(t * 60) > .2 ? 1 : .55) : 1;
      spot.intensity = 5200 * lightOn * flick; rim.intensity = 1.6 * lightOn; hemi.intensity = .35 + .6 * lightOn;
      coneMat.uniforms.uOn.value = lightOn * flick;
      const spin = reduce ? 0 : t * .9;
      if (state === 'intro') {   // trophy rises into the light
        const p = Math.min(1, st / 1.8); trophy.position.y = -60 * (1 - ease(p)); trophy.rotation.y = spin + (1 - p) * 4;
        dolly = 120 * (1 - ease(p)); cam.position.z = baseZ + dolly;   // the camera glides in as it rises
        if (p >= 1) { state = 'show'; st = 0; onEvent('lit'); }
      } else if (state === 'show') {
        (shape === 'trophy' ? trophy : six).rotation.y = spin;
        if (st > (shape === 'trophy' ? 2.6 : 4.2)) startMorph();
      } else if (state === 'morph') {
        const D = 1.9, p = Math.min(1, st / D), e = ease(p), a = morphDir > 0 ? fromT : fromS, b = morphDir > 0 ? fromS : fromT;
        const fromObj = morphDir > 0 ? trophy : six, toObj = morphDir > 0 ? six : trophy;
        // source shape shrinks into sparkles, sparkles swirl and re-form, target shape pops in
        fromObj.scale.setScalar(Math.max(.001, 1 - Math.min(1, p * 4)));
        toObj.scale.setScalar(p > .82 ? Math.min(1, (p - .82) / .18) * 1.0 + .001 : .001);
        pMat.uniforms.uA.value = Math.sin(Math.min(1, p) * Math.PI) * 1.2;
        const swirl = (1 - e) * 2.4, lift = Math.sin(p * Math.PI) * 40, cs = Math.cos(swirl), sn = Math.sin(swirl);
        for (let i = 0; i < N; i++) {
          const k = i * 3, s = seeds[i], ee = Math.min(1, Math.max(0, (e - s * .25) / .75));
          const x = a[k] + (b[k] - a[k]) * ee, y = a[k + 1] + (b[k + 1] - a[k + 1]) * ee + lift * (1 - Math.abs(.5 - s)), z = a[k + 2] + (b[k + 2] - a[k + 2]) * ee;
          pPos[k] = x * cs - z * sn + Math.sin(t * 3 + s * 30) * 4 * (1 - ee); pPos[k + 1] = y; pPos[k + 2] = x * sn + z * cs;
        }
        pGeo.attributes.position.needsUpdate = true;
        if (p >= 1) { shape = morphDir > 0 ? 'six' : 'trophy'; state = 'show'; st = 0; pMat.uniforms.uA.value = 0; toObj.scale.setScalar(1); fromObj.scale.setScalar(.001); }
      }
      // little bounce on the 6 when it lands
      if (shape === 'six' && state === 'show' && st < .6) six.scale.setScalar(1 + Math.sin(st / .6 * Math.PI) * .12);
      renderer.render(scene, cam);
      if (visible) raf = requestAnimationFrame(frame);
    }
    const start = () => { if (started) return; started = true; state = 'intro'; st = 0; dolly = 120; cam.position.z = baseZ + dolly; onEvent('on'); if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
    trophy.position.y = -60;   // hidden below the podium until the show starts
    renderer.render(scene, cam);
    new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      if (autoStart && visible && es[0].intersectionRatio > .35 && !started) start();
      if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    }, { threshold: [0, .35, .6] }).observe(host);
    return { replay: startMorph, start };
  };
})();

// ===== CRYPTIN 3D COIN — free-fall effect on intro click =====
(function initCoin3D() {
    'use strict';

    const wall     = document.getElementById('intro-wall');
    const btnEnter = document.getElementById('introEnter');
    if (!wall || typeof THREE === 'undefined') return;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    // no tone mapping — keeps texture colours true-to-source
    Object.assign(renderer.domElement.style, {
        position:      'fixed',
        inset:         '0',
        pointerEvents: 'none',
        zIndex:        '10000',
        background:    'transparent',
    });
    document.body.appendChild(renderer.domElement);

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // ── Camera ────────────────────────────────────────────────────────────────
    const CAM_FOV = 45;
    const CAM_Z   = 10;
    let   aspect  = window.innerWidth / window.innerHeight;
    const camera  = new THREE.PerspectiveCamera(CAM_FOV, aspect, 0.1, 100);
    camera.position.z = CAM_Z;

    function halfH()        { return Math.tan((CAM_FOV * 0.5) * Math.PI / 180) * CAM_Z; }
    function halfW()        { return halfH() * aspect; }
    function pxToWorldX(px) { return ((px / window.innerWidth) - 0.5) * 2 * halfW(); }

    // ── Lighting ──────────────────────────────────────────────────────────────
    // Gentle ambient — enough to read the coin face without over-exposure
    scene.add(new THREE.AmbientLight(0xfff5cc, 1.6));

    // Key light from upper-right
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(5, 8, 10);
    scene.add(key);

    // Face light — close to camera, keeps the engraving readable
    const faceLit = new THREE.PointLight(0xfff0dd, 1.8, 35);
    faceLit.position.set(0, 1, 9);
    scene.add(faceLit);

    // Warm fill from left
    const fill = new THREE.PointLight(0xffcc55, 0.9, 50);
    fill.position.set(-7, 2, 6);
    scene.add(fill);

    // ── Coin geometry ─────────────────────────────────────────────────────────
    //   CylinderGeometry groups: 0 = side edge, 1 = top cap (y+), 2 = bottom cap (y-)
    const COIN_R  = 0.58;   // minimal kleiner
    const COIN_T  = 0.17;   // thick coin — visible edge when tumbling
    const coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_T, 128, 1);

    // ── Texture ───────────────────────────────────────────────────────────────
    const tex = new THREE.TextureLoader().load('Graphics/cryptin_coin_logo.png');
    if (THREE.SRGBColorSpace !== undefined) {
        tex.colorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding !== undefined) {
        tex.encoding = THREE.sRGBEncoding;
    }

    // ── Materials ─────────────────────────────────────────────────────────────
    // FACE — low metalness so the coin texture (C logo + engraving) is fully visible.
    // A slight emissive ensures the design shows even in shadow.
    const MatType = THREE.MeshPhysicalMaterial || THREE.MeshStandardMaterial;

    // FACE — MeshBasicMaterial: ignores all lighting, shows the PNG texture
    // exactly as-is. The coin image already has realistic gold + engraving
    // baked in, so this is the cleanest way to guarantee full visibility.
    // color multiplies the texture — 0xaaaaaa = ~67 % brightness, slightly less glaring
    const mFace = new THREE.MeshBasicMaterial({ map: tex, color: 0xaaaaaa });

    // EDGE — rich gold, metallic (3D lighting applies here for the rim shine)
    const mEdge = new MatType({
        color:     new THREE.Color(0xd4a030),
        metalness: 0.97,
        roughness: 0.12,
    });

    // BACK — warm gold, slightly less polished
    const mBack = new MatType({
        color:     new THREE.Color(0xc89020),
        metalness: 0.92,
        roughness: 0.22,
    });

    const coinMats = [mEdge, mFace, mFace];  // side, front, back — texture on both faces

    // ── Active coin pool ──────────────────────────────────────────────────────
    const coins = [];
    const MAX_COINS = 30;

    function spawnCoin(screenX) {
        if (!document.getElementById('intro-wall')) return;

        if (coins.length >= MAX_COINS) {
            scene.remove(coins.shift().group);
        }

        const mesh  = new THREE.Mesh(coinGeo, coinMats);
        // rotation.x = π/2 → top-cap normal (local +Y) becomes +Z (toward camera)
        mesh.rotation.x = Math.PI / 2;

        const group = new THREE.Group();
        group.add(mesh);

        const wx = pxToWorldX(screenX) + (Math.random() - 0.5) * 0.5;
        const wz = (Math.random() - 0.5) * 0.8;

        group.position.set(wx, halfH() + COIN_R + 1.6, wz);

        // Start at a random tilt — sometimes face-on, sometimes edge-on
        group.rotation.x = (Math.random() - 0.5) * Math.PI * 0.6;
        group.rotation.z = Math.random() * Math.PI * 2;

        scene.add(group);

        coins.push({
            group,
            vy:      -(0.1 + Math.random() * 0.4),
            vx:      (Math.random() - 0.5) * 0.4,
            gravity: -(8 + Math.random() * 5),       // 8–13 — natural pace
            rSpeedX: (Math.random() > 0.5 ? 1 : -1) * (2.5 + Math.random() * 5),
            rSpeedZ: (Math.random() - 0.5) * 1.8,
            exitY:   -(halfH() + COIN_R + 1.8),
        });
    }

    // ── Click listener ────────────────────────────────────────────────────────
    wall.addEventListener('click', (e) => {
        if (window._mgActive) return;   // mini-game is running — no 3-D coins
        if (e.target === btnEnter || btnEnter.contains(e.target)) return;
        spawnCoin(e.clientX);
    });

    // ── Render loop ───────────────────────────────────────────────────────────
    let last = performance.now();

    function loop() {
        if (!document.getElementById('intro-wall')) {
            renderer.domElement.remove();
            renderer.dispose();
            return;
        }
        requestAnimationFrame(loop);

        const now = performance.now();
        const dt  = Math.min((now - last) / 1000, 0.05);
        last = now;

        for (let i = coins.length - 1; i >= 0; i--) {
            const c = coins[i];
            c.vy += c.gravity * dt;
            c.group.position.y += c.vy * dt;
            c.group.position.x += c.vx * dt;
            c.group.rotation.x += c.rSpeedX * dt;
            c.group.rotation.z += c.rSpeedZ * dt;
            if (c.group.position.y < c.exitY) {
                scene.remove(c.group);
                coins.splice(i, 1);
            }
        }

        renderer.render(scene, camera);
    }
    loop();

    // ── Resize ────────────────────────────────────────────────────────────────
    window.addEventListener('resize', () => {
        aspect = window.innerWidth / window.innerHeight;
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
})();

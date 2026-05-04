// ===== INTRO WALL — fullscreen image shatters into bricks via GSAP =====
(function initIntro() {
    const wall    = document.getElementById('intro-wall');
    const bgImg   = document.getElementById('introBgImg');
    const svg     = document.getElementById('introSvg');
    const chunksG = document.getElementById('introChunks');
    const cracksG = document.getElementById('introCracks');
    const dustG   = document.getElementById('introDust');
    const enter    = document.getElementById('introEnter');
    const miniGame = document.getElementById('introMiniGame');
    if (!wall || !enter || typeof gsap === 'undefined') return;

    // ── Page-load gate: fade out loader, then fade intro wall in calmly ──────
    const loader = document.getElementById('pageLoader');

    function revealWall() {
        wall.style.transition = 'opacity 0.9s ease';
        wall.style.opacity    = '1';
        // Remove transition after it finishes so GSAP can control opacity freely
        setTimeout(() => { wall.style.transition = ''; }, 950);
    }

    function onPageReady() {
        if (loader) {
            // ── Core fix: show wall WHILE loader still covers everything ──────────
            // Step 1: decode the wall image first so it paints in the same frame
            const showWall = () => {
                wall.style.transition = 'none';
                wall.style.opacity    = '1';
                // Two rAFs → browser commits the wall repaint before loader fades.
                // This guarantees the stone wall is fully on-screen when the
                // loader becomes transparent — main page is never exposed.
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        wall.style.transition = '';   // hand opacity back to GSAP
                        loader.classList.add('ldr-out');
                        setTimeout(() => { if (loader.parentNode) loader.remove(); }, 580);
                    });
                });
            };
            // bgImg is guaranteed complete at window.load; decode() ensures it is
            // painted (not just downloaded) before we snap the wall to visible.
            if (typeof bgImg.decode === 'function') {
                bgImg.decode().then(showWall).catch(showWall);
            } else {
                showWall();
            }
        } else {
            revealWall();
        }
    }

    if (document.readyState === 'complete') {
        // Already fully loaded (e.g. hard-cached) — tiny delay so the fade
        // still registers as a transition rather than an instant pop
        setTimeout(onPageReady, 60);
    } else {
        window.addEventListener('load', onPageReady, { once: true });
    }

    // FOUC prevention: opaque until the intro image has loaded.
    // Removed as soon as the image fires 'load' (or instantly if already cached)
    // so Chrome always paints the hero behind the transparent wall before ENTER is clicked.
    wall.style.background = '#03080D';
    function clearWallBg() { wall.style.background = ''; }
    if (bgImg.complete) {
        clearWallBg();
    } else {
        bgImg.addEventListener('load',  clearWallBg, { once: true });
        bgImg.addEventListener('error', clearWallBg, { once: true });
    }

    document.body.classList.add('intro-locked');
    document.documentElement.classList.add('intro-locked');

    const W = 1920, H = 1080;
    const cx = W / 2, cy = H / 2;
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const rnd = (a, b) => a + Math.random() * (b - a);

    /* ---------- Geometry: brick grid extracted from the actual image ----------
       The PowerShell scan of cryptin_intro_wall.png (3840x2160) found the real
       mortar lines. Each "band" is a row, "xs" are the vertical seam positions
       inside that row. SVG viewBox is 1920x1080, so all coords get *0.5. */
    const wallGrid = [
        { yT: 0,    yB: 157,  xs: [0, 323, 818, 1464, 3840] },
        { yT: 157,  yB: 469,  xs: [0, 323, 823, 2441, 3158, 3840] },
        { yT: 469,  yB: 907,  xs: [0, 510, 2851, 3840] },
        { yT: 907,  yB: 1323, xs: [0, 508, 2851, 3840] },
        { yT: 1323, yB: 1601, xs: [0, 508, 2840, 3840] },
        { yT: 1601, yB: 1901, xs: [0, 198, 888, 1588, 2724, 3470, 3840] },
        { yT: 1901, yB: 2160, xs: [0, 193, 543, 882, 1575, 2720, 3484, 3840] }
    ];

    const chunks = [];
    function pushChunk(pts) {
        const polygon = document.createElementNS(SVG_NS, 'polygon');
        const ptsStr = pts.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
        polygon.setAttribute('points', ptsStr);
        chunksG.appendChild(polygon);
        const ccx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const ccy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const size = Math.max.apply(null, pts.map(p => Math.hypot(p.x - ccx, p.y - ccy)));
        chunks.push({ element: polygon, cx: ccx, cy: ccy, size });
    }

    const SCALE = 0.5;       // image pixels → SVG units
    wallGrid.forEach(band => {
        const yT = band.yT * SCALE;
        const yB = band.yB * SCALE;
        for (let i = 0; i < band.xs.length - 1; i++) {
            const xL = band.xs[i] * SCALE;
            const xR = band.xs[i + 1] * SCALE;
            // Tiny jitter so edges don't look CGI-perfect
            const j = 1.5;
            pushChunk([
                { x: xL + rnd(-j, j), y: yT + rnd(-j, j) },
                { x: xR + rnd(-j, j), y: yT + rnd(-j, j) },
                { x: xR + rnd(-j, j), y: yB + rnd(-j, j) },
                { x: xL + rnd(-j, j), y: yB + rnd(-j, j) },
            ]);
        }
    });

    /* ---------- Sync logo position to .hero-logo ---------- */
    const introLogo = document.getElementById('introLogo');
    const heroLogo  = document.querySelector('.hero-logo');

    function syncIntroLogoPos() {
        if (!introLogo || !heroLogo) return;
        // Both logos run heroLogoFloat. getBoundingClientRect already includes
        // the current transform offset — subtract it so the intro-logo's anchor
        // is the natural position, otherwise the float gets applied twice.
        const t = getComputedStyle(heroLogo).transform;
        let translateY = 0;
        if (t && t !== 'none') {
            const m = t.match(/matrix\(([^)]+)\)/);
            if (m) {
                const v = m[1].split(',').map(s => parseFloat(s));
                translateY = v[5] || 0;
            }
        }
        const r = heroLogo.getBoundingClientRect();
        if (r.width === 0) return;
        introLogo.style.left   = r.left + 'px';
        introLogo.style.top    = (r.top - translateY) + 'px';
        introLogo.style.width  = r.width + 'px';
        introLogo.style.height = r.height + 'px';
    }
    syncIntroLogoPos();
    window.addEventListener('resize', syncIntroLogoPos);
    window.addEventListener('load', syncIntroLogoPos);
    setTimeout(syncIntroLogoPos, 50);
    setTimeout(syncIntroLogoPos, 250);

    /* ---------- Click handler: instant wall break ---------- */
    let triggered = false;
    enter.addEventListener('click', () => {
        if (triggered) return;
        triggered = true;
        enter.style.pointerEvents = 'none';

        const tl = gsap.timeline({ onComplete: () => wall.remove() });

        // ENTER + Mini-Game link fade out together
        const fadeTargets = miniGame ? [enter, miniGame] : [enter];
        tl.to(fadeTargets, { opacity: 0, duration: 0.2, ease: 'power1.out' }, 0);

        // Bg image → chunks at t=0 so the wall breaks the moment ENTER is clicked
        tl.to(bgImg, { opacity: 0, duration: 0.12 }, 0);
        tl.set(chunks.map(c => c.element), { opacity: 1 }, 0);

        // Bricks tumble down with gravity, stagger from centre outward
        tl.add('fall', 0);
        chunks.forEach((chunk) => {
            const dx = chunk.cx - cx;
            const dy = chunk.cy - cy;
            const dist = Math.hypot(dx, dy) || 1;
            const distNorm = Math.min(dist / 800, 1);

            const fallY  = H + 600 + Math.random() * 400;
            const horiz  = (chunk.cx - cx) * 0.08 + rnd(-50, 50);
            const rot    = rnd(-22, 22);
            const dur    = 1.05 + rnd(-0.1, 0.35);
            const offset = distNorm * 0.22;

            tl.to(chunk.element, {
                y: fallY,
                x: horiz,
                rotation: rot,
                duration: dur,
                ease: 'power2.in',
            }, 'fall+=' + offset);
        });

        // Whole intro overlay fades — main page is already visible behind
        tl.to(wall, { opacity: 0, duration: 0.55, ease: 'power2.out' }, 1.3);

        // Unlock scroll the moment the wall finishes fading (~1.85s)
        tl.add(() => {
            document.body.classList.remove('intro-locked');
            document.documentElement.classList.remove('intro-locked');
        }, 1.85);
    });

    // Prevent browser from dragging the background image or logo when the user drags
    wall.addEventListener('dragstart', e => e.preventDefault());

    document.addEventListener('keydown', (e) => {
        if (triggered) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            enter.click();
        }
    });
})();

// ===== NEWS TABS =====
document.querySelectorAll('.news-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.news-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
    });
});

// ===== PAGINATION =====
document.querySelectorAll('.pagination .page').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('page-last')) return;
        document.querySelectorAll('.pagination .page').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
    });
});

// ===== PASSWORD EYE TOGGLE =====
document.querySelectorAll('.input-eye').forEach(eye => {
    eye.addEventListener('click', () => {
        const input = eye.parentElement.querySelector('input');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
    });
});

// ===== SMOOTH SCROLL =====
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href === '#' || href.length <= 1) return;
        const target = document.querySelector(href);
        if (target) {
            e.preventDefault();
            const offset = 90;
            const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    });
});

// ===== PICKAXE CURSOR ROTATION ON MOUSE PRESS =====
window.addEventListener('mousedown', () => {
    document.documentElement.classList.add('clicking');
});
window.addEventListener('mouseup', () => {
    document.documentElement.classList.remove('clicking');
});
window.addEventListener('blur', () => {
    document.documentElement.classList.remove('clicking');
});
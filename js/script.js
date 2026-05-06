// ===== INTRO WALL — fullscreen image shatters into bricks via GSAP =====
(function initIntro() {
    // ── Kill browser scroll restoration immediately so a hard-reload with
    //    '#' in the URL never causes the page to start at a scrolled position.
    //    This must happen before any layout/measurement code runs.
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;

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

    let _syncLogoAttempts = 0;
    function syncIntroLogoPos() {
        if (!introLogo || !heroLogo) return;
        const r = heroLogo.getBoundingClientRect();
        // Guard: layout not ready yet if width is 0  OR  the hero logo is
        // sitting at the very top (top < 60 px means the hero section hasn't
        // been given its full height yet — font/image still loading).
        // Retry every 50 ms for up to 3 seconds (60 attempts).
        if (r.width === 0 || r.top < 60) {
            if (++_syncLogoAttempts < 60) setTimeout(syncIntroLogoPos, 50);
            return;
        }
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
        _syncLogoAttempts = 0;
        introLogo.style.left      = r.left + 'px';
        introLogo.style.top       = (r.top - translateY) + 'px';
        introLogo.style.width     = r.width + 'px';
        introLogo.style.height    = r.height + 'px';
        introLogo.style.transform = 'none'; // clear CSS fallback transform
    }
    syncIntroLogoPos();
    window.addEventListener('resize', syncIntroLogoPos);
    window.addEventListener('load', syncIntroLogoPos);
    setTimeout(syncIntroLogoPos, 50);
    setTimeout(syncIntroLogoPos, 250);

    /* ---------- Wall collapse sound (Web Audio API) ---------- */
    function playWallCollapseSound() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            const ctx = new AC();
            const now = ctx.currentTime;

            // Brown noise generator (warm, deep rumble character)
            function brownNoiseBuf(dur) {
                const len = Math.ceil(ctx.sampleRate * dur);
                const buf = ctx.createBuffer(1, len, ctx.sampleRate);
                const d = buf.getChannelData(0);
                let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
                for (let i = 0; i < len; i++) {
                    const w = Math.random() * 2 - 1;
                    b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
                    b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
                    b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
                    d[i] = (b0+b1+b2+b3+b4+b5+b6+w*0.5362) * 0.11;
                    b6 = w * 0.115926;
                }
                return buf;
            }
            function whiteBuf(dur) {
                const len = Math.ceil(ctx.sampleRate * dur);
                const buf = ctx.createBuffer(1, len, ctx.sampleRate);
                const d = buf.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
                return buf;
            }
            function play(buf, t, dur, freqLo, freqHi, peakGain, endGain) {
                const src = ctx.createBufferSource(); src.buffer = buf;
                const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = freqHi;
                const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = freqLo;
                const g  = ctx.createGain();
                g.gain.setValueAtTime(0.001, t);
                g.gain.linearRampToValueAtTime(peakGain, t + 0.012);
                g.gain.exponentialRampToValueAtTime(Math.max(endGain, 0.0001), t + dur);
                src.connect(lp); lp.connect(hp); hp.connect(g); g.connect(ctx.destination);
                src.start(t); src.stop(t + dur + 0.05);
            }

            const bn  = brownNoiseBuf(3.0);
            const wn  = whiteBuf(3.0);

            // 1 — Very soft initial crack
            play(wn,  now,        0.06,  300, 2000, 0.08, 0.001);
            // 2 — Sub-bass impact pulse
            play(bn,  now + 0.01, 0.55,   20,  180, 0.9,  0.001);
            // 3 — Deep stone rumble
            play(bn,  now + 0.03, 2.20,   40,  320, 0.75, 0.001);
            play(bn,  now + 0.08, 1.80,   80,  550, 0.55, 0.001);
            // 4 — Mid crumble layer
            play(bn,  now + 0.05, 1.60,  200,  900, 0.40, 0.001);
            // 5 — Individual stone impacts (randomised cascade)
            for (let i = 0; i < 22; i++) {
                const t  = now + 0.04 + Math.random() * 1.6;
                const lo = 70  + Math.random() * 250;
                const hi = lo  + 150 + Math.random() * 500;
                const gv = 0.12 + Math.random() * 0.38;
                const dv = 0.03 + Math.random() * 0.14;
                play(brownNoiseBuf(dv + 0.06), t, dv, lo, hi, gv, 0.001);
            }
            // 6 — Dust / high-freq hiss (fades away)
            play(wn,  now + 0.08, 2.20, 2500, 11000, 0.027, 0.001);

            setTimeout(() => ctx.close().catch(()=>{}), 4000);
        } catch(e) { /* AudioContext unavailable — silent fail */ }
    }

    /* ---------- Click handler: instant wall break ---------- */
    let triggered = false;
    enter.addEventListener('click', () => {
        if (triggered) return;
        triggered = true;
        enter.style.pointerEvents = 'none';

        // Fire wall collapse sound immediately on click
        playWallCollapseSound();

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
        // Also force scroll to top — the '#' URL or browser scroll-restore
        // might have left the page at a non-zero offset while locked.
        tl.add(() => {
            window.scrollTo(0, 0);
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

// ===== LIVE STRIP COUNTER ANIMATION =====
// Bar is now fixed at the bottom — counters start counting up on page load.
(function initCounters() {
    const easeOut = t => 1 - Math.pow(1 - t, 3);

    function animateCounter(el, target, duration) {
        const start = performance.now();
        const step = now => {
            const progress = Math.min((now - start) / duration, 1);
            const value = Math.round(easeOut(progress) * target);
            el.textContent = value >= 1000
                ? value.toLocaleString('de-DE')
                : String(value);
            if (progress < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }

    const liveVals = document.querySelectorAll('.live-val[data-count]');
    if (!liveVals.length) return;

    // Start immediately when the page (and intro wall) is ready — small stagger
    // so each number counts up at a slightly different speed for visual variety.
    function startCounters() {
        liveVals.forEach((el, i) => {
            const target = parseInt(el.dataset.count, 10);
            setTimeout(() => animateCounter(el, target, 1400 + i * 120), i * 80);
        });
    }

    if (document.readyState === 'complete') {
        startCounters();
    } else {
        window.addEventListener('load', startCounters, { once: true });
    }
})();
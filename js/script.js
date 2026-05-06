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

    /* ---------- Coin drop sound — FM synthesis (metallic character) ---------- */
    function playCoinSound() {
        try {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            const ctx = new AC();
            const now = ctx.currentTime;

            // FM voice: carrier + inharmonic modulator
            // High mod-index at start = metallic "ting", decays to dull thud
            function fmCoin(carrierHz, modRatio, modIdx, gain, dur) {
                const carrier = ctx.createOscillator(); carrier.type = 'sine';
                carrier.frequency.value = carrierHz;

                const mod = ctx.createOscillator(); mod.type = 'sine';
                mod.frequency.value = carrierHz * modRatio;

                // Mod index envelope: bright metallic attack → fades out fast
                const modG = ctx.createGain();
                modG.gain.setValueAtTime(carrierHz * modIdx, now);
                modG.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

                // Low-pass to keep it dumpf
                const lp = ctx.createBiquadFilter();
                lp.type = 'lowpass'; lp.frequency.value = 1100;

                // Output envelope
                const outG = ctx.createGain();
                outG.gain.setValueAtTime(0.001, now);
                outG.gain.linearRampToValueAtTime(gain, now + 0.002);
                outG.gain.exponentialRampToValueAtTime(0.001, now + dur);

                mod.connect(modG); modG.connect(carrier.frequency);
                carrier.connect(lp); lp.connect(outG); outG.connect(ctx.destination);

                carrier.start(now); carrier.stop(now + dur + 0.05);
                mod.start(now);     mod.stop(now + dur + 0.05);
            }

            // Two FM voices — main hit + softer upper partial
            fmCoin(700, 1.414, 3.5, 0.40, 0.45);   // √2 ratio = inharmonic/metallic
            fmCoin(1100, 1.732, 2.0, 0.18, 0.30);  // √3 ratio, softer

            setTimeout(() => ctx.close().catch(() => {}), 2000);
        } catch(e) {}
    }

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

            // 1 — Initial crack (disabled for test)
            // play(wn,  now,        0.06,  300, 2000, 0.08, 0.001);
            // 2 — Sub-bass impact pulse (disabled — sounds like gong)
            // play(bn,  now + 0.01, 0.55,   20,  180, 0.9,  0.001);
            // 3 — Deep stone rumble (disabled)
            // play(bn,  now + 0.03, 2.20,   40,  320, 0.75, 0.001);
            // 4a — Second rumble layer (disabled)
            // play(bn,  now + 0.08, 1.80,   80,  550, 0.55, 0.001);
            // 4b — Mid crumble layer (disabled)
            // play(bn,  now + 0.05, 1.60,  200,  900, 0.40, 0.001);

            // 7 — Kurzer tiefer Bass-Schlag
            (function bassTone() {
                const o = ctx.createOscillator(); o.type = 'sine';
                o.frequency.setValueAtTime(55, now);
                o.frequency.exponentialRampToValueAtTime(22, now + 0.22);
                const g = ctx.createGain();
                g.gain.setValueAtTime(0.001, now);
                g.gain.linearRampToValueAtTime(3.5, now + 0.002);
                g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                o.connect(g); g.connect(ctx.destination);
                o.start(now); o.stop(now + 0.25);
            })();
            // 5 — Realistic stone block impacts
            // Layer A: hard white-noise transient (stone surface contact, 8ms)
            // Layer B: sub-bass brown-noise body (mass/weight of the block, ~150ms)
            function mkBrown(dur) {
                const len = Math.ceil(ctx.sampleRate * dur);
                const buf = ctx.createBuffer(1, len, ctx.sampleRate);
                const d   = buf.getChannelData(0);
                let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
                for (let j=0;j<len;j++){const w=Math.random()*2-1;b0=0.99886*b0+w*0.0555179;b1=0.99332*b1+w*0.0750759;b2=0.96900*b2+w*0.1538520;b3=0.86650*b3+w*0.3104856;b4=0.55000*b4+w*0.5329522;b5=-0.7616*b5-w*0.0168980;d[j]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11;b6=w*0.115926;}
                return buf;
            }
            function mkWhite(dur) {
                const len = Math.ceil(ctx.sampleRate * dur);
                const buf = ctx.createBuffer(1, len, ctx.sampleRate);
                const d   = buf.getChannelData(0);
                for (let j=0;j<len;j++) d[j]=Math.random()*2-1;
                return buf;
            }

            function stoneImpact(t, freq, gain, dur) {
                // A — Hard transient: white noise, filtered 300–2500 Hz, 8 ms
                const ws = ctx.createBufferSource(); ws.buffer = mkWhite(0.02);
                const wlp = ctx.createBiquadFilter(); wlp.type='lowpass';  wlp.frequency.value=200;
                const whp = ctx.createBiquadFilter(); whp.type='highpass'; whp.frequency.value=50;
                const wg  = ctx.createGain();
                wg.gain.setValueAtTime(gain * 1.5, t);
                wg.gain.exponentialRampToValueAtTime(0.001, t + 0.008);
                ws.connect(wlp); wlp.connect(whp); whp.connect(wg); wg.connect(ctx.destination);
                ws.start(t); ws.stop(t + 0.025);

                // B — Sub-bass body: brown noise, filtered 40–200 Hz, slower decay
                const bs  = ctx.createBufferSource(); bs.buffer = mkBrown(dur + 0.05);
                const blp = ctx.createBiquadFilter(); blp.type='lowpass';  blp.frequency.value=freq*0.65;
                const bhp = ctx.createBiquadFilter(); bhp.type='highpass'; bhp.frequency.value=freq*0.35;
                const bg  = ctx.createGain();
                bg.gain.setValueAtTime(0.001, t);
                bg.gain.linearRampToValueAtTime(gain * 0.9, t + 0.004);
                bg.gain.exponentialRampToValueAtTime(0.001, t + dur);
                bs.connect(blp); blp.connect(bhp); bhp.connect(bg); bg.connect(ctx.destination);
                bs.start(t); bs.stop(t + dur + 0.06);
            }

            for (let i = 0; i < 22; i++) {
                const t    = now + 0.02 + Math.random() * 1.8;
                const freq = 35 + Math.random() * 75;    // 35–110 Hz — deeper/dumpfer
                const gain = 6.0;
                const dur  = 0.38 + Math.random() * 0.25; // 0.38–0.63s
                stoneImpact(t, freq, gain, dur);
            }
            // 6 — Dust / high-freq hiss (disabled)
            // play(wn,  now + 0.08, 2.20, 2500, 11000, 0.027, 0.001);

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

    // Falling coin: click anywhere on wall (not on buttons, not during mini-game)
    wall.addEventListener('click', (e) => {
        if (triggered) return;
        if (window._mgActive) return;
        if (e.target.closest('button')) return;

        const size   = 52;
        const coin   = document.createElement('img');
        coin.src     = 'Graphics/cryptin_coin_logo.png';
        const landY  = e.clientY - size / 2;
        const fallDur = 0.32 + (e.clientY / window.innerHeight) * 0.42; // faster top, slower bottom

        Object.assign(coin.style, {
            position:      'fixed',
            width:         size + 'px',
            height:        size + 'px',
            top:           -(size + 10) + 'px',
            left:          (e.clientX - size / 2) + 'px',
            pointerEvents: 'none',
            zIndex:        '9997',
            borderRadius:  '50%',
        });
        document.body.appendChild(coin);

        // Coin spin: scaleX oscillation simulates the coin rotating edge-on
        gsap.to(coin, {
            scaleX: -1,
            duration: fallDur / 6,
            repeat: -1,
            yoyo: true,
            ease: 'none',
        });

        // Fall with gravity (ease-in), then bounce + fade on landing
        gsap.to(coin, {
            top:      landY,
            duration: fallDur,
            ease:     'power2.in',
            onComplete() {
                playCoinSound();
                gsap.killTweensOf(coin); // stop spin
                gsap.timeline()
                    .to(coin, { top: landY - 14, scaleX: 1, duration: 0.09, ease: 'power1.out' })
                    .to(coin, { top: landY,      duration: 0.08, ease: 'power1.in' })
                    .to(coin, { top: landY -  6, duration: 0.06, ease: 'power1.out' })
                    .to(coin, { top: landY,      duration: 0.06, ease: 'power1.in' })
                    .to(coin, { opacity: 0,      duration: 0.40, delay: 0.25, onComplete: () => coin.remove() });
            },
        });
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
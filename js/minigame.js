// ===== CRYPTIN MINI-GAME =====
(function initMiniGame() {
    'use strict';

    const wall      = document.getElementById('intro-wall');
    const btnMini   = document.getElementById('introMiniGame');
    const introLogo = document.getElementById('introLogo');
    const btnGroup  = document.querySelector('.intro-btn-group');

    if (!wall || !btnMini) return;

    const TOTAL = 100;
    let active    = false;
    let spawned   = 0;
    let caught    = 0;
    let clicks    = 0;
    let timers    = [];
    let liveCoins = [];
    let hudEl     = null;
    let audioCtx  = null;


    // ── Shared helper: ensure AudioContext is running ─────────────────────────
    function ensureAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();
    }

    // ── Countdown beeps: deed (3) → deeeed (2) → deeeed (1) → deeeeeeed (GO) ──
    //   Each beep is a held tone — quick attack, sustained body, sharp cut-off.
    //   Duration grows with each step to build tension.
    function playBeep(freq, dur) {
        try {
            ensureAudio();
            const t = audioCtx.currentTime;
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g); g.connect(audioCtx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(freq, t);
            // Flat held tone — no pitch drift
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.48, t + 0.018);   // fast attack
            g.gain.setValueAtTime(0.48, t + dur - 0.04);       // hold
            g.gain.linearRampToValueAtTime(0, t + dur);        // sharp release
            o.start(t); o.stop(t + dur);
        } catch (e) {}
    }

    function playTick(n) {
        const dur  = n === 1 ? 0.26 : n === 2 ? 0.22 : 0.18;
        const freq = n === 1 ? 560  : n === 2 ? 500  : 440;
        playBeep(freq, dur);
    }

    function playGo() {
        playBeep(1200, 1.0);
    }

    // ── Coin sound (Web Audio API — no external file needed) ──────────────────
    function playCoin() {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.connect(g);
            g.connect(audioCtx.destination);
            o.type = 'sine';
            o.frequency.setValueAtTime(1500, audioCtx.currentTime);
            o.frequency.exponentialRampToValueAtTime(850, audioCtx.currentTime + 0.14);
            g.gain.setValueAtTime(0.28, audioCtx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
            o.start();
            o.stop(audioCtx.currentTime + 0.18);
        } catch (e) {}
    }

    // ── HUD ───────────────────────────────────────────────────────────────────
    function buildHUD() {
        hudEl = document.createElement('div');
        hudEl.className = 'mg-hud';
        hudEl.innerHTML =
            '<div class="mg-row"><span>Treffer</span><b class="hv hv-caught">0</b></div>' +
            '<div class="mg-row"><span>Klicks</span><b class="hv hv-clicks">0</b></div>' +
            '<div class="mg-row mg-sep"><span>Verbleibend</span><b class="hv hv-left">100</b></div>';
        wall.appendChild(hudEl);
    }

    function refreshHUD() {
        if (!hudEl) return;
        hudEl.querySelector('.hv-caught').textContent = caught;
        hudEl.querySelector('.hv-clicks').textContent = clicks;
        hudEl.querySelector('.hv-left').textContent   = Math.max(0, TOTAL - spawned);
    }

    // ── Countdown 3 → 2 → 1 then 1 s pause ──────────────────────────────────
    function runCountdown(cb) {
        const wrap = document.createElement('div');
        wrap.className = 'mg-cd-wrap';
        wrap.innerHTML =
            '<div class="mg-cd-n" id="mgN"></div>' +
            '<p class="mg-cd-sub">Catch as many Cryptin-Coins as you can!</p>';
        wall.appendChild(wrap);

        const nEl = wrap.querySelector('#mgN');
        const seq = [3, 2, 1];
        let i = 0;

        function step() {
            if (i < seq.length) {
                const num = seq[i++];
                nEl.textContent = num;
                nEl.classList.remove('mg-cd-pop');
                void nEl.offsetWidth;           // force reflow
                nEl.classList.add('mg-cd-pop');
                playTick(num);
                setTimeout(step, 1000);
            } else {
                // Show GO, play GO beep, then fade out and start game
                nEl.textContent = 'GO';
                nEl.classList.remove('mg-cd-pop');
                void nEl.offsetWidth;
                nEl.classList.add('mg-cd-pop');
                playGo();
                setTimeout(() => {
                    wrap.style.transition = 'opacity 0.3s';
                    wrap.style.opacity    = '0';
                    setTimeout(() => { wrap.remove(); cb(); }, 300);
                }, 3000);   // matches GO beep duration (3.0s)
            }
        }
        step();
    }

    // ── Spawn one falling coin ────────────────────────────────────────────────
    function spawnOne() {
        if (!active) return;
        spawned++;
        refreshHUD();

        const size    = 65 + Math.random() * 44;           // 65–109 px visual
        const leftPct = 4  + Math.random() * 88;           // 4–92 %
        const dur     = 2.6 + Math.random() * 2.6;         // 2.6–5.2 s
        const rot     = (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 360);

        // Hit buffer: invisible padding around the visual coin so nearby clicks
        // also register. The outer div is the click target; the img sits centred.
        const HIT = 16;                                     // px extra on each side
        const total = size + HIT * 2;

        const el = document.createElement('div');
        el.className = 'mg-coin';
        el.style.cssText =
            'width:'  + total + 'px;' +
            'height:' + total + 'px;' +
            'left:'   + leftPct + '%;' +
            'top:-'   + (total + 12) + 'px;' +
            '--rot:'  + rot + 'deg;' +
            '--dur:'  + dur + 's;';

        const img = document.createElement('img');
        img.src = 'Graphics/cryptin_coin_logo.png';
        img.draggable = false;
        // Centre the visual coin inside the larger hit area
        img.style.cssText =
            'position:absolute;' +
            'width:'  + size + 'px;' +
            'height:' + size + 'px;' +
            'top:'    + HIT  + 'px;' +
            'left:'   + HIT  + 'px;';
        el.appendChild(img);

        el.addEventListener('click', function (e) {
            e.stopPropagation();
            if (el._caught) return;   // already caught — ignore double-clicks
            el._caught = true;

            clicks++;
            caught++;
            refreshHUD();
            playCoin();

            // Freeze coin at current visual position, then pop-fade out
            const wr = wall.getBoundingClientRect();
            const er = el.getBoundingClientRect();
            el.style.animation  = 'none';
            el.style.top        = (er.top  - wr.top)  + 'px';
            el.style.left       = (er.left - wr.left) + 'px';
            el.style.filter     = 'drop-shadow(0 0 22px rgba(212,160,48,0.85))';
            el.style.transition = 'transform .17s ease, opacity .17s ease';
            requestAnimationFrame(function () {
                el.style.transform = 'scale(1.55)';
                el.style.opacity   = '0';
            });
            setTimeout(function () { if (el.parentNode) el.remove(); }, 210);
            liveCoins = liveCoins.filter(function (c) { return c !== el; });
        });

        wall.appendChild(el);
        liveCoins.push(el);

        // Auto-remove when coin exits viewport
        setTimeout(function () {
            if (el.parentNode) el.remove();
            liveCoins = liveCoins.filter(function (c) { return c !== el; });
        }, (dur + 0.4) * 1000);
    }

    // ── Background click = missed shot ────────────────────────────────────────
    function onMiss() {
        if (!active) return;
        clicks++;
        refreshHUD();
    }

    // ── Score: caught² ÷ clicks — penalises both misses and missed coins ────────
    //   Perfect run (100 caught, 100 clicks) = 100 %
    //   Can never exceed 100 because clicks ≥ caught always holds.
    function calcScore(caught, clicks) {
        if (clicks === 0) return 0;
        return Math.min(100, Math.round((caught * caught) / clicks));
    }

    // ── Results screen ────────────────────────────────────────────────────────
    function showResults() {
        const score = calcScore(caught, clicks);
        const panel = document.createElement('div');
        panel.className = 'mg-results';
        panel.innerHTML =
            '<h2>Results</h2>' +
            '<div class="mg-res-row">' +
                '<div class="mg-res-stat"><span>Caught</span><b>' + caught + '</b></div>' +
                '<div class="mg-res-stat"><span>Clicks</span><b>' + clicks + '</b></div>' +
                '<div class="mg-res-stat"><span>Accuracy</span><b>' + (clicks > 0 ? Math.round((caught / clicks) * 100) : 0) + '%</b></div>' +
            '</div>' +
            '<div class="mg-score-box">' +
                '<span class="mg-score-label">Score</span>' +
                '<b class="mg-score-val">' + score + '%</b>' +
            '</div>' +
            '<div class="mg-res-btns">' +
                '<button class="mg-again">Again</button>' +
                '<button class="mg-done">Done</button>' +
            '</div>';

        wall.appendChild(panel);
        // Double-rAF ensures CSS transition fires
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                panel.classList.add('mg-results-in');
            });
        });

        panel.querySelector('.mg-again').addEventListener('click', function (e) {
            e.stopPropagation();
            panel.classList.remove('mg-results-in');
            setTimeout(function () { panel.remove(); beginGame(); }, 380);
        });

        panel.querySelector('.mg-done').addEventListener('click', function (e) {
            e.stopPropagation();
            panel.classList.remove('mg-results-in');
            setTimeout(function () {
                panel.remove();
                btnGroup.style.pointerEvents = '';
                if (typeof gsap !== 'undefined') {
                    gsap.to([introLogo, btnGroup], { opacity: 1, duration: 0.5, ease: 'power2.out' });
                } else {
                    introLogo.style.opacity = '1';
                    btnGroup.style.opacity  = '1';
                }
            }, 380);
        });
    }

    // ── End of game round ─────────────────────────────────────────────────────
    function finish() {
        active           = false;
        window._mgActive = false;
        wall.removeEventListener('click', onMiss);
        liveCoins.forEach(function (c) { c.remove(); });
        liveCoins = [];
        if (hudEl) { hudEl.remove(); hudEl = null; }
        showResults();
    }

    // ── Begin one full game round ─────────────────────────────────────────────
    function beginGame() {
        spawned = 0; caught = 0; clicks = 0;
        timers.forEach(clearTimeout);
        timers = []; liveCoins = [];

        runCountdown(function () {
            active           = true;
            window._mgActive = true;
            buildHUD();
            refreshHUD();
            wall.addEventListener('click', onMiss);

            // Schedule all 100 coins with irregular gaps (+10 % slower than before)
            var delay = 0;
            for (var i = 0; i < TOTAL; i++) {
                delay += 127 + Math.random() * 349;
                (function (d) { timers.push(setTimeout(spawnOne, d)); })(delay);
            }

            // End game 6 s after the last coin is spawned
            timers.push(setTimeout(finish, delay + 6000));
        });
    }

    // ── "Start Mini-Game" click ───────────────────────────────────────────────
    btnMini.addEventListener('click', function (e) {
        e.stopPropagation();   // prevent 3-D coin from spawning
        ensureAudio();         // init AudioContext during user gesture so sounds work later
        btnGroup.style.pointerEvents = 'none';

        if (typeof gsap !== 'undefined') {
            gsap.to([introLogo, btnGroup], {
                opacity: 0, duration: 0.4, ease: 'power2.out',
                onComplete: function () { setTimeout(beginGame, 1000); }
            });
        } else {
            introLogo.style.opacity = '0';
            btnGroup.style.opacity  = '0';
            setTimeout(beginGame, 1000);
        }
    });
})();

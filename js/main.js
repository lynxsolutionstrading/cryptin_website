/* ====================================================================
   main.js — Cryptin Website
   Handles: cursor, nav, WebGL particles, hero animations,
   GSAP pinned world section, horizontal features scroll,
   stats counters, scroll reveals, modal.
   Does NOT touch intro-wall logic (script.js handles that).
==================================================================== */

(function () {
    'use strict';

    /* ================================================================
       1. GSAP + ScrollTrigger SETUP
    ================================================================ */
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        gsap.registerPlugin(ScrollTrigger);
    }


    /* ================================================================
       2. CUSTOM CURSOR (desktop only)
    ================================================================ */
    (function initCursor() {
        if (window.matchMedia('(hover: none)').matches) return;

        var dot  = document.getElementById('cursorDot');
        var ring = document.getElementById('cursorRing');
        if (!dot || !ring) return;

        var mouseX = -200, mouseY = -200;
        var ringX  = -200, ringY  = -200;
        var raf;

        document.addEventListener('mousemove', function (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function lerp(a, b, t) { return a + (b - a) * t; }

        function tick() {
            dot.style.left = mouseX + 'px';
            dot.style.top  = mouseY + 'px';

            ringX = lerp(ringX, mouseX, 0.1);
            ringY = lerp(ringY, mouseY, 0.1);
            ring.style.left = ringX + 'px';
            ring.style.top  = ringY + 'px';

            raf = requestAnimationFrame(tick);
        }
        raf = requestAnimationFrame(tick);

        var interactiveSelector = 'a, button, [role="button"], .rank-entry, .feat-panel, .ws-cta';

        document.addEventListener('mouseover', function (e) {
            if (e.target.closest(interactiveSelector)) {
                document.body.classList.add('cursor-hover');
            }
        });

        document.addEventListener('mouseout', function (e) {
            if (e.target.closest(interactiveSelector)) {
                document.body.classList.remove('cursor-hover');
            }
        });

        document.addEventListener('mouseleave', function () {
            dot.style.opacity  = '0';
            ring.style.opacity = '0';
        });
        document.addEventListener('mouseenter', function () {
            dot.style.opacity  = '1';
            ring.style.opacity = '1';
        });

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { cancelAnimationFrame(raf); }
            else { raf = requestAnimationFrame(tick); }
        });
    })();


    /* ================================================================
       3. NAV SCROLL BEHAVIOR
    ================================================================ */
    (function initNav() {
        var nav = document.getElementById('mainNav');
        if (!nav) return;

        function update() {
            if (window.scrollY > 60) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        }

        window.addEventListener('scroll', update, { passive: true });
        update();
    })();


    /* ================================================================
       4. MOBILE HAMBURGER
    ================================================================ */
    (function initHamburger() {
        var hamburger   = document.getElementById('hamburger');
        var mobileMenu  = document.getElementById('mobileMenu');
        var mobileClose = document.getElementById('mobileClose');
        if (!hamburger || !mobileMenu) return;

        function openMenu() {
            hamburger.classList.add('open');
            mobileMenu.classList.add('open');
            mobileMenu.setAttribute('aria-hidden', 'false');
            hamburger.setAttribute('aria-expanded', 'true');
            document.body.style.overflow = 'hidden';
        }

        function closeMenu() {
            hamburger.classList.remove('open');
            mobileMenu.classList.remove('open');
            mobileMenu.setAttribute('aria-hidden', 'true');
            hamburger.setAttribute('aria-expanded', 'false');
            document.body.style.overflow = '';
        }

        hamburger.addEventListener('click', function () {
            mobileMenu.classList.contains('open') ? closeMenu() : openMenu();
        });

        if (mobileClose) mobileClose.addEventListener('click', closeMenu);

        var mobileLinks = mobileMenu.querySelectorAll('.mobile-link');
        mobileLinks.forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });

        var loginMob    = document.getElementById('btnLoginMobile');
        var registerMob = document.getElementById('btnRegisterMobile');
        if (loginMob)    loginMob.addEventListener('click',    function () { closeMenu(); openModal('login'); });
        if (registerMob) registerMob.addEventListener('click', function () { closeMenu(); openModal('register'); });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mobileMenu.classList.contains('open')) closeMenu();
        });
    })();


    /* ================================================================
       5. HERO THREE.JS PARTICLES
    ================================================================ */
    (function initParticles() {
        if (typeof THREE === 'undefined') return;

        var canvas = document.getElementById('heroCanvas');
        if (!canvas) return;

        var hero = canvas.closest('.s-hero');
        if (!hero) return;

        var W = hero.offsetWidth;
        var H = hero.offsetHeight;

        var renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor(0x000000, 0);

        var scene  = new THREE.Scene();
        var camera = new THREE.OrthographicCamera(0, W, H, 0, -1, 1);

        /* ---- Vertex Shader ---- */
        var vertShader = [
            'attribute float aSize;',
            'attribute vec3  aColor;',
            'attribute float aOpacity;',
            'varying vec3  vColor;',
            'varying float vOpacity;',
            'uniform float uTime;',
            'uniform vec2  uMouse;',
            '',
            'void main() {',
            '    vec3 pos = position;',
            '    vec2 diff  = pos.xy - uMouse;',
            '    float dist = length(diff);',
            '    if (dist < 120.0 && dist > 0.001) {',
            '        float s = (1.0 - dist / 120.0) * 18.0;',
            '        pos.xy += normalize(diff) * s;',
            '    }',
            '    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);',
            '    gl_PointSize = aSize * (300.0 / -mvPos.z);',
            '    gl_Position  = projectionMatrix * mvPos;',
            '    vColor   = aColor;',
            '    vOpacity = aOpacity;',
            '}'
        ].join('\n');

        /* ---- Fragment Shader ---- */
        var fragShader = [
            'varying vec3  vColor;',
            'varying float vOpacity;',
            '',
            'void main() {',
            '    vec2  uv   = gl_PointCoord - vec2(0.5);',
            '    float dist = length(uv);',
            '    float a    = smoothstep(0.5, 0.1, dist);',
            '    if (a < 0.01) discard;',
            '    gl_FragColor = vec4(vColor, a * vOpacity);',
            '}'
        ].join('\n');

        var COUNT_A = 600;
        var COUNT_B = 200;
        var COUNT   = COUNT_A + COUNT_B;

        var positions = new Float32Array(COUNT * 3);
        var sizes     = new Float32Array(COUNT);
        var colors    = new Float32Array(COUNT * 3);
        var opacities = new Float32Array(COUNT);
        var velX      = new Float32Array(COUNT);
        var velY      = new Float32Array(COUNT);
        var phase     = new Float32Array(COUNT);
        var pType     = new Uint8Array(COUNT);

        function rnd(a, b) { return a + Math.random() * (b - a); }

        function setGoldColor(t, arr, idx) {
            arr[idx * 3 + 0] = 0.784 + t * (0.941 - 0.784);
            arr[idx * 3 + 1] = 0.588 + t * (0.753 - 0.588);
            arr[idx * 3 + 2] = 0.039 + t * (0.188 - 0.039);
        }

        for (var i = 0; i < COUNT_A; i++) {
            positions[i * 3 + 0] = Math.random() * W;
            positions[i * 3 + 1] = Math.random() * H;
            positions[i * 3 + 2] = 0;
            sizes[i]     = rnd(0.8, 2.8);
            opacities[i] = rnd(0.1, 0.65);
            velX[i]      = rnd(-0.25, 0.25);
            velY[i]      = rnd(-0.6, -0.15);
            phase[i]     = Math.random() * Math.PI * 2;
            pType[i]     = 0;
            setGoldColor(Math.random(), colors, i);
        }

        for (var j = COUNT_A; j < COUNT; j++) {
            positions[j * 3 + 0] = Math.random() * W;
            positions[j * 3 + 1] = Math.random() * H;
            positions[j * 3 + 2] = 0;
            sizes[j]     = rnd(2.0, 5.0);
            opacities[j] = rnd(0.04, 0.2);
            velX[j]      = rnd(-0.08, 0.08);
            velY[j]      = rnd(-0.05, 0.05);
            phase[j]     = Math.random() * Math.PI * 2;
            pType[j]     = 1;
            setGoldColor(Math.random() * 0.5, colors, j);
        }

        var geo  = new THREE.BufferGeometry();
        var posAttr = new THREE.BufferAttribute(positions, 3);
        posAttr.setUsage(THREE.DynamicDrawUsage);
        geo.setAttribute('position', posAttr);
        geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes,    1));
        geo.setAttribute('aColor',   new THREE.BufferAttribute(colors,   3));
        geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities,1));

        var mat = new THREE.ShaderMaterial({
            vertexShader:   vertShader,
            fragmentShader: fragShader,
            transparent:    true,
            depthWrite:     false,
            blending:       THREE.AdditiveBlending,
            uniforms: {
                uTime:  { value: 0 },
                uMouse: { value: new THREE.Vector2(-9999, -9999) }
            }
        });

        var points = new THREE.Points(geo, mat);
        scene.add(points);

        var mouseX = -9999, mouseY = -9999;
        var scrollSpeedBoost = 0;
        var lastScrollY = window.scrollY;
        var clock = new THREE.Clock();
        var rafId;
        var paused = false;

        document.addEventListener('mousemove', function (e) {
            var rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = H - (e.clientY - rect.top);
        });

        window.addEventListener('scroll', function () {
            var delta = Math.abs(window.scrollY - lastScrollY);
            scrollSpeedBoost = Math.min(delta * 0.04, 3.0);
            lastScrollY = window.scrollY;
        }, { passive: true });

        function animate() {
            if (paused) return;
            rafId = requestAnimationFrame(animate);

            var dt = clock.getDelta();
            var t  = clock.getElapsedTime();

            mat.uniforms.uTime.value  = t;
            mat.uniforms.uMouse.value.set(mouseX, mouseY);

            scrollSpeedBoost *= 0.92;

            for (var i = 0; i < COUNT; i++) {
                var ix = i * 3;
                var boost = 1.0 + scrollSpeedBoost;

                if (pType[i] === 0) {
                    // Ember: drift upward with horizontal sine
                    positions[ix]     += (velX[i] + Math.sin(t * 0.7 + phase[i]) * 0.3) * dt * 60 * boost;
                    positions[ix + 1] += velY[i] * dt * 60 * boost;

                    // Flicker opacity
                    opacities[i] = Math.max(0, opacities[i] * 0.998 + (Math.sin(t * 3 + phase[i]) * 0.015));

                    // Wrap: off top → respawn at bottom
                    if (positions[ix + 1] < -10) {
                        positions[ix + 1] = H + 10;
                        positions[ix]     = Math.random() * W;
                        opacities[i]      = rnd(0.1, 0.65);
                    }
                    // Wrap: off sides
                    if (positions[ix] < -10) positions[ix] = W + 10;
                    if (positions[ix] > W + 10) positions[ix] = -10;
                } else {
                    // Orb: slow sine drift
                    positions[ix]     += (velX[i] + Math.sin(t * 0.3 + phase[i]) * 0.15) * dt * 60;
                    positions[ix + 1] += (velY[i] + Math.cos(t * 0.25 + phase[i] * 1.3) * 0.1) * dt * 60;

                    if (positions[ix] < -60)    positions[ix] = W + 60;
                    if (positions[ix] > W + 60) positions[ix] = -60;
                    if (positions[ix + 1] < -60)    positions[ix + 1] = H + 60;
                    if (positions[ix + 1] > H + 60) positions[ix + 1] = -60;
                }
            }

            posAttr.needsUpdate = true;
            geo.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

            renderer.render(scene, camera);
        }

        animate();

        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                paused = true;
                cancelAnimationFrame(rafId);
                clock.stop();
            } else {
                paused = false;
                clock.start();
                animate();
            }
        });

        window.addEventListener('resize', function () {
            W = hero.offsetWidth;
            H = hero.offsetHeight;
            renderer.setSize(W, H);
            camera.right  = W;
            camera.bottom = H;
            camera.updateProjectionMatrix();
        });
    })();


    /* ================================================================
       6. HERO ENTRY ANIMATION
       Fires once when the intro wall is removed from the DOM
    ================================================================ */
    (function initHeroAnimation() {
        var eyebrow = document.getElementById('heroEyebrow');
        var logo    = document.getElementById('heroLogo');
        var btns    = document.getElementById('heroButtons');
        if (!eyebrow || !logo || !btns) return;
        if (typeof gsap === 'undefined') return;

        // Hide initially — will be revealed by animation
        gsap.set([eyebrow, logo, btns], { opacity: 0 });
        gsap.set(eyebrow, { y: 20 });
        gsap.set(logo,    { scale: 1.06 });
        gsap.set(btns,    { y: 24 });

        function playHeroEntry() {
            var tl = gsap.timeline();
            tl.to(eyebrow, { y: 0, opacity: 1, duration: 0.8, ease: 'power2.out', delay: 0.1 })
              .to(logo,    { scale: 1, opacity: 1, duration: 1.2, ease: 'power2.out' }, '-=0.5')
              .to(btns,    { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }, '-=0.7');
        }

        var wall = document.getElementById('intro-wall');
        if (!wall) {
            // Intro wall already gone
            playHeroEntry();
            return;
        }

        // Watch for the intro wall being removed or hidden
        var observer = new MutationObserver(function () {
            var w = document.getElementById('intro-wall');
            if (!w || w.style.display === 'none' || parseFloat(getComputedStyle(w).opacity) < 0.05) {
                observer.disconnect();
                playHeroEntry();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

        // Fallback: also fire after 4s in case wall stays
        setTimeout(function () {
            observer.disconnect();
            var logoEl = document.getElementById('heroLogo');
            if (logoEl && parseFloat(getComputedStyle(logoEl).opacity) < 0.5) {
                playHeroEntry();
            }
        }, 4000);
    })();


    /* ================================================================
       7. WORLD PINNED SECTION (GSAP ScrollTrigger scrub)
    ================================================================ */
    (function initWorldSection() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

        var worldEl = document.getElementById('world');
        var wsA = document.getElementById('wsA');
        var wsB = document.getElementById('wsB');
        var wsC = document.getElementById('wsC');
        if (!worldEl || !wsA || !wsB || !wsC) return;

        // Set initial states
        gsap.set(wsA, { opacity: 1 });
        gsap.set(wsB, { opacity: 0 });
        gsap.set(wsC, { opacity: 0 });

        // Reveal content items
        var aItems = wsA.querySelectorAll('.ws-label, .ws-title, .ws-body');
        var bItems = wsB.querySelectorAll('.ws-label, .ws-title, .ws-body');
        var cItems = wsC.querySelectorAll('.ws-label, .ws-title, .ws-body, .ws-cta');
        gsap.set([aItems, bItems, cItems], { y: 40, opacity: 0 });

        var scrollDist = window.innerHeight * 3.5;

        var tl = gsap.timeline({
            scrollTrigger: {
                trigger: worldEl,
                start: 'top top',
                end: '+=' + scrollDist,
                pin: '#worldPin',
                scrub: 1.2,
                anticipatePin: 1,
                invalidateOnRefresh: true
            }
        });

        // Normalize positions to 0-1 timeline
        // Scene A: visible 0-0.3, fades 0.3-0.38
        // Scene B: fades in 0.3-0.38, visible 0.38-0.65, fades 0.65-0.73
        // Scene C: fades in 0.65-0.73, stays 0.73-1

        tl
            // Scene A content in
            .to(aItems, { y: 0, opacity: 1, duration: 0.12, stagger: 0.03 }, 0)
            // Scene A fades out
            .to(wsA, { opacity: 0, duration: 0.08 }, 0.28)
            // Scene B fades in
            .to(wsB, { opacity: 1, duration: 0.08 }, 0.30)
            .to(bItems, { y: 0, opacity: 1, duration: 0.1, stagger: 0.02 }, 0.32)
            // Scene B fades out
            .to(wsB, { opacity: 0, duration: 0.08 }, 0.63)
            // Scene C fades in
            .to(wsC, { opacity: 1, duration: 0.08 }, 0.65)
            .to(cItems, { y: 0, opacity: 1, duration: 0.1, stagger: 0.02 }, 0.67);
    })();


    /* ================================================================
       8. FEATURES HORIZONTAL SCROLL (GSAP ScrollTrigger)
    ================================================================ */
    (function initFeaturesScroll() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

        var section = document.querySelector('.s-features');
        var track   = document.getElementById('featuresTrack');
        if (!section || !track) return;

        var panels  = track.querySelectorAll('.feat-panel');

        // Animate content in when panel enters center
        panels.forEach(function (panel) {
            var content = panel.querySelector('.feat-content');
            if (!content) return;
            gsap.set(content, { y: 30, opacity: 0 });
        });

        // Horizontal translation amount (updated on refresh)
        function getScrollWidth() {
            return track.scrollWidth - window.innerWidth;
        }

        gsap.to(track, {
            x: function () { return -getScrollWidth(); },
            ease: 'none',
            scrollTrigger: {
                trigger: section,
                start: 'top top',
                end: function () { return '+=' + getScrollWidth(); },
                pin: true,
                scrub: 1,
                anticipatePin: 1,
                invalidateOnRefresh: true,
                onUpdate: function (self) {
                    // Reveal content as panel nears center
                    var progress = self.progress;
                    var total    = panels.length;
                    panels.forEach(function (panel, idx) {
                        var panelProgress = idx / (total - 1);
                        var dist = Math.abs(progress - panelProgress);
                        var content = panel.querySelector('.feat-content');
                        if (!content) return;
                        if (dist < 0.35) {
                            var opacity = Math.max(0, 1 - dist * 3);
                            var yVal    = dist * 60;
                            gsap.set(content, { opacity: opacity, y: yVal });
                        } else {
                            gsap.set(content, { opacity: 0, y: 30 });
                        }
                    });
                }
            }
        });
    })();


    /* ================================================================
       9. STATS COUNTERS (IntersectionObserver)
    ================================================================ */
    (function initStats() {
        var statsSection = document.querySelector('.s-stats');
        if (!statsSection) return;

        var statVals = statsSection.querySelectorAll('.stat-val[data-target]');
        var animated = false;

        function animateCounter(el) {
            var target   = parseFloat(el.getAttribute('data-target'));
            var isPct    = el.classList.contains('stat-val--pct');
            var isFloat  = target !== Math.floor(target);
            var duration = 1800;
            var start    = null;

            function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

            function step(ts) {
                if (!start) start = ts;
                var elapsed  = ts - start;
                var progress = Math.min(elapsed / duration, 1);
                var easedP   = easeOut(progress);
                var current  = target * easedP;

                if (isFloat) {
                    el.textContent = current.toFixed(1);
                } else {
                    el.textContent = Math.floor(current).toLocaleString('de-DE');
                }

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    el.textContent = isFloat ? target.toFixed(1) : target.toLocaleString('de-DE');
                }
            }

            requestAnimationFrame(step);
        }

        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !animated) {
                    animated = true;
                    statVals.forEach(function (el) {
                        animateCounter(el);
                    });
                    observer.disconnect();
                }
            });
        }, { threshold: 0.3 });

        observer.observe(statsSection);
    })();


    /* ================================================================
       10. SCROLL REVEAL (IntersectionObserver)
    ================================================================ */
    (function initReveal() {
        var revealEls = document.querySelectorAll(
            '.rank-eyebrow, .rank-heading, .rank-panels, .rank-cta, ' +
            '.dl-eyebrow, .dl-title, .dl-sub, .dl-btns, .dl-fine, ' +
            '.stats-eyebrow, .stats-heading'
        );

        revealEls.forEach(function (el) {
            el.classList.add('reveal');
        });

        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        document.querySelectorAll('.reveal').forEach(function (el) {
            revealObserver.observe(el);
        });
    })();


    /* ================================================================
       11. MODAL — Login / Register
    ================================================================ */
    var openModal; // hoisted so hamburger init can call it

    (function initModal() {
        var modal       = document.getElementById('modal');
        var overlay     = document.getElementById('modalOverlay');
        var closeBtn    = document.getElementById('modalClose');
        var tabs        = document.querySelectorAll('.mtab');
        var formLogin   = document.getElementById('formLogin');
        var formRegister= document.getElementById('formRegister');
        if (!modal) return;

        function closeModal() {
            modal.classList.remove('open');
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        openModal = function (tab) {
            tab = tab || 'login';
            modal.classList.add('open');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            switchTab(tab);
        };

        function switchTab(tab) {
            tabs.forEach(function (t) {
                var isActive = t.getAttribute('data-tab') === tab;
                t.classList.toggle('mtab--active', isActive);
            });
            if (formLogin)    formLogin.classList.toggle('mform--active',    tab === 'login');
            if (formRegister) formRegister.classList.toggle('mform--active', tab === 'register');
            if (formLogin)    formLogin.style.display    = (tab === 'login')     ? 'flex' : 'none';
            if (formRegister) formRegister.style.display = (tab === 'register')  ? 'flex' : 'none';
        }

        // Initial state
        if (formRegister) formRegister.style.display = 'none';

        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                switchTab(this.getAttribute('data-tab'));
            });
        });

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (overlay)  overlay.addEventListener('click', closeModal);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
        });

        // Prevent box clicks from closing
        var box = modal.querySelector('.modal-box');
        if (box) box.addEventListener('click', function (e) { e.stopPropagation(); });

        // Form submit handlers
        if (formLogin) {
            formLogin.addEventListener('submit', function (e) {
                e.preventDefault();
                // Placeholder: add auth logic here
                console.log('Login submitted');
            });
        }

        if (formRegister) {
            formRegister.addEventListener('submit', function (e) {
                e.preventDefault();
                // Placeholder: add register logic here
                console.log('Register submitted');
            });
        }

        // Open triggers
        var btnLogin    = document.getElementById('btnLogin');
        var btnRegister = document.getElementById('btnRegister');
        var btnRegCta   = document.getElementById('btnRegisterCta');

        if (btnLogin)    btnLogin.addEventListener('click',    function () { openModal('login'); });
        if (btnRegister) btnRegister.addEventListener('click', function () { openModal('register'); });
        if (btnRegCta)   btnRegCta.addEventListener('click',   function () { openModal('register'); });

        // Hero buttons
        var heroPlay  = document.querySelector('.s-hero .btn-gold');
        var heroMore  = document.querySelector('.s-hero .btn-ghost');
        if (heroPlay) heroPlay.addEventListener('click', function () { openModal('register'); });
        if (heroMore) heroMore.addEventListener('click', function () {
            document.getElementById('world') && document.getElementById('world').scrollIntoView({ behavior: 'smooth' });
        });

        // World section CTA
        var wsCta = document.querySelector('.ws-cta');
        if (wsCta) wsCta.addEventListener('click', function () { openModal('register'); });

        // Download section
        var dlPlay = document.querySelector('.dl-btns .btn-gold--lg');
        if (dlPlay) dlPlay.addEventListener('click', function () { openModal('register'); });
    })();


    /* ================================================================
       12. RESIZE HANDLER
    ================================================================ */
    var resizeTimer;
    window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function () {
            if (typeof ScrollTrigger !== 'undefined') {
                ScrollTrigger.refresh();
            }
        }, 200);
    });


    /* ================================================================
       13. SMOOTH NAV ANCHOR SCROLLING
    ================================================================ */
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener('click', function (e) {
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

})();

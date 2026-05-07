/* ====================================================================
   main.js — Cryptin Website
   Handles: cursor, loader, nav, WebGL particles, hero animations,
   GSAP pinned story, parallax, stats counters, feature reveals,
   card tilt, modal, world panels, scroll reveals.
   Does NOT touch intro-wall logic (script.js handles that).
==================================================================== */

(function () {
    'use strict';

    /* ================================================================
       1. CUSTOM CURSOR — two-part lerp system
    ================================================================ */
    (function initCursor() {
        if (window.matchMedia('(hover: none)').matches) return;

        var dot  = document.getElementById('cursor-dot');
        var ring = document.getElementById('cursor-ring');
        if (!dot || !ring) return;

        var mouseX = -200, mouseY = -200;
        var dotX   = -200, dotY   = -200;
        var ringX  = -200, ringY  = -200;

        document.addEventListener('mousemove', function (e) {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        // Lerp factor: dot = instant (1.0), ring = slow (0.12)
        function lerp(a, b, t) { return a + (b - a) * t; }

        (function animCursor() {
            // Dot: instant follow
            dotX = mouseX;
            dotY = mouseY;
            dot.style.left = dotX + 'px';
            dot.style.top  = dotY + 'px';

            // Ring: slow lerp
            ringX = lerp(ringX, mouseX, 0.12);
            ringY = lerp(ringY, mouseY, 0.12);
            ring.style.left = ringX + 'px';
            ring.style.top  = ringY + 'px';

            requestAnimationFrame(animCursor);
        })();

        // Hover effect on interactive elements
        var hoverTargets = 'a, button, [role="button"], .news-card, .stat-card, .ranking-entry';

        function onEnter() {
            dot.classList.add('hovering');
            ring.classList.add('hovering');
        }
        function onLeave() {
            dot.classList.remove('hovering');
            ring.classList.remove('hovering');
        }

        document.addEventListener('mouseover', function (e) {
            if (e.target.closest(hoverTargets)) onEnter();
        });
        document.addEventListener('mouseout', function (e) {
            if (e.target.closest(hoverTargets)) onLeave();
        });

        document.addEventListener('mouseleave', function () {
            dot.style.opacity  = '0';
            ring.style.opacity = '0';
        });
        document.addEventListener('mouseenter', function () {
            dot.style.opacity  = '1';
            ring.style.opacity = '1';
        });
    })();


    /* ================================================================
       2. LOADING SCREEN
       script.js removes the loader after intro image decodes.
       We only set a hard fallback in case script.js isn't loaded.
    ================================================================ */
    (function initLoader() {
        var loader = document.getElementById('pageLoader');
        if (!loader) return;

        // Safety fallback: remove after 3s no matter what
        var safeTimeout = setTimeout(function () {
            if (loader.parentNode) {
                loader.classList.add('ldr-out');
                setTimeout(function () { if (loader.parentNode) loader.remove(); }, 650);
            }
        }, 3000);

        // Cancel safety timeout if script.js removes loader first
        var obs = new MutationObserver(function (muts) {
            muts.forEach(function (m) {
                m.removedNodes.forEach(function (n) {
                    if (n === loader) { clearTimeout(safeTimeout); obs.disconnect(); }
                });
            });
        });
        if (loader.parentNode) obs.observe(loader.parentNode, { childList: true });
    })();


    /* ================================================================
       3. NAV SCROLL BEHAVIOR
    ================================================================ */
    (function initNav() {
        var nav = document.getElementById('mainNav');
        if (!nav) return;

        function update() {
            if (window.scrollY > 80) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        }

        window.addEventListener('scroll', update, { passive: true });
        update();
    })();


    /* ================================================================
       4. MOBILE HAMBURGER MENU
    ================================================================ */
    (function initHamburger() {
        var hamburger   = document.getElementById('hamburger');
        var mobileMenu  = document.getElementById('mobileMenu');
        var mobileClose = document.getElementById('mobileClose');
        var mobileLinks = document.querySelectorAll('.mobile-link');
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
            hamburger.classList.contains('open') ? closeMenu() : openMenu();
        });

        if (mobileClose) mobileClose.addEventListener('click', closeMenu);

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
       5. HERO WEBGL PARTICLES — Three.js with custom ShaderMaterial
    ================================================================ */
    var particleRunning = false;

    (function initParticles() {
        if (typeof THREE === 'undefined') return;

        var canvas = document.getElementById('heroParticles');
        if (!canvas) return;

        var hero = canvas.closest('.hero');
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
            'attribute vec3 aColor;',
            'attribute float aOpacity;',
            'varying vec3 vColor;',
            'varying float vOpacity;',
            'uniform float uTime;',
            'uniform vec2 uMouse;',
            '',
            'void main() {',
            '    vec3 pos = position;',
            '',
            '    // Mouse repulsion',
            '    vec2 diff = pos.xy - uMouse;',
            '    float dist = length(diff);',
            '    if (dist < 120.0 && dist > 0.001) {',
            '        float strength = (1.0 - dist / 120.0) * 18.0;',
            '        pos.xy += normalize(diff) * strength;',
            '    }',
            '',
            '    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);',
            '    gl_PointSize = aSize * (300.0 / -mvPosition.z);',
            '    gl_Position = projectionMatrix * mvPosition;',
            '',
            '    vColor   = aColor;',
            '    vOpacity = aOpacity;',
            '}'
        ].join('\n');

        /* ---- Fragment Shader ---- */
        var fragShader = [
            'varying vec3 vColor;',
            'varying float vOpacity;',
            '',
            'void main() {',
            '    vec2 uv = gl_PointCoord - vec2(0.5);',
            '    float dist = length(uv);',
            '    // Soft circular point with smoothstep falloff',
            '    float alpha = smoothstep(0.5, 0.1, dist);',
            '    if (alpha < 0.01) discard;',
            '    gl_FragColor = vec4(vColor, alpha * vOpacity);',
            '}'
        ].join('\n');

        var COUNT_A = 600; // ember/ash particles
        var COUNT_B = 200; // glowing orbs
        var COUNT   = COUNT_A + COUNT_B;

        // Typed arrays for attributes
        var positions  = new Float32Array(COUNT * 3);
        var sizes      = new Float32Array(COUNT);
        var colors     = new Float32Array(COUNT * 3);
        var opacities  = new Float32Array(COUNT);

        // Per-particle data (not GPU-side)
        var velX       = new Float32Array(COUNT);
        var velY       = new Float32Array(COUNT);
        var phase      = new Float32Array(COUNT);
        var type       = new Uint8Array(COUNT); // 0=ember, 1=orb

        function rnd(a, b) { return a + Math.random() * (b - a); }

        // Interpolate between two gold hues
        function goldColor(t, out, idx) {
            // #c8960a → #f0c030
            out[idx * 3 + 0] = 0.784 + t * (0.941 - 0.784);
            out[idx * 3 + 1] = 0.588 + t * (0.753 - 0.588);
            out[idx * 3 + 2] = 0.039 + t * (0.188 - 0.039);
        }

        // Init Group A: embers
        for (var i = 0; i < COUNT_A; i++) {
            positions[i * 3 + 0] = Math.random() * W;
            positions[i * 3 + 1] = Math.random() * H;
            positions[i * 3 + 2] = 0;
            sizes[i]     = rnd(0.8, 2.5);
            opacities[i] = rnd(0.15, 0.7);
            velX[i]      = rnd(-0.3, 0.3);
            velY[i]      = -(rnd(0.3, 1.2)); // upward (negative in ortho top-down)
            phase[i]     = Math.random() * Math.PI * 2;
            type[i]      = 0;
            goldColor(Math.random(), colors, i);
        }

        // Init Group B: glowing orbs
        for (var j = COUNT_A; j < COUNT; j++) {
            positions[j * 3 + 0] = Math.random() * W;
            positions[j * 3 + 1] = Math.random() * H;
            positions[j * 3 + 2] = 0;
            sizes[j]     = rnd(4, 8);
            opacities[j] = rnd(0.05, 0.15);
            velX[j]      = rnd(-0.15, 0.15);
            velY[j]      = rnd(-0.08, 0.08);
            phase[j]     = Math.random() * Math.PI * 2;
            type[j]      = 1;
            // Deep gold orbs
            colors[j * 3 + 0] = 0.784;
            colors[j * 3 + 1] = 0.588;
            colors[j * 3 + 2] = 0.039;
        }

        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacities, 1));

        var uTime  = { value: 0.0 };
        var uMouse = { value: new THREE.Vector2(-9999, -9999) };

        var material = new THREE.ShaderMaterial({
            vertexShader:   vertShader,
            fragmentShader: fragShader,
            uniforms: {
                uTime:  uTime,
                uMouse: uMouse
            },
            transparent: true,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending
        });

        var points = new THREE.Points(geometry, material);
        scene.add(points);

        var clock   = new THREE.Clock();
        var scrollSpeedBoost = 0;

        // Track mouse for GPU repulsion
        document.addEventListener('mousemove', function (e) {
            // Convert screen coords to ortho camera space (0,0 top-left)
            uMouse.value.set(e.clientX, e.clientY);
        });

        // Scroll boost
        window.addEventListener('scroll', function () {
            scrollSpeedBoost = window.scrollY / 2000;
        }, { passive: true });

        function animateParticles() {
            if (document.hidden) { particleRunning = false; return; }
            particleRunning = true;
            requestAnimationFrame(animateParticles);

            var delta = clock.getDelta();
            uTime.value += delta;
            var t = uTime.value;

            var pos = geometry.attributes.position.array;
            var ops = geometry.attributes.aOpacity.array;

            for (var k = 0; k < COUNT; k++) {
                if (type[k] === 0) {
                    // Group A: ember — float upward
                    var speed = (1 + scrollSpeedBoost) * delta * 60;
                    pos[k * 3 + 0] += velX[k] * speed * 0.5;
                    pos[k * 3 + 1] += velY[k] * speed;

                    // Subtle flicker
                    ops[k] = (0.15 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.1 + phase[k])));

                    // Wrap around: when particle exits top, reset at bottom
                    if (pos[k * 3 + 1] < -10) {
                        pos[k * 3 + 1] = H + 10;
                        pos[k * 3 + 0] = Math.random() * W;
                    }
                    // Wrap horizontal
                    if (pos[k * 3 + 0] < -20) pos[k * 3 + 0] = W + 20;
                    if (pos[k * 3 + 0] > W + 20) pos[k * 3 + 0] = -20;

                } else {
                    // Group B: orbs — slow sine drift
                    pos[k * 3 + 0] += velX[k] * delta * 30 + Math.sin(t * 0.4 + phase[k]) * 0.3;
                    pos[k * 3 + 1] += velY[k] * delta * 30 + Math.cos(t * 0.35 + phase[k]) * 0.25;

                    ops[k] = 0.05 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.8 + phase[k]));

                    // Wrap both axes
                    if (pos[k * 3 + 0] < -50) pos[k * 3 + 0] = W + 50;
                    if (pos[k * 3 + 0] > W + 50) pos[k * 3 + 0] = -50;
                    if (pos[k * 3 + 1] < -50) pos[k * 3 + 1] = H + 50;
                    if (pos[k * 3 + 1] > H + 50) pos[k * 3 + 1] = -50;
                }
            }

            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.aOpacity.needsUpdate = true;

            renderer.render(scene, camera);
        }

        animateParticles();

        // Resize handler
        window.addEventListener('resize', function () {
            W = hero.offsetWidth;
            H = hero.offsetHeight;
            renderer.setSize(W, H);
            camera = new THREE.OrthographicCamera(0, W, H, 0, -1, 1);
        }, { passive: true });

        // Pause when tab hidden
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && !particleRunning) {
                clock.getDelta(); // reset delta so no jump
                animateParticles();
            }
        });
    })();


    /* ================================================================
       6. HERO ENTRY ANIMATIONS (GSAP)
    ================================================================ */
    (function initHeroAnimations() {
        if (typeof gsap === 'undefined') return;

        var eyebrow  = document.getElementById('heroEyebrow');
        var heroLogo = document.getElementById('heroLogo');
        var tagline  = document.getElementById('heroTagline');
        var buttons  = document.getElementById('heroButtons');

        function runHeroAnim() {
            if (heroLogo) {
                heroLogo.classList.add('animated');
            }

            var tl = gsap.timeline();

            if (eyebrow) {
                tl.to(eyebrow, {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: 'power3.out',
                    delay: 0.3
                }, 0);
            }

            if (heroLogo) {
                tl.to(heroLogo, {
                    opacity: 1,
                    scale: 1,
                    duration: 1.4,
                    ease: 'power3.out',
                    delay: 0.2
                }, 0);
            }

            if (tagline) {
                // Stagger each word
                var words = tagline.querySelectorAll ? null : null;
                tl.to(tagline, {
                    opacity: 1,
                    duration: 0.8,
                    ease: 'power2.out',
                    delay: 0.8
                }, 0);
            }

            if (buttons) {
                tl.to(buttons, {
                    opacity: 1,
                    y: 0,
                    duration: 0.8,
                    ease: 'power3.out',
                    delay: 1.2
                }, 0);
            }
        }

        // Wait for intro wall to be removed before triggering
        var introWall = document.getElementById('intro-wall');
        if (!introWall) { runHeroAnim(); return; }

        var wallObs = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                if (m.type === 'attributes' && m.attributeName === 'style') {
                    var op = parseFloat(introWall.style.opacity);
                    if (op === 0 || introWall.style.display === 'none') {
                        runHeroAnim();
                        wallObs.disconnect();
                    }
                }
                m.removedNodes.forEach(function (n) {
                    if (n === introWall) { runHeroAnim(); wallObs.disconnect(); }
                });
            });
        });

        wallObs.observe(introWall, { attributes: true, attributeFilter: ['style'] });
        if (introWall.parentNode) wallObs.observe(introWall.parentNode, { childList: true });

        // Hard fallback
        setTimeout(function () { wallObs.disconnect(); runHeroAnim(); }, 10000);
    })();


    /* ================================================================
       7. COUNTER ANIMATIONS
    ================================================================ */
    function animateCounter(el, target, duration) {
        var start = performance.now();
        var isDecimal = String(target).indexOf('.') !== -1;

        function step(now) {
            var p = Math.min((now - start) / duration, 1);
            var e = 1 - Math.pow(1 - p, 3); // cubic ease out
            var current = target * e;
            if (isDecimal) {
                el.textContent = current.toFixed(1);
            } else {
                el.textContent = Math.round(current).toLocaleString('de-DE');
            }
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }


    /* ================================================================
       8. SCROLL REVEAL — IntersectionObserver
    ================================================================ */
    (function initScrollReveal() {
        if (!('IntersectionObserver' in window)) {
            document.querySelectorAll('.reveal-up, .reveal-clip').forEach(function (el) {
                el.classList.add('in-view');
            });
            return;
        }

        var revealObs = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el    = entry.target;
                var delay = el.dataset.delay ? parseFloat(el.dataset.delay) * 120 : 0;
                setTimeout(function () { el.classList.add('in-view'); }, delay);
                revealObs.unobserve(el);
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.reveal-up, .reveal-clip').forEach(function (el) {
            revealObs.observe(el);
        });

        // Counter IntersectionObserver
        var counterObs = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el  = entry.target;
                var tgt = parseInt(el.dataset.target, 10);
                if (!isNaN(tgt)) animateCounter(el, tgt, 2000);
                counterObs.unobserve(el);
            });
        }, { threshold: 0.3 });

        document.querySelectorAll('.counter[data-target]').forEach(function (el) {
            counterObs.observe(el);
        });

        // Hero status bar live-val counters
        var liveObs = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el  = entry.target;
                var tgt = parseInt(el.dataset.count, 10);
                if (!isNaN(tgt)) animateCounter(el, tgt, 1600);
                liveObs.unobserve(el);
            });
        }, { threshold: 0.3 });

        document.querySelectorAll('.live-val[data-count]').forEach(function (el) {
            liveObs.observe(el);
        });

        // World panel content reveal
        var worldObs = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('in-view');
                worldObs.unobserve(entry.target);
            });
        }, { threshold: 0.2 });

        document.querySelectorAll('.world-panel').forEach(function (p) {
            worldObs.observe(p);
        });
    })();


    /* ================================================================
       9. GSAP SCROLL TRIGGER — Pinned story, parallax, feature reveals
    ================================================================ */
    (function initGSAP() {
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
        gsap.registerPlugin(ScrollTrigger);

        // ---- Pinned Story Section ----
        var storySection = document.getElementById('story');
        var storyPin     = document.getElementById('storyPin');
        var scene1       = document.getElementById('storyScene1');
        var scene2       = document.getElementById('storyScene2');
        var scene3       = document.getElementById('storyScene3');

        if (storySection && storyPin && scene1 && scene2 && scene3) {

            // Pin the container for 300vh of scroll
            ScrollTrigger.create({
                trigger: storySection,
                start: 'top top',
                end: 'bottom bottom',
                pin: storyPin,
                pinSpacing: false
            });

            // Scene 1 → 2 transition at scroll 33%
            ScrollTrigger.create({
                trigger: storySection,
                start: 'top top',
                end: '33% top',
                scrub: 1,
                onUpdate: function (self) {
                    var p = self.progress;
                    if (p > 0.85) {
                        // Fade out scene 1 text
                        var lines = scene1.querySelectorAll('.story-line');
                        lines.forEach(function (l) {
                            gsap.set(l, { opacity: 1 - (p - 0.85) * 6 });
                        });
                    }
                }
            });

            ScrollTrigger.create({
                trigger: storySection,
                start: '28% top',
                end: '36% top',
                scrub: 1,
                onUpdate: function (self) {
                    var p = self.progress;
                    scene1.style.opacity = 1 - p;
                    scene2.style.opacity = p;
                    scene2.style.pointerEvents = p > 0.5 ? 'auto' : 'none';
                }
            });

            // Scene 2 → 3 transition at scroll 66%
            ScrollTrigger.create({
                trigger: storySection,
                start: '62% top',
                end: '70% top',
                scrub: 1,
                onUpdate: function (self) {
                    var p = self.progress;
                    scene2.style.opacity = 1 - p;
                    scene3.style.opacity = p;
                    scene3.style.pointerEvents = p > 0.5 ? 'auto' : 'none';
                }
            });

            // Scene 1 initial reveal
            ScrollTrigger.create({
                trigger: storySection,
                start: 'top 80%',
                once: true,
                onEnter: function () {
                    var lines = scene1.querySelectorAll('.story-line');
                    lines.forEach(function (l, i) {
                        gsap.fromTo(l,
                            { y: 40, opacity: 0 },
                            { y: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: i * 0.3 }
                        );
                    });
                }
            });

            // Scene 2 heading reveal when it enters
            ScrollTrigger.create({
                trigger: storySection,
                start: '33% top',
                once: true,
                onEnter: function () {
                    var h = scene2.querySelector('.story-heading');
                    var e = scene2.querySelector('.story-eyebrow');
                    var s = scene2.querySelector('.story-sub');
                    if (e) gsap.fromTo(e, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out' });
                    if (h) gsap.fromTo(h, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'power3.out', delay: 0.2 });
                    if (s) gsap.fromTo(s, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.6 });
                }
            });

            // Scene 3 heading reveal
            ScrollTrigger.create({
                trigger: storySection,
                start: '66% top',
                once: true,
                onEnter: function () {
                    var h = scene3.querySelector('.story-cta-heading');
                    var b = scene3.querySelector('.story-cta-buttons');
                    if (h) gsap.fromTo(h, { scale: 0.9, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, ease: 'power3.out' });
                    if (b) gsap.fromTo(b, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', delay: 0.5 });
                }
            });
        }

        // ---- World Panels: background parallax ----
        document.querySelectorAll('.world-panel').forEach(function (panel) {
            var bg = panel.querySelector('.world-panel-bg');
            if (!bg) return;
            gsap.fromTo(bg,
                { yPercent: -8 },
                {
                    yPercent: 8,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: panel,
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: true
                    }
                }
            );
        });

        // ---- Feature row image parallax ----
        var featImg = document.querySelector('.parallax-feat');
        if (featImg) {
            gsap.fromTo(featImg,
                { y: -60 },
                {
                    y: 60,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: featImg.closest('.feature-row'),
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: true
                    }
                }
            );
        }

        // ---- Feature content text reveals ----
        document.querySelectorAll('.feature-row').forEach(function (row) {
            var clips = row.querySelectorAll('.reveal-clip');
            if (!clips.length) return;
            clips.forEach(function (el, i) {
                ScrollTrigger.create({
                    trigger: el,
                    start: 'top 88%',
                    once: true,
                    onEnter: function () {
                        setTimeout(function () {
                            el.classList.add('in-view');
                        }, i * 100);
                    }
                });
            });
        });

        // ---- Stats section gold decorative line animation ----
        var statsSection = document.querySelector('.section-stats');
        if (statsSection) {
            ScrollTrigger.create({
                trigger: statsSection,
                start: 'top 70%',
                once: true,
                onEnter: function () {
                    var line = statsSection.querySelector('.stats-deco-line');
                    if (line) {
                        gsap.fromTo(line,
                            { scaleY: 0, opacity: 0 },
                            { scaleY: 1, opacity: 0.3, duration: 1.2, ease: 'power3.out', transformOrigin: 'top' }
                        );
                    }
                }
            });
        }

        // ---- Download section reveal ----
        var dlSection = document.querySelector('.section-download');
        if (dlSection) {
            ScrollTrigger.create({
                trigger: dlSection,
                start: 'top 70%',
                once: true,
                onEnter: function () {
                    var content = dlSection.querySelector('.download-content');
                    if (content) {
                        gsap.fromTo(content,
                            { y: 60, opacity: 0 },
                            { y: 0, opacity: 1, duration: 1.0, ease: 'power3.out' }
                        );
                    }
                }
            });
        }

    })();


    /* ================================================================
       10. 3D TILT EFFECT ON CARDS
    ================================================================ */
    (function initTilt() {
        if (window.matchMedia('(hover: none)').matches) return;

        var cards = document.querySelectorAll('.stat-card, .news-card, .ranking-panel');

        cards.forEach(function (card) {
            card.classList.add('tilt-card');

            card.addEventListener('mousemove', function (e) {
                var rect   = card.getBoundingClientRect();
                var cx     = rect.left + rect.width  / 2;
                var cy     = rect.top  + rect.height / 2;
                var dx     = (e.clientX - cx) / (rect.width  / 2);
                var dy     = (e.clientY - cy) / (rect.height / 2);
                var rotX   = -dy * 6;  // max ±6deg
                var rotY   =  dx * 6;

                card.style.transform = 'perspective(800px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) translateZ(4px)';
            });

            card.addEventListener('mouseleave', function () {
                card.style.transform = '';
            });
        });
    })();


    /* ================================================================
       11. SMOOTH SCROLL
    ================================================================ */
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            var href = link.getAttribute('href');
            if (href === '#' || href.length <= 1) return;
            var target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                var top = target.getBoundingClientRect().top + window.pageYOffset - 80;
                window.scrollTo({ top: top, behavior: 'smooth' });
            }
        });
    });


    /* ================================================================
       12. MODAL LOGIC
    ================================================================ */
    var modalState = { open: false, tab: 'login' };

    function openModal(tab) {
        var overlay   = document.getElementById('modalOverlay');
        if (!overlay) return;
        switchModalTab(tab || 'login');
        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        modalState.open = true;
        setTimeout(function () {
            var first = overlay.querySelector('.modal-form:not(.modal-form--hidden) .form-input');
            if (first) first.focus();
        }, 260);
    }

    function closeModal() {
        var overlay = document.getElementById('modalOverlay');
        if (!overlay) return;
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        modalState.open = false;
    }

    function switchModalTab(tab) {
        var tL = document.getElementById('tabLogin');
        var tR = document.getElementById('tabRegister');
        var fL = document.getElementById('formLogin');
        var fR = document.getElementById('formRegister');
        if (!tL || !tR || !fL || !fR) return;

        if (tab === 'login') {
            tL.classList.add('modal-tab--active');    tL.setAttribute('aria-selected', 'true');
            tR.classList.remove('modal-tab--active'); tR.setAttribute('aria-selected', 'false');
            fL.classList.remove('modal-form--hidden');
            fR.classList.add('modal-form--hidden');
        } else {
            tR.classList.add('modal-tab--active');    tR.setAttribute('aria-selected', 'true');
            tL.classList.remove('modal-tab--active'); tL.setAttribute('aria-selected', 'false');
            fR.classList.remove('modal-form--hidden');
            fL.classList.add('modal-form--hidden');
        }
        modalState.tab = tab;
    }

    // Wire modal triggers
    (function wireModal() {
        var btnLogin    = document.getElementById('btnLogin');
        var btnRegister = document.getElementById('btnRegister');
        var btnRegCta   = document.getElementById('btnRegisterCta');
        var modalClose  = document.getElementById('modalClose');
        var overlay     = document.getElementById('modalOverlay');
        var tL          = document.getElementById('tabLogin');
        var tR          = document.getElementById('tabRegister');

        if (btnLogin)    btnLogin.addEventListener('click',    function () { openModal('login'); });
        if (btnRegister) btnRegister.addEventListener('click', function () { openModal('register'); });
        if (btnRegCta)   btnRegCta.addEventListener('click',   function (e) { e.preventDefault(); openModal('register'); });
        if (modalClose)  modalClose.addEventListener('click',  closeModal);

        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeModal();
            });
        }

        if (tL) tL.addEventListener('click', function () { switchModalTab('login'); });
        if (tR) tR.addEventListener('click', function () { switchModalTab('register'); });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalState.open) closeModal();
        });

        // Prevent form submission on static site
        var fL = document.getElementById('formLogin');
        var fR = document.getElementById('formRegister');
        if (fL) fL.addEventListener('submit', function (e) { e.preventDefault(); });
        if (fR) fR.addEventListener('submit', function (e) { e.preventDefault(); });
    })();


    /* ================================================================
       13. PASSWORD EYE TOGGLE
    ================================================================ */
    document.querySelectorAll('.input-eye').forEach(function (eye) {
        eye.addEventListener('click', function () {
            var input = eye.parentElement.querySelector('input');
            if (!input) return;
            input.type = input.type === 'password' ? 'text' : 'password';
        });
    });


    /* ================================================================
       14. NEWS TABS (kept for script.js compat)
    ================================================================ */
    document.querySelectorAll('.news-tab').forEach(function (tab) {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.news-tab').forEach(function (t) {
                t.classList.remove('active');
            });
            tab.classList.add('active');
        });
    });


    /* ================================================================
       15. PAGINATION (kept for script.js compat)
    ================================================================ */
    document.querySelectorAll('.pagination .page').forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.classList.contains('page-last')) return;
            document.querySelectorAll('.pagination .page').forEach(function (p) {
                p.classList.remove('active');
            });
            btn.classList.add('active');
        });
    });


    /* ================================================================
       16. MOUSEDOWN CLASS (for script.js cursor rotation compat)
    ================================================================ */
    window.addEventListener('mousedown', function () {
        document.documentElement.classList.add('clicking');
    });
    window.addEventListener('mouseup', function () {
        document.documentElement.classList.remove('clicking');
    });
    window.addEventListener('blur', function () {
        document.documentElement.classList.remove('clicking');
    });


    /* ================================================================
       17. STORY SCENE INITIAL STATE — ensure opacity is set
    ================================================================ */
    (function initStoryScenes() {
        var s1 = document.getElementById('storyScene1');
        var s2 = document.getElementById('storyScene2');
        var s3 = document.getElementById('storyScene3');
        if (s1) s1.style.opacity = '1';
        if (s2) { s2.style.opacity = '0'; s2.classList.remove('story-scene--hidden'); }
        if (s3) { s3.style.opacity = '0'; s3.classList.remove('story-scene--hidden'); }
    })();


})(); // end IIFE

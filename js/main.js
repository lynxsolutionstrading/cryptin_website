/* ====================================================================
   main.js — Cryptin Website
   All main-page functionality. Does NOT touch intro-wall logic (script.js).
==================================================================== */

(function () {
    'use strict';

    /* ----------------------------------------------------------------
       1. CUSTOM CURSOR
    ---------------------------------------------------------------- */
    (function initCursor() {
        // Only on non-touch devices
        if (window.matchMedia('(hover: none)').matches) return;

        var dot = document.getElementById('cursor-dot');
        if (!dot) return;

        var curX = -100, curY = -100; // off screen initially
        var dotX = -100, dotY = -100;
        var rafId = null;

        document.addEventListener('mousemove', function (e) {
            curX = e.clientX;
            curY = e.clientY;
        });

        function animateCursor() {
            // Lerp: ~50ms lag at 60fps (factor ~0.18)
            dotX += (curX - dotX) * 0.18;
            dotY += (curY - dotY) * 0.18;
            dot.style.left = dotX + 'px';
            dot.style.top  = dotY + 'px';
            rafId = requestAnimationFrame(animateCursor);
        }

        animateCursor();

        document.addEventListener('mouseleave', function () { dot.style.opacity = '0'; });
        document.addEventListener('mouseenter', function () { dot.style.opacity = '1'; });
    })();


    /* ----------------------------------------------------------------
       2. LOADING SCREEN
       Note: script.js also handles the pageLoader for the intro wall.
       main.js respects whatever script.js does — the loader div is
       removed by script.js after introBgImg.decode(). Here we only
       register a safety fallback in case script.js is not loaded.
    ---------------------------------------------------------------- */
    (function initLoader() {
        // script.js removes the loader; we set a hard fallback at 3s
        var loader = document.getElementById('pageLoader');
        if (!loader) return;

        // If script.js already removed it, nothing to do.
        // Safety timeout: remove after 3s no matter what.
        var safeTimeout = setTimeout(function () {
            if (loader.parentNode) {
                loader.classList.add('ldr-out');
                setTimeout(function () { if (loader.parentNode) loader.remove(); }, 650);
            }
        }, 3000);

        // Clear safety timeout if script.js removes the loader first.
        var observer = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                m.removedNodes.forEach(function (n) {
                    if (n === loader) {
                        clearTimeout(safeTimeout);
                        observer.disconnect();
                    }
                });
            });
        });
        if (loader.parentNode) observer.observe(loader.parentNode, { childList: true });
    })();


    /* ----------------------------------------------------------------
       3. NAV SCROLL BEHAVIOR
    ---------------------------------------------------------------- */
    (function initNav() {
        var nav = document.getElementById('mainNav');
        if (!nav) return;

        function updateNav() {
            if (window.scrollY > 50) {
                nav.classList.add('scrolled');
            } else {
                nav.classList.remove('scrolled');
            }
        }

        window.addEventListener('scroll', updateNav, { passive: true });
        updateNav();
    })();


    /* ----------------------------------------------------------------
       4. MOBILE HAMBURGER MENU
    ---------------------------------------------------------------- */
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
            if (hamburger.classList.contains('open')) { closeMenu(); } else { openMenu(); }
        });

        if (mobileClose) mobileClose.addEventListener('click', closeMenu);

        mobileLinks.forEach(function (link) {
            link.addEventListener('click', closeMenu);
        });

        // Mobile Login / Register buttons in menu
        var loginMobile    = document.getElementById('btnLoginMobile');
        var registerMobile = document.getElementById('btnRegisterMobile');
        if (loginMobile)    loginMobile.addEventListener('click',    function () { closeMenu(); openModal('login'); });
        if (registerMobile) registerMobile.addEventListener('click', function () { closeMenu(); openModal('register'); });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mobileMenu.classList.contains('open')) closeMenu();
        });
    })();


    /* ----------------------------------------------------------------
       5. HERO PARTICLES — Three.js
    ---------------------------------------------------------------- */
    var particleAnimRunning = false;
    var particleRAF = null;

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

        var scene  = new THREE.Scene();
        var camera = new THREE.OrthographicCamera(0, W, H, 0, -1, 1);

        var COUNT = 250;
        var positions  = new Float32Array(COUNT * 3);
        var velocities = new Float32Array(COUNT);     // upward speed per particle
        var opacities  = new Float32Array(COUNT);

        for (var i = 0; i < COUNT; i++) {
            positions[i * 3 + 0]  = Math.random() * W;           // x
            positions[i * 3 + 1]  = Math.random() * H;           // y
            positions[i * 3 + 2]  = 0;                           // z
            velocities[i]         = 0.2 + Math.random() * 0.5;   // upward px/frame
            opacities[i]          = 0.3 + Math.random() * 0.3;
        }

        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        var material = new THREE.PointsMaterial({
            color: 0xc8960a,
            size: 1.5,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0.5
        });

        var points = new THREE.Points(geometry, material);
        scene.add(points);

        function animate() {
            if (document.hidden) {
                particleAnimRunning = false;
                return;
            }

            particleAnimRunning = true;
            particleRAF = requestAnimationFrame(animate);

            var pos = points.geometry.attributes.position.array;
            for (var j = 0; j < COUNT; j++) {
                pos[j * 3 + 1] -= velocities[j];   // move up (y decreases in ortho top-to-bottom)
                if (pos[j * 3 + 1] < 0) {
                    pos[j * 3 + 1] = H;             // wrap around bottom
                    pos[j * 3 + 0] = Math.random() * W;
                }
            }
            points.geometry.attributes.position.needsUpdate = true;
            renderer.render(scene, camera);
        }

        animate();

        // Resize handler
        window.addEventListener('resize', function () {
            W = hero.offsetWidth;
            H = hero.offsetHeight;
            renderer.setSize(W, H);
            camera = new THREE.OrthographicCamera(0, W, H, 0, -1, 1);
            // Clamp existing particles
            for (var k = 0; k < COUNT; k++) {
                positions[k * 3 + 0] = Math.min(positions[k * 3 + 0], W);
                positions[k * 3 + 1] = Math.min(positions[k * 3 + 1], H);
            }
        }, { passive: true });

        // Pause / resume on visibility change
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && !particleAnimRunning) {
                animate();
            }
        });
    })();


    /* ----------------------------------------------------------------
       6. HERO ENTRY ANIMATIONS
    ---------------------------------------------------------------- */
    (function initHeroAnimations() {
        if (typeof gsap === 'undefined') return;

        var heroLogo    = document.getElementById('heroLogo');
        var heroButtons = document.getElementById('heroButtons');

        // Wait until intro-wall is gone before triggering hero animations
        function runHeroAnim() {
            if (heroLogo) {
                gsap.to(heroLogo, {
                    opacity: 1,
                    scale: 1,
                    duration: 1.2,
                    ease: 'power3.out',
                    delay: 0.1
                });
            }
            if (heroButtons) {
                gsap.to(heroButtons, {
                    opacity: 1,
                    duration: 0.8,
                    ease: 'power2.out',
                    delay: 0.9
                });
            }
        }

        // Listen for the intro-wall being removed from the DOM
        var introWall = document.getElementById('intro-wall');
        if (!introWall) {
            // Already gone
            runHeroAnim();
            return;
        }

        var wallObserver = new MutationObserver(function (mutations) {
            mutations.forEach(function (m) {
                if (m.type === 'attributes' && m.attributeName === 'style') {
                    var opacity = parseFloat(introWall.style.opacity);
                    if (opacity === 0 || introWall.style.display === 'none') {
                        runHeroAnim();
                        wallObserver.disconnect();
                    }
                }
                m.removedNodes.forEach(function (n) {
                    if (n === introWall) {
                        runHeroAnim();
                        wallObserver.disconnect();
                    }
                });
            });
        });

        wallObserver.observe(introWall, { attributes: true, attributeFilter: ['style'] });
        if (introWall.parentNode) {
            wallObserver.observe(introWall.parentNode, { childList: true });
        }

        // Hard fallback after 8s
        setTimeout(function () {
            wallObserver.disconnect();
            runHeroAnim();
        }, 8000);
    })();


    /* ----------------------------------------------------------------
       7. COUNTER ANIMATIONS
    ---------------------------------------------------------------- */
    function animateCounter(el, target, duration) {
        var start  = performance.now();
        var startV = 0;

        function step(now) {
            var elapsed  = now - start;
            var progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            var eased = 1 - Math.pow(1 - progress, 3);
            var current = Math.round(startV + (target - startV) * eased);
            el.textContent = current.toLocaleString('de-DE');
            if (progress < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
    }


    /* ----------------------------------------------------------------
       8. SCROLL REVEAL & SCROLL ANIMATIONS
    ---------------------------------------------------------------- */
    (function initScrollAnimations() {
        // IntersectionObserver for .reveal-up and .stagger-left
        if (!('IntersectionObserver' in window)) {
            // Fallback: show everything
            document.querySelectorAll('.reveal-up, .stagger-left').forEach(function (el) {
                el.classList.add('in-view');
            });
            return;
        }

        var revealObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el    = entry.target;
                var delay = el.dataset.delay ? parseFloat(el.dataset.delay) * 0.12 : 0;

                setTimeout(function () {
                    el.classList.add('in-view');
                }, delay * 1000);

                revealObserver.unobserve(el);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        document.querySelectorAll('.reveal-up, .stagger-left').forEach(function (el) {
            revealObserver.observe(el);
        });

        // Counter elements
        var counterObserver = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el     = entry.target;
                var target = parseInt(el.dataset.target, 10);
                if (!isNaN(target)) {
                    animateCounter(el, target, 1800);
                }
                counterObserver.unobserve(el);
            });
        }, { threshold: 0.3 });

        document.querySelectorAll('.counter').forEach(function (el) {
            counterObserver.observe(el);
        });

        // GSAP ScrollTrigger — only if available
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            gsap.registerPlugin(ScrollTrigger);
            initGSAPScrollTrigger();
        }
    })();

    function initGSAPScrollTrigger() {
        // Parallax on feature image
        var parallaxImg = document.querySelector('.parallax-img');
        if (parallaxImg) {
            gsap.fromTo(parallaxImg,
                { y: -60 },
                {
                    y: 60,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: '.section-feature',
                        start: 'top bottom',
                        end: 'bottom top',
                        scrub: true
                    }
                }
            );
        }
    }


    /* ----------------------------------------------------------------
       9. MODAL LOGIC
    ---------------------------------------------------------------- */
    var modalState = { open: false, tab: 'login' };

    function openModal(tab) {
        var overlay    = document.getElementById('modalOverlay');
        var tabLogin   = document.getElementById('tabLogin');
        var tabReg     = document.getElementById('tabRegister');
        var formLogin  = document.getElementById('formLogin');
        var formReg    = document.getElementById('formRegister');

        if (!overlay) return;

        // Set initial tab
        switchModalTab(tab || 'login');

        overlay.classList.add('open');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        modalState.open = true;

        // Focus first input
        setTimeout(function () {
            var firstInput = overlay.querySelector('.modal-form:not(.modal-form--hidden) .form-input');
            if (firstInput) firstInput.focus();
        }, 220);
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
        var tabLogin  = document.getElementById('tabLogin');
        var tabReg    = document.getElementById('tabRegister');
        var formLogin = document.getElementById('formLogin');
        var formReg   = document.getElementById('formRegister');

        if (!tabLogin || !tabReg || !formLogin || !formReg) return;

        if (tab === 'login') {
            tabLogin.classList.add('modal-tab--active');
            tabReg.classList.remove('modal-tab--active');
            tabLogin.setAttribute('aria-selected', 'true');
            tabReg.setAttribute('aria-selected', 'false');
            formLogin.classList.remove('modal-form--hidden');
            formReg.classList.add('modal-form--hidden');
        } else {
            tabReg.classList.add('modal-tab--active');
            tabLogin.classList.remove('modal-tab--active');
            tabReg.setAttribute('aria-selected', 'true');
            tabLogin.setAttribute('aria-selected', 'false');
            formReg.classList.remove('modal-form--hidden');
            formLogin.classList.add('modal-form--hidden');
        }

        modalState.tab = tab;
    }

    // Wire up triggers
    (function wireModal() {
        var btnLogin    = document.getElementById('btnLogin');
        var btnRegister = document.getElementById('btnRegister');
        var btnRegCta   = document.getElementById('btnRegisterCta');
        var modalClose  = document.getElementById('modalClose');
        var overlay     = document.getElementById('modalOverlay');
        var tabLogin    = document.getElementById('tabLogin');
        var tabRegister = document.getElementById('tabRegister');

        if (btnLogin)    btnLogin.addEventListener('click',    function () { openModal('login'); });
        if (btnRegister) btnRegister.addEventListener('click', function () { openModal('register'); });
        if (btnRegCta)   btnRegCta.addEventListener('click',   function (e) { e.preventDefault(); openModal('register'); });
        if (modalClose)  modalClose.addEventListener('click',  closeModal);

        if (overlay) {
            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) closeModal();
            });
        }

        if (tabLogin)    tabLogin.addEventListener('click',    function () { switchModalTab('login'); });
        if (tabRegister) tabRegister.addEventListener('click', function () { switchModalTab('register'); });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalState.open) closeModal();
        });

        // Prevent form submission (static site)
        var formLogin = document.getElementById('formLogin');
        var formReg   = document.getElementById('formRegister');
        if (formLogin) formLogin.addEventListener('submit', function (e) { e.preventDefault(); });
        if (formReg)   formReg.addEventListener('submit',   function (e) { e.preventDefault(); });
    })();


    /* ----------------------------------------------------------------
       10. VISIBILITY CHANGE — pause particles
           (handled inside initParticles via document.hidden check)
    ---------------------------------------------------------------- */

})();

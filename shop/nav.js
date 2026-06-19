/**
 * nav.js — Shared navigation controller for S.M Dynamics Electronics
 * --------------------------------------------------------------------
 * Consolidates logic that used to be copy-pasted (and slightly different,
 * and slightly buggy) across index.html / contact.html / repair.html into
 * one tested implementation. Loaded with `defer`, after the page markup.
 *
 * What this file owns:
 *  1. Measuring the real navbar height into --nav-h so the sticky nav,
 *     anchor-scroll offset, and mobile-menu top edge never drift apart.
 *  2. A single rAF-throttled scroll listener for the "scrolled" (shrink)
 *     state and the back-to-top button — replaces 2-3 separate raw
 *     scroll listeners that used to fire on every pixel of scroll.
 *  3. Mobile menu open/close: hamburger morph, body scroll lock,
 *     close-on-link-click (event delegation), Escape to close,
 *     swipe-up-to-close gesture, and ARIA state syncing.
 *  4. Active-link highlighting — for in-page sections (IntersectionObserver)
 *     and for which physical page you're on (multi-page nav).
 *
 * All lookups are guarded with `?.` / existence checks so this file is
 * safe to include on any page, whether or not it has a mobile menu.
 */
(() => {
  const nav = document.getElementById('nav');
  const toggle = document.getElementById('menuToggle');
  const menu = document.getElementById('mobileMenu');
  const toTop = document.getElementById('toTop');

  /* ---------- 1. Keep --nav-h in sync with the real header height ---------- */
  function syncNavHeight() {
    if (!nav) return;
    document.documentElement.style.setProperty('--nav-h', `${nav.offsetHeight}px`);
  }
  syncNavHeight();
  window.addEventListener('load', syncNavHeight);
  window.addEventListener('resize', debounce(syncNavHeight, 150));
  window.addEventListener('orientationchange', () => setTimeout(syncNavHeight, 250));

  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  /* ---------- 2. One rAF-throttled scroll handler for the whole nav ---------- */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      nav?.classList.toggle('scrolled', y > 20);
      toTop?.classList.toggle('show', y > 600);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll(); // set correct state on load (e.g. mid-scroll page restore)

  /* ---------- 3. Mobile menu: open / close / lock / gestures ---------- */
  let lastScrollY = 0;

  function openMenu() {
    if (!menu || !toggle) return;
    lastScrollY = window.scrollY;
    toggle.classList.add('open');
    menu.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    document.documentElement.classList.add('menu-open');
    // Focus the first link for keyboard users (Enter/Space-activated toggle)
    menu.querySelector('a')?.focus({ preventScroll: true });
  }

  function closeMenu({ returnFocus = false } = {}) {
    if (!menu || !toggle) return;
    toggle.classList.remove('open');
    menu.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('menu-open');
    if (returnFocus) toggle.focus({ preventScroll: true });
  }

  function isMenuOpen() {
    return !!menu?.classList.contains('open');
  }

  if (toggle && menu) {
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', menu.id || 'mobileMenu');
    menu.setAttribute('aria-hidden', 'true');

    toggle.addEventListener('click', () => (isMenuOpen() ? closeMenu() : openMenu()));

    // Event delegation: one listener for every link inside the menu,
    // instead of attaching a click handler to each <a> individually.
    menu.addEventListener('click', e => {
      if (e.target.closest('a')) closeMenu();
    });

    // Escape closes the menu and returns focus to the toggle button.
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isMenuOpen()) closeMenu({ returnFocus: true });
    });

    // Swipe-up-to-close: the panel drops down from the top, so an upward
    // swipe is the natural "put it away" gesture on touch devices.
    let touchStartY = null;
    menu.addEventListener('touchstart', e => { touchStartY = e.touches[0].clientY; }, { passive: true });
    menu.addEventListener('touchend', e => {
      if (touchStartY === null) return;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (dy < -40) closeMenu(); // swiped up more than 40px
      touchStartY = null;
    }, { passive: true });

    // If the viewport grows past the mobile breakpoint while the menu is
    // open (e.g. tablet rotation, foldable unfold), close it so it can't
    // get stuck open behind the desktop nav links.
    window.addEventListener('resize', debounce(() => {
      if (isMenuOpen() && window.innerWidth > 880) closeMenu();
    }, 150));
  }

  /* ---------- 4. Active-link highlighting ---------- */
  const allNavLinks = [
    ...document.querySelectorAll('.nav-links a'),
    ...(menu ? menu.querySelectorAll('a') : []),
  ];

  // 4a. Multi-page: mark the link(s) pointing at the current document.
  const here = location.pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
  allNavLinks.forEach(a => {
    let linkPath;
    try { linkPath = new URL(a.href, location.href).pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/'; }
    catch { return; }
    if (linkPath === here && !a.hash) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });

  // 4b. Single-page sections: highlight the in-view section's nav link.
  const hashLinks = allNavLinks.filter(a => a.getAttribute('href')?.startsWith('#'));
  if (hashLinks.length) {
    const sections = hashLinks
      .map(a => document.getElementById(a.getAttribute('href').slice(1)))
      .filter(Boolean);

    if (sections.length && 'IntersectionObserver' in window) {
      const setActiveHash = id => {
        allNavLinks.forEach(a => {
          const isHashMatch = a.getAttribute('href') === `#${id}`;
          a.classList.toggle('active', isHashMatch);
          if (isHashMatch) a.setAttribute('aria-current', 'true');
          else if (a.getAttribute('href')?.startsWith('#')) a.removeAttribute('aria-current');
        });
      };

      const observer = new IntersectionObserver(entries => {
        // Pick the entry closest to the top of the viewport among those visible.
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          setActiveHash(visible[0].target.id);
        }
      }, {
        // Top margin keeps the threshold line just below the sticky nav.
        rootMargin: `-${(nav?.offsetHeight || 72) + 20}px 0px -65% 0px`,
        threshold: 0,
      });

      sections.forEach(s => observer.observe(s));
    }
  }
})();

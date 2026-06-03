// Shared JS for About / Contact pages

(function () {
  /* ====== Scroll Reveal ====== */
  const revealEls = document.querySelectorAll('[data-scroll-reveal]');

  function checkReveal() {
    const vh = window.innerHeight;
    revealEls.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < vh - 60) {
        setTimeout(() => el.classList.add('in-view'), i * 80);
      }
    });
  }

  // Add base styles for scroll-reveal elements if not already cards
  revealEls.forEach(el => {
    if (!el.classList.contains('card')) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.7s ease, transform 0.7s ease';
    }
  });

  // In-view class sets opacity & transform via inline style reset
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  revealEls.forEach(el => observer.observe(el));

  /* ====== fact-item / scholarship-item / space-fact-item IntersectionObserver ====== */
  const scrollItems = document.querySelectorAll(
    '.fact-item, .scholarship-item, .space-fact-item'
  );
  const itemObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('in-view'), idx * 100);
        itemObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  scrollItems.forEach(el => itemObserver.observe(el));

  /* ====== Nav fade ====== */
  const nav = document.getElementById('main-nav');
  function updateNav() {
    if (!nav) return;
    if (window.scrollY > 50) {
      nav.style.background = 'rgba(0,0,0,0.75)';
      nav.style.backdropFilter = 'blur(12px)';
    } else {
      nav.style.background = 'transparent';
      nav.style.backdropFilter = 'none';
    }
  }
  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

})();

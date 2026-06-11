(function () {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const link = entry.target.querySelector('.planet-link');
      if (link) link.classList.add('revealed');
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.planet-scene').forEach(el => observer.observe(el));
})();

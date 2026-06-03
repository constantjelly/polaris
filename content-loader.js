(function () {
  const scriptTag = document.currentScript;
  const pageKey = scriptTag ? scriptTag.getAttribute('data-page') : null;
  if (!pageKey) return;

  const container = document.getElementById('dynamic-articles');
  if (!container) return;

  async function render() {
    const { data: articles, error } = await polarisDb
      .from('articles')
      .select('*')
      .eq('page', pageKey)
      .eq('published', true)
      .order('date', { ascending: false });

    if (error || !articles || !articles.length) {
      container.innerHTML = `
        <div class="empty-state">
          <p style="color:var(--muted);text-align:center;padding:3rem 1rem;font-family:var(--font-serif);">
            No articles yet — check back soon.
          </p>
        </div>`;
      return;
    }

    const pageConfig = {
      facts: { itemClass: 'space-fact-item' },
      nights: { itemClass: 'gallery-item' },
      exams: { itemClass: 'scholarship-item' }
    };

    const config = pageConfig[pageKey] || { itemClass: 'content-text' };

    container.innerHTML = articles.map(a => {
      const dateStr = new Date(a.date).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric'
      });
      const imageHtml = a.image_url
        ? `<div class="admin-article-img-wrap"><img src="${a.image_url}" alt="${a.title}" class="admin-article-img" /></div>`
        : '';

      return `
        <div class="${config.itemClass}" data-scroll-reveal style="opacity:0;transform:translateY(30px);transition:opacity 0.7s ease,transform 0.7s ease;">
          <div class="article-meta">${dateStr}</div>
          <h3>${a.title}</h3>
          ${imageHtml}
          <p>${a.content.replace(/\n/g, '<br/>')}</p>
        </div>
      `;
    }).join('');

    const revealEls = container.querySelectorAll('[data-scroll-reveal]');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    revealEls.forEach(el => observer.observe(el));
  }

  render();
})();

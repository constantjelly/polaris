(function () {
  const track = document.getElementById('ticker-track');
  if (!track) return;

  async function render() {
    const { data: articles, error } = await polarisDb
      .from('articles')
      .select('*')
      .eq('published', true)
      .order('date', { ascending: false })
      .limit(10);

    if (error || !articles || !articles.length) {
      track.innerHTML = '<span class="ticker-empty">No recent articles</span>';
      document.body.classList.remove('ticker-active');
      return;
    }

    document.body.classList.add('ticker-active');

    const pageLabels = { facts: 'facts.html', nights: 'nights.html', exams: 'exams.html' };
    const pageNames = { facts: 'Space Facts', nights: 'Starry Nights', exams: 'Exams & Scholarships' };

    const items = articles.map(a => {
      const href = pageLabels[a.page] || '#';
      const name = pageNames[a.page] || a.page;
      return `<a href="${href}">${a.title}</a><span class="ticker-sep">// ${name}</span>`;
    });

    const html = items.join('<span class="ticker-sep"> &mdash; </span>');
    track.innerHTML = html + '<span class="ticker-sep"> &mdash; </span>' + html;
  }

  render();
})();

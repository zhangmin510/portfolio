(() => {
  const input = document.getElementById('search');
  const filters = [...document.querySelectorAll('.filter')];
  const cards = [...document.querySelectorAll('.card')];
  const status = document.getElementById('result-count');
  const empty = document.getElementById('empty');
  const key = 'portfolio:panorama-directory:v1';
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch {}
  const params = new URLSearchParams(location.search || (saved?.search || ''));
  input.value = params.get('q') || '';
  let selectedCategory = params.get('category') || '';
  if (!filters.some(b => b.dataset.category === selectedCategory)) selectedCategory = '';
  function update() {
    const terms = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let visible = 0;
    cards.forEach(card => {
      card.hidden = !!((selectedCategory && card.dataset.category !== selectedCategory) || !terms.every(term => card.dataset.search.toLocaleLowerCase().includes(term)));
      if (!card.hidden) visible++;
    });
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === selectedCategory)));
    status.textContent = '展示 ' + visible + ' / ' + cards.length + ' 张全景图';
    empty.hidden = visible !== 0;
    const url = new URL(location.href);
    input.value.trim() ? url.searchParams.set('q', input.value.trim()) : url.searchParams.delete('q');
    selectedCategory ? url.searchParams.set('category', selectedCategory) : url.searchParams.delete('category');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  function save() {
    try { sessionStorage.setItem(key, JSON.stringify({search: location.search, y: scrollY})); } catch {}
  }
  input.addEventListener('input', update);
  filters.forEach(button => button.addEventListener('click', () => { selectedCategory = button.dataset.category; update(); }));
  document.getElementById('reset').addEventListener('click', () => { input.value = ''; selectedCategory = ''; update(); input.focus(); });
  document.addEventListener('click', event => { if (event.target.closest('.card')) save(); });
  addEventListener('pagehide', save);
  update();
  const searchKey = search => { const params = new URLSearchParams(search); params.sort(); return params.toString(); };
  if (saved && searchKey(saved.search) === searchKey(location.search) && !location.hash) requestAnimationFrame(() => scrollTo(0, Number(saved.y) || 0));
})();

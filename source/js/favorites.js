(function() {
  const STORAGE_KEY = 'hexo_favorites';

  function getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveAll(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('favorites-changed'));
  }

  function normUrl(url) {
    try {
      const path = new URL(url, location.origin).pathname;
      return path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
    } catch {
      return url;
    }
  }

  function isFav(url) {
    const key = normUrl(url);
    return getAll().some(item => normUrl(item.url) === key);
  }

  function toggle(item) {
    const key = normUrl(item.url);
    const list = getAll();
    const idx = list.findIndex(i => normUrl(i.url) === key);
    if (idx >= 0) {
      list.splice(idx, 1);
      saveAll(list);
      toast('已取消收藏');
      return false;
    }
    list.unshift({
      url: key,
      title: item.title || '未命名文章',
      cover: item.cover || '',
      date: item.date || '',
      savedAt: new Date().toISOString()
    });
    saveAll(list);
    toast('已加入收藏');
    return true;
  }

  function remove(url) {
    const key = normUrl(url);
    saveAll(getAll().filter(i => normUrl(i.url) !== key));
    toast('已移除收藏');
  }

  function toast(msg) {
    let el = document.getElementById('fav-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fav-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 2000);
  }

  function makeBtn(item, small) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fav-btn' + (small ? ' fav-btn-sm' : '');
    updateBtn(btn, item.url);
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      toggle(item);
      updateBtn(btn, item.url);
      syncAllButtons(item.url);
    });
    return btn;
  }

  function updateBtn(btn, url) {
    const active = isFav(url);
    btn.classList.toggle('active', active);
    btn.innerHTML = smallHtml(active, btn.classList.contains('fav-btn-sm'));
  }

  function smallHtml(active, small) {
    if (small) return active ? '★' : '☆';
    return active
      ? '<i class="fas fa-star"></i><span>已收藏</span>'
      : '<i class="far fa-star"></i><span>收藏</span>';
  }

  function syncAllButtons(url) {
    const key = normUrl(url);
    document.querySelectorAll('.fav-btn').forEach(btn => {
      if (btn.dataset.url && normUrl(btn.dataset.url) === key) updateBtn(btn, key);
    });
  }

  function initPostPage() {
    const titleEl = document.querySelector('#post-info .post-title, .post-title');
    if (!titleEl || document.querySelector('.fav-btn-post')) return;

    const coverMatch = document.querySelector('#page-header.post-bg')?.style?.backgroundImage?.match(/url\(["']?([^"')]+)/);
    const item = {
      url: location.pathname,
      title: titleEl.textContent.trim(),
      cover: coverMatch?.[1] || document.querySelector('.post-bg')?.src || '',
      date: document.querySelector('.post-meta-date-created')?.textContent?.trim() || ''
    };

    const btn = makeBtn(item, false);
    btn.classList.add('fav-btn-post');
    btn.dataset.url = item.url;

    const target = document.querySelector('.tag_share') || document.querySelector('#post-meta');
    if (target) {
      const wrap = document.createElement('div');
      wrap.className = 'fav-btn-wrap';
      wrap.appendChild(btn);
      target.parentNode.insertBefore(wrap, target);
    }
  }

  function initIndexCards() {
    document.querySelectorAll('.recent-post-item').forEach(card => {
      if (card.querySelector('.fav-btn-card')) return;
      const link = card.querySelector('a.article-title, .recent-post-info > a');
      const coverImg = card.querySelector('.post_cover img, img.post-bg');
      if (!link) return;

      const item = {
        url: link.getAttribute('href'),
        title: link.getAttribute('title') || link.textContent.trim(),
        cover: coverImg?.getAttribute('src') || '',
        date: card.querySelector('time')?.textContent?.trim() || ''
      };

      const btn = makeBtn(item, true);
      btn.classList.add('fav-btn-card');
      btn.dataset.url = item.url;
      btn.title = isFav(item.url) ? '取消收藏' : '收藏文章';

      const info = card.querySelector('.recent-post-info');
      if (info) {
        const top = info.querySelector('.article-title')?.parentElement || info;
        const row = document.createElement('div');
        row.className = 'fav-card-row';
        row.appendChild(btn);
        top.insertBefore(row, top.firstChild);
      }
    });
  }

  function renderFavoritesPage() {
    if (document.getElementById('favorites-page')) return;

    const page = document.createElement('div');
    page.id = 'favorites-page';
    page.innerHTML = `
      <h1 class="fav-page-title"><i class="fas fa-star"></i> 我的收藏</h1>
      <p class="fav-page-desc">收藏保存在本浏览器中，换设备或清理缓存后会消失。</p>
      <div class="fav-list" id="fav-list"></div>
    `;

    const article = document.getElementById('article-container');
    if (article) {
      article.innerHTML = '';
      article.appendChild(page);
    } else {
      const target = document.getElementById('content-inner') || document.querySelector('main');
      if (target) target.appendChild(page);
    }

    renderList();
    window.addEventListener('favorites-changed', renderList);
  }

  function renderList() {
    const el = document.getElementById('fav-list');
    if (!el) return;
    const list = getAll();
    if (!list.length) {
      el.innerHTML = '<div class="fav-empty">还没有收藏任何文章，去首页逛逛吧~</div>';
      return;
    }
    el.innerHTML = list.map(item => `
      <div class="fav-item" data-url="${esc(item.url)}">
        <a class="fav-item-cover" href="${esc(item.url)}">
          <img src="${esc(item.cover || '/img/404.jpg')}" alt="" onerror="this.src='/img/404.jpg'">
        </a>
        <div class="fav-item-body">
          <a class="fav-item-title" href="${esc(item.url)}">${esc(item.title)}</a>
          <div class="fav-item-meta">${esc(item.date || '')}</div>
        </div>
        <button type="button" class="fav-item-remove" data-url="${esc(item.url)}" title="移除收藏">×</button>
      </div>
    `).join('');

    el.querySelectorAll('.fav-item-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        remove(btn.dataset.url);
        renderList();
        syncAllButtons(btn.dataset.url);
      });
    });
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function init() {
    const path = normUrl(location.pathname);
    if (path === '/favorites') {
      renderFavoritesPage();
      return;
    }
    initPostPage();
    initIndexCards();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.Favorites = { getAll, isFav, toggle, remove };
})();

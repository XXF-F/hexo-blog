// ==================== State ====================
let allPosts = [];
let currentThemeFilePath = '';
let currentEditSlug = '';

// ==================== Navigation ====================
const pageTitles = {
  dashboard: '仪表盘', posts: '文章管理', editor: '写文章',
  media: '媒体库', comments: '留言管理', 'theme-config': '主题设置',
  'theme-files': '主题文件', 'custom-css': '自定义 CSS',
  'site-config': '站点设置', deploy: '生成部署', account: '账号管理'
};

function navigateTo(page) {
  document.querySelectorAll('.page-section').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(`page-${page}`);
  if (target) target.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navItem) navItem.classList.add('active');

  document.getElementById('page-title').textContent = pageTitles[page] || page;

  const loaders = {
    dashboard: loadDashboard,
    posts: loadPosts,
    media: loadMedia,
    comments: loadAllComments,
    'theme-config': loadThemeConfig,
    'theme-files': () => loadThemeFiles(''),
    'custom-css': loadCustomCSS,
    'site-config': loadSiteConfig,
  };
  if (loaders[page]) loaders[page]();
}

document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => {
    if (item.dataset.page === 'editor') newPost();
    else navigateTo(item.dataset.page);
  });
});

// ==================== API Helper ====================
async function api(url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && data.error && !data.success) {
      data.success = false;
    }
    return data;
  } catch (e) {
    toast('请求失败: ' + e.message, 'error');
    throw e;
  }
}

async function apiForm(url, formData) {
  try {
    const res = await fetch(url, { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok && data.error) data.success = false;
    return data;
  } catch (e) {
    toast('上传失败: ' + e.message, 'error');
    return { success: false, error: e.message };
  }
}

// ==================== Toast ====================
function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  el.className = `toast ${type}`;
  el.innerHTML = `${icons[type] || ''} ${msg}`;
  container.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}

// ==================== Dashboard ====================
async function loadDashboard() {
  const stats = await api('/api/stats');
  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon posts">P</div>
      <div class="stat-info"><h3>${stats.posts}</h3><p>文章</p></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon tags">T</div>
      <div class="stat-info"><h3>${stats.tags}</h3><p>标签</p></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon cats">C</div>
      <div class="stat-info"><h3>${stats.categories}</h3><p>分类</p></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon drafts">D</div>
      <div class="stat-info"><h3>${stats.drafts}</h3><p>草稿</p></div>
    </div>`;

  document.getElementById('post-count').textContent = stats.posts;
  const posts = await api('/api/posts');
  allPosts = posts;
  const recent = posts.slice(0, 5);
  document.getElementById('recent-posts').innerHTML = recent.length ? `
    <table>
      <thead><tr><th>标题</th><th>日期</th><th>标签</th><th>操作</th></tr></thead>
      <tbody>${recent.map(p => `
        <tr>
          <td class="post-title-cell" onclick="editPost('${p.slug}')">${esc(p.title)}</td>
          <td class="text-sm text-muted">${fmtDate(p.date)}</td>
          <td>${(Array.isArray(p.tags) ? p.tags : []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="editPost('${p.slug}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="deletePost('${p.slug}','${esc(p.title)}')">删除</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="text-muted">暂无文章</p>';
}

// ==================== Posts ====================
async function loadPosts() {
  const posts = await api('/api/posts');
  allPosts = posts;
  document.getElementById('post-count').textContent = posts.length;
  renderPostsTable(posts);
}

function renderPostsTable(posts) {
  document.getElementById('posts-table').innerHTML = posts.length ? `
    <table>
      <thead><tr><th>标题</th><th>日期</th><th>标签</th><th>状态</th><th>操作</th></tr></thead>
      <tbody>${posts.map(p => `
        <tr>
          <td class="post-title-cell" onclick="editPost('${p.slug}')">${esc(p.title)}</td>
          <td class="text-sm text-muted">${fmtDate(p.date)}</td>
          <td>${(Array.isArray(p.tags) ? p.tags : []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</td>
          <td><span class="tag" style="background:${p.draft ? '#fef3c7;color:#92400e' : '#d1fae5;color:#065f46'}">${p.draft ? '草稿' : '已发布'}</span></td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="editPost('${p.slug}')">编辑</button>
            <button class="btn btn-sm btn-danger" onclick="deletePost('${p.slug}','${esc(p.title)}')">删除</button>
          </td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="text-muted">暂无文章，点击"新建文章"开始创作吧！</p>';
}

function filterPosts() {
  const q = document.getElementById('post-search').value.toLowerCase();
  const filtered = allPosts.filter(p =>
    p.title.toLowerCase().includes(q) ||
    (Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase().includes(q)))
  );
  renderPostsTable(filtered);
}

async function editPost(slug) {
  const data = await api(`/api/posts/${slug}`);
  document.getElementById('ed-title').value = data.frontmatter.title || '';
  document.getElementById('ed-tags').value = (Array.isArray(data.frontmatter.tags) ? data.frontmatter.tags : []).join(', ');
  document.getElementById('ed-categories').value = (Array.isArray(data.frontmatter.categories) ? data.frontmatter.categories : []).join(', ');
  document.getElementById('ed-cover').value = data.frontmatter.cover || '';
  renderCoverPreview();
  document.getElementById('ed-draft').checked = !!data.frontmatter.draft;
  document.getElementById('ed-content').value = data.content.trim();
  document.getElementById('ed-slug').value = slug;
  currentEditSlug = slug;
  updatePreview();
  navigateTo('editor');
  document.getElementById('page-title').textContent = '编辑文章';
}

async function deletePost(slug, title) {
  if (!confirm(`确定要删除文章"${title}"吗？此操作不可撤销。`)) return;
  const res = await api(`/api/posts/${slug}`, { method: 'DELETE' });
  if (res.success) {
    toast('文章已删除');
    loadPosts();
    loadDashboard();
  } else {
    toast(res.error || '删除失败', 'error');
  }
}

// ==================== Editor ====================
async function savePost() {
  const title = document.getElementById('ed-title').value.trim();
  if (!title) return toast('请输入文章标题', 'error');

  const data = {
    title,
    content: document.getElementById('ed-content').value,
    tags: document.getElementById('ed-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    categories: document.getElementById('ed-categories').value.split(',').map(s => s.trim()).filter(Boolean),
    cover: document.getElementById('ed-cover').value.trim(),
    draft: document.getElementById('ed-draft').checked
  };

  const slug = document.getElementById('ed-slug').value;
  let res;
  if (slug) {
    res = await api(`/api/posts/${slug}`, { method: 'PUT', body: data });
  } else {
    res = await api('/api/posts', { method: 'POST', body: data });
  }

  if (res.success) {
    document.getElementById('ed-slug').value = res.slug;
    currentEditSlug = res.slug;
    if (res.deployed) {
      toast(slug ? '文章已更新并发布到 GitHub' : '文章已创建并发布到 GitHub');
    } else if (!data.draft && res.deployError) {
      toast('文章已保存，但发布失败: ' + res.deployError, 'error');
    } else {
      toast(slug ? '文章已更新' : (data.draft ? '草稿已保存' : '文章已创建'));
    }
  } else {
    const msg = res.code === 'CONTENT_BLOCKED'
      ? (res.error || '内容包含违规信息，禁止发布黄赌毒相关内容')
      : (res.error || '保存失败');
    toast(msg, 'error');
  }
}

function resetEditor() {
  ['ed-title', 'ed-tags', 'ed-categories', 'ed-cover', 'ed-content', 'ed-slug'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('ed-draft').checked = false;
  document.getElementById('ed-preview').innerHTML = '';
  document.getElementById('ed-cover-file').value = '';
  renderCoverPreview();
  currentEditSlug = '';
  document.getElementById('page-title').textContent = '写文章';
}

function newPost() {
  resetEditor();
  navigateTo('editor');
}

function renderCoverPreview() {
  const url = document.getElementById('ed-cover')?.value.trim();
  const img = document.getElementById('ed-cover-preview-img');
  const placeholder = document.getElementById('ed-cover-preview-placeholder');
  const clearBtn = document.getElementById('ed-cover-clear');
  if (!img || !placeholder) return;

  if (url) {
    img.src = url;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    if (clearBtn) clearBtn.style.display = '';
    img.onerror = () => {
      img.style.display = 'none';
      placeholder.style.display = 'block';
      placeholder.textContent = '失败';
    };
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'block';
    placeholder.textContent = '无';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

function clearCover() {
  document.getElementById('ed-cover').value = '';
  document.getElementById('ed-cover-file').value = '';
  renderCoverPreview();
}

async function uploadCoverFile(files) {
  if (!files.length) return;
  const fd = new FormData();
  fd.append('files', files[0]);
  toast('封面上传中...', 'info');
  const res = await apiForm('/api/media/upload', fd);
  if (res.success && res.files.length) {
    document.getElementById('ed-cover').value = res.files[0].url;
    renderCoverPreview();
    toast('封面已上传');
  } else {
    toast(res.error || '上传失败', 'error');
  }
  document.getElementById('ed-cover-file').value = '';
}

function updatePreview() {
  const md = document.getElementById('ed-content').value;
  try {
    document.getElementById('ed-preview').innerHTML = marked.parse(md);
  } catch (e) {
    document.getElementById('ed-preview').textContent = md;
  }
}

function insertMd(before, after) {
  const ta = document.getElementById('ed-content');
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = ta.value.substring(start, end);
  const replacement = before + selected + after;
  ta.setRangeText(replacement, start, end, 'select');
  ta.focus();
  updatePreview();
}

// ==================== Editor Paste/Drop Upload ====================
function setupEditorUpload() {
  const ta = document.getElementById('ed-content');
  if (!ta) return;

  // Paste image from clipboard
  ta.addEventListener('paste', async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        await uploadAndInsert(file, ta);
        return;
      }
    }
  });

  // Drag and drop image files
  ta.addEventListener('dragover', (e) => { e.preventDefault(); ta.style.borderColor = 'var(--primary)'; });
  ta.addEventListener('dragleave', () => { ta.style.borderColor = ''; });
  ta.addEventListener('drop', async (e) => {
    e.preventDefault();
    ta.style.borderColor = '';
    const files = e.dataTransfer?.files;
    if (!files) return;
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        await uploadAndInsert(file, ta);
      }
    }
  });
}

async function uploadAndInsert(file, ta) {
  const placeholder = `![上传中...](uploading)`;
  const pos = ta.selectionStart;
  ta.setRangeText(placeholder, pos, pos, 'end');
  updatePreview();
  toast('图片上传中...', 'info');

  const fd = new FormData();
  fd.append('files', file);
  try {
    const res = await apiForm('/api/media/upload', fd);
    if (res.success && res.files.length) {
      const url = res.files[0].url;
      const mdImg = `![image](${url})`;
      const content = ta.value;
      ta.value = content.replace(placeholder, mdImg);
      updatePreview();
      toast('图片已上传并插入');
    } else {
      ta.value = ta.value.replace(placeholder, '');
      toast('上传失败', 'error');
    }
  } catch (err) {
    ta.value = ta.value.replace(placeholder, '');
    toast('上传出错: ' + err.message, 'error');
  }
}

// ==================== Media ====================
async function loadMedia() {
  const media = await api('/api/media');
  const grid = document.getElementById('media-grid');
  grid.innerHTML = media.length ? media.map(m => `
    <div class="media-item">
      <img src="${m.url}" alt="${esc(m.name)}" loading="lazy" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%2260%22 x=%2220%22 font-size=%2240%22>📄</text></svg>'">
      <div class="media-info" title="${esc(m.name)}">${esc(m.name)}</div>
      <div class="media-actions">
        <button onclick="copyMediaUrl('${m.url}')" title="复制链接">📋</button>
        <button onclick="insertMediaToEditor('${m.url}')" title="插入文章">📝</button>
        <button onclick="deleteMedia('${esc(m.name)}')" title="删除">🗑️</button>
      </div>
    </div>`).join('') : '<p class="text-muted">媒体库为空，上传一些文件吧！</p>';

  setupDropzone();
}

function setupDropzone() {
  const dz = document.getElementById('dropzone');
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); uploadFiles(e.dataTransfer.files); });
}

async function uploadFiles(files) {
  if (!files.length) return;
  const fd = new FormData();
  Array.from(files).forEach(f => fd.append('files', f));
  toast('上传中...', 'info');
  const res = await apiForm('/api/media/upload', fd);
  if (res.success) {
    toast(`成功上传 ${res.files.length} 个文件`);
    loadMedia();
  } else {
    toast(res.error || '上传失败', 'error');
  }
}

function copyMediaUrl(url) {
  navigator.clipboard.writeText(url).then(() => toast('链接已复制'));
}

function insertMediaToEditor(url) {
  const ta = document.getElementById('ed-content');
  const insertion = `![image](${url})`;
  const pos = ta.selectionStart;
  ta.setRangeText(insertion, pos, pos, 'end');
  updatePreview();
  navigateTo('editor');
  toast('图片已插入编辑器');
}

async function deleteMedia(name) {
  if (!confirm(`确定要删除 "${name}" 吗？`)) return;
  const res = await api(`/api/media/${name}`, { method: 'DELETE' });
  if (res.success) { toast('文件已删除'); loadMedia(); }
  else toast(res.error || '删除失败', 'error');
}

function openMediaPicker() {
  navigateTo('media');
  toast('点击图片上的 📝 按钮插入到文章中', 'info');
}

// ==================== Tab Switching ====================
let themeConfigMode = 'form';
let siteConfigMode = 'form';

function switchConfigTab(type, mode) {
  const formView = document.getElementById(`${type}-form-view`);
  const rawView = document.getElementById(`${type}-raw-view`);
  const btns = formView.parentElement.querySelectorAll('.tab-btn');

  if (mode === 'form') {
    formView.style.display = '';
    rawView.style.display = 'none';
    btns[0].classList.add('active');
    btns[1].classList.remove('active');
  } else {
    formView.style.display = 'none';
    rawView.style.display = '';
    btns[0].classList.remove('active');
    btns[1].classList.add('active');
    if (type === 'theme') syncThemeFormToRaw();
    if (type === 'site') syncSiteFormToRaw();
  }
  if (type === 'theme') themeConfigMode = mode;
  if (type === 'site') siteConfigMode = mode;
}

// ==================== Theme Config ====================
let themeRawData = '';

function getVal(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }

async function loadThemeConfig() {
  const data = await api('/api/config/theme');
  themeRawData = data.raw || '';
  const c = data.config || {};
  document.getElementById('theme-config-editor').value = themeRawData;

  // Nav
  setVal('tc-nav-logo', c.nav?.logo || '');
  setVal('tc-nav-display-title', String(c.nav?.display_title ?? true));
  setVal('tc-nav-display-post-title', String(c.nav?.display_post_title ?? true));
  setVal('tc-nav-fixed', String(c.nav?.fixed ?? false));
  if (c.menu && typeof c.menu === 'object') renderMenuEditor(parseMenuConfig(c.menu));
  else renderMenuEditor([]);

  // Background
  setVal('tc-background', c.background || '');
  renderBackgroundPreview();

  // Layout & Cover
  setVal('tc-index-layout', String(c.index_layout ?? 3));
  setVal('tc-post-content-method', String(c.index_post_content?.method ?? 3));
  setVal('tc-post-content-length', c.index_post_content?.length ?? 500);
  setVal('tc-cover-index', String(c.cover?.index_enable ?? true));
  setVal('tc-cover-aside', String(c.cover?.aside_enable ?? true));
  setVal('tc-cover-archives', String(c.cover?.archives_enable ?? true));
  setVal('tc-cover-default', (c.cover?.default_cover || []).join('\n'));
  setVal('tc-rounded-corners', String(c.rounded_corners_ui ?? true));

  // Darkmode
  setVal('tc-darkmode-enable', String(c.darkmode?.enable ?? true));
  setVal('tc-darkmode-button', String(c.darkmode?.button ?? true));
  setVal('tc-darkmode-auto', String(c.darkmode?.autoChangeMode ?? false));
  setVal('tc-display-mode', c.display_mode || 'light');
  setVal('tc-theme-color-main', c.theme_color?.main || '');

  // Post settings
  setVal('tc-toc-post', String(c.toc?.post ?? true));
  setVal('tc-toc-number', String(c.toc?.number ?? true));
  setVal('tc-toc-scroll', String(c.toc?.scroll_percent ?? true));
  setVal('tc-readmode', String(c.readmode ?? true));
  setVal('tc-wordcount', String(c.wordcount?.enable ?? false));
  setVal('tc-min2read', String(c.wordcount?.min2read ?? true));
  setVal('tc-related-post', String(c.related_post?.enable ?? true));
  setVal('tc-related-limit', c.related_post?.limit ?? 6);
  setVal('tc-outdate-enable', String(c.noticeOutdate?.enable ?? false));
  setVal('tc-outdate-days', c.noticeOutdate?.limit_day ?? 365);
  setVal('tc-copyright', String(c.post_copyright?.enable ?? true));
  setVal('tc-copyright-license', c.post_copyright?.license || 'CC BY-NC-SA 4.0');
  setVal('tc-translate-enable', String(c.translate?.enable ?? false));
  setVal('tc-series', String(c.series?.enable ?? false));
  setVal('tc-pagination', String(c.post_pagination ?? 1));

  // Code blocks
  setVal('tc-code-theme', c.code_blocks?.theme || 'light');
  setVal('tc-code-mac', String(c.code_blocks?.macStyle ?? false));
  setVal('tc-code-copy', String(c.code_blocks?.copy ?? true));
  setVal('tc-code-lang', String(c.code_blocks?.language ?? true));
  setVal('tc-code-shrink', String(c.code_blocks?.shrink ?? false));
  setVal('tc-code-wrap', String(c.code_blocks?.word_wrap ?? false));
  setVal('tc-code-height', c.code_blocks?.height_limit || 'false');
  setVal('tc-code-fullpage', String(c.code_blocks?.fullpage ?? false));

  // Math
  setVal('tc-math-use', c.math?.use || '');
  setVal('tc-math-perpage', String(c.math?.per_page ?? true));
  setVal('tc-math-scrollbar', String(c.math?.hide_scrollbar ?? false));

  // Search
  setVal('tc-search-use', c.search?.use || '');
  setVal('tc-search-placeholder', c.search?.placeholder || '');
  setVal('tc-search-preload', String(c.search?.local_search?.preload ?? false));

  // 404 & Pjax
  setVal('tc-404-enable', String(c.error_404?.enable ?? false));
  setVal('tc-404-subtitle', c.error_404?.subtitle || 'Page Not Found');
  setVal('tc-pjax', String(c.pjax?.enable ?? false));
  setVal('tc-instantpage', String(c.instantpage ?? false));

  // Comments
  setVal('tc-comments-use', c.comments?.use || '');
  setVal('tc-comments-lazy', String(c.comments?.lazyload ?? false));
  setVal('tc-comments-count', String(c.comments?.count ?? false));
  setVal('tc-twikoo-envid', c.twikoo?.envId || '');
  setVal('tc-waline-server', c.waline?.serverURL || '');
  setVal('tc-giscus-repo', c.giscus?.repo || '');
  setVal('tc-giscus-repoid', c.giscus?.repo_id || '');
  setVal('tc-giscus-catid', c.giscus?.category_id || '');
  setVal('tc-gitalk-clientid', c.gitalk?.client_id || '');

  // Share & Chat
  setVal('tc-share-use', c.share?.use || 'sharejs');
  setVal('tc-share-sites', c.share?.sharejs?.sites || 'facebook,x,wechat,weibo,qq');
  setVal('tc-chat-use', c.chat?.use || '');
  setVal('tc-chatra-id', c.chatra?.id || '');
  setVal('tc-tidio-key', c.tidio?.public_key || '');
  setVal('tc-crisp-id', c.crisp?.website_id || '');

  // Analytics
  setVal('tc-busuanzi-uv', String(c.busuanzi?.site_uv ?? true));
  setVal('tc-busuanzi-pv', String(c.busuanzi?.site_pv ?? true));
  setVal('tc-busuanzi-page', String(c.busuanzi?.page_pv ?? true));
  setVal('tc-google-analytics', c.google_analytics || '');
  setVal('tc-baidu-analytics', c.baidu_analytics || '');
  setVal('tc-cf-analytics', c.cloudflare_analytics || '');
  setVal('tc-ms-clarity', c.microsoft_clarity || '');

  // Ads
  setVal('tc-adsense-enable', String(c.google_adsense?.enable ?? false));
  setVal('tc-adsense-client', c.google_adsense?.client || '');
  setVal('tc-adsense-auto', String(c.google_adsense?.auto_ads ?? true));
  if (Array.isArray(c.site_verification)) {
    setVal('tc-site-verify', c.site_verification.map(v => `${v.name}: ${v.content}`).join('\n'));
  }

  // Effects
  setVal('tc-power-mode', String(c.activate_power_mode?.enable ?? false));
  setVal('tc-power-colorful', String(c.activate_power_mode?.colorful ?? true));
  setVal('tc-power-shake', String(c.activate_power_mode?.shake ?? true));
  setVal('tc-fireworks', String(c.fireworks?.enable ?? false));
  setVal('tc-click-heart', String(c.click_heart?.enable ?? false));
  setVal('tc-click-text', String(c.clickShowText?.enable ?? false));
  setVal('tc-click-text-content', (c.clickShowText?.text || []).join(','));
  setVal('tc-lightbox', c.lightbox || '');
  setVal('tc-ribbon', String(c.canvas_ribbon?.enable ?? false));
  setVal('tc-fluttering', String(c.canvas_fluttering_ribbon?.enable ?? false));
  setVal('tc-canvas-nest', String(c.canvas_nest?.enable ?? false));
  setVal('tc-enter-transitions', String(c.enter_transitions ?? true));

  // Loading & Lazy
  setVal('tc-preloader', String(c.preloader?.enable ?? false));
  setVal('tc-preloader-source', String(c.preloader?.source ?? 1));
  setVal('tc-lazyload-enable', String(c.lazyload?.enable ?? false));
  setVal('tc-lazyload-blur', String(c.lazyload?.blur ?? false));

  // Advanced
  setVal('tc-pwa', String(c.pwa?.enable ?? false));
  setVal('tc-copy-enable', String(c.copy?.enable ?? true));
  setVal('tc-copy-copyright', String(c.copy?.copyright?.enable ?? false));
  setVal('tc-snackbar', String(c.snackbar?.enable ?? false));
  setVal('tc-mermaid', String(c.mermaid?.enable ?? false));
  setVal('tc-chartjs', String(c.chartjs?.enable ?? false));
  setVal('tc-abcjs', String(c.abcjs?.enable ?? false));
  setVal('tc-aplayer', String(c.aplayerInject?.enable ?? false));

  // Avatar & Social & Footer
  setVal('tc-avatar-img', c.avatar?.img || '');
  setVal('tc-avatar-effect', String(c.avatar?.effect ?? false));
  if (c.social && typeof c.social === 'object') setVal('tc-social', Object.entries(c.social).map(([k,v]) => `${k}: ${v}`).join('\n'));
  setVal('tc-footer-since', c.footer?.owner?.since || '');
  setVal('tc-footer-custom', c.footer?.custom_text || '');
  setVal('tc-footer-copyright', String(c.footer?.copyright?.enable ?? true));
  setTimeout(renderCoverPreviews, 100);
}

function buildThemeYaml() {
  const v = getVal;
  const lines = (id) => v(id).split('\n').filter(s => s.trim());
  let y = '';

  y += `nav:\n  logo: ${v('tc-nav-logo')}\n  display_title: ${v('tc-nav-display-title')}\n  display_post_title: ${v('tc-nav-display-post-title')}\n  fixed: ${v('tc-nav-fixed')}\n\n`;
  const menuYaml = buildMenuYaml();
  if (menuYaml) y += menuYaml;

  const bg = v('tc-background').trim();
  if (bg) y += `background: ${bg}\n\n`;

  y += `disable_top_img: false\nindex_top_img_height: 100vh\n\nmask:\n  header: false\n  footer: true\n\n`;

  y += `index_layout: ${v('tc-index-layout')}\n\nindex_post_content:\n  method: ${v('tc-post-content-method')}\n  length: ${v('tc-post-content-length')}\n\n`;

  y += `cover:\n  index_enable: ${v('tc-cover-index')}\n  aside_enable: ${v('tc-cover-aside')}\n  archives_enable: ${v('tc-cover-archives')}\n`;
  const covers = lines('tc-cover-default');
  if (covers.length) { y += `  default_cover:\n`; covers.forEach(u => y += `    - ${u.trim()}\n`); } else { y += `  default_cover:\n`; }
  y += `\nrounded_corners_ui: ${v('tc-rounded-corners')}\n\n`;

  y += `darkmode:\n  enable: ${v('tc-darkmode-enable')}\n  button: ${v('tc-darkmode-button')}\n  autoChangeMode: ${v('tc-darkmode-auto')}\n\ndisplay_mode: ${v('tc-display-mode')}\n\n`;
  if (v('tc-theme-color-main')) y += `theme_color:\n  enable: true\n  main: "${v('tc-theme-color-main')}"\n\n`;

  y += `toc:\n  post: ${v('tc-toc-post')}\n  page: false\n  number: ${v('tc-toc-number')}\n  expand: false\n  scroll_percent: ${v('tc-toc-scroll')}\n\n`;
  y += `readmode: ${v('tc-readmode')}\n\n`;
  y += `wordcount:\n  enable: ${v('tc-wordcount')}\n  post_wordcount: true\n  min2read: ${v('tc-min2read')}\n  total_wordcount: true\n\n`;
  y += `related_post:\n  enable: ${v('tc-related-post')}\n  limit: ${v('tc-related-limit')}\n\n`;
  y += `noticeOutdate:\n  enable: ${v('tc-outdate-enable')}\n  style: flat\n  limit_day: ${v('tc-outdate-days')}\n  position: top\n\n`;
  y += `post_copyright:\n  enable: ${v('tc-copyright')}\n  decode: false\n  license: ${v('tc-copyright-license')}\n  license_url: https://creativecommons.org/licenses/by-nc-sa/4.0/\n\n`;
  y += `translate:\n  enable: ${v('tc-translate-enable')}\n  default: 繁\n  defaultEncoding: 2\n\n`;
  y += `series:\n  enable: ${v('tc-series')}\n\npost_pagination: ${v('tc-pagination')}\n\n`;

  y += `code_blocks:\n  theme: ${v('tc-code-theme')}\n  macStyle: ${v('tc-code-mac')}\n  height_limit: ${v('tc-code-height')}\n  word_wrap: ${v('tc-code-wrap')}\n  copy: ${v('tc-code-copy')}\n  language: ${v('tc-code-lang')}\n  shrink: ${v('tc-code-shrink')}\n  fullpage: ${v('tc-code-fullpage')}\n\n`;

  y += `math:\n  use: ${v('tc-math-use') || ''}\n  per_page: ${v('tc-math-perpage')}\n  hide_scrollbar: ${v('tc-math-scrollbar')}\n\n`;

  y += `search:\n  use: ${v('tc-search-use') || ''}\n  placeholder: ${v('tc-search-placeholder')}\n  local_search:\n    preload: ${v('tc-search-preload')}\n\n`;

  y += `error_404:\n  enable: ${v('tc-404-enable')}\n  subtitle: '${v('tc-404-subtitle')}'\n\npjax:\n  enable: ${v('tc-pjax')}\n\ninstantpage: ${v('tc-instantpage')}\n\n`;

  y += `comments:\n  use: ${v('tc-comments-use') || ''}\n  text: true\n  lazyload: ${v('tc-comments-lazy')}\n  count: ${v('tc-comments-count')}\n\n`;
  if (v('tc-twikoo-envid')) y += `twikoo:\n  envId: ${v('tc-twikoo-envid')}\n\n`;
  if (v('tc-waline-server')) y += `waline:\n  serverURL: ${v('tc-waline-server')}\n\n`;
  if (v('tc-giscus-repo')) y += `giscus:\n  repo: ${v('tc-giscus-repo')}\n  repo_id: ${v('tc-giscus-repoid')}\n  category_id: ${v('tc-giscus-catid')}\n\n`;
  if (v('tc-gitalk-clientid')) y += `gitalk:\n  client_id: ${v('tc-gitalk-clientid')}\n\n`;

  y += `share:\n  use: ${v('tc-share-use') || ''}\n  sharejs:\n    sites: ${v('tc-share-sites')}\n\n`;
  y += `chat:\n  use: ${v('tc-chat-use') || ''}\n\n`;
  if (v('tc-chatra-id')) y += `chatra:\n  id: ${v('tc-chatra-id')}\n\n`;
  if (v('tc-tidio-key')) y += `tidio:\n  public_key: ${v('tc-tidio-key')}\n\n`;
  if (v('tc-crisp-id')) y += `crisp:\n  website_id: ${v('tc-crisp-id')}\n\n`;

  y += `busuanzi:\n  site_uv: ${v('tc-busuanzi-uv')}\n  site_pv: ${v('tc-busuanzi-pv')}\n  page_pv: ${v('tc-busuanzi-page')}\n\n`;
  if (v('tc-google-analytics')) y += `google_analytics: ${v('tc-google-analytics')}\n\n`;
  if (v('tc-baidu-analytics')) y += `baidu_analytics: ${v('tc-baidu-analytics')}\n\n`;
  if (v('tc-cf-analytics')) y += `cloudflare_analytics: ${v('tc-cf-analytics')}\n\n`;
  if (v('tc-ms-clarity')) y += `microsoft_clarity: ${v('tc-ms-clarity')}\n\n`;

  y += `google_adsense:\n  enable: ${v('tc-adsense-enable')}\n  auto_ads: ${v('tc-adsense-auto')}\n  client: ${v('tc-adsense-client')}\n\n`;
  const verify = lines('tc-site-verify');
  if (verify.length) { y += `site_verification:\n`; verify.forEach(l => { const [n,...rest] = l.split(':'); y += `  - name: ${n.trim()}\n    content: ${rest.join(':').trim()}\n`; }); y += `\n`; }

  y += `activate_power_mode:\n  enable: ${v('tc-power-mode')}\n  colorful: ${v('tc-power-colorful')}\n  shake: ${v('tc-power-shake')}\n  mobile: false\n\n`;
  y += `fireworks:\n  enable: ${v('tc-fireworks')}\n  zIndex: 9999\n  mobile: false\n\nclick_heart:\n  enable: ${v('tc-click-heart')}\n  mobile: false\n\n`;
  const clickTexts = v('tc-click-text-content').split(',').filter(s => s.trim());
  const clickEnabled = v('tc-click-text') === 'true' && clickTexts.length > 0;
  y += `clickShowText:\n  enable: ${clickEnabled}\n`;
  if (clickTexts.length) {
    y += `  text:\n`;
    clickTexts.forEach(t => y += `    - ${t.trim()}\n`);
  } else {
    y += `  text: []\n`;
  }
  y += `  fontSize: 15px\n  random: false\n  mobile: false\n\n`;

  y += `lightbox: ${v('tc-lightbox') || ''}\n\n`;
  y += `canvas_ribbon:\n  enable: ${v('tc-ribbon')}\n  size: 150\n  alpha: 0.6\n  zIndex: -1\n  click_to_change: false\n  mobile: false\n\ncanvas_fluttering_ribbon:\n  enable: ${v('tc-fluttering')}\n  mobile: false\n\ncanvas_nest:\n  enable: ${v('tc-canvas-nest')}\n  color: '0,0,255'\n  opacity: 0.7\n  zIndex: -1\n  count: 99\n  mobile: false\n\n`;
  y += `enter_transitions: ${v('tc-enter-transitions')}\n\n`;

  y += `preloader:\n  enable: ${v('tc-preloader')}\n  source: ${v('tc-preloader-source')}\n\n`;
  y += `lazyload:\n  enable: ${v('tc-lazyload-enable')}\n  field: site\n  blur: ${v('tc-lazyload-blur')}\n\n`;

  y += `pwa:\n  enable: ${v('tc-pwa')}\n\ncopy:\n  enable: ${v('tc-copy-enable')}\n  copyright:\n    enable: ${v('tc-copy-copyright')}\n    limit_count: 150\n\n`;
  y += `snackbar:\n  enable: ${v('tc-snackbar')}\n  position: bottom-left\n  bg_light: '#49b1f5'\n  bg_dark: '#1f1f1f'\n\n`;
  y += `mermaid:\n  enable: ${v('tc-mermaid')}\n  code_write: false\n\nchartjs:\n  enable: ${v('tc-chartjs')}\n\nabcjs:\n  enable: ${v('tc-abcjs')}\n  per_page: true\n\naplayerInject:\n  enable: ${v('tc-aplayer')}\n  per_page: true\n\n`;

  y += `avatar:\n  img: ${v('tc-avatar-img')}\n  effect: ${v('tc-avatar-effect')}\n\n`;
  const social = lines('tc-social');
  if (social.length) { y += `social:\n`; social.forEach(l => y += `  ${l.trim()}\n`); y += `\n`; }
  y += `footer:\n  owner:\n    enable: true\n    since: ${v('tc-footer-since')}\n  copyright:\n    enable: ${v('tc-footer-copyright')}\n    version: true\n  custom_text: ${v('tc-footer-custom')}\n\n`;

  y += `inject:\n  head:\n    - <link rel="stylesheet" href="/css/custom.css">\n    - <link rel="stylesheet" href="/css/comments.css">\n    - <link rel="stylesheet" href="/css/favorites.css">\n  bottom:\n    - <script>window.HEXO_MESSAGE_API='http://207.57.123.17:4001/api/comments';</script>\n    - <script src="/js/comments.js"></script>\n    - <script src="/js/favorites.js"></script>\n    - <script src="/js/snow.js"></script>\n`;

  return y;
}

function syncThemeFormToRaw() {
  document.getElementById('theme-config-editor').value = buildThemeYaml();
}

async function saveThemeConfig() {
  let raw;
  if (themeConfigMode === 'form') {
    raw = buildThemeYaml();
  } else {
    raw = document.getElementById('theme-config-editor').value;
  }
  const res = await api('/api/config/theme', { method: 'PUT', body: { raw, regenerate: true } });
  if (res.success) toast('主题配置已保存，站点已重新生成');
  else toast(res.error || '保存失败', 'error');
}

// ==================== Theme Files ====================
async function loadThemeFiles(dir) {
  currentThemeFilePath = '';
  document.getElementById('file-editor-wrap').style.display = 'none';
  document.getElementById('save-theme-file-btn').style.display = 'none';

  const parts = dir ? dir.split('/').filter(Boolean) : [];
  let bc = '<a onclick="loadThemeFiles(\'\')">🏠 themes/butterfly</a>';
  let accumulated = '';
  parts.forEach(p => {
    accumulated += (accumulated ? '/' : '') + p;
    bc += ` <span>/</span> <a onclick="loadThemeFiles('${accumulated}')">${p}</a>`;
  });
  document.getElementById('file-breadcrumb').innerHTML = bc;

  const files = await api(`/api/theme/files?dir=${encodeURIComponent(dir)}`);
  const dirs = files.filter(f => f.isDir).sort((a, b) => a.name.localeCompare(b.name));
  const fileItems = files.filter(f => !f.isDir).sort((a, b) => a.name.localeCompare(b.name));

  document.getElementById('file-browser').innerHTML = `<ul class="file-list">
    ${dir ? `<li class="file-item" onclick="loadThemeFiles('${parts.slice(0, -1).join('/')}')"><span class="file-icon">⬆️</span><span class="file-name">..</span></li>` : ''}
    ${dirs.map(f => `<li class="file-item" onclick="loadThemeFiles('${f.path}')"><span class="file-icon">📁</span><span class="file-name">${f.name}</span></li>`).join('')}
    ${fileItems.map(f => `<li class="file-item" onclick="openThemeFile('${f.path}')"><span class="file-icon">${fileIcon(f.name)}</span><span class="file-name">${f.name}</span><span class="file-size">${fmtSize(f.size)}</span></li>`).join('')}
  </ul>`;
}

async function openThemeFile(filepath) {
  const data = await api(`/api/theme/file?path=${encodeURIComponent(filepath)}`);
  currentThemeFilePath = filepath;
  document.getElementById('theme-file-editor').value = data.content;
  document.getElementById('file-editor-wrap').style.display = 'block';
  document.getElementById('save-theme-file-btn').style.display = '';
}

async function saveThemeFile() {
  if (!currentThemeFilePath) return;
  const content = document.getElementById('theme-file-editor').value;
  const res = await api('/api/theme/file', { method: 'PUT', body: { path: currentThemeFilePath, content } });
  if (res.success) toast('文件已保存');
  else toast(res.error || '保存失败', 'error');
}

// ==================== Custom CSS ====================
async function loadCustomCSS() {
  const data = await api('/api/custom-css');
  document.getElementById('custom-css-editor').value = data.content || '';
}

async function saveCustomCSS() {
  const content = document.getElementById('custom-css-editor').value;
  const res = await api('/api/custom-css', { method: 'PUT', body: { content } });
  if (res.success) toast('自定义 CSS 已保存');
  else toast(res.error || '保存失败', 'error');
}

// ==================== Site Config ====================
let siteRawData = '';

async function loadSiteConfig() {
  const data = await api('/api/config/site');
  siteRawData = data.raw || '';
  const c = data.config || {};

  document.getElementById('site-config-editor').value = siteRawData;

  setVal('sc-title', c.title || '');
  setVal('sc-subtitle', c.subtitle || '');
  setVal('sc-description', c.description || '');
  setVal('sc-keywords', Array.isArray(c.keywords) ? c.keywords.join(', ') : (c.keywords || ''));
  setVal('sc-author', c.author || '');
  setVal('sc-url', c.url || '');
  setVal('sc-permalink', c.permalink || ':year/:month/:day/:title/');
  setVal('sc-language', c.language || 'zh-CN');
  setVal('sc-timezone', c.timezone || '');
  setVal('sc-per-page', c.per_page ?? 10);
  setVal('sc-default-layout', c.default_layout || 'post');
  setVal('sc-theme', c.theme || 'butterfly');
}

function syncSiteFormToRaw() {
  const lines = siteRawData.split('\n');
  const updates = {
    'title:': `title: ${getVal('sc-title')}`,
    'subtitle:': `subtitle: '${getVal('sc-subtitle')}'`,
    'description:': `description: '${getVal('sc-description')}'`,
    'keywords:': `keywords: ${getVal('sc-keywords')}`,
    'author:': `author: ${getVal('sc-author')}`,
    'url:': `url: ${getVal('sc-url')}`,
    'permalink:': `permalink: ${getVal('sc-permalink')}`,
    'language:': `language: ${getVal('sc-language')}`,
    'timezone:': `timezone: '${getVal('sc-timezone')}'`,
    'per_page:': `per_page: ${getVal('sc-per-page')}`,
    'default_layout:': `default_layout: ${getVal('sc-default-layout')}`,
    'theme:': `theme: ${getVal('sc-theme')}`,
  };

  const result = lines.map(line => {
    const trimmed = line.trim();
    for (const [prefix, replacement] of Object.entries(updates)) {
      if (trimmed.startsWith(prefix) && !trimmed.startsWith(prefix + ' #') && !line.startsWith(' ') && !line.startsWith('\t')) {
        return replacement;
      }
    }
    return line;
  });

  document.getElementById('site-config-editor').value = result.join('\n');
}

async function saveSiteConfig() {
  let raw;
  if (siteConfigMode === 'form') {
    syncSiteFormToRaw();
    raw = document.getElementById('site-config-editor').value;
  } else {
    raw = document.getElementById('site-config-editor').value;
  }
  const res = await api('/api/config/site', { method: 'PUT', body: { raw } });
  if (res.success) {
    siteRawData = raw;
    toast('站点配置已保存（已自动备份）');
  } else {
    toast(res.error || '保存失败', 'error');
  }
}

// ==================== Deploy ====================
const deployLog = () => document.getElementById('deploy-log');

async function runGenerate() {
  deployLog().textContent = '⏳ 正在执行 hexo clean && hexo generate ...\n';
  navigateTo('deploy');
  try {
    const res = await api('/api/hexo/generate', { method: 'POST' });
    deployLog().textContent += res.success ? `✅ 生成完成\n\n${res.output}` : `❌ 失败: ${res.error}`;
    if (res.success) toast('站点已重新生成');
  } catch (e) {
    deployLog().textContent += `❌ 执行出错: ${e.message}`;
  }
}

async function runDeploy() {
  deployLog().textContent = '⏳ 正在执行 hexo clean && hexo generate && hexo deploy ...\n';
  try {
    const res = await api('/api/hexo/deploy', { method: 'POST' });
    deployLog().textContent += res.success ? `✅ 部署完成\n\n${res.output}` : `❌ 失败: ${res.error}`;
    if (res.success) toast('站点已部署');
  } catch (e) {
    deployLog().textContent += `❌ 执行出错: ${e.message}`;
  }
}

async function runClean() {
  deployLog().textContent = '⏳ 正在执行 hexo clean ...\n';
  try {
    const res = await api('/api/hexo/clean', { method: 'POST' });
    deployLog().textContent += res.success ? `✅ 清理完成\n\n${res.output}` : `❌ 失败: ${res.error}`;
    if (res.success) toast('缓存已清理');
  } catch (e) {
    deployLog().textContent += `❌ 执行出错: ${e.message}`;
  }
}

// ==================== Utilities ====================
function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function fmtDate(d) { try { return new Date(d).toLocaleDateString('zh-CN'); } catch { return d; } }
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  const icons = { yml: '⚙️', yaml: '⚙️', pug: '🟢', ejs: '🟡', styl: '🎨', css: '🎨', js: '📜', json: '📋', md: '📝', html: '🌐', png: '🖼️', jpg: '🖼️', svg: '🖼️' };
  return icons[ext] || '📄';
}

// ==================== Keyboard shortcut ====================
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    const activePage = document.querySelector('.page-section.active')?.id;
    if (activePage === 'page-editor') savePost();
    else if (activePage === 'page-theme-config') saveThemeConfig();
    else if (activePage === 'page-site-config') saveSiteConfig();
    else if (activePage === 'page-custom-css') saveCustomCSS();
    else if (activePage === 'page-theme-files' && currentThemeFilePath) saveThemeFile();
  }
});

// ==================== Messages Admin ====================
async function loadAllComments() {
  const comments = await api('/api/comments-all');
  const el = document.getElementById('comments-list');
  if (!comments.length) { el.innerHTML = '<p class="text-muted">暂无留言</p>'; return; }
  el.innerHTML = `<table>
    <thead><tr><th>称呼</th><th>联系方式</th><th>留言内容</th><th>来源页面</th><th>时间</th><th>操作</th></tr></thead>
    <tbody>${comments.map(c => `
      <tr>
        <td><strong>${esc(c.nickname)}</strong></td>
        <td class="text-sm">${c.email ? esc(c.email) : '<span class="text-muted">未留</span>'}</td>
        <td style="max-width:280px;white-space:pre-wrap;word-break:break-word;">${esc(c.content)}</td>
        <td class="text-sm text-muted">${esc(c.slug)}</td>
        <td class="text-sm text-muted">${fmtDate(c.date)}</td>
        <td><button class="btn btn-sm btn-danger" onclick="deleteComment('${esc(c.slug)}','${c.id}')">删除</button></td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

async function deleteComment(slug, id) {
  if (!confirm('确定删除这条留言？')) return;
  const res = await api(`/api/comments/${slug}/${id}`, { method: 'DELETE' });
  if (res.success) { toast('留言已删除'); loadAllComments(); }
  else toast(res.error || '删除失败', 'error');
}

// ==================== Menu Editor ====================
const MENU_ICON_OPTIONS = [
  { label: '首页', value: 'fas fa-home' },
  { label: '首页(带动画)', value: 'faa-parent animated-hover fas fa-home faa-tada' },
  { label: '搜索', value: 'fas fa-search' },
  { label: '标签', value: 'fas fa-tags' },
  { label: '电脑', value: 'fas fa-desktop' },
  { label: '手机', value: 'fas fa-mobile-alt' },
  { label: '文件夹', value: 'fas fa-folder-open' },
  { label: '纸飞机', value: 'fas fa-paper-plane' },
  { label: '归档', value: 'fas fa-archive' },
  { label: '收藏', value: 'fas fa-star' },
  { label: '链接', value: 'fas fa-link' },
  { label: '自定义', value: '__custom__' }
];

function parseMenuConfig(menu) {
  const items = [];
  Object.entries(menu).forEach(([name, value]) => {
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childName, childValue]) => {
        items.push(parseMenuItem(childName, childValue));
      });
      return;
    }
    items.push(parseMenuItem(name, value));
  });
  return items;
}

function parseMenuItem(name, value) {
  const parts = String(value).split('||').map(s => s.trim());
  const icon = parts[1] || 'fas fa-link';
  const preset = MENU_ICON_OPTIONS.find(opt => opt.value === icon);
  return {
    name,
    link: parts[0] || '/',
    iconSelect: preset ? icon : '__custom__',
    iconCustom: preset ? '' : icon
  };
}

function renderMenuEditor(items = []) {
  const box = document.getElementById('nav-menu-editor');
  if (!box) return;
  if (!items.length) {
    box.innerHTML = '<div class="menu-item-empty">暂无菜单，点击下方「添加菜单」开始配置</div>';
    return;
  }
  box.innerHTML = items.map((item, index) => menuItemRowHtml(item, index)).join('');
}

function menuItemRowHtml(item, index) {
  const iconSelect = item.iconSelect || (MENU_ICON_OPTIONS.find(opt => opt.value === item.icon) ? item.icon : '__custom__');
  const showCustom = iconSelect === '__custom__';
  const options = MENU_ICON_OPTIONS.map(opt =>
    `<option value="${opt.value}" ${iconSelect === opt.value ? 'selected' : ''}>${opt.label}</option>`
  ).join('');
  return `<div class="menu-item-row" data-index="${index}">
    <div><label>菜单名称</label><input type="text" class="menu-name" value="${esc(item.name || '')}" placeholder="例如：首页"></div>
    <div><label>跳转链接</label><input type="text" class="menu-link" value="${esc(item.link || '')}" placeholder="例如：/ 或 /tags/"></div>
    <div>
      <label>图标</label>
      <select class="menu-icon-select" onchange="toggleMenuCustomIcon(this)">${options}</select>
      <input type="text" class="menu-icon-custom custom-icon" value="${esc(item.iconCustom || '')}" placeholder="自定义图标类名" style="display:${showCustom ? 'block' : 'none'};">
    </div>
    <div style="padding-top:22px;"><button type="button" class="btn btn-sm btn-danger" onclick="removeMenuItem(${index})">删除</button></div>
  </div>`;
}

function toggleMenuCustomIcon(select) {
  const custom = select.parentElement.querySelector('.menu-icon-custom');
  if (custom) custom.style.display = select.value === '__custom__' ? 'block' : 'none';
}

function getMenuItemsFromForm() {
  const rows = document.querySelectorAll('#nav-menu-editor .menu-item-row');
  return Array.from(rows).map(row => {
    const name = row.querySelector('.menu-name')?.value.trim() || '';
    const link = row.querySelector('.menu-link')?.value.trim() || '/';
    const iconSelect = row.querySelector('.menu-icon-select')?.value || 'fas fa-link';
    const iconCustom = row.querySelector('.menu-icon-custom')?.value.trim() || '';
    const icon = iconSelect === '__custom__' ? (iconCustom || 'fas fa-link') : iconSelect;
    return { name, link, icon };
  }).filter(item => item.name);
}

function buildMenuYaml() {
  const items = getMenuItemsFromForm();
  if (!items.length) return '';
  let y = 'menu:\n';
  items.forEach(item => {
    y += `  ${item.name}: ${item.link} || ${item.icon}\n`;
  });
  return y + '\n';
}

function addMenuItem() {
  const items = getMenuItemsFromForm();
  items.push({ name: '', link: '/', iconSelect: 'fas fa-home', iconCustom: '' });
  renderMenuEditor(items);
}

function removeMenuItem(index) {
  const items = getMenuItemsFromForm();
  items.splice(index, 1);
  renderMenuEditor(items);
}

// ==================== Cover Upload ====================
async function uploadCoverFiles(files) {
  if (!files.length) return;
  const fd = new FormData();
  Array.from(files).forEach(f => fd.append('files', f));
  toast('封面上传中...', 'info');
  const res = await apiForm('/api/media/upload', fd);
  if (res.success && res.files.length) {
    const ta = document.getElementById('tc-cover-default');
    const existing = ta.value.trim();
    const newUrls = res.files.map(f => f.url).join('\n');
    ta.value = existing ? existing + '\n' + newUrls : newUrls;
    renderCoverPreviews();
    toast(`已上传 ${res.files.length} 张封面图`);
  } else {
    toast('上传失败', 'error');
  }
}

function renderCoverPreviews() {
  const ta = document.getElementById('tc-cover-default');
  const list = document.getElementById('cover-preview-list');
  if (!ta || !list) return;
  const urls = ta.value.split('\n').filter(s => s.trim());
  list.innerHTML = urls.map((url, i) => `
    <div style="position:relative;width:80px;height:56px;border-radius:4px;overflow:hidden;border:1px solid #e5e7eb;">
      <img src="${url.trim()}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">
      <button onclick="removeCover(${i})" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,.6);color:#fff;border:none;border-radius:3px;font-size:10px;cursor:pointer;padding:1px 4px;">×</button>
    </div>
  `).join('');
}

function removeCover(index) {
  const ta = document.getElementById('tc-cover-default');
  const urls = ta.value.split('\n').filter(s => s.trim());
  urls.splice(index, 1);
  ta.value = urls.join('\n');
  renderCoverPreviews();
}

function setupCoverDropzone() {
  const dz = document.getElementById('cover-dropzone');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('dragover'); uploadCoverFiles(e.dataTransfer.files); });
}

// ==================== Background ====================
function renderBackgroundPreview() {
  const input = document.getElementById('tc-background');
  const img = document.getElementById('bg-preview-img');
  const placeholder = document.getElementById('bg-preview-placeholder');
  if (!input || !img || !placeholder) return;
  const url = input.value.trim();
  if (url) {
    img.src = url;
    img.style.display = 'block';
    placeholder.style.display = 'none';
    img.onerror = () => {
      img.style.display = 'none';
      placeholder.style.display = 'block';
      placeholder.textContent = '图片加载失败';
    };
  } else {
    img.style.display = 'none';
    placeholder.style.display = 'block';
    placeholder.textContent = '暂无背景预览';
  }
}

async function uploadBackgroundFile(files) {
  if (!files.length) return;
  const fd = new FormData();
  fd.append('files', files[0]);
  toast('背景图上传中...', 'info');
  const res = await apiForm('/api/media/upload', fd);
  if (res.success && res.files.length) {
    document.getElementById('tc-background').value = res.files[0].url;
    renderBackgroundPreview();
    toast('背景图已上传，点击「应用背景」生效');
  } else {
    toast('上传失败', 'error');
  }
}

async function applyBackground() {
  const url = document.getElementById('tc-background')?.value.trim();
  if (!url) return toast('请先上传或输入背景图 URL', 'error');
  toast('正在应用背景并重新生成...', 'info');
  const res = await api('/api/config/background', {
    method: 'PUT',
    body: { url, regenerate: true }
  });
  if (res.success) {
    toast('背景已更新，站点已重新生成并刷新');
    themeRawData = (await api('/api/config/theme')).raw || themeRawData;
    if (themeConfigMode === 'raw') {
      document.getElementById('theme-config-editor').value = themeRawData;
    }
  } else {
    toast(res.error || '应用失败', 'error');
  }
}

function setupBackgroundDropzone() {
  const dz = document.getElementById('bg-dropzone');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragover'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('dragover');
    uploadBackgroundFile(e.dataTransfer.files);
  });
}

// ==================== Auth ====================
function getToken() { return localStorage.getItem('hexo_admin_token'); }

async function checkAuth() {
  const token = getToken();
  if (!token) { showLogin(); return; }
  try {
    const res = await api('/api/auth/verify', { method: 'POST', body: { token } });
    if (res.valid) { showApp(); } else { showLogin(); }
  } catch { showLogin(); }
}

function showLogin() {
  document.getElementById('login-page').style.display = '';
  document.getElementById('app-wrap').style.display = 'none';
}

function showApp() {
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app-wrap').style.display = 'flex';
  loadDashboard();
  setupEditorUpload();
  setupCoverDropzone();
  setupBackgroundDropzone();
}

async function doLogin() {
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('hexo_admin_token', data.token);
      showApp();
    } else {
      errEl.textContent = data.error || '登录失败';
      errEl.style.display = 'block';
    }
  } catch (e) {
    errEl.textContent = '网络错误';
    errEl.style.display = 'block';
  }
}

async function doLogout() {
  const token = getToken();
  if (token) await api('/api/auth/logout', { method: 'POST', body: { token } }).catch(() => {});
  localStorage.removeItem('hexo_admin_token');
  showLogin();
}

async function changePassword() {
  const oldPass = document.getElementById('acc-old-pass').value;
  const newPass = document.getElementById('acc-new-pass').value;
  const confirm = document.getElementById('acc-confirm-pass').value;

  if (!oldPass) return toast('请输入当前密码', 'error');
  if (!newPass || newPass.length < 4) return toast('新密码至少4位', 'error');
  if (newPass !== confirm) return toast('两次输入的密码不一致', 'error');

  const res = await api('/api/auth/change-password', {
    method: 'POST', body: { oldPassword: oldPass, newPassword: newPass, token: getToken() }
  });
  if (res.success) {
    toast('密码修改成功');
    document.getElementById('acc-old-pass').value = '';
    document.getElementById('acc-new-pass').value = '';
    document.getElementById('acc-confirm-pass').value = '';
  } else {
    toast(res.error || '修改失败', 'error');
  }
}

// ==================== Init ====================
checkAuth();

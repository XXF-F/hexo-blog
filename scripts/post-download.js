'use strict';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildDownloadBlock(download) {
  const dl = download || {};
  const desc = escapeHtml(dl.desc || '').trim();
  const link = escapeHtml(dl.link || '').trim();
  const code = escapeHtml(dl.code || '').trim();
  const pass = escapeHtml(dl.pass || '').trim();

  const descHtml = link
    ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${desc || link}</a>`
    : (desc || '<span class="post-download-placeholder">请在后台填写资源说明</span>');

  const codeHtml = code || '<span class="post-download-placeholder">—</span>';
  const passHtml = pass || '<span class="post-download-placeholder">—</span>';

  return `
<div class="post-download-section">
  <h3 class="post-download-title"><i class="fas fa-link"></i> 获取资源</h3>
  <div class="post-download-resource">
    <span class="post-download-check"><i class="fas fa-check-circle"></i></span>
    <div class="post-download-desc">${descHtml}</div>
  </div>
  <div class="post-download-info">
    <div class="post-download-info-line"><span class="post-download-label">获取:</span> ${codeHtml}</div>
    <div class="post-download-info-line"><span class="post-download-label">解压码:</span> ${passHtml}</div>
  </div>
</div>`;
}

hexo.extend.filter.register('after_render:html', function (data, locals) {
  if (!locals || !locals.page || locals.page.layout !== 'post') return data;

  const block = buildDownloadBlock(locals.page.download);
  if (data.includes('class="post-download-section"')) return data;

  if (data.includes('class="post-copyright"')) {
    return data.replace('<div class="post-copyright"', `${block}<div class="post-copyright"`);
  }

  if (data.includes('</article>')) {
    return data.replace('</article>', `${block}</article>`);
  }

  return data;
}, 20);

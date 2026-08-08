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
  const link = escapeHtml(dl.link || '').trim();
  const code = escapeHtml(dl.code || '').trim();
  const pass = escapeHtml(dl.pass || '').trim();

  // 获取：显示获取码文字，点击跳转到下载链接（不直接展示完整 URL）
  let getHtml;
  if (link && code) {
    getHtml = `<a class="post-download-get-link" href="${link}" target="_blank" rel="noopener noreferrer">${code}</a>`;
  } else if (link) {
    getHtml = `<a class="post-download-get-link" href="${link}" target="_blank" rel="noopener noreferrer">点击获取</a>`;
  } else if (code) {
    getHtml = code;
  } else {
    getHtml = '<span class="post-download-placeholder">—</span>';
  }

  const passHtml = pass || '<span class="post-download-placeholder">—</span>';

  return `
<div class="post-download-section">
  <h3 class="post-download-title"><i class="fas fa-link"></i> 获取资源</h3>
  <div class="post-download-info">
    <div class="post-download-info-line"><span class="post-download-label">获取:</span> ${getHtml}</div>
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

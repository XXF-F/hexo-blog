'use strict';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function looksLikeUrl(str) {
  return /^https?:\/\//i.test(String(str || '').trim());
}

function extractCodeFromLink(link) {
  try {
    const u = new URL(link);
    const seg = u.pathname.split('/').filter(Boolean).pop();
    return seg || '';
  } catch {
    return '';
  }
}

function resolveGetText(link, code) {
  const c = String(code || '').trim();
  const l = String(link || '').trim();

  // 正常：获取码是短码，不是 URL
  if (c && !looksLikeUrl(c) && c !== l) return c;

  // 获取码误填成链接时，从链接路径取最后一段作为显示文字
  if (l) {
    const fromLink = extractCodeFromLink(l);
    if (fromLink) return fromLink;
  }

  if (c && !looksLikeUrl(c)) return c;
  return '点击获取';
}

function buildDownloadBlock(download) {
  const dl = download || {};
  const link = String(dl.link || '').trim();
  const code = String(dl.code || '').trim();
  const pass = String(dl.pass || '').trim();

  const href = escapeHtml(looksLikeUrl(link) ? link : (looksLikeUrl(code) ? code : link));
  const text = escapeHtml(resolveGetText(link, code));
  const passHtml = pass ? escapeHtml(pass) : '<span class="post-download-placeholder">—</span>';

  let getHtml;
  if (href) {
    getHtml = `<a class="post-download-get-link" href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  } else if (text && text !== '点击获取') {
    getHtml = text;
  } else {
    getHtml = '<span class="post-download-placeholder">—</span>';
  }

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

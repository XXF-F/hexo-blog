(function() {
  const API_BASE = window.HEXO_MESSAGE_API || '/api/comments';
  const slug = window.location.pathname.replace(/^\/|\/$/g, '').replace(/\//g, '-') || 'site';

  const articleEl = document.getElementById('article-container');
  if (!articleEl) return;

  let container = document.getElementById('custom-comments');
  if (!container) {
    container = document.createElement('div');
    container.id = 'custom-comments';
    const postEl = document.getElementById('post');
    if (postEl) postEl.appendChild(container);
    else articleEl.parentNode.insertBefore(container, articleEl.nextSibling);
  }

  function renderForm(success) {
    if (success) {
      container.innerHTML = `
        <div class="cmt-section">
          <h3 class="cmt-title">✉️ 给我留言</h3>
          <div class="msg-success">
            <p>✅ 留言已发送，感谢您的反馈！</p>
            <button type="button" onclick="window._msgReset()">再写一条</button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="cmt-section">
        <h3 class="cmt-title">✉️ 给我留言</h3>
        <p class="msg-desc">有什么想对我说的，欢迎留言。留言仅站长可见，不会公开展示。</p>
        <div class="cmt-form">
          <div class="cmt-form-row">
            <input type="text" id="cmt-nickname" placeholder="您的称呼 *" maxlength="30">
            <input type="text" id="cmt-email" placeholder="联系方式（邮箱/微信等，选填）" maxlength="100">
          </div>
          <textarea id="cmt-input" placeholder="写下您的留言..." rows="4" maxlength="2000"></textarea>
          <div class="cmt-form-footer">
            <span class="cmt-hint">留言仅站长可见，最多2000字</span>
            <button id="cmt-submit" type="button" onclick="window._msgSubmit()">发送留言</button>
          </div>
        </div>
      </div>
    `;

    const savedNick = localStorage.getItem('msg_nickname');
    const savedContact = localStorage.getItem('msg_contact');
    if (savedNick) document.getElementById('cmt-nickname').value = savedNick;
    if (savedContact) document.getElementById('cmt-email').value = savedContact;
  }

  window._msgReset = function() {
    renderForm(false);
  };

  window._msgSubmit = async function() {
    const nickname = document.getElementById('cmt-nickname').value.trim();
    const email = document.getElementById('cmt-email').value.trim();
    const content = document.getElementById('cmt-input').value.trim();

    if (!nickname) return alert('请输入您的称呼');
    if (!content) return alert('请输入留言内容');

    const btn = document.getElementById('cmt-submit');
    btn.disabled = true;
    btn.textContent = '发送中...';

    try {
      const res = await fetch(`${API_BASE}/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, email, content })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('msg_nickname', nickname);
        localStorage.setItem('msg_contact', email);
        renderForm(true);
      } else {
        const msg = data.code === 'CONTENT_BLOCKED'
          ? (data.error || '内容包含违规信息，禁止发布黄赌毒相关内容')
          : (data.error || '发送失败');
        alert(msg);
        btn.disabled = false;
        btn.textContent = '发送留言';
      }
    } catch (e) {
      alert('网络错误，请稍后重试');
      btn.disabled = false;
      btn.textContent = '发送留言';
    }
  };

  renderForm(false);
})();

'use strict';

const path = require('path');
const fs = require('fs');

const COMMENTS_DIR = path.join(__dirname, '../admin-panel/data');

function getCommentsFile(slug) {
  return path.join(COMMENTS_DIR, `comments_${slug.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}

function readComments(slug) {
  const file = getCommentsFile(slug);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function writeComments(slug, comments) {
  fs.mkdirSync(COMMENTS_DIR, { recursive: true });
  fs.writeFileSync(getCommentsFile(slug), JSON.stringify(comments, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

hexo.extend.filter.register('server_middleware', app => {
  app.use((req, res, next) => {
    const url = req.url.split('?')[0];
    const match = url.match(/^\/api\/comments\/([^/]+)\/?$/);
    if (!match) return next();

    const slug = decodeURIComponent(match[1]);

    if (req.method === 'GET') {
      sendJson(res, 200, []);
      return;
    }

    if (req.method === 'POST') {
      readBody(req).then(body => {
        const { nickname, email, content } = body;
        if (!nickname || !content) {
          sendJson(res, 400, { error: '称呼和留言内容不能为空' });
          return;
        }
        const contentFilter = require(path.join(__dirname, '../admin-panel/lib/content-filter'));
        const blocked = contentFilter.checkComment({ nickname, email, content });
        if (blocked.blocked) {
          sendJson(res, 403, { error: blocked.message, code: 'CONTENT_BLOCKED', category: blocked.label });
          return;
        }
        const comments = readComments(slug);
        const comment = {
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          nickname: String(nickname).trim().slice(0, 30),
          email: String(email || '').trim().slice(0, 100),
          content: String(content).trim().slice(0, 2000),
          page: slug,
          date: new Date().toISOString(),
          deleted: false
        };
        comments.push(comment);
        writeComments(slug, comments);
        sendJson(res, 200, { success: true });
      }).catch(() => sendJson(res, 400, { error: '无效请求' }));
      return;
    }

    next();
  });
});

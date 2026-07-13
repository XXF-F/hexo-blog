const express = require('express');
const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');
const yaml = require('js-yaml');
const multer = require('multer');
const { exec, spawn } = require('child_process');
const contentFilter = require('./lib/content-filter');

const app = express();
const PORT = 4001;
const HEXO_ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(HEXO_ROOT, 'source', '_posts');
const PAGES_DIR = path.join(HEXO_ROOT, 'source');
const IMAGES_DIR = path.join(HEXO_ROOT, 'source', 'images');
const THEME_DIR = path.join(HEXO_ROOT, 'themes', 'butterfly');

fs.mkdirSync(IMAGES_DIR, { recursive: true });

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(IMAGES_DIR));
app.use('/images', express.static(IMAGES_DIR));

// ==================== Auth ====================
const AUTH_FILE = path.join(__dirname, 'data', 'auth.json');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

function getAuth() {
  if (!fs.existsSync(AUTH_FILE)) {
    const crypto = require('crypto');
    const defaultAuth = { username: 'admin', password: crypto.createHash('sha256').update('admin123').digest('hex') };
    fs.writeFileSync(AUTH_FILE, JSON.stringify(defaultAuth, null, 2));
    return defaultAuth;
  }
  return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
}

const sessions = new Set();

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const crypto = require('crypto');
  const auth = getAuth();
  const hash = crypto.createHash('sha256').update(password || '').digest('hex');
  if (username === auth.username && hash === auth.password) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ error: '用户名或密码错误' });
  }
});

app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body;
  res.json({ valid: sessions.has(token) });
});

app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body;
  sessions.delete(token);
  res.json({ success: true });
});

app.post('/api/auth/change-password', (req, res) => {
  const { oldPassword, newPassword, token } = req.body;
  if (!sessions.has(token)) return res.status(401).json({ error: '未登录' });
  const crypto = require('crypto');
  const auth = getAuth();
  const oldHash = crypto.createHash('sha256').update(oldPassword || '').digest('hex');
  if (oldHash !== auth.password) return res.status(400).json({ error: '当前密码错误' });
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: '新密码至少4位' });
  auth.password = crypto.createHash('sha256').update(newPassword).digest('hex');
  fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2));
  res.json({ success: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, IMAGES_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/\s+/g, '-');
    const unique = Date.now().toString(36);
    cb(null, `${name}-${unique}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const blocked = contentFilter.checkText(file.originalname);
    if (blocked.blocked) return cb(new Error(blocked.message));
    cb(null, true);
  }
});

// ==================== Dashboard Stats ====================

app.get('/api/stats', (req, res) => {
  try {
    const posts = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const tags = new Set();
    const categories = new Set();
    let drafts = 0;

    posts.forEach(f => {
      try {
        const content = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
        const { data } = matter(content);
        if (data.draft) drafts++;
        if (Array.isArray(data.tags)) data.tags.forEach(t => tags.add(t));
        else if (data.tags) tags.add(data.tags);
        if (Array.isArray(data.categories)) data.categories.forEach(c => categories.add(c));
        else if (data.categories) categories.add(data.categories);
      } catch (e) { /* skip */ }
    });

    res.json({
      posts: posts.length,
      drafts,
      tags: tags.size,
      categories: categories.size,
      tagList: [...tags],
      categoryList: [...categories]
    });
  } catch (e) {
    res.json({ posts: 0, drafts: 0, tags: 0, categories: 0, tagList: [], categoryList: [] });
  }
});

// ==================== Posts API ====================

app.get('/api/posts', (req, res) => {
  try {
    const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
    const posts = files.map(f => {
      const content = fs.readFileSync(path.join(POSTS_DIR, f), 'utf8');
      const { data, content: body } = matter(content);
      const stat = fs.statSync(path.join(POSTS_DIR, f));
      return {
        filename: f,
        slug: path.basename(f, '.md'),
        title: data.title || path.basename(f, '.md'),
        date: data.date || stat.birthtime,
        updated: data.updated || stat.mtime,
        tags: data.tags || [],
        categories: data.categories || [],
        draft: !!data.draft,
        top: data.top || false,
        excerpt: body.substring(0, 200).replace(/[#*`>\-\n]/g, '').trim(),
        cover: data.cover || ''
      };
    });
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(posts);
  } catch (e) {
    res.json([]);
  }
});

app.get('/api/posts/:slug', (req, res) => {
  const filepath = path.join(POSTS_DIR, `${req.params.slug}.md`);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: '文章不存在' });
  const content = fs.readFileSync(filepath, 'utf8');
  const { data, content: body } = matter(content);
  res.json({ frontmatter: data, content: body, filename: `${req.params.slug}.md` });
});

app.post('/api/posts', (req, res) => {
  const { title, content, tags, categories, cover, draft } = req.body;
  const blocked = contentFilter.checkPost({ title, content, tags, categories, cover });
  if (blocked.blocked) return contentFilter.rejectResponse(res, blocked);

  const slug = title.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '');
  const filename = `${slug}.md`;
  const filepath = path.join(POSTS_DIR, filename);

  if (fs.existsSync(filepath)) return res.status(400).json({ error: '同名文章已存在' });

  const frontmatter = { title, date: new Date().toISOString(), tags: tags || [], categories: categories || [] };
  if (cover) frontmatter.cover = cover;
  if (draft) frontmatter.draft = true;

  const fileContent = matter.stringify(content || '', frontmatter);
  fs.writeFileSync(filepath, fileContent);
  res.json({ success: true, slug, filename });
});

app.put('/api/posts/:slug', (req, res) => {
  const filepath = path.join(POSTS_DIR, `${req.params.slug}.md`);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: '文章不存在' });

  const { title, content, tags, categories, cover, draft, top } = req.body;
  const blocked = contentFilter.checkPost({ title, content, tags, categories, cover });
  if (blocked.blocked) return contentFilter.rejectResponse(res, blocked);

  const original = fs.readFileSync(filepath, 'utf8');
  const { data: oldData } = matter(original);

  const frontmatter = { ...oldData };
  if (title !== undefined) frontmatter.title = title;
  if (tags !== undefined) frontmatter.tags = tags;
  if (categories !== undefined) frontmatter.categories = categories;
  if (cover !== undefined) frontmatter.cover = cover;
  if (draft !== undefined) frontmatter.draft = draft;
  if (top !== undefined) frontmatter.top = top;
  frontmatter.updated = new Date().toISOString();

  const fileContent = matter.stringify(content !== undefined ? content : matter(original).content, frontmatter);
  fs.writeFileSync(filepath, fileContent);

  if (title && title !== oldData.title) {
    const newSlug = title.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fa5-]/g, '');
    const newPath = path.join(POSTS_DIR, `${newSlug}.md`);
    if (newPath !== filepath && !fs.existsSync(newPath)) {
      fs.renameSync(filepath, newPath);
      return res.json({ success: true, slug: newSlug });
    }
  }
  res.json({ success: true, slug: req.params.slug });
});

app.delete('/api/posts/:slug', (req, res) => {
  const filepath = path.join(POSTS_DIR, `${req.params.slug}.md`);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: '文章不存在' });
  fs.unlinkSync(filepath);
  res.json({ success: true });
});

// ==================== Site Config API ====================

app.get('/api/config/site', (req, res) => {
  try {
    const content = fs.readFileSync(path.join(HEXO_ROOT, '_config.yml'), 'utf8');
    const config = yaml.load(content);
    res.json({ config, raw: content });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/config/site', (req, res) => {
  try {
    const { raw } = req.body;
    const blocked = contentFilter.checkRawContent(raw);
    if (blocked.blocked) return contentFilter.rejectResponse(res, blocked);
    yaml.load(raw); // validate
    const backupPath = path.join(HEXO_ROOT, `_config.yml.bak.${Date.now()}`);
    fs.copyFileSync(path.join(HEXO_ROOT, '_config.yml'), backupPath);
    fs.writeFileSync(path.join(HEXO_ROOT, '_config.yml'), raw);
    res.json({ success: true, backup: backupPath });
  } catch (e) {
    res.status(400).json({ error: `YAML 格式错误: ${e.message}` });
  }
});

// ==================== Theme Config API ====================

app.get('/api/config/theme', (req, res) => {
  try {
    const overridePath = path.join(HEXO_ROOT, '_config.butterfly.yml');
    const defaultPath = path.join(THEME_DIR, '_config.yml');

    let raw = '';
    let source = '';
    if (fs.existsSync(overridePath)) {
      raw = fs.readFileSync(overridePath, 'utf8');
      source = 'override';
    } else if (fs.existsSync(defaultPath)) {
      raw = fs.readFileSync(defaultPath, 'utf8');
      source = 'default';
    }

    const config = yaml.load(raw) || {};
    res.json({ config, raw, source });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function ensureThemeEssentials(raw) {
  if (!/^inject:/m.test(raw)) {
    raw += `\ninject:\n  head:\n    - <link rel="stylesheet" href="/css/custom.css">\n    - <link rel="stylesheet" href="/css/comments.css">\n    - <link rel="stylesheet" href="/css/favorites.css">\n  bottom:\n    - <script>window.HEXO_MESSAGE_API='http://207.57.123.17:4001/api/comments';</script>\n    - <script src="/js/comments.js"></script>\n    - <script src="/js/favorites.js"></script>\n    - <script src="/js/snow.js"></script>\n`;
  }
  if (!/^disable_top_img:/m.test(raw)) {
    raw = `disable_top_img: false\nindex_top_img_height: 100vh\n\nmask:\n  header: false\n  footer: true\n\n${raw}`;
  }
  return raw;
}

app.put('/api/config/theme', async (req, res) => {
  try {
    let { raw, regenerate } = req.body;
    raw = ensureThemeEssentials(raw);
    const blocked = contentFilter.checkRawContent(raw);
    if (blocked.blocked) return contentFilter.rejectResponse(res, blocked);
    yaml.load(raw); // validate
    const overridePath = path.join(HEXO_ROOT, '_config.butterfly.yml');
    if (fs.existsSync(overridePath)) {
      fs.copyFileSync(overridePath, `${overridePath}.bak.${Date.now()}`);
    }
    fs.writeFileSync(overridePath, raw);

    let output = '';
    if (regenerate) {
      output = await regenerateAndRestart();
    }
    res.json({ success: true, output });
  } catch (e) {
    res.status(400).json({ error: `YAML 格式错误: ${e.message}` });
  }
});

function patchThemeYamlField(raw, key, value) {
  const line = value ? `${key}: ${value}` : `${key}:`;
  const regex = new RegExp(`^${key}:.*$`, 'm');
  if (regex.test(raw)) {
    return raw.replace(regex, line);
  }
  return `${line}\n${raw}`;
}

function runHexoCmd(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: HEXO_ROOT, timeout: 120000 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

function restartHexoServer() {
  return new Promise((resolve) => {
    exec('pkill -f "hexo server" || true', () => {
      setTimeout(() => {
        const child = spawn('npx', ['hexo', 'server'], {
          cwd: HEXO_ROOT,
          detached: true,
          stdio: 'ignore',
          env: process.env
        });
        child.unref();
        setTimeout(() => resolve('Hexo 开发服务已重启'), 2500);
      }, 800);
    });
  });
}

async function regenerateAndRestart() {
  const output = await runHexoCmd('npx hexo clean && npx hexo generate');
  const restartMsg = await restartHexoServer();
  return `${output}\n${restartMsg}`;
}

app.get('/api/config/background', (req, res) => {
  try {
    const overridePath = path.join(HEXO_ROOT, '_config.butterfly.yml');
    if (!fs.existsSync(overridePath)) return res.json({ background: '' });
    const config = yaml.load(fs.readFileSync(overridePath, 'utf8')) || {};
    res.json({ background: config.background || '' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/config/background', async (req, res) => {
  try {
    const { url, regenerate } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: '请提供背景图 URL' });
    }
    const blocked = contentFilter.checkText(url);
    if (blocked.blocked) return contentFilter.rejectResponse(res, blocked);
    const overridePath = path.join(HEXO_ROOT, '_config.butterfly.yml');
    let raw = '';
    if (fs.existsSync(overridePath)) {
      raw = fs.readFileSync(overridePath, 'utf8');
      fs.copyFileSync(overridePath, `${overridePath}.bak.${Date.now()}`);
    } else {
      const defaultPath = path.join(THEME_DIR, '_config.yml');
      raw = fs.existsSync(defaultPath) ? fs.readFileSync(defaultPath, 'utf8') : '';
    }
    raw = patchThemeYamlField(raw, 'background', url.trim());
    yaml.load(raw);
    fs.writeFileSync(overridePath, raw);

    let output = '';
    if (regenerate) {
      output = await regenerateAndRestart();
    }
    res.json({ success: true, background: url.trim(), output });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ==================== Theme Files API ====================

app.get('/api/theme/files', (req, res) => {
  const dir = req.query.dir || '';
  const targetDir = path.join(THEME_DIR, dir);
  if (!targetDir.startsWith(THEME_DIR)) return res.status(403).json({ error: '禁止访问' });
  if (!fs.existsSync(targetDir)) return res.json([]);

  const items = fs.readdirSync(targetDir, { withFileTypes: true });
  const result = items
    .filter(i => !i.name.startsWith('.') && i.name !== 'node_modules')
    .map(i => ({
      name: i.name,
      path: path.join(dir, i.name),
      isDir: i.isDirectory(),
      size: i.isFile() ? fs.statSync(path.join(targetDir, i.name)).size : 0
    }));
  res.json(result);
});

app.get('/api/theme/file', (req, res) => {
  const filePath = path.join(THEME_DIR, req.query.path || '');
  if (!filePath.startsWith(THEME_DIR)) return res.status(403).json({ error: '禁止访问' });
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件不存在' });
  const content = fs.readFileSync(filePath, 'utf8');
  res.json({ content, path: req.query.path });
});

app.put('/api/theme/file', (req, res) => {
  const blocked = contentFilter.checkRawContent(req.body.content || '');
  if (blocked.blocked) return contentFilter.rejectResponse(res, blocked);
  const filePath = path.join(THEME_DIR, req.body.path || '');
  if (!filePath.startsWith(THEME_DIR)) return res.status(403).json({ error: '禁止访问' });
  fs.writeFileSync(filePath, req.body.content);
  res.json({ success: true });
});

// ==================== Media API ====================

app.get('/api/media', (req, res) => {
  try {
    const files = fs.readdirSync(IMAGES_DIR);
    const media = files
      .filter(f => /\.(jpg|jpeg|png|gif|webp|svg|ico|mp4|webm)$/i.test(f))
      .map(f => {
        const stat = fs.statSync(path.join(IMAGES_DIR, f));
        return { name: f, size: stat.size, date: stat.mtime, url: `/images/${f}` };
      });
    media.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(media);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/media/upload', (req, res) => {
  upload.array('files', 20)(req, res, (err) => {
    if (err) {
      const code = err.message.includes('违规') ? 'CONTENT_BLOCKED' : 'UPLOAD_ERROR';
      return res.status(code === 'CONTENT_BLOCKED' ? 403 : 400).json({ error: err.message, code });
    }
    const uploaded = (req.files || []).map(f => ({
      name: f.filename,
      url: `/images/${f.filename}`,
      size: f.size
    }));
    res.json({ success: true, files: uploaded });
  });
});

app.post('/api/content-check', (req, res) => {
  const { type, payload, raw } = req.body || {};
  let result = { blocked: false };
  if (raw != null) result = contentFilter.checkRawContent(raw);
  else if (type === 'post') result = contentFilter.checkPost(payload || {});
  else if (type === 'comment') result = contentFilter.checkComment(payload || {});
  else if (type === 'text') result = contentFilter.checkText(payload?.text || '');
  res.json(result);
});

app.delete('/api/media/:name', (req, res) => {
  const filepath = path.join(IMAGES_DIR, req.params.name);
  if (!filepath.startsWith(IMAGES_DIR)) return res.status(403).json({ error: '禁止访问' });
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: '文件不存在' });
  fs.unlinkSync(filepath);
  res.json({ success: true });
});

// ==================== Custom CSS API ====================

app.get('/api/custom-css', (req, res) => {
  const cssPath = path.join(HEXO_ROOT, 'source', 'css', 'custom.css');
  fs.mkdirSync(path.dirname(cssPath), { recursive: true });
  const content = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
  res.json({ content });
});

app.put('/api/custom-css', (req, res) => {
  const blocked = contentFilter.checkRawContent(req.body.content || '');
  if (blocked.blocked) return contentFilter.rejectResponse(res, blocked);
  const cssPath = path.join(HEXO_ROOT, 'source', 'css', 'custom.css');
  fs.mkdirSync(path.dirname(cssPath), { recursive: true });
  fs.writeFileSync(cssPath, req.body.content || '');
  res.json({ success: true });
});

// ==================== Hexo Commands API ====================

app.post('/api/hexo/generate', async (req, res) => {
  try {
    const output = await regenerateAndRestart();
    res.json({ success: true, output });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/hexo/deploy', async (req, res) => {
  try {
    const output = await runHexoCmd('npx hexo clean && npx hexo generate && npx hexo deploy');
    res.json({ success: true, output });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/hexo/clean', async (req, res) => {
  try {
    const output = await runHexoCmd('npx hexo clean');
    res.json({ success: true, output });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== Comments API ====================

const COMMENTS_DIR = path.join(__dirname, 'data');
fs.mkdirSync(COMMENTS_DIR, { recursive: true });

function getCommentsFile(slug) {
  return path.join(COMMENTS_DIR, `comments_${slug.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`);
}

function readComments(slug) {
  const file = getCommentsFile(slug);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

function writeComments(slug, comments) {
  fs.writeFileSync(getCommentsFile(slug), JSON.stringify(comments, null, 2));
}

// CORS for comment widget (served from port 4000)
app.use('/api/comments', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Get messages (public API returns empty — only admin can view via /api/comments-all)
app.get('/api/comments/:slug', (req, res) => {
  res.json([]);
});

// Submit a private message
app.post('/api/comments/:slug', (req, res) => {
  const { nickname, email, content } = req.body;
  if (!nickname || !content) return res.status(400).json({ error: '称呼和留言内容不能为空' });

  const blocked = contentFilter.checkComment({ nickname, email, content });
  if (blocked.blocked) return contentFilter.rejectResponse(res, blocked);

  const comments = readComments(req.params.slug);
  const comment = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    nickname: nickname.trim().slice(0, 30),
    email: (email || '').trim().slice(0, 100),
    content: content.trim().slice(0, 2000),
    page: req.params.slug,
    date: new Date().toISOString(),
    deleted: false
  };

  comments.push(comment);
  writeComments(req.params.slug, comments);
  res.json({ success: true });
});

// Delete a comment (admin)
app.delete('/api/comments/:slug/:id', (req, res) => {
  const comments = readComments(req.params.slug);
  const idx = comments.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: '评论不存在' });
  comments[idx].deleted = true;
  writeComments(req.params.slug, comments);
  res.json({ success: true });
});

// Get all comments (for admin panel)
app.get('/api/comments-all', (req, res) => {
  const files = fs.readdirSync(COMMENTS_DIR).filter(f => f.startsWith('comments_') && f.endsWith('.json'));
  const all = [];
  files.forEach(f => {
    const slug = f.replace('comments_', '').replace('.json', '');
    try {
      const comments = JSON.parse(fs.readFileSync(path.join(COMMENTS_DIR, f), 'utf8'));
      comments.forEach(c => { if (!c.deleted) all.push({ ...c, slug }); });
    } catch {}
  });
  all.sort((a, b) => new Date(b.date) - new Date(a.date));
  res.json(all);
});

// ==================== Catch-all ====================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  ✨ Hexo 管理后台已启动`);
  console.log(`  🌐 访问地址: http://localhost:${PORT}`);
  console.log(`  📁 Hexo 根目录: ${HEXO_ROOT}\n`);
});

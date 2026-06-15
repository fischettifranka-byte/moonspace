const express = require('express');
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ===== 加载 .env =====
function loadEnv() {
  const env = {};
  try {
    const content = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
    content.split('\n').forEach(line => {
      const m = line.match(/^([^=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    });
  } catch(e) { console.log('⚠️ 未找到 .env 文件'); }
  return env;
}
const ENV = loadEnv();

// ===== 加载网易云VIP Cookie（从 start.sh 读取）=====
let NETEASE_COOKIE = '';
try {
  const startSh = fs.readFileSync(path.join(__dirname, 'start.sh'), 'utf8');
  const match = startSh.match(/NETEASE_MUSIC_U=([^;\s]+)/);
  if (match) NETEASE_COOKIE = 'MUSIC_U=' + match[1].trim();
  if (NETEASE_COOKIE) console.log('🎵 音乐Cookie已加载');
} catch(e) { console.log('⚠️ 未加载音乐Cookie:', e.message); }

// ===== 邮件发送器 =====
const mailer = nodemailer.createTransport({
  host: ENV.SMTP_HOST || 'smtp.163.com',
  port: parseInt(ENV.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: ENV.SMTP_USER || '',
    pass: ENV.SMTP_PASS || ''
  }
});

// 发送邮件
async function sendEmail(to, subject, html) {
  try {
    await mailer.sendMail({
      from: `"月光空间" <${ENV.SMTP_USER}>`,
      to, subject, html
    });
    console.log(`📧 邮件已发送 → ${to}`);
    return true;
  } catch(e) {
    console.error(`📧 邮件发送失败 ${to}:`, e.message);
    return false;
  }
}

const app = express();
const PORT = 18888;
const DATA_FILE = path.join(__dirname, 'data', 'db.json');
const SESSION_SECRET_FILE = path.join(__dirname, 'data', '.session-secret');

// ===== Session 密钥持久化 =====
function getSessionSecret() {
  try {
    if (fs.existsSync(SESSION_SECRET_FILE)) return fs.readFileSync(SESSION_SECRET_FILE, 'utf8').trim();
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(SESSION_SECRET_FILE, secret, 'utf8');
    return secret;
  } catch(e) { return crypto.randomBytes(32).toString('hex'); }
}

// ===== 数据层 =====
function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch(e) {
    return {
      users: {}, posts: [], music: {}, smsCodes: {},
      board: [], secrets: [], checkins: {}, messages: [],
      notifications: [], stories: []
    };
  }
}
function saveDB(db) { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8'); }

// ===== 备份 =====
function backupDB() {
  try {
    const db = loadDB();
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    fs.writeFileSync(path.join(backupDir, `db_${ts}.json`), JSON.stringify(db, null, 2));
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('db_')).sort().reverse();
    if (files.length > 30) files.slice(30).forEach(f => fs.unlinkSync(path.join(backupDir, f)));
    console.log(`📦 备份完成: db_${ts}.json`);
  } catch(e) { console.error('备份失败:', e.message); }
}
setInterval(backupDB, 3600000);

// ===== 文件上传 =====
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'public', 'uploads'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) return cb(null, true);
    cb(new Error('仅支持图片格式'));
  }
});

// ===== 云盘上传（独立配置） =====
const cloudStorage = multer.diskStorage({
  destination: path.join(__dirname, 'public', 'cloud'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + path.extname(file.originalname))
});
const cloudUpload = multer({
  storage: cloudStorage,
  limits: { fileSize: 200 * 1024 * 1024 }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: '10mb' }));
app.use(session({
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: 'lax' }
}));

// 基础安全头
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '0');
  next();
});

// ===== 帮助函数 =====
function auth(req, res) {
  if (!req.session.user) { res.json({ ok: false, msg: '未登录' }); return null; }
  const db = loadDB();
  const u = db.users[req.session.user];
  if (!u) { res.json({ ok: false, msg: '用户不存在' }); return null; }
  return { db, user: req.session.user, userData: u };
}
function getUserName(db, uid) {
  return db.users[uid]?.nickname || uid;
}

// ==================== 🎵 音乐代理 ====================
const MUSIC_API = 'http://127.0.0.1:3000';
// 格式化歌曲数据
function fmtSong(s) {
  return {
    id: s.id, name: s.name,
    artists: (s.ar||s.artists||[]).map(a => a.name||a).join('/'),
    album: (s.al||s.album||{}).name||'',
    cover: ((s.al||s.album||{}).picUrl)||'',
    duration: s.dt||s.duration||0
  };
}

// 音乐代理（带数据转换）
function musicProxy(endpoint, transform, res) {
  const opts = { timeout: 25000, headers: {} };
  if (NETEASE_COOKIE) opts.headers.Cookie = NETEASE_COOKIE;
  const req = http.get(`${MUSIC_API}${endpoint}`, opts, (proxyRes) => {
    let data = '';
    proxyRes.on('data', chunk => data += chunk);
    proxyRes.on('end', () => {
      try {
        const raw = JSON.parse(data);
        res.json(transform ? transform(raw) : raw);
      } catch(e) { res.json({ ok: false, msg: '音乐服务异常' }); }
    });
  });
  req.on('timeout', () => { req.destroy(); res.json({ ok: false, msg: '请求超时，请重试' }); });
  req.on('error', () => res.json({ ok: false, msg: '音乐服务离线' }));
}

// 搜索
app.get('/api/music/search', (req, res) => {
  const { keywords, limit = 20 } = req.query;
  if (!keywords) return res.json({ ok: false, msg: '请输入关键词' });
  musicProxy(`/search?keywords=${encodeURIComponent(keywords)}&limit=${limit}`, raw => ({
    ok: true, songs: (raw.result?.songs||[]).map(fmtSong), total: raw.result?.songCount||0
  }), res);
});
// 播放地址
// 播放地址（并行多级降级+Cookie）
app.get('/api/music/url/:id', (req, res) => {
  const songId = req.params.id;
  const levels = ['lossless', 'exhigh', 'higher', 'standard'];
  let done = false;
  const opts = { timeout: 8000, headers: {} };
  if (NETEASE_COOKIE) opts.headers.Cookie = NETEASE_COOKIE;
  // 并行请求所有品质，取第一个有URL的
  let pending = levels.length;
  levels.forEach(level => {
    http.get(MUSIC_API + '/song/url/v1?id=' + songId + '&level=' + level, opts, (proxyRes) => {
      let data = '';
      proxyRes.on('data', chunk => data += chunk);
      proxyRes.on('end', () => {
        try {
          const raw = JSON.parse(data);
          const url = raw.data?.[0]?.url || '';
          if (url && !done) { done = true; return res.json({ ok: true, url }); }
        } catch(e) {}
        if (--pending <= 0 && !done) {
          done = true;
          res.json({ ok: true, url: '', msg: '暂无播放源' });
        }
      });
    }).on('error', () => { if (--pending <= 0 && !done) { done = true; res.json({ ok: true, url: '' }); }})
     .on('timeout', function() { this.destroy(); if (--pending <= 0 && !done) { done = true; res.json({ ok: true, url: '' }); }});
  });
});
// 免费播放地址
app.get('/api/music/free-url/:id', (req, res) => {
  musicProxy(`/song/url/v1?id=${req.params.id}&level=lossless`, raw => {
    const d = raw.data?.[0];
    return { ok: true, url: d?.url || '' };
  }, res);
});
// 歌词
app.get('/api/music/lyric/:id', (req, res) => {
  musicProxy(`/lyric?id=${req.params.id}`, raw => ({
    ok: true, lyric: raw.lrc?.lyric || raw.tlyric?.lyric || ''
  }), res);
});
// 热搜
app.get('/api/music/hot', (req, res) => {
  musicProxy('/search/hot/detail', raw => ({
    ok: true, hots: (raw.data||[]).map(h => h.searchWord)
  }), res);
});
// 每日推荐（VIP）- 这些歌曲保证可播放
app.get('/api/music/daily', (req, res) => {
  musicProxy('/recommend/songs', raw => ({
    ok: true,
    songs: (raw.data?.dailySongs || []).map(s => ({
      id: s.id, name: s.name, artists: (s.ar || []).map(a => a.name).join('&'),
      cover: s.al?.picUrl || '', duration: s.dt
    }))
  }), res);
});

// 新歌速递
app.get('/api/music/newsongs', (req, res) => {
  musicProxy('/top/song?type=0', raw => ({
    ok: true, songs: (raw.data||[]).map(fmtSong)
  }), res);
});
// 热门歌单
app.get('/api/music/playlists', (req, res) => {
  musicProxy('/top/playlist?limit=20&order=hot', raw => ({
    ok: true, playlists: (raw.playlists||[]).map(p => ({
      id: p.id, name: p.name,
      cover: p.coverImgUrl||'',
      playCount: p.playCount||0
    }))
  }), res);
});
// 歌单详情
app.get('/api/music/playlist/:id', (req, res) => {
  musicProxy(`/playlist/detail?id=${req.params.id}`, raw => ({
    ok: true,
    name: raw.playlist?.name||'',
    tracks: (raw.playlist?.tracks||[]).map(fmtSong)
  }), res);
});
// 收藏歌曲
app.post('/api/music/favorite', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { song } = req.body;
  if (!song) return res.json({ ok: false });
  if (!ctx.userData.musicList) ctx.userData.musicList = [];
  const idx = ctx.userData.musicList.findIndex(s => s.id === song.id);
  if (idx > -1) ctx.userData.musicList.splice(idx, 1);
  else ctx.userData.musicList.push(song);
  saveDB(ctx.db);
  res.json({ ok: true, list: ctx.userData.musicList });
});
app.get('/api/music/favorites', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  res.json({ ok: true, list: ctx.userData.musicList || [] });
});

// ==================== 认证 ====================

// 发送验证码（邮箱/手机号通用）
app.post('/api/send-code', async (req, res) => {
  const { phone, email } = req.body;
  const key = phone || email;
  if (!key) return res.json({ ok: false, msg: '请输入手机号或邮箱' });
  if (phone && !/^1\d{10}$/.test(phone)) return res.json({ ok: false, msg: '手机号格式不对' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ ok: false, msg: '邮箱格式不对' });
  const db = loadDB();
  const last = db.smsCodes[key];
  if (last && Date.now() - (last.sentAt || 0) < 60000) return res.json({ ok: false, msg: '请60秒后再试' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  db.smsCodes[key] = { code, expires: Date.now() + 300000, sentAt: Date.now() };
  saveDB(db);
  // 邮箱 → 发邮件
  if (email) {
    const sent = await sendEmail(email, '🌙 月光空间 - 验证码',
      `<div style="max-width:400px;margin:0 auto;padding:30px;background:#0c0e1a;border-radius:20px;font-family:Arial,sans-serif;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">🌙</div>
        <h2 style="color:#f5d76e;letter-spacing:2px">月光空间</h2>
        <p style="color:#888;font-size:14px">你的验证码是</p>
        <div style="font-size:36px;font-weight:800;color:#f5d76e;letter-spacing:8px;margin:16px 0">${code}</div>
        <p style="color:#666;font-size:12px">5分钟内有效，请勿泄露</p>
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,.06)">
          <p style="color:#444;font-size:11px">如非本人操作，请忽略此邮件</p>
        </div>
      </div>`
    );
    if (sent) {
      console.log(`📱 验证码 [${key}]: ${code}`);
      res.json({ ok: true, msg: '验证码已发送到邮箱，请查收' });
    } else {
      // 邮件发送失败，降级到控制台显示
      console.log(`📱 验证码 [${key}]: ${code} (邮件发送失败，仅控制台可见)`);
      res.json({ ok: false, msg: '邮件发送失败，请稍后再试' });
    }
  } else {
    // 手机号（无真实短信服务）
    console.log(`📱 验证码 [${key}]: ${code}`);
    res.json({ ok: true, msg: '验证码已发送' });
  }
});

app.post('/api/phone-login', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.json({ ok: false, msg: '请填写完整' });
  const db = loadDB();
  const sms = db.smsCodes[phone];
  if (!sms || sms.code !== code) return res.json({ ok: false, msg: '验证码错误' });
  if (Date.now() > sms.expires) return res.json({ ok: false, msg: '验证码已过期' });
  delete db.smsCodes[phone];
  if (!db.users[phone]) {
    db.users[phone] = { password: '', nickname: '用户' + phone.slice(-4), phone, avatar: '', bio: '新人报到 🌙', created: Date.now(), musicList: [], points: 0 };
  }
  saveDB(db);
  req.session.user = phone;
  res.json({ ok: true });
});

app.post('/api/login', (req, res) => {
  const { username, password, email } = req.body;
  const id = username || email;
  console.log('LOGIN:', id, 'pwd:', password ? '***' : 'MISSING');
  if (!id || !password) return res.json({ ok: false, msg: '填完再点' });
  const db = loadDB();
  const userKey = Object.keys(db.users).find(k => k === id || db.users[k].nickname === id || db.users[k].email === id);
  console.log('LOGIN_MATCH:', userKey || 'NOT FOUND');
  if (!userKey) return res.json({ ok: false, msg: '账号不存在' });
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  const stored = db.users[userKey].password;
  // 统一使用 SHA-256 哈希比对
  const passOk = stored && stored === hash;
  console.log('LOGIN_PASS:', passOk ? 'OK' : 'WRONG');
  if (!passOk) return res.json({ ok: false, msg: '密码不对' });
  req.session.user = userKey;
  res.json({ ok: true });
});


app.post('/api/register', (req, res) => {
  const { username, password, nickname, email, code } = req.body;
  const id = email || username;
  if (!id || !password) return res.json({ ok: false, msg: '必填项不能为空' });
  if (password.length < 6) return res.json({ ok: false, msg: '密码至少6位' });
  const db = loadDB();
  if (db.users[id]) return res.json({ ok: false, msg: '账号已存在' });
  // 检查邮箱是否已被其他账号绑定
  if (email && Object.keys(db.users).some(k => k !== id && db.users[k].email === email)) {
    return res.json({ ok: false, msg: '该邮箱已被注册' });
  }
  // 邮箱注册需验证验证码
  if (email) {
    const sms = db.smsCodes[email];
    if (!sms) return res.json({ ok: false, msg: '请先获取邮箱验证码' });
    if (!code || sms.code !== code) return res.json({ ok: false, msg: '验证码错误' });
    if (Date.now() > sms.expires) return res.json({ ok: false, msg: '验证码已过期' });
    delete db.smsCodes[email];
  }
  const hash = crypto.createHash('sha256').update(password).digest('hex');
  db.users[id] = { password: hash, nickname: nickname || (email ? email.split('@')[0] : id), phone: '', avatar: '', bio: '这个人很懒，什么都没写', created: Date.now(), musicList: [], points: 0, email: email || '' };
  saveDB(db);
  req.session.user = id;
  res.json({ ok: true });
});

// 邮箱登录（简易：用邮箱作为用户名）
app.post('/api/email-login', (req, res) => {
  const { email, code } = req.body;
  if (!email) return res.json({ ok: false, msg: '请输入邮箱' });
  const db = loadDB();
  // 验证验证码
  const sms = db.smsCodes[email];
  if (!sms) return res.json({ ok: false, msg: '请先获取验证码' });
  if (!code || sms.code !== code) return res.json({ ok: false, msg: '验证码错误' });
  if (Date.now() > sms.expires) return res.json({ ok: false, msg: '验证码已过期' });
  delete db.smsCodes[email];
  // 查找现有账号：优先以邮箱为key，其次查email字段
  let uid = db.users[email] ? email : Object.keys(db.users).find(k => db.users[k].email === email);
  if (!uid) {
    uid = 'em_' + crypto.createHash('md5').update(email).digest('hex').slice(0, 12);
    db.users[uid] = { password: '', nickname: email.split('@')[0], email, avatar: '', bio: '邮箱用户 🌙', created: Date.now(), musicList: [], points: 0 };
  }
  saveDB(db);
  req.session.user = uid;
  res.json({ ok: true });
});

app.get('/api/check', (req, res) => {
  if (!req.session.user) return res.json({ loggedIn: false });
  const db = loadDB();
  const u = db.users[req.session.user];
  if (!u) return res.json({ loggedIn: false });
  const myPosts = db.posts.filter(p => p.user === req.session.user);
  const mySecrets = db.secrets ? db.secrets.filter(s => s.user === req.session.user) : [];
  // 粉丝数
  const followersCount = Object.values(db.users).filter(v => v.following?.includes(req.session.user)).length;
  // 等级（每100分升一级，最低1级）
  const level = Math.floor((u.points || 0) / 100) + 1;
  // 成就数
  const achievementChecks = [
    myPosts.length >= 1, myPosts.length >= 10, myPosts.length >= 50,
    myPosts.reduce((a, p) => a + (p.likes?.length || 0), 0) >= 10,
    myPosts.reduce((a, p) => a + (p.likes?.length || 0), 0) >= 100,
    (u.points || 0) >= 50, (u.points || 0) >= 500,
    db.posts.filter(p => p.comments?.some(c => c.user === req.session.user)).length >= 20
  ];
  const achievementCount = achievementChecks.filter(Boolean).length;
  // 签到状态（兼容旧格式：字符串 → 对象 { lastDate, streak }）
  if (!db.checkins) db.checkins = {};
  const today = new Date().toISOString().slice(0, 10);
  const raw = db.checkins[req.session.user];
  const ci = typeof raw === 'object' ? raw : { lastDate: raw || '', streak: raw ? 1 : 0 };
  const checkedInToday = ci.lastDate === today;
  const checkinStreak = checkedInToday ? ci.streak : 0;
  res.json({
    loggedIn: true, user: req.session.user, nickname: u.nickname, phone: u.phone,
    avatar: u.avatar, bio: u.bio, created: u.created, points: u.points || 0,
    postCount: myPosts.length, totalLikes: myPosts.reduce((a, p) => a + (p.likes?.length || 0), 0),
    secretCount: mySecrets.length, email: u.email || '',
    checkedInToday, checkinStreak,
    hasPassword: !!u.password,
    followersCount, level, achievementCount
  });
});

app.post('/api/logout', (req, res) => { req.session.destroy(); res.json({ ok: true }); });

// ==================== 说说 ====================

app.post('/api/post', upload.array('images', 9), (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { content, mood, location } = req.body;
  if (!content && (!req.files || !req.files.length)) return res.json({ ok: false, msg: '写点啥吧' });
  const visibility = req.body.visibility || 'public';
  const post = {
    id: Date.now(), user: req.session.user, content: content || '',
    images: req.files ? req.files.map(f => '/uploads/' + f.filename) : [],
    mood: mood || '', location: location || '', time: Date.now(), likes: [], comments: [],
    visibility
  };
  ctx.db.posts.unshift(post);
  saveDB(ctx.db);
  // 发帖加积分
  ctx.userData.points = (ctx.userData.points || 0) + 5;
  saveDB(ctx.db);
  res.json({ ok: true });
});

app.get('/api/posts', (req, res) => {
  const db = loadDB();
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 10;
  const start = (page - 1) * size;
  const filteredPosts = db.posts.filter(p => !p.visibility || p.visibility === 'public' || p.user === (req.query.user || ''));
  const items = filteredPosts.slice(start, start + size).map(p => ({
    ...p, nickname: getUserName(db, p.user), avatar: db.users[p.user]?.avatar || ''
  }));
  res.json({ ok: true, posts: items, total: filteredPosts.length, hasMore: start + size < filteredPosts.length });
});

// 优化版动态流（含关注用户优先）
app.get('/api/feed-optimized', (req, res) => {
  if (!req.session.user) return res.json({ ok: false, msg: '未登录' });
  const db = loadDB();
  const uid = req.session.user;
  const page = parseInt(req.query.page) || 1; const size = 10;
  const myPosts = db.posts.filter(p => p.user === uid);
  const start = (page - 1) * size;
  const items = myPosts.slice(start, start + size).map(p => ({
    ...p, nickname: getUserName(db, p.user), avatar: db.users[p.user]?.avatar || ''
  }));
  res.json({ ok: true, posts: items, hasMore: start + size < myPosts.length });
});

app.post('/api/like/:id', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const post = ctx.db.posts.find(p => p.id == req.params.id);
  if (!post) return res.json({ ok: false, msg: '不存在' });
  if (!post.likes) post.likes = [];
  const idx = post.likes.indexOf(req.session.user);
  if (idx > -1) post.likes.splice(idx, 1); else post.likes.push(req.session.user);
  saveDB(ctx.db);
  res.json({ ok: true, likes: post.likes });
});

app.post('/api/comment/:id', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { text } = req.body;
  if (!text) return res.json({ ok: false, msg: '写点啥' });
  const post = ctx.db.posts.find(p => p.id == req.params.id);
  if (!post) return res.json({ ok: false, msg: '不存在' });
  if (!post.comments) post.comments = [];
  post.comments.push({ user: req.session.user, text, time: Date.now() });
  saveDB(ctx.db);
  res.json({ ok: true, comments: post.comments.map(c => ({ ...c, nickname: getUserName(ctx.db, c.user) })) });
});

app.post('/api/delete/:id', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const idx = ctx.db.posts.findIndex(p => p.id == req.params.id);
  if (idx === -1 || ctx.db.posts[idx].user !== req.session.user) return res.json({ ok: false, msg: '不能操作' });
  ctx.db.posts.splice(idx, 1);
  saveDB(ctx.db);
  res.json({ ok: true });
});

// ==================== 留言板 ====================

app.get('/api/board', (req, res) => {
  const db = loadDB();
  if (!db.board) db.board = [];
  const items = db.board.slice(-50).map(b => ({ ...b, nickname: getUserName(db, b.user) }));
  res.json({ ok: true, messages: items });
});

app.post('/api/board', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { text } = req.body;
  if (!text) return res.json({ ok: false, msg: '说点什么吧' });
  if (!ctx.db.board) ctx.db.board = [];
  ctx.db.board.push({ id: Date.now(), user: req.session.user, text, time: Date.now(), likes: [] });
  saveDB(ctx.db);
  res.json({ ok: true });
});

app.post('/api/board/like/:id', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.db.board) return res.json({ ok: false });
  const msg = ctx.db.board.find(m => m.id == req.params.id);
  if (!msg) return res.json({ ok: false });
  if (!msg.likes) msg.likes = [];
  const idx = msg.likes.indexOf(req.session.user);
  if (idx > -1) msg.likes.splice(idx, 1); else msg.likes.push(req.session.user);
  saveDB(ctx.db);
  res.json({ ok: true });
});

// ==================== 悄悄话 ====================

app.get('/api/secret', (req, res) => {
  const db = loadDB();
  if (!db.secrets) db.secrets = [];
  const uid = req.session.user;
  const items = db.secrets.filter(s => !uid || s.user !== uid).slice(-30);
  res.json({ ok: true, secrets: items });
});

app.post('/api/secret', (req, res) => {
  const token = req.headers.authorization || req.session.user;
  if (!token) return res.json({ ok: false, msg: '请先登录' });
  const { text } = req.body;
  if (!text) return res.json({ ok: false, msg: '写点什么呢' });
  if (text.length > 500) return res.json({ ok: false, msg: '最多500字' });
  const db = loadDB();
  if (!db.secrets) db.secrets = [];
  // 每人每天最多3条悄悄话
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = db.secrets.filter(s => s.user === req.session.user && new Date(s.time).toISOString().slice(0, 10) === today).length;
  if (todayCount >= 3) return res.json({ ok: false, msg: '今天发太多了，明天再来吧' });
  db.secrets.push({
    id: Date.now(), user: req.session.user || '匿名', text, time: Date.now(),
    color: ['#f5d76e','#64c8ff','#6bffb8','#ff6b6b','#c084fc'][Math.floor(Math.random()*5)]
  });
  saveDB(db);
  res.json({ ok: true });
});

// ==================== 签到 ====================

app.post('/api/checkin', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.db.checkins) ctx.db.checkins = {};
  const today = new Date().toISOString().slice(0, 10);
  // 兼容旧格式
  const raw = ctx.db.checkins[req.session.user];
  const ci = typeof raw === 'object' ? raw : { lastDate: raw || '', streak: raw ? 1 : 0 };
  if (ci.lastDate === today) return res.json({ ok: false, msg: '今天已经签到过了' });
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streak = ci.lastDate === yesterday ? ci.streak + 1 : 1;
  ci.lastDate = today;
  ci.streak = streak;
  ctx.db.checkins[req.session.user] = ci;
  const bonus = Math.floor(Math.random() * 10) + 5;
  ctx.userData.points = (ctx.userData.points || 0) + bonus;
  saveDB(ctx.db);
  res.json({ ok: true, points: ctx.userData.points, bonus, streak });
});

// ==================== 排行榜 ====================

app.get('/api/leaderboard', (req, res) => {
  const db = loadDB();
  const users = Object.entries(db.users).map(([uid, u]) => ({
    user: uid, nickname: u.nickname, avatar: u.avatar,
    points: u.points || 0, postCount: db.posts.filter(p => p.user === uid).length
  }));
  users.sort((a, b) => b.points - a.points);
  res.json({ ok: true, leaderboard: users.slice(0, 50) });
});

// ==================== 每日运势 ====================

app.get('/api/fortune/today', (req, res) => {
  const fortunes = [
    '宜出门走走','宜听一首好歌','宜早点睡觉','宜喝杯奶茶','宜和朋友聊天',
    '宜给自己放个假','宜记录生活','宜微笑','宜晒太阳','宜吃顿好的',
    '宜焚香品茗','宜抚琴听风','宜临帖习字','宜踏青赏花','宜泛舟湖上',
    '宜登高望远','宜执笔抒怀','宜月下独酌','宜煮酒论诗','宜采菊东篱',
    '宜听雨入眠','宜观云望月','宜踏雪寻梅','宜对弈手谈','宜仗剑天涯'
  ];
  const avoids = [
    '忌熬夜','忌暴饮暴食','忌冲动消费','忌过度焦虑',
    '忌久坐不动','忌说不该说的话','忌闷闷不乐','忌拖延',
    '忌想太多','忌刷手机太久','忌抱怨','忌自我否定',
    '忌吃太撑','忌不喝水','忌骂人','忌生闷气',
    '忌对月伤怀','忌独坐空庭','忌凭栏叹息','忌辜负良辰',
    '忌虚度光阴','忌闭门不出','忌愁眉不展','忌妄自菲薄'
  ];
  const blessings = [
    '今天会有好事发生 ✨','你是被月亮眷顾的人 🌙',
    '愿君如星如月，流光皎洁 🌟','山高水长，皆是好风光 🏔️',
    '且将新火试新茶，诗酒趁年华 🍵','此心安处是吾乡 🌸',
    '莫愁前路无知己，天下谁人不识君 🎈','长风破浪会有时，直挂云帆济沧海 ⛵',
    '一蓑烟雨任平生 🍃','人间有味是清欢 🍜',
    '当时明月在，曾照彩云归 🌕','春风得意马蹄疾，一日看尽长安花 🐴',
    '桃李春风一杯酒，江湖夜雨十年灯 🏮','月上柳梢头，人约黄昏后 🌆',
    '满目山河空念远，不如怜取眼前人 💛','浮生若梦，为欢几何 🦋',
    '行到水穷处，坐看云起时 ☁️','愿我如星君如月，夜夜流光相皎洁 ✨',
    '醉后不知天在水，满船清梦压星河 🌌','山中何事？松花酿酒，春水煎茶 🍶',
    '世间所有的相遇，都是久别重逢 🤝','星河滚烫，你是人间理想 🔥',
    '宠辱不惊，看庭前花开花落 🌺','明月松间照，清泉石上流 🌊',
    '保持热爱，奔赴山海 🏔️','生活明朗，万物可爱 🐾',
    '今天也要活得热气腾腾 🔥'
  ];
  const lucky = ['金色','蓝色','绿色','粉色','紫色','橙色','白色','银色','鹅黄色','薄荷绿','珊瑚粉','天空蓝'];
  const luckyNumbers = ['3','6','7','8','9','12','16','21','25','28','33','36','42','48','52'];
  const seed = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g,''),10);
  const rng = (max) => Math.abs(Math.floor(Math.sin(seed * 9301 + 49297) * 233280)) % max;
  res.json({
    ok: true,
    fortune: {
      fortune: fortunes[rng(fortunes.length)],
      avoid: avoids[rng(avoids.length)],
      blessing: blessings[rng(blessings.length)],
      luckyNumber: luckyNumbers[rng(luckyNumbers.length)],
      luckyColor: lucky[rng(lucky.length)],
      rating: rng(5) + 1
    }
  });
});

// ==================== 消息/通知 ====================

app.get('/api/messages', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!Array.isArray(ctx.db.messages)) ctx.db.messages = [];
  const msgs = ctx.db.messages
    .filter(m => m.to === req.session.user)
    .sort((a, b) => b.time - a.time)
    .slice(0, 50);
  res.json({ ok: true, messages: msgs });
});

app.post('/api/messages', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { text } = req.body;
  // 公开消息
  if (!Array.isArray(ctx.db.messages)) ctx.db.messages = [];
  ctx.db.messages.push({ id: Date.now(), from: req.session.user, to: '所有人', text, time: Date.now() });
  saveDB(ctx.db);
  res.json({ ok: true });
});

app.get('/api/notifications', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.db.notifications) ctx.db.notifications = [];
  const notifs = ctx.db.notifications
    .filter(n => n.user === req.session.user)
    .sort((a, b) => b.time - a.time)
    .slice(0, 30);
  res.json({ ok: true, notifications: notifs, unread: notifs.filter(n => !n.read).length });
});

app.post('/api/notifications/read', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.db.notifications) ctx.db.notifications = [];
  ctx.db.notifications.forEach(n => { if (n.user === req.session.user) n.read = true; });
  saveDB(ctx.db);
  res.json({ ok: true });
});

// 添加通知辅助函数
function addNotification(db, user, type, text, link) {
  if (!db.notifications) db.notifications = [];
  db.notifications.push({ id: Date.now(), user, type, text, link: link || '', time: Date.now(), read: false });
}

// ==================== 私信 ====================

app.get('/api/dm/conversations', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!Array.isArray(ctx.db.dms)) ctx.db.dms = [];
  const myDms = ctx.db.dms.filter(m => m.from === req.session.user || m.to === req.session.user);
  const partners = new Set();
  myDms.forEach(m => { if (m.from !== req.session.user) partners.add(m.from); if (m.to !== req.session.user) partners.add(m.to); });
  const convos = [...partners].map(uid => {
    const msgs = myDms.filter(m => (m.from === uid && m.to === req.session.user) || (m.to === uid && m.from === req.session.user)).sort((a, b) => a.time - b.time);
    const lastMsg = msgs.slice(-1)[0];
    const unread = msgs.filter(m => m.from === uid && m.to === req.session.user && !m.read).length;
    return {
      user: uid, nickname: getUserName(ctx.db, uid), avatar: ctx.db.users[uid]?.avatar || '',
      lastMsg: lastMsg?.text || '', lastTime: lastMsg?.time || 0, unread
    };
  });
  res.json({ ok: true, conversations: convos });
});

app.get('/api/dm/messages/:uid', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!Array.isArray(ctx.db.dms)) ctx.db.dms = [];
  const msgs = ctx.db.dms.filter(m =>
    (m.from === req.session.user && m.to === req.params.uid) ||
    (m.from === req.params.uid && m.to === req.session.user)
  ).sort((a, b) => a.time - b.time).slice(-100);
  res.json({ ok: true, messages: msgs });
});

app.post('/api/dm/send', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { to, text } = req.body;
  if (!to || !text) return res.json({ ok: false, msg: '内容不能为空' });
  if (!Array.isArray(ctx.db.dms)) ctx.db.dms = [];
  ctx.db.dms.push({ id: Date.now(), from: req.session.user, to, text, time: Date.now() });
  addNotification(ctx.db, to, 'dm', `${ctx.userData.nickname} 给你发了私信`, to);
  saveDB(ctx.db);
  res.json({ ok: true });
});

// 发送云盘文件到私信
app.post('/api/dm/send-file', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { to, fileId } = req.body;
  console.log('DM_SEND_FILE req.body:', JSON.stringify(req.body));
  if (!to || !fileId) return res.json({ ok: false, msg: '参数不完整' });
  if (!ctx.db.cloud || !ctx.db.cloud[req.session.user]) return res.json({ ok: false, msg: '云盘为空' });
  const userCloud = ctx.db.cloud[req.session.user];
  console.log('DM_SEND_FILE cloud ids:', userCloud.map(f => ({id: f.id, type: typeof f.id})));
  console.log('DM_SEND_FILE looking for fileId:', fileId, 'type:', typeof fileId);
  const file = userCloud.find(f => String(f.id) === String(fileId));
  if (!file) return res.json({ ok: false, msg: '文件不存在' });
  if (!Array.isArray(ctx.db.dms)) ctx.db.dms = [];
  ctx.db.dms.push({ id: Date.now(), from: req.session.user, to, text: `[文件] ${file.name}`, time: Date.now(), file: { id: file.id, name: file.name, path: file.path, size: file.size, category: file.category } });
  addNotification(ctx.db, to, 'dm', `${ctx.userData.nickname} 给你发了一个文件`, to);
  saveDB(ctx.db);
  res.json({ ok: true, message: { file: { id: file.id, name: file.name, path: file.path, size: file.size, category: file.category } } });
});

// ==================== 故事 ====================

app.get('/api/stories', (req, res) => {
  const db = loadDB();
  if (!db.stories) db.stories = [];
  const stories = db.stories.filter(s => Date.now() - s.time < 86400000);
  res.json({ ok: true, stories: stories.map(s => ({ ...s, nickname: getUserName(db, s.user) })) });
});

app.post('/api/stories/post', upload.single('image'), (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!req.file) return res.json({ ok: false, msg: '请选择图片' });
  if (!ctx.db.stories) ctx.db.stories = [];
  ctx.db.stories.unshift({ id: Date.now(), user: req.session.user, image: '/uploads/' + req.file.filename, text: req.body.text || '', time: Date.now(), views: [] });
  saveDB(ctx.db);
  res.json({ ok: true });
});

app.post('/api/stories/view/:id', (req, res) => {
  const db = loadDB();
  if (!db.stories) return res.json({ ok: false });
  const story = db.stories.find(s => s.id == req.params.id);
  if (!story) return res.json({ ok: false });
  if (!story.views) story.views = [];
  if (req.session.user && !story.views.includes(req.session.user)) story.views.push(req.session.user);
  saveDB(db);
  res.json({ ok: true });
});

// ==================== 关注 ====================

app.post('/api/follow/:uid', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.userData.following) ctx.userData.following = [];
  const idx = ctx.userData.following.indexOf(req.params.uid);
  if (idx > -1) ctx.userData.following.splice(idx, 1);
  else ctx.userData.following.push(req.params.uid);
  saveDB(ctx.db);
  res.json({ ok: true, following: ctx.userData.following });
});

// ==================== 用户主页 ====================

app.get('/api/user/:uid', (req, res) => {
  const db = loadDB();
  const u = db.users[req.params.uid];
  if (!u) return res.json({ ok: false, msg: '用户不存在' });
  const posts = db.posts.filter(p => p.user === req.params.uid);
  const isSelf = req.session.user === req.params.uid;
  const isFollowing = req.session.user ? (db.users[req.session.user]?.following || []).includes(req.params.uid) : false;
  const followersCount = Object.values(db.users).filter(v => v.following?.includes(req.params.uid)).length;
  const level = Math.floor((u.points || 0) / 100) + 1;
  res.json({
    ok: true, uid: req.params.uid, nickname: u.nickname, avatar: u.avatar, bio: u.bio,
    created: u.created, points: u.points || 0,
    postCount: posts.length, totalLikes: posts.reduce((a, p) => a + (p.likes?.length || 0), 0),
    followersCount, level,
    isSelf, isFollowing
  });
});

app.get('/api/gallery/:uid', (req, res) => {
  const db = loadDB();
  const posts = db.posts.filter(p => p.user === req.params.uid);
  const images = posts.filter(p => p.images?.length).flatMap(p => p.images.map(img => ({ url: img, time: p.time, postId: p.id })));
  res.json({ ok: true, images });
});

// ==================== 广场 ====================

app.get('/api/square', (req, res) => {
  const db = loadDB();
  const page = parseInt(req.query.page) || 1;
  const size = parseInt(req.query.size) || 10;
  const sort = req.query.sort || 'hot';
  let posts = [...db.posts].filter(p => !p.visibility || p.visibility === 'public');
  // 排序
  if (sort === 'hot') {
    posts.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0) || b.time - a.time);
  } else {
    posts.sort((a, b) => b.time - a.time);
  }
  const start = (page - 1) * size;
  const items = posts.slice(start, start + size).map(p => ({
    id: p.id,
    content: p.content || '',
    images: p.images || [],
    image: (p.images && p.images[0]) ? p.images[0] : '',
    user: p.user,
    nickname: getUserName(db, p.user),
    avatar: db.users[p.user]?.avatar || '',
    time: p.time,
    likes: p.likes || [],
    comments: p.comments || [],
    mood: p.mood || '',
    location: p.location || ''
  }));
  // 热门话题标签
  const trending = [];
  if (page === 1 && sort === 'hot') {
    const tagCount = {};
    db.posts.filter(p => p.content).forEach(p => {
      const tags = p.content.match(/#([^#]+)#/g);
      if (tags) tags.forEach(t => { const k = t.replace(/#/g,''); tagCount[k] = (tagCount[k]||0)+1; });
    });
    trending.push(...Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([tag,count])=>({tag,count})));
  }
  res.json({ ok: true, posts: items, trending, hasMore: start + size < posts.length, total: posts.length });
});

// ==================== 成就 ====================

app.get('/api/achievements', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const posts = ctx.db.posts.filter(p => p.user === req.session.user);
  const points = ctx.userData.points || 0;
  const achievements = [
    { id: 'first_post', name: '初次发声', desc: '发表第一条说说', icon: '📝', unlocked: posts.length >= 1 },
    { id: 'ten_posts', name: '话痨', desc: '发表10条说说', icon: '💬', unlocked: posts.length >= 10 },
    { id: 'fifty_posts', name: '故事大王', desc: '发表50条说说', icon: '📖', unlocked: posts.length >= 50 },
    { id: 'likes_10', name: '人气新星', desc: '累计获得10个赞', icon: '⭐', unlocked: posts.reduce((a, p) => a + (p.likes?.length || 0), 0) >= 10 },
    { id: 'likes_100', name: '万众瞩目', desc: '累计获得100个赞', icon: '🌟', unlocked: posts.reduce((a, p) => a + (p.likes?.length || 0), 0) >= 100 },
    { id: 'checkin_7', name: '常驻居民', desc: '连续签到7天', icon: '🔥', unlocked: points >= 50 },
    { id: 'points_500', name: '积分达人', desc: '积分达到500', icon: '💎', unlocked: points >= 500 },
    { id: 'commenter', name: '热心评论', desc: '评论数达到20', icon: '💭', unlocked: ctx.db.posts.filter(p => p.comments?.some(c => c.user === req.session.user)).length >= 20 },
  ];
  res.json({ ok: true, achievements });
});

// ==================== 年度报告 ====================

app.get('/api/report/yearly', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const myPosts = ctx.db.posts.filter(p => p.user === req.session.user);
  const curYear = new Date().getFullYear();
  const yearPosts = myPosts.filter(p => new Date(p.time).getFullYear() === curYear);
  // 月度统计
  const monthlyPosts = Array(12).fill(0);
  yearPosts.forEach(p => { monthlyPosts[new Date(p.time).getMonth()]++; });
  // 评论数
  const totalComments = myPosts.reduce((a, p) => a + (p.comments?.length || 0), 0);
  // 粉丝
  const followers = Object.values(ctx.db.users).filter(v => v.following?.includes(req.session.user)).length;
  // 签到天数
  const rawCI = ctx.db.checkins?.[req.session.user];
  const ci = typeof rawCI === 'object' ? rawCI : { lastDate: rawCI || '', streak: rawCI ? 1 : 0 };
  const checkinDays = ci.streak || 0;
  // 最常心情
  const moodCounts = {};
  myPosts.forEach(p => { if (p.mood) { moodCounts[p.mood] = (moodCounts[p.mood] || 0) + 1; } });
  const topMoodEntry = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0];
  // 等级
  const level = Math.floor((ctx.userData.points || 0) / 100) + 1;
  // 成就
  const achievementChecks = [
    myPosts.length >= 1, myPosts.length >= 10, myPosts.length >= 50,
    myPosts.reduce((a, p) => a + (p.likes?.length || 0), 0) >= 10,
    myPosts.reduce((a, p) => a + (p.likes?.length || 0), 0) >= 100,
    (ctx.userData.points || 0) >= 50, (ctx.userData.points || 0) >= 500,
    ctx.db.posts.filter(p => p.comments?.some(c => c.user === req.session.user)).length >= 20
  ];
  res.json({
    ok: true,
    year: curYear,
    totalPosts: myPosts.length,
    totalLikes: myPosts.reduce((a, p) => a + (p.likes?.length || 0), 0),
    totalComments,
    checkinDays,
    followers,
    musicCount: (ctx.userData.musicList || []).length,
    achievementCount: achievementChecks.filter(Boolean).length,
    topMood: topMoodEntry ? topMoodEntry[0] : '',
    topMoodCount: topMoodEntry ? topMoodEntry[1] : 0,
    monthlyPosts,
    level,
    points: ctx.userData.points || 0
  });
});

// ==================== 设置 ====================

app.post('/api/set-password', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { password, oldPassword } = req.body;
  if (!password) return res.json({ ok: false, msg: '密码不能为空' });
  if (password.length < 6) return res.json({ ok: false, msg: '密码至少6位' });
  // 如果已有密码，必须验证旧密码
  if (ctx.userData.password) {
    if (!oldPassword) return res.json({ ok: false, msg: '请输入旧密码' });
    const oldHash = crypto.createHash('sha256').update(oldPassword).digest('hex');
    if (oldHash !== ctx.userData.password) return res.json({ ok: false, msg: '旧密码错误' });
  }
  ctx.userData.password = crypto.createHash('sha256').update(password).digest('hex');
  saveDB(ctx.db);
  res.json({ ok: true });
});

// 发验证码到绑定邮箱（改密用）
app.post('/api/settings/send-pwd-code', async (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const email = ctx.userData.email;
  if (!email) return res.json({ ok: false, msg: '请先绑定邮箱' });
  const last = ctx.db.smsCodes && ctx.db.smsCodes['pwd_' + req.session.user];
  if (last && Date.now() - (last.sentAt || 0) < 60000) return res.json({ ok: false, msg: '请60秒后再试' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  if (!ctx.db.smsCodes) ctx.db.smsCodes = {};
  ctx.db.smsCodes['pwd_' + req.session.user] = { code, expires: Date.now() + 300000, sentAt: Date.now() };
  saveDB(ctx.db);
  const sent = await sendEmail(email, 'Moonlight - Password Reset Code',
    '<div style="max-width:400px;margin:0 auto;padding:30px;background:#0c0e1a;border-radius:20px;font-family:Arial,sans-serif;text-align:center">' +
    '<div style="font-size:48px;margin-bottom:16px">🔑</div>' +
    '<h2 style="color:#f5d76e;letter-spacing:2px">Modify Password</h2>' +
    '<p style="color:#888;font-size:14px">Your verification code is</p>' +
    '<div style="font-size:36px;font-weight:800;color:#f5d76e;letter-spacing:8px;margin:16px 0">' + code + '</div>' +
    '<p style="color:#666;font-size:12px">Valid for 5 minutes. Ignore if not you.</p></div>');
  if (sent) res.json({ ok: true, msg: '验证码已发送到 ' + email });
  else res.json({ ok: false, msg: '邮件发送失败，请稍后重试' });
});

// 邮箱验证码修改密码（有密码可用旧密码验证，否则必须邮箱验证码）
app.post('/api/settings/change-password', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { code, newPassword: newPwd, oldPassword } = req.body;
  if (!newPwd) return res.json({ ok: false, msg: '新密码不能为空' });
  if (newPwd.length < 6) return res.json({ ok: false, msg: '新密码至少6位' });
  // 有旧密码时优先用旧密码验证
  if (ctx.userData.password && oldPassword) {
    const oldHash = crypto.createHash('sha256').update(oldPassword).digest('hex');
    if (oldHash !== ctx.userData.password) return res.json({ ok: false, msg: '旧密码错误' });
    ctx.userData.password = crypto.createHash('sha256').update(newPwd).digest('hex');
    saveDB(ctx.db);
    return res.json({ ok: true });
  }
  // 没有旧密码 → 必须用邮箱验证码
  if (!code) return res.json({ ok: false, msg: '请输入验证码' });
  const stored = ctx.db.smsCodes && ctx.db.smsCodes['pwd_' + req.session.user];
  if (!stored || stored.code !== code) return res.json({ ok: false, msg: '验证码错误' });
  if (Date.now() > stored.expires) return res.json({ ok: false, msg: '验证码已过期' });
  ctx.userData.password = crypto.createHash('sha256').update(newPwd).digest('hex');
  delete ctx.db.smsCodes['pwd_' + req.session.user];
  saveDB(ctx.db);
  res.json({ ok: true });
});

app.get('/api/settings/security', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  res.json({ ok: true, hasPassword: !!ctx.userData.password, hasEmail: !!ctx.userData.email, phone: ctx.userData.phone || '', created: ctx.userData.created, email: ctx.userData.email || '' });
});

// 更换邮箱 → 发验证码到新邮箱
app.post('/api/settings/send-email-code', async (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { email } = req.body;
  if (!email) return res.json({ ok: false, msg: '请输入新邮箱' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.json({ ok: false, msg: '邮箱格式不对' });
  // 检查邮箱是否已被占用
  if (Object.keys(ctx.db.users).some(k => k !== req.session.user && ctx.db.users[k].email === email)) {
    return res.json({ ok: false, msg: '该邮箱已被其他账号使用' });
  }
  const last = ctx.db.smsCodes && ctx.db.smsCodes['email_' + req.session.user];
  if (last && Date.now() - (last.sentAt || 0) < 60000) return res.json({ ok: false, msg: '请60秒后再试' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  if (!ctx.db.smsCodes) ctx.db.smsCodes = {};
  ctx.db.smsCodes['email_' + req.session.user] = { code, newEmail: email, expires: Date.now() + 300000, sentAt: Date.now() };
  saveDB(ctx.db);
  const sent = await sendEmail(email, '🌙 月光空间 - 更换邮箱',
    '<div style="max-width:400px;margin:0 auto;padding:30px;background:#0c0e1a;border-radius:20px;font-family:Arial,sans-serif;text-align:center">' +
    '<div style="font-size:48px;margin-bottom:16px">📧</div>' +
    '<h2 style="color:#f5d76e;letter-spacing:2px">更换邮箱</h2>' +
    '<p style="color:#888;font-size:14px">你的验证码是</p>' +
    '<div style="font-size:36px;font-weight:800;color:#f5d76e;letter-spacing:8px;margin:16px 0">' + code + '</div>' +
    '<p style="color:#666;font-size:12px">5分钟内有效，请勿泄露</p></div>');
  if (sent) res.json({ ok: true, msg: '验证码已发送到 ' + email });
  else res.json({ ok: false, msg: '邮件发送失败，请稍后重试' });
});

// 更换邮箱 → 验证码确认
app.post('/api/settings/verify-email', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { code } = req.body;
  if (!code) return res.json({ ok: false, msg: '请输入验证码' });
  const stored = ctx.db.smsCodes && ctx.db.smsCodes['email_' + req.session.user];
  if (!stored || stored.code !== code) return res.json({ ok: false, msg: '验证码错误' });
  if (Date.now() > stored.expires) return res.json({ ok: false, msg: '验证码已过期' });
  ctx.userData.email = stored.newEmail;
  // 如果用户有 em_ 开头的旧 key，迁移数据到新邮箱 key
  const oldKey = req.session.user;
  if (oldKey.startsWith('em_') && stored.newEmail) {
    ctx.db.users[stored.newEmail] = { ...ctx.userData };
    delete ctx.db.users[oldKey];
    req.session.user = stored.newEmail;
  }
  delete ctx.db.smsCodes['email_' + oldKey];
  saveDB(ctx.db);
  res.json({ ok: true, newEmail: stored.newEmail });
});

// 注销账号
app.post('/api/settings/delete-account', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { password } = req.body;
  // 如果有密码必须验证
  if (ctx.userData.password) {
    if (!password) return res.json({ ok: false, msg: '请输入密码确认' });
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (hash !== ctx.userData.password) return res.json({ ok: false, msg: '密码错误' });
  }
  const uid = req.session.user;
  // 清理所有相关数据
  delete ctx.db.users[uid];
  if (ctx.db.posts) ctx.db.posts = ctx.db.posts.filter(p => p.user !== uid);
  if (ctx.db.board) ctx.db.board = ctx.db.board.filter(b => b.user !== uid);
  if (ctx.db.secrets) ctx.db.secrets = ctx.db.secrets.filter(s => s.user !== uid);
  if (ctx.db.messages) ctx.db.messages = ctx.db.messages.filter(m => m.from !== uid && m.to !== uid);
  if (ctx.db.dms) ctx.db.dms = ctx.db.dms.filter(m => m.from !== uid && m.to !== uid);
  if (ctx.db.whispers) ctx.db.whispers = ctx.db.whispers.filter(w => w.from !== uid && w.to !== uid);
  if (ctx.db.guestbook) ctx.db.guestbook = ctx.db.guestbook.filter(g => g.from !== uid);
  if (ctx.db.cloud) delete ctx.db.cloud[uid];
  if (ctx.db.checkins) delete ctx.db.checkins[uid];
  saveDB(ctx.db);
  req.session.destroy();
  res.json({ ok: true });
});

// ==================== 天气 ====================

const weatherAgent = new http.Agent({ keepAlive: true });
app.get('/api/weather', (req, res) => {
  const { lat, lon, city } = req.query;
  let url;
  if (lat && lon) {
    url = `http://wttr.in/@${lat},${lon}?format=j1`;
  } else if (city) {
    url = `http://wttr.in/${encodeURIComponent(city)}?format=j1`;
  } else {
    url = `http://wttr.in/Beijing?format=j1`;
  }
  try {
    const wreq = http.get(url, { timeout: 10000, agent: weatherAgent }, (wres) => {
      let body = '';
      wres.on('data', chunk => body += chunk);
      wres.on('end', () => {
        try {
          const data = JSON.parse(body);
          const c = data.current_condition[0];
          res.json({
            ok: true,
            temp: c.temp_C,
            feelsLike: c.FeelsLikeC,
            humidity: c.humidity,
            windSpeed: c.windspeedKmph,
            desc: c.weatherDesc[0].value,
            code: c.weatherCode,
            uvIndex: c.uvIndex || '--',
            city: data.nearest_area?.[0]?.areaName?.[0]?.value || city || '北京'
          });
        } catch(e) { res.json({ ok: false, msg: '天气数据解析失败' }); }
      });
    });
    wreq.on('timeout', () => { wreq.destroy(); res.json({ ok: false, msg: '天气服务超时' }); });
    wreq.on('error', () => res.json({ ok: false, msg: '天气服务不可用' }));
  } catch(e) { res.json({ ok: false, msg: '天气服务异常' }); }
});

// ==================== 个人资料 ====================

app.post('/api/profile', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  const { nickname, bio } = req.body;
  if (nickname) ctx.userData.nickname = nickname;
  if (bio !== undefined) ctx.userData.bio = bio;
  saveDB(ctx.db);
  res.json({ ok: true });
});

app.post('/api/avatar', upload.single('avatar'), (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!req.file) return res.json({ ok: false, msg: '请选择图片' });
  ctx.userData.avatar = '/uploads/' + req.file.filename;
  saveDB(ctx.db);
  res.json({ ok: true, url: ctx.userData.avatar });
});

// ==================== 云盘（简易） ====================

const cloudDir = path.join(__dirname, 'public', 'cloud');
if (!fs.existsSync(cloudDir)) fs.mkdirSync(cloudDir, { recursive: true });

app.post('/api/cloud/upload', cloudUpload.single('file'), (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!req.file) return res.json({ ok: false, msg: '请选择文件' });
  if (!ctx.db.cloud) ctx.db.cloud = {};
  if (!ctx.db.cloud[req.session.user]) ctx.db.cloud[req.session.user] = [];
  const ext = path.extname(req.file.originalname).toLowerCase();
  let category = 'file';
  if (['.jpg','.jpeg','.png','.gif','.webp'].includes(ext)) category = 'image';
  else if (['.mp4','.mov','.avi','.webm'].includes(ext)) category = 'video';
  else if (['.mp3','.wav','.ogg','.flac','.m4a'].includes(ext)) category = 'audio';
  const fileObj = {
    id: Date.now(), name: Buffer.from(req.file.originalname, 'latin1').toString('utf8'), path: '/cloud/' + req.file.filename,
    size: req.file.size, time: Date.now(), mimetype: req.file.mimetype, category
  };
  ctx.db.cloud[req.session.user].push(fileObj);
  saveDB(ctx.db);
  res.json({ ok: true, file: fileObj });
});

app.get('/api/cloud/files', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.db.cloud) ctx.db.cloud = {};
  if (!Array.isArray(ctx.db.cloud[req.session.user])) ctx.db.cloud[req.session.user] = [];
  const category = req.query.category || 'all';
  let files = ctx.db.cloud[req.session.user] || [];
  if (category !== 'all') files = files.filter(f => f.category === category);
  res.json({ ok: true, files });
});

app.get('/api/cloud/info', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.db.cloud) ctx.db.cloud = {};
  const files = ctx.db.cloud[req.session.user] || [];
  const totalSize = files.reduce((a, f) => a + (f.size || 0), 0);
  const maxSize = 200 * 1024 * 1024;
  const usedPercent = Math.min(100, Math.round(totalSize / maxSize * 100));
  const counts = { image: 0, video: 0, audio: 0, file: 0 };
  files.forEach(f => {
    const cat = f.category || 'file';
    if (counts[cat] !== undefined) counts[cat]++;
  });
  res.json({ ok: true, fileCount: files.length, totalSize, maxSize, usedPercent, counts });
});

app.post('/api/cloud/delete/:id', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.db.cloud?.[req.session.user]) return res.json({ ok: false });
  ctx.db.cloud[req.session.user] = ctx.db.cloud[req.session.user].filter(f => String(f.id) !== String(req.params.id));
  saveDB(ctx.db);
  res.json({ ok: true });
});

app.get('/api/cloud/download/:id', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.db.cloud?.[req.session.user]) return res.json({ ok: false, msg: '云盘为空' });
  const file = ctx.db.cloud[req.session.user].find(f => String(f.id) === String(req.params.id));
  if (!file) return res.json({ ok: false, msg: '文件不存在' });
  const filePath = path.join(__dirname, 'public', 'cloud', path.basename(file.path));
  if (!fs.existsSync(filePath)) return res.json({ ok: false, msg: '文件已过期或被删除' });
  if (!res.headersSent) res.download(filePath, file.name);
});

app.post('/api/cloud/share/:id', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.db.cloud?.[req.session.user]) return res.json({ ok: false, msg: '云盘为空' });
  const userCloud = ctx.db.cloud[req.session.user];
  console.log('CLOUD_SHARE cloud ids:', userCloud.map(f => ({id: f.id, type: typeof f.id})));
  console.log('CLOUD_SHARE req.params.id:', req.params.id, 'type:', typeof req.params.id);
  const file = userCloud.find(f => String(f.id) === String(req.params.id));
  if (!file) return res.json({ ok: false, msg: '文件不存在' });
  const shareKey = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  file.shareKey = shareKey;
  const pw = (req.body.password || '').trim();
  if (pw) file.sharePassword = pw;
  else delete file.sharePassword;
  saveDB(ctx.db);
  res.json({ ok: true, url: '/s/' + shareKey, hasPassword: !!pw });
});

app.post('/api/cloud/unshare/:id', (req, res) => {
  const ctx = auth(req, res); if (!ctx) return;
  if (!ctx.db.cloud?.[req.session.user]) return res.json({ ok: false, msg: '云盘为空' });
  const file = ctx.db.cloud[req.session.user].find(f => String(f.id) === String(req.params.id));
  if (!file) return res.json({ ok: false, msg: '文件不存在' });
  delete file.shareKey;
  delete file.sharePassword;
  saveDB(ctx.db);
  res.json({ ok: true });
});

// ===== 分享文件页面 + 下载（无需登录） =====
function sharePage(file, key, error) {
  const pwStr = file.sharePassword ? '🔒 密码保护' : '🌐 公开分享';
  const iconMap = { image: '🖼️', video: '🎬', audio: '🎵', file: '📄' };
  const icon = iconMap[file.category] || '📄';
  const sizeStr = file.size > 1048576 ? (file.size / 1048576).toFixed(1) + ' MB' : file.size > 1024 ? (file.size / 1024).toFixed(1) + ' KB' : file.size + ' B';
  const pwInput = file.sharePassword ? `<div style="margin:20px 0"><input id="pw" type="password" placeholder="请输入提取密码" style="width:100%;padding:12px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#fff;font-size:15px;box-sizing:border-box;margin-bottom:12px"><div id="pwError" style="color:#ff6b6b;font-size:13px;margin-bottom:8px;display:none">${error||'密码错误'}</div><button onclick="verifyPw()" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#f5d76e,#d4b84a);color:#1a1040;font-weight:bold;font-size:15px;cursor:pointer">🔓 提取文件</button></div>` : `<a href="/s/${key}?dl=1" style="display:inline-block;margin-top:24px;padding:14px 40px;border-radius:14px;border:none;background:linear-gradient(135deg,#6bffb8,#3dd68c);color:#0a1a10;font-weight:bold;font-size:16px;cursor:pointer;text-decoration:none">⬇️ 下载文件</a>`;
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${file.name} - 月光空间</title><style>*{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:linear-gradient(135deg,#0f0f1a 0%,#1a1040 100%);color:#fff;margin:0;padding:20px}.card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:24px;padding:40px 32px;text-align:center;max-width:400px;width:100%;backdrop-filter:blur(20px)}.file-icon{font-size:56px;margin-bottom:16px}.file-name{font-size:16px;font-weight:600;word-break:break-all;margin-bottom:8px;line-height:1.4}.file-meta{font-size:13px;color:rgba(255,255,255,.5);margin-bottom:4px}.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;margin-top:12px;background:rgba(245,215,110,.12);color:#f5d76e}.footer{margin-top:24px;font-size:12px;color:rgba(255,255,255,.3)}.footer a{color:rgba(255,255,255,.5);text-decoration:none}input:focus{outline:none;border-color:#f5d76e!important}</style></head><body><div class="card"><div class="file-icon">${icon}</div><div class="file-name">${file.name}</div><div class="file-meta">${sizeStr} · ${new Date(file.time).toLocaleDateString('zh-CN')}</div><div class="badge">${pwStr}</div>${pwInput}<div class="footer">🌙 月光空间 · 安全分享</div></div><script>function verifyPw(){const pw=document.getElementById('pw').value;if(!pw)return;location.search='?pw='+encodeURIComponent(pw)}</script></body></html>`;
}

app.get('/s/:key', (req, res) => {
  const db = loadDB();
  if (!db.cloud) return res.status(404).send('文件不存在或已被删除');
  let file = null;
  for (const uid in db.cloud) { const f = db.cloud[uid].find(x => x.shareKey === req.params.key); if (f) { file = f; break; } }
  if (!file) return res.status(404).send('<h1 style="text-align:center;color:#fff;font-family:sans-serif;padding-top:40vh">📂 文件不存在或已被删除</h1>');
  const filePath = path.join(__dirname, 'public', 'cloud', path.basename(file.path));
  if (!fs.existsSync(filePath)) return res.status(404).send('<h1 style="text-align:center;color:#fff;font-family:sans-serif;padding-top:40vh">📂 文件已过期</h1>');
  // 密码保护：验证或显示密码页
  if (file.sharePassword) {
    if (req.query.pw === file.sharePassword ) {
      res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
      return res.download(filePath, file.name);
    }
    return res.send(sharePage(file, req.params.key, req.query.pw ? '密码错误，请重试' : null));
  }
  // 公开分享：?dl=1 触发下载，否则展示页面
  if (req.query.dl === "1") {
    res.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    return res.download(filePath, file.name);
  }
  res.send(sharePage(file, req.params.key));
});

// ==================== 静态文件（禁用缓存） ====================
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, p) => {
    if (p.endsWith('.html') || p.endsWith('.js')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
  }
}));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌙 月光空间 v4 已启动 → http://0.0.0.0:${PORT}`);
  console.log(`   外网: http://你的服务器IP:${PORT}`);
  console.log(`   音乐API: ${MUSIC_API}`);
  backupDB();
});

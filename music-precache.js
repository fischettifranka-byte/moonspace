#!/usr/bin/env node
// 月光空间 - 音乐预缓存脚本 v2（带VIP Cookie）
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(__dirname, 'music-cache');
const MAX_SIZE = 10 * 1024 * 1024 * 1024; // 10GB
const API_BASE = 'http://127.0.0.1:3000';

// 读取VIP Cookie
let COOKIE = '';
try {
  const startSh = fs.readFileSync(path.join(__dirname, 'start.sh'), 'utf8');
  const match = startSh.match(/NETEASE_MUSIC_U=(.+)/);
  if (match) COOKIE = 'MUSIC_U=' + match[1].trim();
} catch(e) {}

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

function getCacheSize() {
  let size = 0;
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const f of files) {
      try { size += fs.statSync(path.join(CACHE_DIR, f)).size; } catch(e) {}
    }
  } catch(e) {}
  return size;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { timeout: 15000, headers: { Cookie: COOKIE } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout: 60000 }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const ws = fs.createWriteStream(dest);
      res.pipe(ws);
      ws.on('finish', () => { ws.close(); resolve(true); });
      ws.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function getSongUrl(id) {
  try {
    const data = await httpGet(`${API_BASE}/song/url?id=${id}&br=320000`);
    if (data.code === 200 && data.data?.[0]?.url) return data.data[0].url;
    // 尝试不同品质
    for (const q of ['standard','higher','exhigh','lossless']) {
      try {
        const d2 = await httpGet(`${API_BASE}/song/url?id=${id}&level=${q}`);
        if (d2.code === 200 && d2.data?.[0]?.url) return d2.data[0].url;
      } catch(e) {}
    }
  } catch(e) {}
  return null;
}

async function getHotSongIds() {
  const ids = new Set();
  
  // 1. 热搜
  try {
    const hot = await httpGet(`${API_BASE}/search/hot`);
    if (hot.result?.hots) {
      for (const h of hot.result.hots.slice(0, 20)) {
        try {
          const s = await httpGet(`${API_BASE}/cloudsearch?keywords=${encodeURIComponent(h.first)}&limit=10`);
          if (s.result?.songs) s.result.songs.forEach(song => ids.add(song.id));
        } catch(e) {}
        await new Promise(r => setTimeout(r, 300));
      }
    }
  } catch(e) { console.log('热搜失败:', e.message); }

  // 2. 新歌速递
  try {
    const newsongs = await httpGet(`${API_BASE}/top/song?type=0`);
    if (newsongs.data) newsongs.data.slice(0, 100).forEach(s => ids.add(s.id));
  } catch(e) {}

  // 3. 热门歌单
  try {
    const playlists = await httpGet(`${API_BASE}/top/playlist?limit=15&order=hot`);
    if (playlists.playlists) {
      for (const pl of playlists.playlists.slice(0, 12)) {
        try {
          const detail = await httpGet(`${API_BASE}/playlist/detail?id=${pl.id}`);
          if (detail.playlist?.tracks) {
            detail.playlist.tracks.slice(0, 50).forEach(t => ids.add(t.id));
          }
        } catch(e) {}
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch(e) {}

  // 4. 搜索关键词
  const keywords = ['周杰伦','林俊杰','陈奕迅','薛之谦','邓紫棋','毛不易','周深',
    '华语流行','抖音热歌','经典老歌','粤语经典','民谣','说唱','电子','古风',
    '韩语','日语','英文歌','纯音乐','轻音乐','钢琴','吉他','动漫','游戏',
    'Taylor Swift','Ed Sheeran','Adele','Bruno Mars','The Weeknd',
    'BLACKPINK','BTS','IU','YOASOBI','米津玄師'];
  for (const kw of keywords) {
    try {
      const s = await httpGet(`${API_BASE}/cloudsearch?keywords=${encodeURIComponent(kw)}&limit=15`);
      if (s.result?.songs) s.result.songs.forEach(song => ids.add(song.id));
    } catch(e) {}
    await new Promise(r => setTimeout(r, 300));
  }

  // 5. 推荐歌单详情
  try {
    const top = await httpGet(`${API_BASE}/personalized?limit=10`);
    if (top.result) {
      for (const pl of top.result.slice(0, 8)) {
        try {
          const detail = await httpGet(`${API_BASE}/playlist/detail?id=${pl.id}`);
          if (detail.playlist?.tracks) {
            detail.playlist.tracks.slice(0, 30).forEach(t => ids.add(t.id));
          }
        } catch(e) {}
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch(e) {}

  return Array.from(ids);
}

async function main() {
  console.log('🎵 月光空间 - 音乐预缓存 v2（VIP Cookie）');
  console.log('================================');
  console.log('Cookie:', COOKIE ? '已配置' : '未配置');
  
  const currentSize = getCacheSize();
  const cachedCount = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.mp3')).length;
  console.log(`📦 已缓存: ${cachedCount} 首, ${(currentSize/1024/1024).toFixed(1)}MB`);
  
  if (currentSize >= MAX_SIZE) {
    console.log('✅ 缓存已满');
    return;
  }

  console.log('🔍 收集热门歌曲ID...');
  const songIds = await getHotSongIds();
  console.log(`📋 共找到 ${songIds.length} 首候选歌曲`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const id of songIds) {
    if (getCacheSize() >= MAX_SIZE) {
      console.log(`\n💾 缓存已达到上限`);
      break;
    }

    const cacheFile = path.join(CACHE_DIR, id + '.mp3');
    if (fs.existsSync(cacheFile)) { skipped++; continue; }

    try {
      const url = await getSongUrl(id);
      if (!url) { failed++; continue; }
      
      await downloadFile(url, cacheFile);
      const size = fs.statSync(cacheFile).size;
      if (size < 10000) { fs.unlinkSync(cacheFile); failed++; continue; }
      
      downloaded++;
      const totalMB = (getCacheSize()/1024/1024).toFixed(1);
      process.stdout.write(`\r📥 已下载 ${downloaded} 首 | 跳过 ${skipped} | 失败 ${failed} | 总计 ${totalMB}MB`);
    } catch(e) {
      failed++;
      try { if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile); } catch(e2) {}
    }
    
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\n\n✅ 缓存完成！`);
  console.log(`   下载: ${downloaded} 首`);
  console.log(`   跳过: ${skipped} 首`);
  console.log(`   失败: ${failed} 首`);
  console.log(`   总大小: ${(getCacheSize()/1024/1024).toFixed(1)}MB`);
}

main().catch(e => console.error('错误:', e));

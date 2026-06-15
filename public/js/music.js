// ===== 音乐 =====
function switchMusicTab(tab){
  currentMusicTab=tab;
  document.querySelectorAll('#pageMusic .music-tab').forEach(t=>t.classList.toggle('active',t.textContent.includes(tab==='discover'?'发现':tab==='search'?'搜索':'收藏')));
  if(tab==='discover')loadDiscover();
  if(tab==='search')document.getElementById('musicContent').innerHTML='';
  if(tab==='favorites')loadFavorites();
}
let discoverNewSongs=[];
async function loadDiscover(){
  const el=document.getElementById('musicContent');el.innerHTML='<div class="loading">加载中</div>';
  let html='';
  // 🌟 每日推荐 - 这些歌保证可播放
  try{const daily=await api('/api/music/daily');if(daily.ok&&daily.songs?.length){discoverDailySongs=daily.songs;html+='<div style="padding:12px 12px 4px;font-size:13px;color:var(--gold)">🌟 每日推荐（可播放）</div>';html+=daily.songs.slice(0,20).map((s,i)=>'<div class="song-item" onclick="playDiscoverDaily('+i+')"><div class="song-idx">'+(i+1)+'</div><img class="song-cover" src="'+(s.cover||'')+'" onerror="this.style.display=\'none\'"><div class="song-info"><div class="song-name">'+esc(s.name)+'</div><div class="song-artist">'+esc(s.artists)+'</div></div></div>').join('')}}catch(e){}
  try{const hot=await api('/api/music/hot');if(hot.ok&&hot.hots?.length){html+='<div style="padding:12px 12px 4px;font-size:13px;color:var(--text2)">🔥 热搜</div><div class="hot-tags">'+hot.hots.map(h=>'<span class="hot-tag" onclick="document.getElementById(\'musicSearchInput\').value=\''+esc(h).replace(/'/g,"\'")+'\';switchMusicTab(\'search\');searchMusic()">'+esc(h)+'</span>').join('')+'</div>'}}catch(e){}
  el.innerHTML=html||'<div class="loading">加载中...</div>';
  try{const newSongs=await api('/api/music/newsongs');if(newSongs.ok&&newSongs.songs?.length){discoverNewSongs=newSongs.songs;html+='<div style="padding:12px 12px 4px;font-size:13px;color:var(--text2)">🆕 新歌速递</div>';html+=newSongs.songs.map((s,i)=>'<div class="song-item" onclick="playDiscoverSong('+i+')"><div class="song-idx">'+(i+1)+'</div><img class="song-cover" src="'+(s.cover||'')+'" onerror="this.style.display=\'none\'"><div class="song-info"><div class="song-name">'+esc(s.name)+'</div><div class="song-artist">'+esc(s.artists)+'</div></div><span class="song-fav" onclick="event.stopPropagation();favDiscoverSong('+i+')">🤍</span></div>').join('')}}catch(e){}
  el.innerHTML=html||'<div class="loading">加载中...</div>';
  try{const playlists=await api('/api/music/playlists');if(playlists.ok&&playlists.playlists?.length){html+='<div style="padding:12px 12px 4px;font-size:13px;color:var(--text2)">🎶 热门歌单</div><div class="playlist-grid">'+playlists.playlists.map(p=>'<div class="playlist-item" onclick="loadPlaylistTracks('+p.id+')"><img src="'+(p.cover||'')+'" onerror="this.style.display=\'none\'"><div class="pl-name">'+esc(p.name)+'</div><div class="pl-count">▶ '+((p.playCount||0)/10000).toFixed(1)+'万</div></div>').join('')+'</div>'}}catch(e){}
  el.innerHTML=html||'<div class="empty-msg">暂无内容</div>';
}
function playDiscoverDaily(i){if(discoverDailySongs[i]){playlist=[discoverDailySongs[i]];currentSong=0;startPlay()}}

function playDiscoverSong(i){if(discoverNewSongs[i]){playlist=[discoverNewSongs[i]];currentSong=0;startPlay()}}
function favDiscoverSong(i){if(discoverNewSongs[i])favSong(discoverNewSongs[i])}
async function searchMusic(){
  const kw=document.getElementById('musicSearchInput').value.trim();if(!kw)return;
  document.getElementById('musicContent').innerHTML='<div class="loading">搜索中</div>';
  const d=await api('/api/music/search?keywords='+encodeURIComponent(kw));
  if(d.ok&&d.songs?.length){playlist=d.songs;document.getElementById('musicContent').innerHTML=d.songs.map((s,i)=>`<div class="song-item" id="song_${s.id}" onclick="playSongFromList(${i})"><div class="song-idx">${i+1}</div><img class="song-cover" src="${s.cover||''}" onerror="this.style.display='none'"><div class="song-info"><div class="song-name">${esc(s.name)}</div><div class="song-artist">${esc(s.artists)}</div></div><span class="song-fav" onclick="event.stopPropagation();favSong(playlist[${i}])">🤍</span></div>`).join('')}else document.getElementById('musicContent').innerHTML='<div class="empty-msg">'+(d.msg||'没有找到')+'</div>';
}
async function loadPlaylistTracks(id){document.getElementById('musicContent').innerHTML='<div class="loading">加载中</div>';const d=await api('/api/music/playlist/'+id);if(d.ok&&d.tracks.length){playlist=d.tracks;document.getElementById('musicContent').innerHTML=`<div style="display:flex;align-items:center;gap:10px;padding:12px"><button onclick="switchMusicTab('discover');loadDiscover()" style="background:none;border:1px solid var(--border);border-radius:10px;color:var(--text2);font-size:13px;padding:6px 12px;cursor:pointer;font-family:inherit">← 返回</button><span style="font-size:14px;color:var(--gold)">🎶 ${esc(d.name)} (${d.tracks.length}首)</span></div>`+d.tracks.map((s,i)=>`<div class="song-item" id="song_${s.id}" onclick="playSongFromList(${i})"><div class="song-idx">${i+1}</div><img class="song-cover" src="${s.cover}" onerror="this.style.display='none'"><div class="song-info"><div class="song-name">${esc(s.name)}</div><div class="song-artist">${esc(s.artists)}</div></div></div>`).join('')}else document.getElementById('musicContent').innerHTML='<div class="empty-msg">加载失败</div>'}
function loadHistoryList(){
  const h=getPlayHistory();
  if(h.length){
    playlist=h;
    let html='<div style="padding:12px;font-size:14px;color:var(--gold)">📜 播放历史 ('+h.length+'首)</div>';
    html+=h.map((s,i)=>'<div class="song-item" onclick="playSongFromList('+i+')"><div class="song-idx">'+(i+1)+'</div><img class="song-cover" src="'+(s.cover||'')+'" ><div class="song-info"><div class="song-name">'+esc(s.name)+'</div><div class="song-artist">'+esc(s.artists)+'</div></div><span style="font-size:10px;color:var(--text3)">'+fmtTime(s.time)+'</span></div>').join('');
    document.getElementById('musicContent').innerHTML=html;
  }else document.getElementById('musicContent').innerHTML='<div class="empty-msg">还没有播放历史 🎧</div>';
}
async function loadFavorites(){const d=await api('/api/music/favorites');if(d.ok&&d.list?.length){playlist=d.list;document.getElementById('musicContent').innerHTML=d.list.map((s,i)=>`<div class="song-item" onclick="playSongFromList(${i})"><div class="song-idx">${i+1}</div><img class="song-cover" src="${s.cover||''}" onerror="this.style.display='none'"><div class="song-info"><div class="song-name">${esc(s.name)}</div><div class="song-artist">${esc(s.artists)}</div></div><span class="song-fav" onclick="event.stopPropagation();favSong(playlist[${i}])">❤️</span></div>`).join('')}else document.getElementById('musicContent').innerHTML='<div class="empty-msg">还没有收藏歌曲 🎧</div>'}
async function favSong(song){const d=await api('/api/music/favorite',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({song})});if(d.ok){toast(d.list.find(s=>s.id===song.id)?'已收藏 ❤️':'已取消收藏');if(d.newAchievements)d.newAchievements.forEach(a=>showAchievementPopup(a))}}
async function playSong(song){
  addToHistory(song);
  // 如果当前歌单里有这首歌，直接播放它
  const idx=playlist.findIndex(s=>s.id===song.id);
  if(idx>=0){currentSong=idx;await startPlay()}
  else{playlist=[song];currentSong=0;await startPlay()}
}
function playSongFromList(i){currentSong=i;startPlay()}
async function startPlay(){addToHistory(playlist[currentSong]);
  let skipped = 0;
  while(currentSong<playlist.length){
    const song=playlist[currentSong];
    document.getElementById("exName").textContent=song.name;
    document.getElementById("exArtist").textContent=song.artists;
    document.getElementById("exCover").src=song.cover||"";
    document.getElementById("fpName").textContent=song.name;
    document.getElementById("fpArtist").textContent=song.artists;
    document.getElementById("fpCover").src=song.cover||"";
    document.getElementById("floatPlayer").classList.add("show");
    var dp=document.getElementById("dsMiniPlayer");if(dp){dp.style.display="block";document.getElementById("dsCover").src=song.cover||"";document.getElementById("dsName").textContent=song.name;document.getElementById("dsArtist").textContent=song.artists}
    document.getElementById("fpMiniCover").src=song.cover||"";
    document.querySelectorAll(".song-item").forEach(el=>el.classList.remove("playing"));
    const el=document.getElementById("song_"+song.id)||document.getElementById("exsong_"+song.id);if(el)el.classList.add("playing");
    const urlEndpoint=musicSource==="free"?"/api/music/free-url/":"/api/music/url/";
    try{
      const d=await api(urlEndpoint+song.id+"?quality="+musicQuality);
      if(d.ok&&d.url){
        const audio=document.getElementById("audioPlayer");
        audio.src=d.url;
        try{await audio.play();isPlaying=true;updatePlayBtns();loadLyric(song.id);if(skipped>0)toast("已跳过"+skipped+"首无版权歌曲 ⏭️");return}
        catch(e){console.log("播放失败:",e.message)}
      }
    }catch(e){console.log("API请求失败:",e.message)}
    skipped++;currentSong++;
  }
  currentSong=0;isPlaying=false;updatePlayBtns();toast("⏭️ 当前歌单"+playlist.length+"首均无播放版权");
}
function updatePlayBtns(){document.getElementById('exPlayBtn').textContent=isPlaying?'⏸':'▶';document.getElementById('fpPlayBtn').textContent=isPlaying?'⏸':'▶';document.getElementById('fpMiniPlay').textContent=isPlaying?'⏸':'▶';document.getElementById('exCover').src=document.getElementById('fpCover').src||'';const fp=document.getElementById('floatPlayer');if(isPlaying){fp.classList.add('playing');fp.classList.remove('paused')}else{fp.classList.add('paused');fp.classList.remove('playing')}}
function togglePlay(){const audio=document.getElementById('audioPlayer');if(!audio.src)return;if(isPlaying){audio.pause();isPlaying=false}else{audio.play();isPlaying=true}updatePlayBtns()}
function playPrev(){
  if(currentSong>0){currentSong--;startPlay()}
  else{
    const h=getPlayHistory();
    if(h.length>1){
      const curId=playlist[currentSong]?.id;
      const idx=h.findIndex(s=>s.id===curId);
      if(idx>0){playlist=[h[idx-1]];currentSong=0;startPlay();return}
    }
  }
}
function playNext(){
  if(currentSong<playlist.length-1){currentSong++;startPlay()}
  else{
    // 从历史中找下一首
    const h=getPlayHistory();
    if(h.length>1){
      const curId=playlist[currentSong]?.id;
      const idx=h.findIndex(s=>s.id===curId);
      if(idx>=0&&idx<h.length-1){playlist=[h[idx+1]];currentSong=0;startPlay();return}
      if(idx===-1&&h.length){playlist=[h[0]];currentSong=0;startPlay();return}
    }
    isPlaying=false;updatePlayBtns()
  }
}
function onTimeUpdate(){const audio=document.getElementById('audioPlayer');if(!audio.duration)return;const pct=audio.currentTime/audio.duration*100;document.getElementById('fpRange').value=pct;document.getElementById('exRange').value=pct;document.getElementById('fpTimeNow').textContent=fmtDuration(audio.currentTime*1000);document.getElementById('exTimeNow').textContent=fmtDuration(audio.currentTime*1000);if(lrcLines.length){let idx=-1;for(let i=0;i<lrcLines.length;i++){if(lrcLines[i].time<=audio.currentTime)idx=i;else break}if(idx!==currentLrcIdx){currentLrcIdx=idx;highlightLrc(idx)}}}
function onMetadata(){document.getElementById('fpTimeTotal').textContent=fmtDuration(document.getElementById('audioPlayer').duration*1000);document.getElementById('exTimeTotal').textContent=fmtDuration(document.getElementById('audioPlayer').duration*1000)}
function seekTo(pct){const audio=document.getElementById('audioPlayer');if(audio.duration)audio.currentTime=audio.duration*pct/100}
async function loadLyric(id){lrcLines=[];currentLrcIdx=-1;document.getElementById('fpLyric').innerHTML='<div style="color:var(--text3)">加载歌词中...</div>';const d=await api('/api/music/lyric/'+id);if(d.ok&&d.lyric){lrcLines=parseLrc(d.lyric);document.getElementById('fpLyric').innerHTML=lrcLines.map((l,i)=>`<div class="lrc-line" data-idx="${i}">${esc(l.text)}</div>`).join('')||'<div style="color:var(--text3)">暂无歌词</div>'}else document.getElementById('fpLyric').innerHTML='<div style="color:var(--text3)">暂无歌词</div>'}
function parseLrc(txt){const lines=txt.split('\n').filter(l=>l.trim());const result=[];for(const line of lines){const m=line.match(/\[(\d+):(\d+\.?\d*)\](.*)/);if(m)result.push({time:parseFloat(m[1])*60+parseFloat(m[2]),text:m[3].trim()})}result.sort((a,b)=>a.time-b.time);return result}
function highlightLrc(idx){document.querySelectorAll('.lrc-line').forEach((el,i)=>{el.className=i===idx?'lrc-line lrc-active':'lrc-line'});const active=document.querySelector('.lrc-active');if(active)active.scrollIntoView({behavior:'smooth',block:'center'})}
// === 可展开悬浮面板逻辑 ===
let exExpanded=false;
function openExPlayer(){
  var p=document.getElementById('exPlayer');
  p.classList.remove('expanded');
  p.classList.add('collapsed','show');
  document.getElementById('exPlayerOverlay').classList.add('show');
  exExpanded=false;
  var btn=document.getElementById('exExpandBtn');if(btn)btn.textContent='▲ 展开';
  renderExPlaylist();
}
function closeExPlayer(){
  var p=document.getElementById('exPlayer');
  p.classList.remove('show','expanded');
  p.classList.add('collapsed');
  document.getElementById('exPlayerOverlay').classList.remove('show');
  exExpanded=false;
  var btn=document.getElementById('exExpandBtn');if(btn)btn.textContent='▲ 展开';
}
function toggleExExpand(){
  const p=document.getElementById('exPlayer');
  const btn=document.getElementById('exExpandBtn');
  if(exExpanded){collapseExPlayer(p);if(btn)btn.textContent='▲ 展开'}
  else{expandExPlayer(p);if(btn)btn.textContent='▼ 收起'}
}
function expandExPlayer(p){
  p.classList.remove('collapsed');p.classList.add('expanded');exExpanded=true;
  var btn=document.getElementById('exExpandBtn');if(btn)btn.textContent='▼ 收起';
  renderExPlaylist();
}
function collapseExPlayer(p){
  p.classList.remove('expanded');p.classList.add('collapsed');exExpanded=false;
  var btn=document.getElementById('exExpandBtn');if(btn)btn.textContent='▲ 展开';
}
// === 拖拽展开/收起 1/3 播放器 ===
(function initExDrag(){
  const panel=document.getElementById('exPlayer');
  const dragTargets=[document.getElementById('exHandle'),panel.querySelector('.ex-compact')];
  let startY=0,startT=0,dragging=false;
  function onDown(e){
    if(panel.classList.contains('expanded')&&e.target.closest('.ex-body,.ex-tabs,.ex-search-row,.ex-progress'))return;
    startY=e.touches?e.touches[0].clientY:e.clientY;
    startT=parseFloat((panel.style.transform.match(/-?[\d.]+/)||[0])[0]);
    dragging=true;panel.style.transition='none';
  }
  function onMove(e){
    if(!dragging)return;
    const y=e.touches?e.touches[0].clientY:e.clientY;
    const dy=Math.max(0,startY-y+startT);
    panel.style.transform='translateY('+dy+'px)';
    if(!exExpanded&&dy>80){expandExPlayer(panel);dragging=false;panel.style.transition='';panel.style.transform=''}
    if(exExpanded&&dy<-20){collapseExPlayer(panel);dragging=false;panel.style.transition='';panel.style.transform=''}
  }
  function onUp(){
    if(!dragging)return;dragging=false;panel.style.transition='';panel.style.transform='';
  }
  dragTargets.forEach(function(el){
    if(!el)return;
    el.addEventListener('touchstart',onDown,{passive:false});
    el.addEventListener('touchmove',onMove,{passive:false});
    el.addEventListener('touchend',onUp);
    el.addEventListener('mousedown',onDown);
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
})();
let exCurrentTab='playlist';
function switchExTab(tab){
  exCurrentTab=tab;
  document.querySelectorAll('#exTabs .ex-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===tab));
  document.getElementById('exSearchRow').style.display=tab==='search'?'flex':'none';
  renderExPlaylist();
}
async function renderExPlaylist(){
  const el=document.getElementById('exList');
  if(!el)return;
  if(exCurrentTab==='playlist'){
    if(playlist.length){
      el.innerHTML=playlist.map((s,i)=>'<div class="song-item" id="exsong_'+s.id+'" onclick="playSongFromList('+i+')"><div class="song-idx">'+(i+1)+'</div><img class="song-cover" src="'+(s.cover||'')+'" onerror="this.style.display=\'none\'"><div class="song-info"><div class="song-name">'+esc(s.name)+'</div><div class="song-artist">'+esc(s.artists)+'</div></div><span class="song-fav" onclick="event.stopPropagation();favSong(playlist['+i+'])">🤍</span></div>').join('');
    }else el.innerHTML='<div class="ex-empty">🎶 歌单为空，搜首歌听听吧</div>';
  }else if(exCurrentTab==='history'){
    const h=getPlayHistory();
    if(h.length){el.innerHTML=h.map((s,i)=>'<div class="song-item" onclick="playHistoryFromList('+i+')"><div class="song-idx">'+(i+1)+'</div><img class="song-cover" src="'+(s.cover||'')+'" onerror="this.style.display=\'none\'"><div class="song-info"><div class="song-name">'+esc(s.name)+'</div><div class="song-artist">'+esc(s.artists)+'</div></div><span style="font-size:10px;color:var(--text3)">'+fmtTime(s.time)+'</span></div>').join('')}
    else el.innerHTML='<div class="ex-empty">🕐 还没有播放历史</div>';
  }else if(exCurrentTab==='favorites'){
    el.innerHTML='<div class="loading">加载中</div>';
    try{const d=await api('/api/music/favorites');if(d.ok&&d.list?.length){favList=d.list;el.innerHTML=d.list.map((s,i)=>'<div class="song-item" onclick="playFavFromList('+i+')"><div class="song-idx">'+(i+1)+'</div><img class="song-cover" src="'+(s.cover||'')+'" onerror="this.style.display=\'none\'"><div class="song-info"><div class="song-name">'+esc(s.name)+'</div><div class="song-artist">'+esc(s.artists)+'</div></div><span class="song-fav" onclick="event.stopPropagation();favSong(favList['+i+'])">❤️</span></div>').join('')}else el.innerHTML='<div class="ex-empty">❤️ 还没有收藏歌曲</div>'}catch(e){el.innerHTML='<div class="ex-empty">加载失败</div>'}
  }
}
let favList=[];
async function loadFavList(){try{const d=await api('/api/music/favorites');if(d.ok)d.list&&(favList=d.list)}catch(e){}}
function playHistoryFromList(i){const h=getPlayHistory();if(h[i]){playlist=[h[i]];currentSong=0;startPlay()}}
function playFavFromList(i){if(favList[i]){playlist=[favList[i]];currentSong=0;startPlay()}}
async function exSearch(){
  const kw=document.getElementById('exSearchInput').value.trim();if(!kw)return;
  document.getElementById('exList').innerHTML='<div class="loading">搜索中</div>';
  const d=await api('/api/music/search?keywords='+encodeURIComponent(kw));
  if(d.ok&&d.songs?.length){playlist=d.songs;document.getElementById('exList').innerHTML=d.songs.map((s,i)=>'<div class="song-item" id="exsong_'+s.id+'" onclick="playSongFromList('+i+')"><div class="song-idx">'+(i+1)+'</div><img class="song-cover" src="'+(s.cover||'')+'" onerror="this.style.display=\'none\'"><div class="song-info"><div class="song-name">'+esc(s.name)+'</div><div class="song-artist">'+esc(s.artists)+'</div></div><span class="song-fav" onclick="event.stopPropagation();favSong(playlist['+i+'])">🤍</span></div>').join('')}
  else document.getElementById('exList').innerHTML='<div class="ex-empty">没有找到</div>';
}
function openFullPlayer(){document.getElementById('fullPlayer').classList.add('show')}
function closeFullPlayer(){document.getElementById('fullPlayer').classList.remove('show');document.getElementById('fpMiniCover').src=document.getElementById('fpCover').src||''}
async function favCurrent(){if(currentSong>=0&&currentSong<playlist.length)await favSong(playlist[currentSong])}



// ===== 导航 =====
// ===== 右侧挂件栏桌面端 =====
function loadDeskSidebar(){
  var ds=document.getElementById('deskSidebar');
  if(!ds||window.innerWidth<768)return;
  // 天气
  loadWeatherDesk();
  // 热榜
  loadTrendingDesk();
  // 签到状态
  loadCheckinDesk();
}
async function loadWeatherDesk(){
  var el=document.getElementById('dsWeather');
  if(!el)return;
  try{var d=await api('/api/weather');if(d.ok){var icons={'113':'☀️','116':'⛅','119':'☁️','122':'☁️','143':'🌫️','176':'🌦️','179':'🌨️','182':'🌧️','185':'🌧️','200':'⛈️','227':'🌨️','230':'❄️','248':'🌫️','260':'🌫️','263':'🌦️','266':'🌧️','281':'🌧️','284':'🌧️','293':'🌦️','296':'🌧️','299':'🌧️','302':'🌧️','305':'🌧️','308':'🌧️','311':'🌧️','314':'🌧️','317':'🌨️','320':'🌨️','323':'🌨️','326':'🌨️','329':'❄️','332':'❄️','335':'❄️','338':'❄️','350':'🌧️','353':'🌦️','356':'🌧️','359':'🌧️','362':'🌨️','365':'🌨️','368':'🌨️','371':'❄️','374':'🌨️','377':'🌨️','386':'⛈️','389':'⛈️','392':'⛈️','395':'❄️'};var icon=icons[d.code]||'🌤️';el.innerHTML='<div class="ds-title">'+icon+' 天气</div><div style="font-size:22px;font-weight:700">'+d.temp+'°C</div><div style="font-size:12px;color:var(--text2);margin-top:2px">'+esc(d.desc)+'</div><div style="font-size:11px;color:var(--text3);margin-top:2px">'+esc(d.city||'')+'</div>'}else el.innerHTML='<div class="ds-title">🌤 天气</div><div style="font-size:12px;color:var(--text3)">'+esc(d.msg)+'</div>'}catch(e){el.innerHTML='<div class="ds-title">🌤 天气</div><div style="font-size:12px;color:var(--text3)">暂无</div>'}
}
async function loadTrendingDesk(){
  var el=document.getElementById('dsTrendingContent');
  if(!el)return;
  try{
    var d=await api('/api/square?sort=hot&page=1&size=8');
    if(d.ok&&d.trending&&d.trending.length){
      el.innerHTML=d.trending.slice(0,8).map(function(t,i){
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.02);cursor:pointer" onclick="switchTab('Square');setTimeout(function(){searchHashtag('${esc(t.tag).replace(/'/g,"\\'")}')},200)"><span style="color:${i<3?'var(--gold)':'var(--text3)'};font-weight:700;width:20px;font-size:11px">${i+1}</span><span style="flex:1;font-size:12px;color:var(--text2)">#${esc(t.tag)}#</span><span style="font-size:10px;color:var(--text3)">${t.count}</span></div>`;
      }).join('');
    }else el.innerHTML='<span style="color:var(--text3);font-size:12px">暂无热门话题</span>';
  }catch(e){el.innerHTML='<span style="color:var(--text3)">加载失败</span>'}
}
async function loadCheckinDesk(){
  var el=document.getElementById('dsCheckinContent');
  var card=document.getElementById('dsCheckin');
  if(!el||!card)return;
  if(!state.loggedIn)return;
  card.style.display='block';
  try{var d=await api('/api/check');if(d.loggedIn){el.innerHTML='<div style="font-size:28px;font-weight:800;color:var(--gold)">⭐ '+(d.points||0)+'</div><div style="font-size:11px;color:var(--text3);margin-top:4px">积分</div><button onclick="doCheckinDesk()" id="dsCheckinBtn" style="margin-top:10px;width:100%;padding:8px;border-radius:20px;border:none;background:var(--gold-bg);color:var(--gold);font-size:12px;cursor:pointer;font-weight:600">✅ 签到</button>'}}catch(e){}
}
async function doCheckinDesk(){
  var d=await api('/api/checkin',{method:'POST'});
  if(d.ok){state.checkedInToday=true;state.checkinStreak=d.streak;state.points=d.points;document.getElementById('dsCheckinBtn').textContent='已签到 ✓ ('+d.bonus+')';document.getElementById('dsCheckinBtn').disabled=true;toast('签到成功 +'+d.bonus)}
  else toast(d.msg||'签到失败');
}
// 初始化桌面侧栏
(function(){
  if(window.innerWidth>=768){loadDeskSidebar();setInterval(loadDeskSidebar,300000)}
  window.addEventListener('resize',function(){if(window.innerWidth>=768)loadDeskSidebar()});
})();
function switchTab(n){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page'+n).classList.add('active');
  document.querySelectorAll('.tab-item').forEach(t=>t.classList.toggle('active',t.dataset.tab===n));
  if(n!=='Music')closeExPlayer();
  if(n==='Home'){if(!state.posts.length&&!state.loading){state.posts=[];state.page=1;state.hasMore=true;loadPosts()}else renderFeed();loadWeather();loadStories()}
  if(n==='Profile')renderProfile();
  if(n==='Music')loadDiscover();
  if(n==='Board')loadBoard();
  if(n==='Notif')loadNotifications();
  if(n==='Square'){squarePage=1;squareHasMore=true;document.getElementById('squareFeed').innerHTML='';loadSquare()}
  pageHistory=[];
}
function showPage(id){closeFullPlayer();closeExPlayer();const c=document.querySelector('.page.active');pageHistory.push(c.id);document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(id).classList.add('active');document.getElementById(id).classList.add('page-enter');setTimeout(()=>document.getElementById(id).classList.remove('page-enter'),300)}
function goBack(){if(pageHistory.length){const p=pageHistory.pop();document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById(p).classList.add('active')}else switchTab('Home')}


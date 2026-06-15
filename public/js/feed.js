// ===== 天气 =====
async function loadWeather(){
  try{
    let d;
    // 先尝试浏览器定位（更准确）
    try{
      const pos=await new Promise((resolve,reject)=>{
        if(!navigator.geolocation)return reject('no geo');
        navigator.geolocation.getCurrentPosition(resolve,reject,{timeout:5000,maximumAge:600000});
      });
      const lat=pos.coords.latitude.toFixed(2);
      const lon=pos.coords.longitude.toFixed(2);
      d=await api(`/api/weather?lat=${lat}&lon=${lon}`);
    }catch(e){
      // 定位失败，用 IP 检测
      d=await api('/api/weather');
    }
    if(d.ok){
      const icons={'113':'☀️','116':'⛅','119':'☁️','122':'☁️','143':'🌫️','176':'🌦️','179':'🌨️','182':'🌧️','185':'🌧️','200':'⛈️','227':'🌨️','230':'❄️','248':'🌫️','260':'🌫️','263':'🌦️','266':'🌧️','281':'🌧️','284':'🌧️','293':'🌦️','296':'🌧️','299':'🌧️','302':'🌧️','305':'🌧️','308':'🌧️','311':'🌧️','314':'🌧️','317':'🌨️','320':'🌨️','323':'🌨️','326':'🌨️','329':'❄️','332':'❄️','335':'❄️','338':'❄️','350':'🌧️','353':'🌦️','356':'🌧️','359':'🌧️','362':'🌨️','365':'🌨️','368':'🌨️','371':'❄️','374':'🌨️','377':'🌨️','386':'⛈️','389':'⛈️','392':'⛈️','395':'❄️'};
      const icon=icons[d.code]||'🌤️';
      document.getElementById('weatherCard').style.display='flex';
      document.getElementById('weatherCard').innerHTML=`<div class="wc-icon">${icon}</div><div class="wc-info"><div class="wc-temp">${d.temp}°C${d.city?' · '+esc(d.city):''}</div><div class="wc-desc">${esc(d.desc)} · 体感${d.feelsLike}°C</div><div class="wc-detail">💧 ${d.humidity}% · 🌬️ ${d.windSpeed}km/h · UV ${d.uvIndex}</div></div>`;
    }
  }catch(e){}
}

// ===== Stories =====
async function loadStories(){
  try{
    const d=await api('/api/stories');
    if(!d.ok)return;
    storyGroups=d.groups||[];
    renderStories();
  }catch(e){}
}
function renderStories(){
  const el=document.getElementById('storiesContainer');
  if(!el)return;
  let html='<div class="stories-row">';
  // Add button
  html+=`<div class="story-ring add" onclick="showPage('pageStoryCreate')"><div class="ring"><span>+</span></div><div class="s-name">发布</div></div>`;
  storyGroups.forEach((g,i)=>{
    const allViewed=g.stories.every(s=>s.viewed);
    const av=g.avatar?`<img src="${g.avatar}">`:`<span>${(g.nickname||g.userId)[0]||'?'}</span>`;
    html+=`<div class="story-ring" onclick="openStoryViewer(${i})"><div class="ring ${allViewed?'viewed':''}">${av}</div><div class="s-name">${esc(g.nickname)}</div></div>`;
  });
  html+='</div>';
  el.innerHTML=html;
}
function openStoryViewer(groupIdx){
  currentStoryGroup=groupIdx;currentStoryItem=0;
  document.getElementById('storyViewer').classList.add('show');
  showCurrentStory();
}
function showCurrentStory(){
  const g=storyGroups[currentStoryGroup];
  if(!g||!g.stories[currentStoryItem]){closeStoryViewer();return}
  const s=g.stories[currentStoryItem];
  document.getElementById('svAv').innerHTML=g.avatar?`<img src="${g.avatar}">`:`<span style="font-size:14px">${(g.nickname||g.userId)[0]||'?'}</span>`;
  document.getElementById('svName').textContent=g.nickname;
  document.getElementById('svTime').textContent=fmtTime(s.time);
  document.getElementById('svImg').innerHTML=s.image?`<img src="${s.image}">`:'';
  document.getElementById('svText').textContent=s.text||'';
  document.getElementById('svText').style.display=s.text?'block':'none';
  // Progress bars
  let bars='';
  g.stories.forEach((_,i)=>{
    const cls=i<currentStoryItem?'done':i===currentStoryItem?'':'';
    bars+=`<div class="bar ${cls}"><div class="fill" style="width:${i<currentStoryItem?'100%':i===currentStoryItem?'0%':'0%'}"></div></div>`;
  });
  document.getElementById('svProgress').innerHTML=bars;
  // Animate current bar
  setTimeout(()=>{
    const fills=document.querySelectorAll('#svProgress .bar:not(.done) .fill');
    if(fills[0])fills[0].style.width='100%';
  },50);
  // Mark as viewed
  if(!s.viewed){api('/api/stories/view/'+s.id,{method:'POST'});s.viewed=true}
  // Auto advance
  if(storyTimer)clearTimeout(storyTimer);
  storyTimer=setTimeout(()=>nextStoryItem(),5000);
}
function nextStoryItem(){
  const g=storyGroups[currentStoryGroup];
  if(!g)return;
  if(currentStoryItem<g.stories.length-1){currentStoryItem++;showCurrentStory()}
  else if(currentStoryGroup<storyGroups.length-1){currentStoryGroup++;currentStoryItem=0;showCurrentStory()}
  else closeStoryViewer();
}
function prevStoryItem(){
  if(currentStoryItem>0){currentStoryItem--;showCurrentStory()}
  else if(currentStoryGroup>0){currentStoryGroup--;currentStoryItem=storyGroups[currentStoryGroup].stories.length-1;showCurrentStory()}
}
function closeStoryViewer(){
  document.getElementById('storyViewer').classList.remove('show');
  if(storyTimer)clearTimeout(storyTimer);
  renderStories();
}
let storyImgFile=null;
function previewStoryImg(input){
  if(input.files[0]){
    storyImgFile=input.files[0];
    document.getElementById('storyPreview').innerHTML=`<img src="${URL.createObjectURL(storyImgFile)}">`;
  }
}
async function submitStory(){
  const text=document.getElementById('storyText').value.trim();
  if(!text&&!storyImgFile)return toast('写点啥或发张图吧');
  const fd=new FormData();
  if(text)fd.append('text',text);
  if(storyImgFile)fd.append('image',storyImgFile);
  const d=await fetch('/api/stories/post',{method:'POST',body:fd,credentials:'same-origin'}).then(r=>r.json());
  if(d.ok){
    document.getElementById('storyText').value='';
    document.getElementById('storyPreview').innerHTML='';
    storyImgFile=null;
    if(d.newAchievements)d.newAchievements.forEach(a=>showAchievementPopup(a));
    toast('✨ Story已发布');
    goBack();loadStories();
  }else toast(d.msg||'发布失败');
}

// ===== 说说 =====
function previewImgs(input){pendingFiles=Array.from(input.files);document.getElementById('previewBox').innerHTML=pendingFiles.map((f,i)=>`<img src="${URL.createObjectURL(f)}" onclick="pendingFiles.splice(${i},1);previewImgs(document.getElementById('imgInput'))">`).join('')}
async function submitPost(){
  const c=document.getElementById('postContent').value.trim(),m=document.getElementById('postMood').value.trim(),l=document.getElementById('postLoc').value.trim();
  if(!c&&!pendingFiles.length)return toast('写点啥吧');
  const fd=new FormData();fd.append('content',c);if(m)fd.append('mood',m);if(l)fd.append('location',l);fd.append('visibility',document.getElementById('postVis').value);pendingFiles.forEach(f=>fd.append('images',f));
  const d=await fetch('/api/post',{method:'POST',body:fd,credentials:'same-origin'}).then(r=>r.json());
  if(d.ok){
    document.getElementById('postContent').value='';document.getElementById('postMood').value='';document.getElementById('postLoc').value='';document.getElementById("postVis").value="public";document.getElementById("postVisToggle").className="vis-toggle public";document.getElementById("postVisToggle").innerHTML="🌍 公开";document.getElementById('previewBox').innerHTML='';pendingFiles=[];
    state.postCount=(state.postCount||0)+1;state.points=(state.points||0)+5;
    const ptsEls=document.querySelectorAll('.profile-stats .num');if(ptsEls[0])ptsEls[0].textContent=state.postCount;if(ptsEls[2])ptsEls[2].textContent=state.points;
    state.posts=[];state.page=1;state.hasMore=true;loadPosts();
    if(d.newAchievements)d.newAchievements.forEach(a=>showAchievementPopup(a));
    toast('✨ 发布成功 +5积分')
  }else toast(d.msg||'发布失败');
}
async function loadPosts(){
  if(state.loading||!state.hasMore)return;state.loading=true;document.getElementById('feedLoading').style.display='block';
  const d=await api('/api/feed-optimized?page='+state.page);
  if(d.ok){
    if(state.page===1&&d.tiers){
      // Show skeleton then load
    }
    state.posts=[...state.posts,...d.posts];state.hasMore=d.hasMore;state.page++;renderFeed()
  }
  state.loading=false;document.getElementById('feedLoading').style.display=state.hasMore?'block':'none';
}
function renderFeed(){
  const feed=document.getElementById('feed');if(!feed)return;
  if(!state.posts.length){feed.innerHTML='<div class="empty-msg">还没有动态<br>去发第一条说说吧 🌙</div>';return}
  feed.innerHTML=state.posts.map(p=>renderPostHTML(p)).join('');
}
async function likePost(id){
  const d=await api('/api/like/'+id,{method:'POST'});
  if(!d.ok)return;
  const p=state.posts.find(x=>x.id===id);if(p)p.likes=d.likes;
  const btn=document.querySelector(`[onclick="likePost(${id})"]`);
  if(btn){const liked=d.likes.includes(state.user);btn.className=liked?'liked':'';btn.innerHTML=`${liked?'❤️':'🤍'} ${d.likes.length||'赞'}`}
}
function toggleComment(id){const e=document.getElementById('cmt_'+id);e.style.display=e.style.display==='none'?'block':'none'}
async function addCmt(id){
  const i=document.getElementById('ci_'+id);if(!i.value.trim())return;
  const text=i.value.trim();i.value='';
  const d=await api('/api/comment/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text})});
  if(!d.ok)return;
  const p=state.posts.find(x=>x.id===id);if(p)p.comments=d.comments;
  const box=document.getElementById('cmt_'+id);
  if(box){
    const cmtDiv=document.createElement('div');cmtDiv.className='cmt-item';
    cmtDiv.innerHTML=`<strong onclick="viewUser('${state.user}')">${esc(state.nickname||state.user)}</strong> ${esc(text)}`;
    const inputDiv=box.querySelector('.cmt-input');box.insertBefore(cmtDiv,inputDiv);
    const cmtBtn=document.querySelector(`[onclick="toggleComment(${id})"]`);
    if(cmtBtn)cmtBtn.textContent=`💬 ${d.comments.length||'评论'}`;
  }
}
async function delPost(id){showConfirm("确认删除","删除后不可恢复，确定要删除这条动态吗？","🗑️",async()=>{const d=await api('/api/delete/'+id,{method:'POST'});if(d.ok){state.posts=state.posts.filter(p=>p.id!==id);renderFeed();toast("已删除")}});}
function showLightbox(src){const l=document.createElement('div');l.className='lightbox';l.innerHTML=`<img src="${src}">`;l.onclick=()=>l.remove();document.body.appendChild(l)}
let st;document.getElementById('pageHome').addEventListener('scroll',()=>{clearTimeout(st);st=setTimeout(()=>{const el=document.getElementById('pageHome');if(el.scrollHeight-el.scrollTop-el.clientHeight<300&&state.hasMore&&!state.loading)loadPosts()},150)});

// ===== 运势 =====
async function loadFortune(){
  try{
    const d=await api('/api/fortune/today');
    if(d.ok&&d.fortune){
      const f=d.fortune;
      const stars='⭐'.repeat(f.rating);
      return '<div class="fortune-box"><div style="font-size:13px;color:var(--text2);margin-bottom:6px">🔮 今日运势</div><div class="fortune-stars">'+stars+'</div>'+(f.blessing?'<div style="text-align:center;font-size:15px;color:var(--gold);margin-top:10px;line-height:1.8;letter-spacing:1px">'+esc(f.blessing)+'</div>':'')+'<div style="display:flex;gap:12px;margin-top:12px;justify-content:center"><div style="flex:1;padding:10px;border-radius:12px;background:rgba(107,255,184,.06);border:1px solid rgba(107,255,184,.12)"><div style="font-size:11px;color:var(--green);margin-bottom:4px">✅ 宜</div><div style="font-size:13px;color:var(--text)">'+esc(f.fortune)+'</div></div><div style="flex:1;padding:10px;border-radius:12px;background:rgba(255,107,107,.06);border:1px solid rgba(255,107,107,.12)"><div style="font-size:11px;color:var(--red);margin-bottom:4px">🚫 忌</div><div style="font-size:13px;color:var(--text)">'+esc(f.avoid)+'</div></div></div><div class="fortune-detail"><div class="fd-item">🔢 幸运数字: <span>'+f.luckyNumber+'</span></div><div class="fd-item">🎨 幸运颜色: <span>'+esc(f.luckyColor)+'</span></div></div></div>';
    }
  }catch(e){}
  return '';
}

function toggleVisibility(){
  const el=document.getElementById("postVisToggle");
  const hidden=document.getElementById("postVis");
  if(hidden.value==="public"){
    hidden.value="private";
    el.className="vis-toggle private";
    el.innerHTML="🔒 私密";
  }else{
    hidden.value="public";
    el.className="vis-toggle public";
    el.innerHTML="🌍 公开";
  }
}

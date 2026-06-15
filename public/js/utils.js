async function api(p,o){const r=await fetch(p,{...o,credentials:'same-origin'});return r.json()}
function esc(t){const d=document.createElement('div');d.textContent=t;return d.innerHTML}
function toast(msg,t=2000){const el=document.createElement('div');el.className='toast';el.textContent=msg;document.body.appendChild(el);setTimeout(()=>el.remove(),t)}
function fmtTime(ts){const d=new Date(ts),n=new Date(),diff=n-d;if(diff<60000)return'刚刚';if(diff<3600000)return Math.floor(diff/60000)+'分钟前';if(diff<86400000)return Math.floor(diff/3600000)+'小时前';if(diff<172800000)return'昨天';return(d.getMonth()+1)+'月'+d.getDate()+'日'}
function fmtDuration(ms){const s=Math.floor(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function fmtTime2(ts){const d=new Date(ts);return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')}
function linkHashtags(text){return esc(text).replace(/#([^#]+)#/g,'<span class="hashtag" onclick="searchHashtag(\'$1\')">#$1#</span>')}
function showAchievementPopup(a){
  const el=document.createElement('div');el.className='ach-popup';
  el.innerHTML=`<div class="ap-icon">${a.icon}</div><div class="ap-text"><div class="ap-title">🎉 解锁成就: ${esc(a.name)}</div><div class="ap-desc">${esc(a.desc)}</div></div>`;
  document.body.appendChild(el);setTimeout(()=>el.remove(),4000);
}
function searchHashtag(tag){
  switchTab('Square');
  setTimeout(async()=>{
    const d=await api('/api/square?sort=new&page=1&size=50');
    if(d.ok&&d.posts){
      const filtered=d.posts.filter(p=>(p.content||'').includes('#'+tag+'#'));
      squareHasMore=false;
      document.getElementById('squareFeed').innerHTML=filtered.length?filtered.map(p=>renderPostHTML(p)).join(''):'<div class="empty-msg">暂无 #'+esc(tag)+'# 相关内容</div>';
    }
  },100);
}
function renderPostHTML(p){
  const visIcon = p.visibility === "private" ? " <span class=\vis-badge\>私密</span>" : ""; return `<div class="post-item"><div class="post-header"><div class="post-av" onclick="viewUser('${p.user}')">${p.avatar?`<img src="${p.avatar}">`:esc((p.nickname||p.user)[0]||'?')}</div><div class="post-meta"><div class="post-nick" onclick="viewUser('${p.user}')">${esc(p.nickname||p.user)}${visIcon}</div><div class="post-time">${fmtTime(p.time)}</div></div></div>${p.content?`<div class="post-text">${linkHashtags(p.content)}</div>`:''}${(p.mood||p.location)?`<div class="post-tags">${p.mood?`<span class="post-tag mood">💭 ${esc(p.mood)}</span>`:''}${p.location?`<span class="post-tag loc">📍 ${esc(p.location)}</span>`:''}</div>`:''}${p.images?.length?`<div class="post-imgs">${p.images.map(i=>`<img src="${i}" onclick="showLightbox('${i}')">`).join('')}</div>`:''}<div class="post-actions"><button class="${p.likes?.includes(state.user)?'liked':''}" onclick="likePost(${p.id})">${p.likes?.includes(state.user)?'❤️':'🤍'} ${p.likes?.length||'赞'}</button><button onclick="toggleComment(${p.id})">💬 ${p.comments?.length||'评论'}</button>${p.user===state.user?`<button style="color:rgba(255,80,80,.5)" onclick="delPost(${p.id})">🗑️</button>`:''}</div><div class="comments" id="cmt_${p.id}" style="display:none">${(p.comments||[]).map(c=>`<div class="cmt-item"><strong onclick="viewUser('${c.user}')">${esc(c.user)}</strong> ${esc(c.text)}</div>`).join('')}<div class="cmt-input"><input id="ci_${p.id}" placeholder="说点什么..." onkeydown="if(event.key==='Enter')addCmt(${p.id})"><button onclick="addCmt(${p.id})">发送</button></div></div></div>`;
}

// 自定义确认弹窗（替代浏览器 confirm）
function showConfirm(title, desc, icon, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.className = 'toast-modal-overlay';
  overlay.innerHTML = '<div class="toast-modal"><div class="toast-modal-icon">' + (icon || '⚠️') + '</div><div class="toast-modal-title">' + title + '</div><div class="toast-modal-desc">' + desc + '</div><div class="toast-modal-btns"><button class="btn-cancel">取消</button><button class="btn-danger">确认</button></div></div>';
  overlay.querySelector('.btn-cancel').onclick = function() {
    document.body.removeChild(overlay);
    if (onCancel) onCancel();
  };
  overlay.querySelector('.btn-danger').onclick = function() {
    document.body.removeChild(overlay);
    if (onConfirm) onConfirm();
  };
  overlay.onclick = function(e) { if (e.target === overlay) { document.body.removeChild(overlay); if (onCancel) onCancel(); } };
  document.body.appendChild(overlay);
}

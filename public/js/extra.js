// ===== 通知 =====
async function loadNotifications(){const d=await api('/api/notifications');if(!d.ok)return;const b=document.getElementById('notifBadge');if(d.unread>0){b.classList.add('has-count');b.dataset.count=d.unread}else b.classList.remove('has-count');document.getElementById('notifList').innerHTML=d.notifications.length?d.notifications.map(n=>{const icon=n.type==='like'?'❤️':n.type==='comment'?'💬':n.type==='follow'?'👤':n.type==='secret'?'💌':n.type==='dm'?'💬':'🔔';return`<div class="notif-item ${n.read?'':'unread'}" onclick="${n.from?`viewUser('${n.from}')`:''}"><div class="notif-av">${n.fromAvatar?`<img src="${n.fromAvatar}">`:icon}</div><div class="notif-text"><strong>${esc(n.fromNickname)}</strong> ${esc(n.content)}</div><div class="notif-time">${fmtTime(n.time)}</div></div>`}).join(''):'<div class="empty-msg">暂无消息 🌙</div>'}
async function markAllRead(){await api('/api/notifications/read',{method:'POST'});loadNotifications();toast('已全部标为已读')}

// ===== 成就 =====
async function loadAchievements(userId){
  const d=await api('/api/achievements'+(userId?'?user='+userId:''));
  if(!d.ok)return;
  document.getElementById('achContent').innerHTML=`<div style="padding:16px 16px 0;text-align:center"><div style="font-size:24px;font-weight:700;color:var(--gold)">${d.unlockedCount} / ${d.totalCount}</div><div style="font-size:12px;color:var(--text3);margin-top:4px">已解锁成就</div></div><div class="ach-grid">${d.achievements.map(a=>`<div class="ach-item ${a.unlocked?'':'locked'}"><div class="ach-icon">${a.icon}</div><div class="ach-name">${esc(a.name)}</div><div class="ach-desc">${esc(a.desc)}</div></div>`).join('')}</div>`;
}

// ===== 年度报告 =====
async function loadReport(){
  const d=await api('/api/report/yearly');
  if(!d.ok)return;
  const maxMonthly=Math.max(...d.monthlyPosts,1);
  const months=['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
  document.getElementById('reportContent').innerHTML=`
    <div class="report-card"><div style="font-size:14px;color:var(--text3);margin-bottom:8px">📊 ${d.year}年度报告</div><div class="rc-num">${d.totalPosts}</div><div class="rc-label">条说说</div></div>
    <div class="report-grid">
      <div class="rg-item"><div class="rg-num">${d.totalLikes}</div><div class="rg-label">❤️ 获赞</div></div>
      <div class="rg-item"><div class="rg-num">${d.totalComments}</div><div class="rg-label">💬 评论</div></div>
      <div class="rg-item"><div class="rg-num">${d.checkinDays}</div><div class="rg-label">📅 签到天</div></div>
      <div class="rg-item"><div class="rg-num">${d.followers}</div><div class="rg-label">👥 粉丝</div></div>
      <div class="rg-item"><div class="rg-num">${d.musicCount}</div><div class="rg-label">🎵 收藏</div></div>
      <div class="rg-item"><div class="rg-num">${d.achievementCount}</div><div class="rg-label">🎯 成就</div></div>
    </div>
    <div class="report-card" style="margin-top:8px"><div style="font-size:13px;color:var(--text3)">💭 最常表达的心情</div><div class="rc-num" style="font-size:24px;margin-top:8px">${esc(d.topMood)}${d.topMoodCount?` (${d.topMoodCount}次)`:''}</div></div>
    <div class="report-chart"><div style="font-size:13px;color:var(--text2)">📈 月度发布统计</div><div class="rc-bars">${d.monthlyPosts.map(v=>`<div class="rc-bar" style="height:${Math.max(v/maxMonthly*100,4)}%" data-val="${v}"></div>`).join('')}</div><div class="rc-months">${months.map(m=>`<span>${m}</span>`).join('')}</div></div>
    <div class="report-card" style="margin-top:8px"><div style="font-size:13px;color:var(--text3)">🏅 等级</div><div class="rc-num" style="font-size:24px">Lv.${d.level}</div><div class="rc-label">${d.points} 积分</div></div>`;
}

// ===== 照片墙 =====
async function loadGallery(userId){
  const d=await api('/api/gallery/'+userId);
  if(!d.ok)return;
  document.getElementById('galleryContent').innerHTML=d.images.length?`<div style="padding:12px;font-size:13px;color:var(--text3)">共 ${d.images.length} 张照片</div><div class="gallery-grid">${d.images.map(i=>`<img src="${i.url}" onclick="showLightbox('${i.url}')" loading="lazy">`).join('')}</div>`:'<div class="empty-msg">还没有照片 📸</div>';
}

// ===== 排行榜 =====
function showLeaderboard(){showPage('pageLeaderboard');loadLBTab('points')}
function switchLBTab(tab){currentLBTab=tab;document.querySelectorAll('#pageLeaderboard .music-tab').forEach(t=>t.classList.toggle('active',t.textContent.includes(tab==='points'?'积分':tab==='posts'?'活跃':'签到')));loadLBTab(tab)}
async function loadLBTab(tab){document.getElementById('lbContent').innerHTML='<div class="loading">加载中</div>';const d=await api('/api/leaderboard?type='+tab);if(d.ok)document.getElementById('lbContent').innerHTML=d.leaderboard.map((u,i)=>{const rc=i===0?'top1':i===1?'top2':i===2?'top3':'normal';const v=tab==='points'?u.points+'分':tab==='posts'?u.postCount+'条':u.checkinStreak+'天';return`<div class="lb-item" onclick="viewUser('${u.user}')"><div class="lb-rank ${rc}">${i+1}</div><div class="lb-av">${u.avatar?`<img src="${u.avatar}">`:esc(u.nickname[0]||'?')}</div><div class="lb-info"><div class="lb-name">${esc(u.nickname)}</div><div class="lb-detail">Lv.${u.level}</div></div><div class="lb-value">${v}</div></div>`}).join('')}


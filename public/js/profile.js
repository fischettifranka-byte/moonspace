// ===== 个人资料 =====
async function renderProfile(){
  const el=document.getElementById('profileContent');if(!el)return;
  const fortuneHTML=await loadFortune();
  el.innerHTML=`<div class="profile-card"><div class="profile-av" onclick="document.getElementById('avInput').click()">${state.avatar?`<img src="${state.avatar}?t=${Date.now()}">`:'🌙'}<div class="level-badge">${state.level||1}</div><input type="file" id="avInput" accept="image/*" onchange="uploadAvatar(this)"></div><div class="profile-info"><div style="display:flex;align-items:center;gap:8px"><div class="profile-nick">${esc(state.nickname||state.user)}</div><button onclick="toggleTheme()" style="background:none;border:1px solid var(--border);border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text);padding:0" id="themeIcon">🌙</button></div><div class="profile-bio" id="bioDisplay">${esc(state.bio||'这个人很懒什么都没写')} <span style="color:var(--text3);font-size:11px;cursor:pointer" onclick="showEditBio()">✏️</span></div><div class="edit-bio" id="editBioArea" style="display:none"><input id="bioInput" value="${esc(state.bio||'')}"><button onclick="saveBio()">保存</button></div></div></div><div class="profile-stats"><div><div class="num">${state.postCount||0}</div><div class="lbl">说说</div></div><div><div class="num">${state.totalLikes||0}</div><div class="lbl">获赞</div></div><div><div class="num">${state.points||0}</div><div class="lbl">积分</div></div><div><div class="num">${state.followersCount||0}</div><div class="lbl">粉丝</div></div></div>${fortuneHTML}<div class="checkin-card"><div style="font-size:14px;color:var(--text2);margin-bottom:8px">📅 每日签到</div><div class="streak" id="checkinStreak">${state.checkinStreak||0}</div><div class="streak-label">连续签到天数</div><button class="checkin-btn" id="checkinBtn" onclick="doCheckin()" ${state.checkedInToday?'disabled':''}>${state.checkedInToday?'✅ 今日已签到':'✨ 签到领积分'}</button></div><div class="menu-grid"><div class="menu-item" onclick="viewUser('${state.user}')"><span class="mi-icon">📄</span>我的说说</div><div class="menu-item" onclick="showMyMessages()"><span class="mi-icon">📩</span>信件</div><div class="menu-item" onclick="showConversations()"><span class="mi-icon">💬</span>私信</div><div class="menu-item" onclick="showPage('pageAchievements');loadAchievements()"><span class="mi-icon">🎯</span>成就<div style="font-size:10px;color:var(--gold);margin-top:2px">${state.achievementCount||0}个</div></div><div class="menu-item" onclick="showPage('pageReport');loadReport()"><span class="mi-icon">📊</span>年度报告</div><div class="menu-item" onclick="showPage('pageGallery');loadGallery('${state.user}')"><span class="mi-icon">📸</span>照片墙</div><div class="menu-item" onclick="showPage('pageCloud');loadCloud()"><span class="mi-icon">☁️</span>云盘</div><div class="menu-item" onclick="showLeaderboard()"><span class="mi-icon">🏆</span>排行榜</div>${state.hasPassword?'':`<div class="menu-item" onclick="showPage('pageSetPassword')"><span class="mi-icon">🔑</span>设密码</div>`}<div class="menu-item" onclick="showPage('pageSettings');loadSettings()"><span class="mi-icon">⚙️</span>设置</div></div>`;
}
function showEditBio(){document.getElementById('bioDisplay').style.display='none';document.getElementById('editBioArea').style.display='flex'}
async function saveBio(){const b=document.getElementById('bioInput').value.trim();const d=await api("/api/profile",{method:"POST",body:JSON.stringify({bio:b})});if(d.ok){state.bio=b;document.getElementById('bioDisplay').innerHTML=esc(b||'这个人很懒什么都没写')+' <span style="color:var(--text3);font-size:11px;cursor:pointer" onclick="showEditBio()">✏️</span>';document.getElementById('bioDisplay').style.display='block';document.getElementById('editBioArea').style.display='none'}else toast(d.msg)}
async function uploadAvatar(input){const fd=new FormData();fd.append('avatar',input.files[0]);const d=await fetch('/api/avatar',{method:'POST',body:fd,credentials:'same-origin'}).then(r=>r.json());if(d.ok){state.avatar=d.url;renderProfile();renderFeed();toast('头像已更新')}}
async function doCheckin(){
  const d=await api("/api/checkin",{method:"POST"});
  if(d.ok){
    toast('签到成功！+'+d.bonus+'积分 🔥连续'+d.streak+'天');
    state.points=d.points;
    state.checkedInToday=true;
    state.checkinStreak=d.streak;
    const streakEl=document.getElementById('checkinStreak');if(streakEl)streakEl.textContent=d.streak;
    const btn=document.getElementById('checkinBtn');if(btn){btn.disabled=true;btn.textContent='✅ 今日已签到'}
    const ptsEls=document.querySelectorAll('.profile-stats .num');if(ptsEls[2])ptsEls[2].textContent=d.points;
    if(d.newAchievements)d.newAchievements.forEach(a=>showAchievementPopup(a));
  }else toast(d.msg)
  });
}
async function setPassword(){const p=document.getElementById('newPass').value,p2=document.getElementById('newPass2').value;if(!p||p.length<6)return toast('密码至少6位');if(p!==p2)return toast('两次密码不一致');const d=await api("/api/set-password",{method:"POST",body:JSON.stringify({password:p})});if(d.ok){toast('密码设置成功 🔑');state.hasPassword=true;showPage('pageProfile');initProfile()}else toast(d.msg)}

// ===== 设置页面 =====
let settingsEmailSent=false;
async function loadSettings(){
  const d=await api("/api/settings/security");
  if(!d.ok)return;
  const el=document.getElementById('settingsContent');
  el.innerHTML=`
    <div class="card" style="margin-top:12px">
      <div style="font-size:15px;font-weight:700;color:var(--gold);margin-bottom:16px">🔐 账号安全</div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="color:var(--text2);font-size:13px">邮箱</span>
        <span style="color:var(--text);font-size:13px">${esc(d.email||'未绑定')}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="color:var(--text2);font-size:13px">密码</span>
        <span style="color:var(--text);font-size:13px">${d.hasPassword?'已设置':'未设置'}</span>
      </div>
      <div style="display:flex;justify-content:space-between;padding:12px 0">
        <span style="color:var(--text2);font-size:13px">注册时间</span>
        <span style="color:var(--text);font-size:13px">${new Date(d.created).toLocaleDateString('zh-CN')}</span>
      </div>
    </div>

    <div class="card" style="margin-top:8px">
      <div style="font-size:15px;font-weight:700;color:var(--gold);margin-bottom:16px">📧 更换邮箱</div>
      <p style="color:var(--text3);font-size:12px;margin-bottom:12px">更换邮箱需要验证新邮箱地址，验证码将发送到新邮箱。</p>
      <div class="inp-row" style="display:flex;gap:8px;margin-bottom:8px">
        <input class="inp" id="settingsNewEmail" type="email" placeholder="新邮箱地址" style="margin-bottom:0">
        <button class="code-btn" id="settingsSendCodeBtn" onclick="settingsSendCode()" style="min-width:100px">发送验证码</button>
      </div>
      <input class="inp" id="settingsEmailCode" placeholder="邮箱验证码" style="margin-bottom:8px">
      <button class="btn" onclick="settingsVerifyEmail()" style="font-size:13px;padding:12px">✦ 确认更换</button>
    </div>

    <div class="card" style="margin-top:8px">
      <div style="font-size:15px;font-weight:700;color:var(--gold);margin-bottom:16px">🔑 修改密码</div>
      <p style="color:var(--text3);font-size:12px;margin-bottom:12px">验证码将发送到你的绑定邮箱${d.email?' <b style="color:var(--gold)">'+d.email+'</b>':''}。</p>
      <div class="inp-row" style="display:flex;gap:8px;margin-bottom:8px">
        <input class="inp" id="settingsPwdCode" type="text" autocomplete="off" placeholder="邮箱验证码" maxlength="6" style="margin-bottom:0">
        <button class="code-btn" id="settingsPwdSendBtn" onclick="settingsSendPwdCode()" style="min-width:100px">发送验证码</button>
      </div>
${d.hasPassword?`<input class="inp" id="settingsOldPass" type="password" autocomplete="current-password" placeholder="旧密码（或直接用邮箱验证码）">`:''}
      <input class="inp" id="settingsNewPass" type="password" autocomplete="new-password" placeholder="新密码（至少6位）">
      <input class="inp" id="settingsNewPass2" type="password" autocomplete="new-password" placeholder="确认新密码">
      <button class="btn" onclick="settingsChangePassword(${d.hasPassword})" style="font-size:13px;padding:12px">✦ 修改密码</button>

    <div class="card" style="margin-top:8px;margin-bottom:20px">
      <div style="font-size:15px;font-weight:700;color:var(--red);margin-bottom:16px">⚠️ 危险操作</div>
      <p style="color:var(--text3);font-size:12px;margin-bottom:12px">注销账号将删除你的所有数据，且无法恢复。</p>
      <button onclick="settingsDeleteAccount(${d.hasPassword})" style="width:100%;padding:12px;border-radius:14px;border:1px solid rgba(255,80,80,.3);background:rgba(255,80,80,.08);color:var(--red);font-size:13px;cursor:pointer;font-family:inherit">注销账号</button>
    </div>

    <div style="margin:12px 0 30px">
      <button onclick="logout()" style="width:100%;padding:14px;border-radius:50px;border:1px solid rgba(255,255,255,.08);background:transparent;color:var(--text2);font-size:14px;cursor:pointer;font-family:inherit">🚪 退出登录</button>
    </div>
  `;
}

async function settingsSendCode(){
  const email=document.getElementById('settingsNewEmail').value.trim();
  if(!email)return toast('请输入新邮箱');
  const btn=document.getElementById('settingsSendCodeBtn');
  btn.disabled=true;let s=60;btn.textContent=s+'s';
  const timer=setInterval(()=>{s--;btn.textContent=s+'s';if(s<=0){clearInterval(timer);btn.disabled=false;btn.textContent='发送验证码'}},1000);
  const d=await api("/api/settings/send-email-code",{method:"POST",body:JSON.stringify({email})});
  if(d.ok){settingsEmailSent=true;toast(d.msg||'验证码已发送');}
  else{toast(d.msg);clearInterval(timer);btn.disabled=false;btn.textContent='发送验证码'}
}

async function settingsVerifyEmail(){
  const code=document.getElementById('settingsEmailCode').value.trim();
  if(!code)return toast('请输入验证码');
  const d=await api("/api/settings/verify-email",{method:"POST",body:JSON.stringify({code})});
  if(d.ok){toast('邮箱更换成功 ✅');state.email=d.newEmail;loadSettings()}
  else toast(d.msg)
  });
}

async function settingsSendPwdCode(){
  const btn=document.getElementById("settingsPwdSendBtn");
  if(!btn)return;
  btn.disabled=true;let s=60;btn.textContent=s+"s";
  const timer=setInterval(()=>{s--;btn.textContent=s+"s";if(s<=0){clearInterval(timer);btn.disabled=false;btn.textContent="发送验证码"}},1000);
  const d=await api("/api/settings/send-pwd-code",{method:"POST"});
  if(d.ok)toast(d.msg||"验证码已发送");
  else{toast(d.msg);clearInterval(timer);btn.disabled=false;btn.textContent="发送验证码"}
}

async function settingsChangePassword(hasPassword){
  const code=document.getElementById("settingsPwdCode")?.value?.trim()||'';
  const oldP=hasPassword?(document.getElementById("settingsOldPass")?.value||''):'';
  const newP=document.getElementById("settingsNewPass").value;
  const newP2=document.getElementById("settingsNewPass2").value;
  if(!newP||newP.length<6)return toast("新密码至少6位");
  if(newP!==newP2)return toast("两次密码不一致");
  // 未提供旧密码时必须提供邮箱验证码
  if(!oldP&&!code)return toast("请输入旧密码或邮箱验证码");
  const body={newPassword:newP,code:code||undefined,oldPassword:oldP||undefined};
  const d=await api("/api/settings/change-password",{method:"POST",body:JSON.stringify(body)});
  if(d.ok){toast("密码修改成功 🔑");loadSettings()}
  else toast(d.msg)
  });
}

async function settingsDeleteAccount(hasPassword){
  const msg=hasPassword?'请输入密码确认注销':'确定要注销账号吗？此操作不可恢复！';
  const password=hasPassword?prompt(msg):'';
  if(hasPassword&&!password)return;
  showConfirm("⚠️ 注销账号","所有数据将被删除且无法恢复！","⚠️",()=>{
  const d=await api("/api/settings/delete-account",{method:"POST",body:JSON.stringify({password:password||undefined})});
  if(d.ok){toast('账号已注销');setTimeout(()=>location.reload(),1000)}
  else toast(d.msg)
  });
}

// ===== 云盘 =====
let cloudCategory='all';
async function loadCloud(){
  const d=await api("/api/cloud/info");
  if(!d.ok)return;
  const el=document.getElementById('cloudContent');
  const pct=d.usedPercent;
  const barColor=pct>80?'var(--red)':pct>50?'var(--gold)':'var(--green)';
  const sizeStr=(s)=>s>1048576?(s/1048576).toFixed(1)+'MB':s>1024?(s/1024).toFixed(1)+'KB':s+'B';
  el.innerHTML=`
    <div class="card" style="margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <span style="font-size:15px;font-weight:700;color:var(--gold)">☁️ 存储空间</span>
        <span style="font-size:12px;color:var(--text3)">${sizeStr(d.totalSize)} / 200MB</span>
      </div>
      <div style="height:8px;background:rgba(255,255,255,.06);border-radius:4px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width .5s"></div>
      </div>
      <div style="display:flex;gap:12px;margin-top:12px;font-size:12px;color:var(--text3)">
        <span>🖼️ ${d.counts.image}张图片</span>
        <span>🎬 ${d.counts.video}个视频</span>
        <span>🎵 ${d.counts.audio}个音频</span>
        <span>📄 ${d.counts.file}个文件</span>
      </div>
    </div>
    <div style="margin:12px;padding:0 4px">
      <label style="display:block;padding:14px;border-radius:14px;background:linear-gradient(135deg,rgba(245,215,110,.1),rgba(100,200,255,.05));border:1px dashed rgba(245,215,110,.3);text-align:center;cursor:pointer;font-size:14px;color:var(--gold);transition:all .2s">
        📤 上传文件（最大200MB）
        <input type="file" id="cloudFileInput" style="display:none" onchange="uploadCloudFile(this)">
      </label>
    </div>
    <div style="display:flex;gap:6px;padding:0 12px;margin-bottom:8px;overflow-x:auto">
      ${['all','image','video','audio','file'].map(c=>`<button onclick="switchCloudCat('${c}')" class="hot-tag ${cloudCategory===c?'active':''}">${c==='all'?'全部':c==='image'?'🖼️图片':c==='video'?'🎬视频':c==='audio'?'🎵音频':'📄文件'}</button>`).join('')}
    </div>
    <div id="cloudFiles"></div>
  `;
  loadCloudFiles();
}

async function switchCloudCat(cat){
  cloudCategory=cat;
  document.querySelectorAll('#cloudContent .hot-tag').forEach(b=>b.classList.toggle('active',b.textContent.includes(cat==='all'?'全部':cat==='image'?'图片':cat==='video'?'视频':cat==='audio'?'音频':'文件')));
  loadCloudFiles();
}

async function loadCloudFiles(){
  const d=await api("/api/cloud/files"+(cloudCategory!=='all'?'?category='+cloudCategory:''));
  if(!d.ok)return;
  const el=document.getElementById('cloudFiles');
  const sizeStr=(s)=>s>1048576?(s/1048576).toFixed(1)+'MB':s>1024?(s/1024).toFixed(1)+'KB':s+'B';
  if(!d.files.length){el.innerHTML='<div class="empty-msg">还没有文件 📂</div>';return}
  el.innerHTML=d.files.map(f=>{
    const isImg=f.category==='image';
    const isVid=f.category==='video';
    const icon=isImg?'🖼️':isVid?'🎬':f.category==='audio'?'🎵':'📄';
    return `<div class="card" style="margin:8px 12px;padding:12px;display:flex;align-items:center;gap:12px">
      ${isImg?`<img src="${f.path}" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0;cursor:pointer" onclick="showLightbox('${f.path}')">`:`<div style="width:56px;height:56px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04);border-radius:10px;flex-shrink:0;font-size:24px">${icon}</div>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;color:#e8e8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px">${sizeStr(f.size)} · ${new Date(f.time).toLocaleDateString('zh-CN')}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0">
        ${f.shareKey?`<button onclick="showSharedLinkModal('${f.shareKey}',${!!f.sharePassword})" style="padding:6px 10px;border-radius:8px;background:rgba(107,255,184,.1);color:var(--green);font-size:12px;border:none;cursor:pointer">🔗已分享</button><button onclick="unshareCloudFile('${f.id}')" style="padding:6px 10px;border-radius:8px;background:rgba(255,80,80,.1);color:var(--red);font-size:12px;border:none;cursor:pointer">取消分享</button>`:`<button onclick="showShareModal('${f.id}')" style="padding:6px 10px;border-radius:8px;background:rgba(245,215,110,.1);color:var(--gold);font-size:12px;border:none;cursor:pointer">🔗</button>`}
        <a href="/api/cloud/download/${f.id}" download style="padding:6px 10px;border-radius:8px;background:rgba(100,200,255,.1);color:var(--blue);font-size:12px;text-decoration:none">⬇️</a>
        <button onclick="deleteCloudFile('${f.id}')" style="padding:6px 10px;border-radius:8px;background:rgba(255,80,80,.1);color:var(--red);font-size:12px;border:none;cursor:pointer">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

async function uploadCloudFile(input){
  if(!input.files.length)return;
  const file=input.files[0];
  if(file.size>200*1024*1024)return toast('文件不能超过200MB');
  const fd=new FormData();fd.append('file',file);
  toast('上传中...');
  const d=await fetch('/api/cloud/upload',{method:'POST',body:fd,credentials:'same-origin'}).then(r=>r.json());
  if(d.ok){toast('上传成功 ✅');input.value='';loadCloud()}
  else toast(d.msg||'上传失败');
}

async function deleteCloudFile(id){
  showConfirm("删除文件","确定要删除这个文件吗？","📄",async()=>{
  const d=await api("/api/cloud/delete/"+id,{method:"POST"});
  if(d.ok){toast("已删除");loadCloudFiles()}
  else toast(d.msg);
  });
}

function showShareModal(fileId){
  const modal=document.getElementById('shareModal');
  modal.style.display='flex';
  modal.dataset.fileId=fileId;
  document.getElementById('sharePwInput').value='';
  document.getElementById('sharePwToggle').checked=false;
  document.getElementById('sharePwArea').style.display='none';
  document.getElementById('shareStep1').style.display='block';
  document.getElementById('shareStep2').style.display='none';
}
function closeShareModal(){document.getElementById('shareModal').style.display='none'}
function toggleSharePw(){
  const on=document.getElementById('sharePwToggle').checked;
  document.getElementById('sharePwArea').style.display=on?'block':'none';
  document.getElementById('shareToggleTrack').style.background=on?'linear-gradient(135deg,#f5d76e,#d4b84a)':'rgba(255,255,255,.1)';
  document.getElementById('shareToggleDot').style.left=on?'23px':'3px';
  document.getElementById('shareToggleDot').style.background=on?'#1a1040':'#666';
}
async function confirmShare(){
  const modal=document.getElementById('shareModal');
  const fileId=modal.dataset.fileId;
  const usePw=document.getElementById('sharePwToggle').checked;
  const pw=usePw?document.getElementById('sharePwInput').value.trim():'';
  if(usePw&&!pw)return toast('请输入密码或关闭密码开关');
  const d=await api("/api/cloud/share/"+fileId,{method:"POST",body:JSON.stringify(pw?{password:pw}:{})});
  if(d.ok){
    const url=location.origin+d.url;
    document.getElementById('shareStep1').style.display='none';
    document.getElementById('shareStep2').style.display='block';
    document.getElementById('shareLinkInput').value=url;
    document.getElementById('shareLinkPw').textContent=d.hasPassword?'🔒 需要密码才能下载':'🌐 公开链接，任何人可下载';
    loadCloudFiles();
  }else toast(d.msg);
  });
}
function copyShareUrl(){
  const url=document.getElementById('shareLinkInput').value;
  const ta=document.createElement('textarea');ta.value=url;ta.style.cssText='position:fixed;left:-9999px';document.body.appendChild(ta);ta.select();
  try{document.execCommand('copy');toast('链接已复制 ✅')}catch(e){prompt('请手动复制：',url)}
  document.body.removeChild(ta);
}

function showSharedLinkModal(shareKey,hasPassword){
  const url=location.origin+'/s/'+shareKey;
  document.getElementById('shareStep1').style.display='none';
  document.getElementById('shareStep2').style.display='block';
  document.getElementById('shareLinkInput').value=url;
  document.getElementById('shareLinkPw').textContent=hasPassword?'🔒 需要密码才能下载':'🌐 公开链接，任何人可下载';
  document.getElementById('shareModal').style.display='flex';
}

async function unshareCloudFile(id){
  const d=await api("/api/cloud/unshare/"+id,{method:"POST"});
  if(d.ok){toast('已取消分享');loadCloudFiles()}
  else toast(d.msg);
  });
}


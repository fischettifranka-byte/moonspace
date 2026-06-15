// ===== 用户主页 =====
async function viewUser(userId){
  showPage('pageUser');
  const d=await api('/api/user/'+userId);
  if(!d.ok){document.getElementById('userContent').innerHTML='<div class="empty-msg">用户不存在</div>';return}
  const isMe=userId===state.user;
  let bgmHTML='';
  if(d.bgmSong){
    bgmHTML=`<div class="bgm-bar"><button class="bgm-play" onclick="event.stopPropagation();playBGM('${d.bgmSong.id}')">▶</button><div class="bgm-name">🎵 ${esc(d.bgmSong.name)} - ${esc(d.bgmSong.artists)}</div></div>`;
  }
  document.getElementById('userContent').innerHTML=`<div class="user-profile"><div class="user-av">${d.avatar?`<img src="${d.avatar}">`:esc(d.nickname[0]||'?')}</div><div class="user-name">${esc(d.nickname)}</div><div class="user-bio">${esc(d.bio||'')}</div>${bgmHTML}<div class="profile-stats" style="margin:16px 0"><div><div class="num">${d.postCount}</div><div class="lbl">说说</div></div><div><div class="num">${d.totalLikes}</div><div class="lbl">获赞</div></div><div><div class="num">${d.followersCount}</div><div class="lbl">粉丝</div></div><div><div class="num">Lv.${d.level}</div><div class="lbl">等级</div></div></div>${isMe?'':`<div class="user-actions"><button class="${d.isFollowing?'primary':''}" onclick="toggleFollow('${userId}',this)">${d.isFollowing?'已关注':'✦ 关注'}</button><button onclick="showSecretForm('${userId}')">💌 悄悄话</button><button onclick="startDM('${userId}')">💬 私信</button></div>`}</div><div id="userPosts"></div>`;
  const posts=await api('/api/posts?user='+userId);
  if(posts.ok&&posts.posts.length)document.getElementById('userPosts').innerHTML=posts.posts.map(p=>renderPostHTML(p)).join('');
  else document.getElementById('userPosts').innerHTML='<div class="empty-msg">暂无说说</div>';
}
async function toggleFollow(userId,btn){const d=await api('/api/follow/'+userId,{method:'POST'});if(d.ok){btn.textContent=d.following?'已关注':'✦ 关注';btn.className=d.following?'primary':'';toast(d.following?'已关注':'已取消关注');const statsEl=document.querySelector('#userContent .profile-stats');if(statsEl){const nums=statsEl.querySelectorAll('.num');if(nums[2]){const cur=parseInt(nums[2].textContent)||0;nums[2].textContent=d.following?cur+1:Math.max(0,cur-1)}}}}
function playBGM(songId){playlist=[{id:songId,name:'',artists:'',cover:''}];currentSong=0;startPlay()}


// ===== 留言板 =====
let boardPage=1,boardHasMore=true,boardLoading=false;
async function loadBoard(){if(boardLoading||!boardHasMore)return;boardLoading=true;document.getElementById('boardLoading').style.display='block';const d=await api('/api/board?page='+boardPage);if(d.ok){document.getElementById('boardFeed').innerHTML=(d.messages||[]).map(m=>`<div class="board-item"><div class="board-header"><div class="board-av" onclick="viewUser('${m.user}')">${m.avatar?`<img src="${m.avatar}">`:esc(m.nickname[0]||'?')}</div><div><div class="post-nick" onclick="viewUser('${m.user}')" style="font-size:13px">${esc(m.nickname)}</div><div class="post-time">${fmtTime(m.time)}</div></div></div><div class="board-content">${esc(m.content)}</div><div class="board-footer"><button class="${m.likes.includes(state.user)?'liked':''}" onclick="likeBoard(${m.id},this)">${m.likes.includes(state.user)?'❤️':'🤍'} ${m.likes.length||''}</button></div></div>`).join('');boardHasMore=d.hasMore;boardPage++}boardLoading=false;document.getElementById('boardLoading').style.display='none'}
async function submitBoard(){const c=document.getElementById('boardContent').value.trim();if(!c)return toast('写点啥吧');const d=await api('/api/board',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:c})});if(d.ok){document.getElementById('boardContent').value='';const feed=document.getElementById('boardFeed');if(feed){const item=document.createElement('div');item.className='board-item';item.style.animation='fadeIn .25s ease';item.innerHTML=`<div class="board-header"><div class="board-av">${state.avatar?`<img src="${state.avatar}">`:esc(state.nickname[0]||'?')}</div><div><div class="post-nick" style="font-size:13px">${esc(state.nickname||state.user)}</div><div class="post-time">刚刚</div></div></div><div class="board-content">${esc(c)}</div><div class="board-footer"><button>🤍 0</button></div>`;feed.insertBefore(item,feed.firstChild)}state.points=(state.points||0)+3;toast('留言成功 +3积分')}}
async function likeBoard(id,btn){const d=await api('/api/board/like/'+id,{method:'POST'});if(d.ok){const liked=d.likes.includes(state.user);btn.className=liked?'liked':'';btn.innerHTML=`${liked?'❤️':'🤍'} ${d.likes.length||''}`}}
document.getElementById('pageBoard').addEventListener('scroll',()=>{clearTimeout(st);st=setTimeout(()=>{const el=document.getElementById('pageBoard');if(el.scrollHeight-el.scrollTop-el.clientHeight<300&&boardHasMore&&!boardLoading)loadBoard()},150)});

// ===== 广场 =====
function switchSquareSort(sort){
  squareSort=sort;squarePage=1;squareHasMore=true;
  document.querySelectorAll('#squareSort button').forEach(b=>b.classList.toggle('active',b.textContent.includes(sort==='hot'?'最热':'最新')));
  document.getElementById('squareFeed').innerHTML='';
  loadSquare();
}
async function loadSquare(){
  if(squareLoading||!squareHasMore)return;squareLoading=true;document.getElementById('squareLoading').style.display='block';
  const d=await api('/api/square?sort='+squareSort+'&page='+squarePage);
  if(d.ok){
    // Trending
    if(squarePage===1&&d.trending?.length){
      document.getElementById('trendingBar').innerHTML='<div class="trending-bar">'+d.trending.map(t=>`<div class="trending-tag" onclick="searchHashtag('${esc(t.tag)}')">#${esc(t.tag)}# ${t.count}</div>`).join('')+'</div>';
    }
    const feed=document.getElementById('squareFeed');
    const html=d.posts.map(p=>renderPostHTML(p)).join('');
    feed.innerHTML=(feed.innerHTML||'')+html;
    squareHasMore=d.hasMore;squarePage++;
  }
  squareLoading=false;document.getElementById('squareLoading').style.display='none';
}
// Square scroll
(function(){const sq=document.getElementById('pageSquare');if(sq){sq.addEventListener('scroll',()=>{clearTimeout(st);st=setTimeout(()=>{if(sq.scrollHeight-sq.scrollTop-sq.clientHeight<300&&squareHasMore&&!squareLoading)loadSquare()},150)},{passive:true})}})();

// ===== 悄悄话 =====
function showSecretForm(to){showPage('pageSecret');if(to)document.getElementById('secretTo').value=to}
async function sendSecret(){const to=document.getElementById('secretTo').value.trim(),content=document.getElementById('secretContent').value.trim(),anon=document.getElementById('secretAnon').checked;if(!to||!content)return toast('请填写完整');const d=await api('/api/secret',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to,content,anonymous:anon})});if(d.ok){document.getElementById('secretContent').value='';toast('💌 已发送');goBack()}else toast(d.msg)}
async function showMyMessages(){showPage('pageMessages');loadMsgTab('received')}
function switchMsgTab(tab){currentMsgTab=tab;document.querySelectorAll('#pageMessages .music-tab').forEach(t=>t.classList.toggle('active',t.textContent.includes(tab==='received'?'收到':'发出')));loadMsgTab(tab)}
async function loadMsgTab(tab){const d=await api('/api/messages');if(!d.ok)return;const list=tab==='received'?d.received:d.sent;document.getElementById('messagesContent').innerHTML=list.length?list.map(m=>`<div class="card" style="margin:8px 12px"><div style="font-size:12px;color:var(--text3);margin-bottom:6px">${tab==='received'?'来自':'发给'}: <strong style="color:#e8e8e8">${esc(tab==='received'?m.fromNickname:m.toNickname)}</strong> · ${fmtTime(m.time)} ${m.anonymous?'🎭 匿名':''}</div><div style="font-size:14px;color:var(--text);line-height:1.7">${esc(m.content)}</div></div>`).join(''):'<div class="empty-msg">'+(tab==='received'?'还没有收到消息':'还没有发送过消息')+'</div>'}

// ===== 私信 DM =====
async function showConversations(){
  showPage('pageConversations');
  const d=await api('/api/dm/conversations');
  if(!d.ok)return;
  const el=document.getElementById('convList');
  if(!d.conversations.length){el.innerHTML='<div class="empty-msg">还没有私信<br>去用户主页发一条吧 💬</div>';return}
  el.innerHTML=d.conversations.map(c=>`<div class="conv-item" onclick="openChat('${c.other}')"><div class="conv-av">${c.avatar?`<img src="${c.avatar}">`:esc(c.nickname[0]||'?')}${c.unread?`<div class="conv-unread">${c.unread}</div>`:''}</div><div class="conv-info"><div class="conv-name">${esc(c.nickname)}</div><div class="conv-last">${esc(c.lastMessage)}</div></div><div class="conv-time">${fmtTime(c.lastTime)}</div></div>`).join('');
}
function startDM(userId){openChat(userId)}
async function openChat(userId){
  currentChatUser=userId;
  showPage('pageChat');
  document.getElementById('chatView').innerHTML='<div class="chat-messages" id="chatMsgs"></div><div class="chat-input"><button onclick="showFilePicker()" style="background:none;border:none;font-size:20px;cursor:pointer;padding:8px">📎</button><input id="chatInput" placeholder="输入消息..." onkeydown="if(event.key===\'Enter\')sendDM()"><button onclick="sendDM()">发送</button></div>';
  loadChatMessages();
}
async function loadChatMessages(){
  if(!currentChatUser)return;
  const d=await api('/api/dm/messages/'+currentChatUser);
  if(!d.ok)return;
  document.getElementById('chatTitle').innerHTML=`💬 <span>${esc(d.otherNickname)}</span>`;
  const msgs=document.getElementById('chatMsgs');
  msgs.innerHTML=d.messages.map(m=>{
    const isSent=m.from===state.user;
    if(m.file){
      const f=m.file;
      const icon=f.category==='image'?'🖼️':f.category==='video'?'🎬':f.category==='audio'?'🎵':'📄';
      const sizeStr=f.size>1048576?(f.size/1048576).toFixed(1)+'MB':f.size>1024?(f.size/1024).toFixed(1)+'KB':f.size+'B';
      return `<div class="chat-msg ${isSent?'sent':'received'} chat-file"><div style="display:flex;align-items:center;gap:10px;padding:4px 0">${f.category==='image'?`<img src="${f.path}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0">`:`<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border-radius:8px;flex-shrink:0;font-size:22px">${icon}</div>`}<div style="flex:1;min-width:0"><div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div><div style="font-size:11px;opacity:.5;margin-top:2px">${sizeStr}</div></div><a href="/api/cloud/download/${f.id}" download style="padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.08);font-size:12px;text-decoration:none;flex-shrink:0">⬇️</a></div><div class="msg-time">${fmtTime2(m.time)}</div></div>`;
    }
    return `<div class="chat-msg ${isSent?'sent':'received'}">${esc(m.text)}<div class="msg-time">${fmtTime2(m.time)}</div></div>`;
  }).join('');
  msgs.scrollTop=msgs.scrollHeight;
}
async function sendDM(){
  const input=document.getElementById('chatInput');
  if(!input||!input.value.trim()||!currentChatUser)return;
  const content=input.value.trim();input.value='';
  const d=await api('/api/dm/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:currentChatUser,text:content})});
  if(d.ok){
    const msgs=document.getElementById('chatMsgs');
    msgs.innerHTML+=`<div class="chat-msg sent">${esc(content)}<div class="msg-time">${fmtTime2(Date.now())}</div></div>`;
    msgs.scrollTop=msgs.scrollHeight;
  }else toast(d.msg||'发送失败');
}
async function showFilePicker(){
  const d=await api('/api/cloud/files?category=all');
  if(!d.ok||!d.files.length){toast('云盘没有文件，请先上传');return}
  const modal=document.getElementById('filePickerModal');
  const el=document.getElementById('filePickerList');
  const sizeStr=(s)=>s>1048576?(s/1048576).toFixed(1)+'MB':s>1024?(s/1024).toFixed(1)+'KB':s+'B';
  el.innerHTML=d.files.map(f=>{
    const icon=f.category==='image'?'🖼️':f.category==='video'?'🎬':f.category==='audio'?'🎵':'📄';
    return `<div onclick="sendFileInChat('${f.id}')" style="display:flex;align-items:center;gap:10px;padding:12px;border-bottom:1px solid rgba(255,255,255,.03);cursor:pointer;transition:background .2s">
      ${f.category==='image'?`<img src="${f.path}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;flex-shrink:0">`:`<div style="width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04);border-radius:8px;flex-shrink:0;font-size:18px">${icon}</div>`}
      <div style="flex:1;min-width:0"><div style="font-size:13px;color:#e8e8e8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div><div style="font-size:11px;color:var(--text3)">${sizeStr(f.size)}</div></div>
    </div>`;
  }).join('');
  modal.style.display='flex';
}
function closeFilePicker(){document.getElementById('filePickerModal').style.display='none'}
async function sendFileInChat(fileId){
  closeFilePicker();
  const d=await api('/api/dm/send-file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:currentChatUser,fileId})});
  if(d.ok){
    const msgs=document.getElementById('chatMsgs');
    const f=d.message.file;
    const icon=f.category==='image'?'🖼️':f.category==='video'?'🎬':f.category==='audio'?'🎵':'📄';
    const sizeStr=f.size>1048576?(f.size/1048576).toFixed(1)+'MB':f.size>1024?(f.size/1024).toFixed(1)+'KB':f.size+'B';
    msgs.innerHTML+=`<div class="chat-msg sent chat-file"><div style="display:flex;align-items:center;gap:10px;padding:4px 0">${f.category==='image'?`<img src="${f.path}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0">`:`<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.06);border-radius:8px;flex-shrink:0;font-size:22px">${icon}</div>`}<div style="flex:1;min-width:0"><div style="font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(f.name)}</div><div style="font-size:11px;opacity:.5;margin-top:2px">${sizeStr}</div></div><a href="/api/cloud/download/${f.id}" download style="padding:6px 10px;border-radius:8px;background:rgba(255,255,255,.08);font-size:12px;text-decoration:none;flex-shrink:0">⬇️</a></div><div class="msg-time">${fmtTime2(d.message.time)}</div></div>`;
    msgs.scrollTop=msgs.scrollHeight;
  }else toast(d.msg||'发送失败');
}


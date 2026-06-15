// ===== 认证 =====
function switchAuth(m){
  document.getElementById('loginForm').style.display=m==='login'?'':'none';
  document.getElementById('regForm').style.display=m==='register'?'':'none';
  document.querySelectorAll('#authTab div').forEach((e,i)=>e.className=i===(m==='login'?0:1)?'active':'');
}
function toggleLoginMode(){
  useCodeLogin=!useCodeLogin;
  document.getElementById('loginPasswordWrap').style.display=useCodeLogin?'none':'';
  document.getElementById('loginCodeWrap').style.display=useCodeLogin?'':'none';
  document.querySelector('#loginForm .link-btn').textContent=useCodeLogin?'🔑 用密码登录':'📧 用验证码登录';
}
let ct=0;
async function sendLoginCode(){
  const email=document.getElementById('loginEmail').value.trim();
  if(!email)return document.getElementById('loginMsg').textContent='请输入邮箱';
  document.getElementById('loginCodeBtn').disabled=true;let s=60;
  document.getElementById('loginCodeBtn').textContent=s+'s';
  ct=setInterval(()=>{s--;if(s>0)document.getElementById('loginCodeBtn').textContent=s+'s';else{clearInterval(ct);document.getElementById('loginCodeBtn').disabled=false;document.getElementById('loginCodeBtn').textContent='重新获取'}},1000);
  const d=await api('/api/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
  document.getElementById('loginMsg').textContent=d.msg||'验证码已发送';
}
async function doLogin(){
  var email=document.getElementById('loginEmail').value.trim();
  var remember=document.getElementById('rememberMe').checked;
  var msg=document.getElementById('loginMsg');
  if(!email){msg.textContent='请输入邮箱';return}
  var d;
  if(useCodeLogin){
    var code=document.getElementById('loginCode').value.trim();
    if(!code){msg.textContent='请输入验证码';return}
    msg.textContent='登录中...';
    try{d=await api('/api/email-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,code:code,remember:remember})})}catch(e){msg.textContent='网络错误:'+e.message;return}
  }else{
    var pass=document.getElementById('loginPass').value;
    if(!pass){msg.textContent='请输入密码';return}
    msg.textContent='登录中...';
    try{d=await api('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email,password:pass,remember:remember})})}catch(e){msg.textContent='网络错误:'+e.message;return}
  }
  if(d.ok){clearInterval(ct);msg.textContent='登录成功！';initApp().catch(e=>{console.error('initApp error:',e)});if(d.needPassword)toast('建议设置密码，方便下次登录')}
  else msg.textContent='❌ '+(d.msg||'未知错误')+'(v4.6)';
}
let regCt=0;
async function sendRegCode(){
  const email=document.getElementById('regEmail').value.trim();
  if(!email)return document.getElementById('regMsg').textContent='请输入邮箱';
  document.getElementById('regCodeBtn').disabled=true;let s=60;
  document.getElementById('regCodeBtn').textContent=s+'s';
  regCt=setInterval(()=>{s--;if(s>0)document.getElementById('regCodeBtn').textContent=s+'s';else{clearInterval(regCt);document.getElementById('regCodeBtn').disabled=false;document.getElementById('regCodeBtn').textContent='重新获取'}},1000);
  const d=await api('/api/send-code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email})});
  document.getElementById('regMsg').textContent=d.msg||'验证码已发送';
}
async function doRegister(){
  const email=document.getElementById('regEmail').value.trim();
  const code=document.getElementById('regCode').value.trim();
  const nick=document.getElementById('regNick').value.trim();
  const pass=document.getElementById('regPass').value;
  const pass2=document.getElementById('regPass2').value;
  if(!email)return document.getElementById('regMsg').textContent='请输入邮箱';
  if(!code)return document.getElementById('regMsg').textContent='请输入验证码';
  if(!pass)return document.getElementById('regMsg').textContent='请设置密码';
  if(pass.length<6)return document.getElementById('regMsg').textContent='密码至少6位';
  if(pass!==pass2)return document.getElementById('regMsg').textContent='两次密码不一致';
  const d=await api('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,code,password:pass,nickname:nick})});
  if(d.ok){clearInterval(regCt);initApp()}else document.getElementById('regMsg').textContent=d.msg;
}
async function logout(){await api('/api/logout',{method:'POST'});state.loggedIn=false;document.getElementById('app').style.display='none';document.getElementById('authPage').style.display='flex';document.getElementById('tabBar').style.display='none';if(dmPollTimer)clearInterval(dmPollTimer);toast('已退出')}

async function initApp(){
  const d=await api('/api/check');
  if(d.loggedIn){
    Object.assign(state,d,{loggedIn:true});
    document.getElementById('authPage').style.display='none';
    document.getElementById('app').style.display='block';document.getElementById('app').classList.add('logged-in');document.getElementById('tabBar').style.display='';
    
    state.posts=[];state.page=1;state.hasMore=true;
    loadPosts().catch(()=>{});renderProfile().catch(()=>{});loadNotifications().catch(()=>{});loadWeather().catch(()=>{});loadStories().catch(()=>{});
    startDMPolling();
    if(!d.hasPassword)toast('💡 建议去"我的"设置密码',3000);
  }
}
// ===== DM Polling =====
function startDMPolling(){
  if(dmPollTimer)clearInterval(dmPollTimer);
  dmPollTimer=setInterval(async()=>{
    if(!state.loggedIn)return;
    try{
      const d=await api('/api/dm/conversations');
      if(d.ok){
        const totalUnread=d.conversations.reduce((a,c)=>a+c.unread,0);
      }
    }catch(e){}
  },30000);
}

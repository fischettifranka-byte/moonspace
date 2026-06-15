// 星空背景已改用CSS伪元素，无需JS生成
let state={loggedIn:false,user:'',nickname:'',email:'',avatar:'',bio:'',postCount:0,totalLikes:0,points:0,level:0,followingCount:0,followersCount:0,hasPassword:false,achievementCount:0,bgmSong:null,posts:[],page:1,hasMore:true,loading:false};
let pendingFiles=[];let pageHistory=[];let currentMusicTab='discover';
let musicSource='netease';
let musicQuality=localStorage.getItem('musicQuality')||'standard';
function switchMusicSource(){musicSource=document.getElementById('musicSource').value;toast(musicSource==='netease'?'☁️ 网易云模式':'🆓 免费模式')}
function switchMusicQuality(){musicQuality=document.getElementById('musicQuality').value;localStorage.setItem('musicQuality',musicQuality);toast('🎵 音质: '+{standard:'标准',higher:'较高',exhigh:'极高',lossless:'无损',hires:'Hi-Res'}[musicQuality])}
(function(){const q=localStorage.getItem('musicQuality');if(q){musicQuality=q;const sel=document.getElementById('musicQuality');if(sel)sel.value=q}})();
let currentMsgTab='received';let currentLBTab='points';
let playlist=[];let currentSong=-1;let isPlaying=false;let lrcLines=[];let currentLrcIdx=-1;
// ===== 播放历史 =====
function getPlayHistory(){try{return JSON.parse(localStorage.getItem('playHistory_'+state.user)||'[]')}catch(e){return[]}}
function addToHistory(song){if(!state.user||!song.id)return;let h=getPlayHistory();h=h.filter(s=>s.id!==song.id);h.unshift({id:song.id,name:song.name,artists:song.artists,cover:song.cover,time:Date.now()});if(h.length>100)h=h.slice(0,100);localStorage.setItem('playHistory_'+state.user,JSON.stringify(h))}
function loadHistoryPlaylist(){const h=getPlayHistory();if(h.length){playlist=h;currentSong=0;startPlay();toast('📜 播放历史 '+h.length+'首')}else toast('还没有播放历史')}
let useCodeLogin=false;
let storyGroups=[];let currentStoryGroup=-1;let currentStoryItem=0;let storyTimer=null;
let squareSort='hot';let squarePage=1;let squareHasMore=true;let squareLoading=false;
let dmPollTimer=null;let currentChatUser=null;

// ===== Theme =====
function toggleTheme(){
  const isLight=document.body.classList.toggle('light');
  localStorage.setItem('theme',isLight?'light':'dark');
  const icon=document.getElementById('themeIcon');
  if(icon)icon.textContent=isLight?'☀️':'🌙';
  toast(isLight?'☀️ 浅色模式':'🌙 深色模式');
}
(function(){
  const t=localStorage.getItem('theme');
  if(t==='light'){document.body.classList.add('light')}
  // Update theme icon when profile page renders
  const observer=new MutationObserver(()=>{
    const icon=document.getElementById('themeIcon');
    if(icon){
      const isLight=document.body.classList.contains('light');
      icon.textContent=isLight?'☀️':'🌙';
    }
  });
  observer.observe(document.body,{attributes:true,attributeFilter:['class']});
})();


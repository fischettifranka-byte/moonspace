// ===== Float Player Drag =====
(function(){
  const fp=document.getElementById('floatPlayer');
  if(!fp)return;
  let isDragging=false,startX,startY,startLeft,startBottom,dragMoved=false;
  fp.addEventListener('touchstart',function(e){
    const t=e.touches[0];isDragging=true;dragMoved=false;
    startX=t.clientX;startY=t.clientY;
    const r=fp.getBoundingClientRect();
    startLeft=r.left;startBottom=window.innerHeight-r.bottom;
  },{passive:true});
  fp.addEventListener('touchmove',function(e){
    if(!isDragging)return;
    const t=e.touches[0];
    const dx=t.clientX-startX,dy=t.clientY-startY;
    if(Math.abs(dx)>5||Math.abs(dy)>5)dragMoved=true;
    const newLeft=Math.max(0,Math.min(window.innerHeight-56,startLeft+dx));
    const newBottom=Math.max(68,Math.min(window.innerHeight-56,startBottom-dy));
    fp.style.left=newLeft+'px';fp.style.right='auto';
    fp.style.bottom=newBottom+'px';
  },{passive:true});
  fp.addEventListener('touchend',function(){
    isDragging=false;
    if(!dragMoved){openExPlayer()}
    // Snap to nearest edge
    const r=fp.getBoundingClientRect();
    const mid=window.innerWidth/2;
    if(r.left+r.width/2<mid){fp.style.left='12px';fp.style.right='auto'}
    else{fp.style.left='auto';fp.style.right='12px'}
  });
  // Mouse support
  fp.addEventListener('mousedown',function(e){
    isDragging=true;dragMoved=false;
    startX=e.clientX;startY=e.clientY;
    const r=fp.getBoundingClientRect();
    startLeft=r.left;startBottom=window.innerHeight-r.bottom;
    e.preventDefault();
  });
  document.addEventListener('mousemove',function(e){
    if(!isDragging)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    if(Math.abs(dx)>5||Math.abs(dy)>5)dragMoved=true;
    const newLeft=Math.max(0,Math.min(window.innerWidth-56,startLeft+dx));
    const newBottom=Math.max(68,Math.min(window.innerHeight-56,startBottom-dy));
    fp.style.left=newLeft+'px';fp.style.right='auto';
    fp.style.bottom=newBottom+'px';
  });
  document.addEventListener('mouseup',function(){
    if(!isDragging)return;
    isDragging=false;
    if(!dragMoved){openExPlayer()}
    const r=fp.getBoundingClientRect();
    const mid=window.innerWidth/2;
    if(r.left+r.width/2<mid){fp.style.left='12px';fp.style.right='auto'}
    else{fp.style.left='auto';fp.style.right='12px'}
  });
})();

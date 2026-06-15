(async()=>{const d=await api('/api/check');if(d.loggedIn)initApp()})();

// 全局性能优化：passive scroll + GPU hints
(function(){
  if(typeof window==='undefined')return;
  var add=EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener=function(type,fn,opts){
    var o=opts;
    if((type==='touchstart'||type==='touchmove'||type==='wheel'||type==='mousewheel')&&(typeof o!=='object'||o===null)){o={passive:true}}
    else if(typeof o==='object'&&o!==null&&o.passive===undefined&&(type==='touchstart'||type==='touchmove'||type==='wheel'||type==='mousewheel')){o=Object.assign({},o,{passive:true})}
    return add.call(this,type,fn,o);
  };
})();

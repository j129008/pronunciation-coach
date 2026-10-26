
/* ---- data loader: data/items.json → IndexedDB → file picker ---- */
const IDB={open(){return new Promise((ok,no)=>{const r=indexedDB.open('pronunciation-coach',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})},
 async get(k){const db=await this.open();return new Promise((ok,no)=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})},
 async set(k,v){const db=await this.open();return new Promise((ok,no)=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').put(v,k);t.oncomplete=()=>ok();t.onerror=()=>no(t.error)})},
 async del(k){const db=await this.open();return new Promise(ok=>{const t=db.transaction('kv','readwrite');t.objectStore('kv').delete(k);t.oncomplete=()=>ok()})}};
function validItems(a){if(!Array.isArray(a))a=a&&a.items;if(!Array.isArray(a)||!a.length)throw new Error('JSON 必須是陣列（或 {items:[...]}）');
 return a.map((d,k)=>{if(!d||typeof d.e!=='string')throw new Error('第 '+(k+1)+' 筆缺少 "e"（英文）欄位');return Object.assign({i:k+1,t:'sentence',z:'',x:'',p:'',l:''},d)})}
async function loadData(){
 try{const r=await fetch('data/items.json',{cache:'no-store'});if(r.ok)return validItems(await r.json())}catch(e){}
 try{const v=await IDB.get('items');if(v&&v.length)return v}catch(e){}
 return new Promise(ok=>{const ov=document.getElementById('loadScreen');ov.style.display='flex';
  const use=(items,save)=>{(save?IDB.set('items',items).catch(()=>{}):Promise.resolve()).then(()=>{ov.style.display='none';ok(items)})};
  document.getElementById('dataFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{use(validItems(JSON.parse(await f.text())),true)}catch(err){document.getElementById('loadErr').textContent='讀取失敗：'+err.message}};
  document.getElementById('loadSample').onclick=async()=>{try{const r=await fetch('data/sample.json');use(validItems(await r.json()),false)}catch(err){document.getElementById('loadErr').textContent='無法載入範例：'+err.message}}})}
loadData().then(DATA=>{startApp(DATA)});
async function forgetData(){if(confirm('移除瀏覽器中保存的練習資料？（練習進度不會刪除）')){await IDB.del('items');location.reload()}}
function startApp(DATA){

const $=id=>document.getElementById(id);
function getWeak(){try{return JSON.parse(localStorage.weakWords||'{}')}catch(e){return {}}}
function setWeak(w){localStorage.weakWords=JSON.stringify(w)}
function getWeakItems(){try{return JSON.parse(localStorage.weakItems||'{}')}catch(e){return {}}}
const byId=new Map(DATA.map(d=>[d.i,d]));
const TL={sentence:'句子',vocab:'單字',extra:'補充'};
function lessonOf(d){const m=(d.l||'').match(/L(\d{2,4})/);return m?'L'+m[1].padStart(3,'0'):'其他'}
DATA.forEach(d=>{d.L=lessonOf(d)});
const ORDERED=DATA.slice().sort((a,b)=>(a.L==='其他')-(b.L==='其他')||a.L.localeCompare(b.L)||a.i-b.i);
ORDERED.forEach((d,k)=>d.o_=k);
const DAY=864e5;
function lsGet(k,def){try{return JSON.parse(localStorage[k]||'null')||def}catch(e){return def}}
let PROG=lsGet('progress',{});
function saveProg(){localStorage.progress=JSON.stringify(PROG)}
(function migrate(){if(localStorage.progMigrated)return;const wi=lsGet('weakItems',{});const now=Date.now()-36e5;
 for(const [id,s] of Object.entries(wi))if(!PROG[id]&&byId.has(+id))PROG[id]={a:1,b:s,l:s,d:now,h:[s]};saveProg();localStorage.progMigrated='1'})();
function dkey(t){const d=new Date(t);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function statusOf(id,now){const p=PROG[id];now=now||Date.now();if(!p||!p.a)return 'new';
 if(p.l>=85)return (now-p.d>=3*DAY)?'due':'good';if(p.l>=70)return 'fair';return 'weak'}
const ST={new:['未練','#b0b4bd'],weak:['要加強','#e5484d'],fair:['還不錯','#f5a524'],good:['已熟練','#30a46c'],due:['待複習','#7c5cff']};
function recordAttempt(score){if(!cur)return;score=Math.max(0,Math.min(100,Math.round(score)));const id=cur.i,now=Date.now();
 const p=PROG[id]||{a:0,b:0,l:0,d:0,h:[]};const prevBest=p.a?p.b:null;p.a++;p.l=score;p.b=Math.max(p.a>1?p.b:0,score);p.d=now;p.h=(p.h||[]).concat(score).slice(-5);PROG[id]=p;saveProg();
 const days=lsGet('days',{});const k=dkey(now);days[k]=(days[k]||0)+1;localStorage.days=JSON.stringify(days);
 renderDash();renderList();showSummary(score,prevBest,p)}
function streak(){const days=lsGet('days',{});let n=0,t=Date.now();if(!days[dkey(t)])t-=DAY;while(days[dkey(t)]){n++;t-=DAY}return n}
// filters
let fStatus='all',fType='',fQuery='';const openG=new Set();
function inFilter(d,now){if(fType&&d.t!==fType)return false;if(fQuery&&!(d.e+' '+d.z+' '+(d.x||'')+' #'+d.i).toLowerCase().includes(fQuery))return false;
 if(fStatus!=='all'&&statusOf(d.i,now)!==fStatus)return false;return true}
let filtered=ORDERED,cur=null;
function applyFilter(){const now=Date.now();filtered=ORDERED.filter(d=>inFilter(d,now));renderList()}
// dashboard
function renderDash(){const now=Date.now(),c={new:0,weak:0,fair:0,good:0,due:0};let sum=0,n=0;
 for(const d of DATA){const s=statusOf(d.i,now);c[s]++;const p=PROG[d.i];if(p&&p.a){sum+=p.l;n++}}
 const today=lsGet('days',{})[dkey(now)]||0;const T=DATA.length;
 $('bar').innerHTML=['good','due','fair','weak'].map(s=>`<span style="width:${100*c[s]/T}%;background:${ST[s][1]}" title="${ST[s][0]} ${c[s]}"></span>`).join('');
 $('stats').innerHTML=Object.keys(ST).map(s=>`<span class="stat" data-chip="${s}"><i class="dot" style="background:${ST[s][1]}"></i>${ST[s][0]} <b>${c[s]}</b></span>`).join('')+
  `<span class="stat">📅 今天 <b>${today}</b></span><span class="stat">🔥 連續 <b>${streak()}</b> 天</span><span class="stat">📊 平均 <b>${n?Math.round(sum/n):'-'}</b></span>`;
 document.querySelectorAll('#chips .chip').forEach(ch=>{const s=ch.dataset.st;ch.classList.toggle('on',s===fStatus);const cnt=s==='all'?T:c[s];ch.querySelector('em').textContent=cnt})}
// virtual list
const RH=44,HH=36;let rows=[];
function buildRows(){const groups=new Map();for(const d of filtered){if(!groups.has(d.L))groups.set(d.L,[]);groups.get(d.L).push(d)}
 const expandAll=!!fQuery||fStatus!=='all';rows=[];
 for(const [L,items] of groups){let done=0,sum=0,n=0;for(const d of items){const p=PROG[d.i];if(p&&p.a){done++;sum+=p.l;n++}}
  const open=expandAll?!openG.has('x'+L):openG.has(L);rows.push({h:1,L,items:items.length,done,avg:n?Math.round(sum/n):null,open});if(open)for(const d of items)rows.push({d})}
 let y=0;for(const r of rows){r.y=y;y+=r.h?HH:RH}return y}
function renderList(){const total=buildRows();$('vinner').style.height=total+'px';$('lcount').textContent=filtered.length+' 筆';drawRows()}
function drawRows(){const box=$('vlist'),top=box.scrollTop,bot=top+box.clientHeight+200,now=Date.now();let h='';
 for(const r of rows){if(r.y+RH<top-200)continue;if(r.y>bot)break;
  if(r.h)h+=`<div class="grp" style="top:${r.y}px" data-g="${r.L}"><span>${r.open?'▾':'▸'} ${r.L}</span><small>${r.done}/${r.items}${r.avg!=null?' • 平均 '+r.avg:''}</small><i class="gbar"><i style="width:${100*r.done/r.items}%"></i></i></div>`;
  else{const d=r.d,p=PROG[d.i],s=statusOf(d.i,now);
   h+=`<div class="row${cur===d?' cur':''}" style="top:${r.y}px" data-i="${d.i}"><i class="dot" style="background:${ST[s][1]}" title="${ST[s][0]}"></i><span class="rt">${esc(d.e)}</span><span class="rm">${p&&p.a?`<b>${p.b}</b><small>×${p.a}</small>`:`<small>${TL[d.t]}</small>`}${s==='due'?'<em class="due">待複習</em>':''}</span></div>`}}
 $('vinner').innerHTML=h}
function scrollToCur(){if(!cur)return;if(!openG.has(cur.L)){openG.add(cur.L);openG.delete('x'+cur.L);renderList()}const r=rows.find(r=>r.d===cur);if(!r)return;const b=$('vlist');if(r.y<b.scrollTop||r.y>b.scrollTop+b.clientHeight-RH)b.scrollTop=r.y-b.clientHeight/3;drawRows()}
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function show(d,reason){if(!d)return;cur=d;const p=PROG[d.i],s=statusOf(d.i);
 $('meta').innerHTML=`<span class="tag" style="background:${ST[s][1]}">${ST[s][0]}</span> #${d.i}・${TL[d.t]}・${esc(d.L)}${p&&p.a?`・最佳 <b>${p.b}</b>・上次 ${p.l}・練 ${p.a} 次・歷史 ${p.h.join(' → ')}`:''}`;
 $('reason').textContent=reason||'';$('reason').style.display=reason?'inline-block':'none';
 $('tgt').textContent=d.e;$('ipa').textContent=d.p?'/'+d.p+'/':'';
 $('zh').innerHTML=esc(d.z)+(d.x?`<br><small>例句：${esc(d.x)}</small>`:'')+(d.o?`<br><small>原本說法：${esc(d.o)}</small>`:'');
 $('result').style.display='none';$('summary').style.display='none';$('interim').textContent='';$('myAudio').style.display='none';$('status').innerHTML='';
 location.hash=d.i;scrollToCur();drawRows();if(innerWidth<900)document.body.classList.remove('side-open')}
// smart pick
let pickN=0;const seenS=new Set();
function smartPick(pool,now,lastId){now=now||Date.now();pool=pool||filtered;const recent=10*60*1000;
 const fresh=d=>{const p=PROG[d.i];return !p||now-p.d>=recent};
 const due=[],weak=[],fair=[],neu=[];
 for(const d of pool){if(d.i===lastId||seenS.has(d.i))continue;const s=statusOf(d.i,now);if(s==='new')neu.push(d);else if(!fresh(d))continue;else if(s==='due')due.push(d);else if(s==='weak')weak.push(d);else if(s==='fair')fair.push(d)}
 due.sort((a,b)=>PROG[a.i].d-PROG[b.i].d);weak.sort((a,b)=>PROG[a.i].l-PROG[b.i].l);fair.sort((a,b)=>PROG[a.i].l-PROG[b.i].l);
 const review=due.concat(weak);const wantReview=pickN%3===0;pickN++;
 const why=d=>{const p=PROG[d.i],s=statusOf(d.i,now);if(s==='new')return '🆕 新題';if(s==='due')return `⏰ 已熟練但 ${Math.floor((now-p.d)/DAY)} 天沒練，複習一下`;return `🔁 上次 ${p.l} 分，再練一次`};
 let d=(wantReview&&review[0])||neu[0]||review[0]||fair[0];
 if(!d&&seenS.size){seenS.clear();return smartPick(pool,now,lastId)}
 if(!d){const all=pool.filter(x=>x.i!==lastId&&PROG[x.i]).sort((a,b)=>PROG[a.i].d-PROG[b.i].d);d=all[0];if(d)return {d,why:'🔄 都練得不錯！複習最久沒練的'};return null}
 return {d,why:why(d)}}
function next(){if(cur)seenS.add(cur.i);const r=smartPick(filtered,Date.now(),cur&&cur.i);if(!r)return alert('目前篩選條件下沒有項目');show(r.d,r.why)}
function step(k){const a=filtered.length?filtered:ORDERED;let j=cur?a.indexOf(cur):-1;show(a[(j+k+a.length)%a.length])}
function showSummary(score,prevBest,p){const s=$('summary');s.style.display='flex';const st=statusOf(cur.i);
 const diff=prevBest==null?'第一次練習':score>prevBest?`🎉 新紀錄！(+${score-prevBest})`:score===prevBest?'平最佳紀錄':`最佳 ${prevBest}（差 ${prevBest-score}）`;
 s.innerHTML=`<div class="big" style="color:${ST[st][1]}">${score}</div><div><div><span class="tag" style="background:${ST[st][1]}">${ST[st][0]}</span> 這次 <b>${score}</b> ・ ${diff}</div><small>最近：${p.h.join(' → ')}（共 ${p.a} 次）</small></div>
 <div class="sp"></div><button id="again" class="ghost">↺ 再唸一次</button><button id="next2" class="primary">▶ 下一題 <kbd>N</kbd></button>`;
 $('again').onclick=()=>$('rec').click();$('next2').onclick=next}
// TTS
const RANK=['Google US English','Samantha','Ava','Allison','Zoe','Premium','Enhanced','Natural','Aria','Jenny'];
function rankV(v){let r=RANK.findIndex(k=>v.name.includes(k));return (r<0?99:r)+(v.lang==='en-US'||v.lang==='en_US'?0:50)}
function fillVoices(){const sel=$('voice');const saved=localStorage.voice||'google';
 const vs=speechSynthesis.getVoices().filter(v=>/^en[-_]/i.test(v.lang)).sort((a,b)=>rankV(a)-rankV(b));
 sel.innerHTML='<option value="google">Google（預設）</option>'+vs.map(v=>`<option value="${esc(v.name)}">${esc(v.name)} (${v.lang})</option>`).join('');
 sel.value=[...sel.options].some(o=>o.value===saved)?saved:'google'}
const player=new Audio();let ttsQueue=[],ttsGen=0;
function ttsChunks(text){const out=[];let cur='';for(const w of text.split(/\s+/)){if((cur+' '+w).trim().length>190&&cur){out.push(cur);cur=w}else cur=(cur+' '+w).trim()}if(cur)out.push(cur);return out}
function sysSpeak(text,rate){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);const name=localStorage.voice;
 let v=speechSynthesis.getVoices().find(v=>v.name===name&&name!=='google');
 if(!v)v=speechSynthesis.getVoices().filter(v=>/^en[-_]/i.test(v.lang)).sort((a,b)=>rankV(a)-rankV(b))[0];
 if(v){u.voice=v;u.lang=v.lang}else u.lang='en-US';u.rate=rate;speechSynthesis.speak(u)}
function speak(text,rate){rate=rate||($('slow').checked?0.7:1);speechSynthesis.cancel();player.pause();
 if((localStorage.voice||'google')!=='google')return sysSpeak(text,rate);
 const gen=++ttsGen;const q=ttsChunks(text);let failed=false;
 const playNext=()=>{if(gen!==ttsGen||!q.length)return;const c=q.shift();
  player.src='https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q='+encodeURIComponent(c);
  player.onended=playNext;player.onerror=()=>{if(gen!==ttsGen||failed)return;failed=true;sysSpeak([c,...q].join(' '),rate)};
  player.playbackRate=rate;player.defaultPlaybackRate=rate;player.preservesPitch=true;
  const p=player.play();if(p)p.catch(e=>{if(e.name!=='AbortError'&&!failed&&gen===ttsGen){failed=true;sysSpeak([c,...q].join(' '),rate)}})};
 playNext()}
speechSynthesis.onvoiceschanged=fillVoices;
$('listen').onclick=()=>cur&&speak(cur.e);
// alignment
function lev(a,b){const m=a.length,n=b.length,D=[];for(let i=0;i<=m;i++){D[i]=[i];}for(let j=0;j<=n;j++)D[0][j]=j;
 for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)D[i][j]=Math.min(D[i-1][j]+1,D[i][j-1]+1,D[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return D}
function charSim(a,b){const D=lev(a,b);return 1-D[a.length][b.length]/Math.max(a.length,b.length,1)}
function align(T,H){const m=T.length,n=H.length,D=[];for(let i=0;i<=m;i++){D[i]=new Array(n+1);D[i][0]=i}for(let j=0;j<=n;j++)D[0][j]=j;
 const sub=(a,b)=>a===b?0:(charSim(a,b)>0.5?0.8:1);
 for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)D[i][j]=Math.min(D[i-1][j]+1,D[i][j-1]+1,D[i-1][j-1]+sub(T[i-1],H[j-1]));
 const out=[];let i=m,j=n;
 while(i>0||j>0){if(i>0&&j>0&&Math.abs(D[i][j]-(D[i-1][j-1]+sub(T[i-1],H[j-1])))<1e-9){out.push({t:T[i-1],h:H[j-1],s:T[i-1]===H[j-1]?'ok':'bad'});i--;j--}
  else if(i>0&&Math.abs(D[i][j]-(D[i-1][j]+1))<1e-9){out.push({t:T[i-1],s:'miss'});i--}else{out.push({h:H[j-1],s:'extra'});j--}}
 return out.reverse()}
const CONTR={"i'm":"i am","it's":"it is","don't":"do not","can't":"cannot","won't":"will not","i've":"i have","i'll":"i will","i'd":"i would","that's":"that is","there's":"there is","didn't":"did not","doesn't":"does not","isn't":"is not","we're":"we are","they're":"they are","you're":"you are","let's":"let us"};
function expand(ws){return ws.flatMap(w=>(CONTR[w]||w).split(' '))}
const ONES=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const TENS=['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function n2w(n){if(n<20)return ONES[n];if(n<100)return TENS[Math.floor(n/10)]+(n%10?' '+ONES[n%10]:'');
 if(n<1000)return ONES[Math.floor(n/100)]+' hundred'+(n%100?' '+n2w(n%100):'');
 for(const [v,w] of [[1e9,'billion'],[1e6,'million'],[1e3,'thousand']])if(n>=v)return n2w(Math.floor(n/v))+' '+w+(n%v?' '+n2w(n%v):'');return String(n)}
const ORD={one:'first',two:'second',three:'third',five:'fifth',eight:'eighth',nine:'ninth',twelve:'twelfth'};
function ordw(n){const w=n2w(n).split(' ');let l=w.pop();l=ORD[l]||(l.endsWith('y')?l.slice(0,-1)+'ieth':l+'th');return [...w,l].join(' ')}
function numWords(s){s=s.replace(/,/g,'');const [i,d]=s.split('.');let r=n2w(parseInt(i,10));if(d)r+=' point '+d.split('').map(c=>ONES[+c]).join(' ');return r}
const WMAP={km:'kilometer',kms:'kilometer',kilometers:'kilometer',kilometre:'kilometer',kilometres:'kilometer',meters:'meter',metre:'meter',metres:'meter',
 miles:'mile',minutes:'minute',mins:'minute',seconds:'second',secs:'second',sec:'second',hours:'hour',hrs:'hour',hr:'hour',pounds:'pound',lbs:'pound',lb:'pound',
 kg:'kilogram',kgs:'kilogram',kilograms:'kilogram',kilo:'kilogram',kilos:'kilogram',cm:'centimeter',centimeters:'centimeter',dollars:'dollar',bucks:'dollar',
 per:'per',pct:'percent',okay:'ok',mister:'mr',missus:'mrs',doctor:'dr',street:'st',versus:'vs',email:'email',
 colour:'color',colours:'colors',favour:'favor',favourite:'favorite',behaviour:'behavior',honour:'honor',labour:'labor',neighbour:'neighbor',flavour:'flavor',humour:'humor',centre:'center',theatre:'theater',programme:'program',travelling:'traveling',travelled:'traveled',cancelled:'canceled'};
const AFTERNUM={m:'meter',mi:'mile',min:'minute',s:'second',h:'hour',g:'gram',ft:'foot',feet:'foot',mm:'millimeter'};
const MULTI={eg:'for example',ie:'that is',etc:'etc'};
function canonWord(w,prevNum){if(prevNum&&AFTERNUM[w])return AFTERNUM[w];if(WMAP[w])return WMAP[w];
 if(/i[sz](e|ed|es|ing|ation|ations)$/.test(w)&&w.length>5)w=w.replace(/iz(e|ed|es|ing|ation|ations)$/,'is$1');return w}
// returns array of groups: {d: original display word, k: [keys]}
function tokenize(s){s=s.replace(/[’‘]/g,"'").replace(/\bet cetera\b/gi,'etc').replace(/\bper cent\b/gi,'percent').replace(/\be-mail/gi,'email').replace(/\bo\.?k\.?\b/gi,'ok');
 const out=[];let prevNum=false;
 for(const raw of s.split(/\s+/).filter(Boolean)){let t=raw.toLowerCase().replace(/^[^a-z0-9$&]+|[^a-z0-9%&]+$/g,'');const keys=[];let isNum=false;
  let m;
  if(!t){continue}
  if(t==='&')keys.push('and');
  else if(m=t.match(/^\$([\d,]+(?:\.\d+)?)([a-z]*)$/)){keys.push(...numWords(m[1]).split(' '),'dollar')}
  else if(m=t.match(/^([\d,]+(?:\.\d+)?)%$/)){keys.push(...numWords(m[1]).split(' '),'percent')}
  else if(m=t.match(/^(\d{1,2}):(\d{2})(am|pm)?$/)){keys.push(...n2w(+m[1]).split(' '));const mm=+m[2];if(mm>0)keys.push(...(mm<10?'oh '+ONES[mm]:n2w(mm)).split(' '));if(m[3])keys.push(m[3])}
  else if(m=t.match(/^(\d+)(st|nd|rd|th)$/)){keys.push(...ordw(+m[1]).split(' '))}
  else if(m=t.match(/^(\d[\d,]*(?:\.\d+)?)([a-z]*)$/)){keys.push(...numWords(m[1]).split(' '));isNum=true;if(m[2])keys.push(canonWord(m[2],true))}
  else{const w0=t.replace(/\./g,'');if(MULTI[w0])keys.push(...MULTI[w0].split(' '));
   else for(const p of w0.split(/[-\/]+/)){const w=p.replace(/[^a-z0-9']/g,'').replace(/^'+|'+$/g,'');if(!w)continue;
    if(/^\d+$/.test(w)){keys.push(...n2w(+w).split(' '));isNum=true;continue}
    for(const x of (CONTR[w]||w).split(' '))keys.push(canonWord(x,prevNum))}}
  if(keys.length)out.push({d:raw,k:keys});prevNum=isNum||keys.every(k=>/^(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|point|a)$/.test(k))&&keys[0]!=='a'}
 return out}
function norm(s){return tokenize(s).flatMap(g=>g.k)}
function scoreHyp(Tsrc,h){const G=tokenize(Tsrc),T=G.flatMap(g=>g.k),own=G.flatMap((g,gi)=>g.k.map(()=>gi));
 const a=align(T,norm(h));const ok=a.filter(x=>x.s==='ok').length;const ex=a.filter(x=>x.s==='extra').length;
 // regroup to display words
 const disp=[];let ti=0,last=-1;
 for(const x of a){if(x.s==='extra'){disp.push(x);continue}const gi=own[ti++];
  if(gi!==last){disp.push({t:x.t,d:G[gi].d,parts:[x]});last=gi}else disp[disp.length-1].parts.push(x)}
 for(const g of disp)if(g.parts){const ps=g.parts;g.s=ps.every(p=>p.s==='ok')?'ok':ps.every(p=>p.s==='miss')?'miss':'bad';g.h=ps.map(p=>p.h).filter(Boolean).join(' ');
  if(ps.length===1){g.t=ps[0].t}else g.t=ps.map(p=>p.t).join(' ')}
 return {a,disp,score:Math.round(100*ok/Math.max(T.length+ex*0.5,1))}}

// tips
function tipsFor(al){const tips=new Set();
 for(const x of al){const t=x.t||'',h=x.h||'';
  if(x.s==='miss'){if(['a','an','the'].includes(t))tips.add('冠詞 a/an/the 被吞掉了：雖然要輕讀，但仍要發出聲音。');else tips.add(`漏掉「${t}」：整句要把每個字都唸到，可放慢速度。`);}
  if(x.s!=='bad')continue;
  if(/ed$/.test(t)&&h===t.replace(/e?d$/,''))tips.add(`過去式 -ed 字尾不見了（${t}）：注意 /t/、/d/、/ɪd/ 要輕輕發出。`);
  if(/s$/.test(t)&&h===t.replace(/e?s$/,''))tips.add(`複數/第三人稱 -s 字尾不見了（${t}）：結尾 /s/ /z/ 要發出來。`);
  if(/s$/.test(h)&&t===h.replace(/e?s$/,''))tips.add(`多加了 -s（${t}）：注意單複數。`);
  if(/th/.test(t))tips.add(`「th」音（${t}）：舌尖輕放上下齒之間吹氣 /θ/ 或振動 /ð/，不要唸成 s/z/d/f。`);
  if((/v/.test(t)&&/w|b|f/.test(h))||(/w/.test(t)&&/v/.test(h)))tips.add(`v/w 混淆（${t}→${h}）：/v/ 上齒輕咬下唇並振動；/w/ 嘴唇圓起不碰牙齒。`);
  if((/l/.test(t)&&/n/.test(h)&&!/n/.test(t))||(/n/.test(t)&&/l/.test(h)&&!/l/.test(t)))tips.add(`l/n 混淆（${t}→${h}）：/n/ 由鼻腔出氣；/l/ 舌尖頂上齒齦、氣從舌頭兩側出。`);
  if(/r/.test(t)&&/l/.test(h)||/l/.test(t)&&/r/.test(h))tips.add(`r/l 混淆（${t}→${h}）：/r/ 舌尖不碰上顎並捲起；/l/ 舌尖要頂住。`);
  if(h&&t.startsWith(h)&&t.length>h.length&&!/(ed|s)$/.test(t))tips.add(`字尾子音被吞掉（${t}→${h}）：英文結尾子音如 t/d/k/g/p/b 要輕輕收尾，不要省略。`);
  else if(h&&h.length>2&&t.length>2&&h.slice(0,-1)===t.slice(0,-1))tips.add(`結尾子音不清楚（${t}→${h}）：注意最後一個音。`);
  if(/sh/.test(t)&&/s/.test(h)&&!/sh/.test(h)||/s/.test(t)&&/sh/.test(h)&&!/sh/.test(t))tips.add(`s/sh 混淆（${t}→${h}）：/ʃ/ 嘴唇嘟起、舌頭後縮。`);
  if(/^(i|e)/.test(t)&&charSim(t,h)>0.5)tips.add(`母音長短（${t}→${h}）：注意 /iː/（長、嘴角拉開）與 /ɪ/（短、放鬆）等的差別。`);
 }
 if(!tips.size&&al.some(x=>x.s==='bad'))tips.add('有些字被聽成別的字：試試慢速聽示範，跟讀並注意重音與每個子音。');
 return [...tips].slice(0,8)}
function recordWeak(al,score){const w=getWeak();for(const x of al){if(!x.t)continue;const k=x.t;w[k]=w[k]||{bad:0,ok:0,heard:''};if(x.s==='ok')w[k].ok++;else{w[k].bad++;if(x.h)w[k].heard=x.h}}setWeak(w);
 const wi=getWeakItems();if(score<85)wi[cur.i]=score;else delete wi[cur.i];localStorage.weakItems=JSON.stringify(wi);renderWeak()}
function renderWeak(){const w=getWeak();const arr=Object.entries(w).filter(([k,v])=>v.bad>0).sort((a,b)=>(b[1].bad-b[1].ok/2)-(a[1].bad-a[1].ok/2)).slice(0,60);
 $('weakList').innerHTML=arr.length?arr.map(([k,v])=>`<span class="w bad" style="font-size:15px;cursor:pointer" data-w="${esc(k)}" title="點擊聽發音">${esc(k)} <small>✗${v.bad} ✓${v.ok}${v.heard?' 聽成:'+esc(v.heard):''}</small></span>`).join(''):'<small>尚無紀錄</small>'}
$('weakList').onclick=e=>{const s=e.target.closest('[data-w]');if(s)speak(s.dataset.w,0.7)};
$('clearWeak').onclick=()=>{if(confirm('清除所有弱點紀錄？')){localStorage.removeItem('weakWords');localStorage.removeItem('weakItems');renderWeak()}};
function showResult(best,alts){const {a,score}=best;$('result').style.display='block';$('score').textContent=score+'%';
 $('score').style.color=score>=85?'#1a8a1a':score>=60?'#c80':'#c00';
 $('words').innerHTML=(best.disp||a).map(x=>x.s==='extra'?`<span class="w extra">+${esc(x.h)}</span>`:`<span class="w ${x.s}" data-w="${esc(x.d||x.t)}">${esc(x.d||x.t)}${x.s==='bad'?`<span class="heard">${esc(x.h)}</span>`:''}</span>`).join('');
 $('heardAll').innerHTML='<small>辨識結果（最佳）：'+alts.map((h,i)=>i?esc(h):'<b>'+esc(h)+'</b>').join(' ｜ ')+'</small>';
 const t=tipsFor(a);$('tips').innerHTML=t.length?'<b>💡 建議</b><ul>'+t.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':(score===100?'🎉 完美！':'');
 recordWeak(a,score);if(!suppressRec)recordAttempt(score)}
let suppressRec=false;
$('words').onclick=e=>{const s=e.target.closest('[data-w]');if(s)speak(s.dataset.w,0.7)};
// recording
let recog=null,mr=null,chunks=[],stream=null,busy=false;
async function startAudio(){try{stream=await navigator.mediaDevices.getUserMedia({audio:true});mr=new MediaRecorder(stream);chunks=[];
 mr.ondataavailable=e=>chunks.push(e.data);mr.onstop=()=>{const b=new Blob(chunks,{type:mr.mimeType});const a=$('myAudio');a.src=URL.createObjectURL(b);a.style.display='block';stream.getTracks().forEach(t=>t.stop())};mr.start()}catch(e){status('無法使用麥克風：'+e.message)}}
function stopAudio(){if(mr&&mr.state!=='inactive')mr.stop()}
function status(s){$('status').innerHTML='<small>'+s+'</small>'}
function useAzure(){return $('azOn').checked&&!!localStorage.azKey&&!!localStorage.azRegion}
function updBadge(){const b=$('modeBadge');if(b){const az=useAzure();b.textContent=az?'Azure 評分中':'預設模式';b.style.background=az?'#0a7':'#888'}}
$('rec').onclick=async()=>{if(!cur)return alert('請先選擇一個項目');
 if(azRec)return azRec.stop();
 if(busy){recog&&recog.stop();return}
 if(useAzure())return azureAssess();
 defaultRecognize()};
async function defaultRecognize(){
 const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR)return alert('此瀏覽器不支援語音辨識，請使用 Chrome 或 Edge。');
 recog=new SR();recog.lang='en-US';recog.interimResults=true;recog.maxAlternatives=5;recog.continuous=false;
 let finals=[];busy=true;$('rec').textContent='■ 停止';status('🎙️ 請開始唸…');await startAudio();
 recog.onresult=e=>{let it='';for(let i=e.resultIndex;i<e.results.length;i++){const r=e.results[i];if(r.isFinal){finals.push([...r].map(x=>x.transcript))}else it+=r[0].transcript}$('interim').textContent=it};
 recog.onerror=e=>status('辨識錯誤：'+e.error+(e.error==='not-allowed'?'（請允許麥克風；file:// 可能被擋，請改用 localhost）':e.error==='network'?'（需連網，Chrome 語音辨識走 Google 伺服器）':''));
 recog.onend=()=>{busy=false;$('rec').textContent='● 錄音並評分';stopAudio();$('interim').textContent='';
  if(!finals.length){status('沒有聽到聲音，請再試一次。');return}
  const tops=finals.map(f=>f[0]);const set=new Set([tops.join(' ')]);finals.forEach((f,i)=>f.forEach(alt=>{const c=tops.slice();c[i]=alt;set.add(c.join(' '))}));finals.flat().forEach(x=>set.add(x));
  let combos=[...set];const res=combos.map(h=>scoreHyp(cur.e,h));let bi=0;res.forEach((r,i)=>{if(r.score>res[bi].score)bi=i});
  status('完成。可以按下方播放器聽自己的聲音，再按 🔊 對照。');showResult(res[bi],[combos[bi],...combos.filter((c,i)=>i!==bi).slice(0,4)])};
 recog.start()}
// Azure

$('azKey').value=localStorage.azKey||'';$('azRegion').value=localStorage.azRegion||'';$('azOn').checked=localStorage.azOn==='1';
$('azSave').onclick=()=>{localStorage.azKey=$('azKey').value.trim();localStorage.azRegion=$('azRegion').value.trim();localStorage.azOn=$('azOn').checked?'1':'0';updBadge();alert('已儲存')};
$('azOn').onchange=()=>{localStorage.azOn=$('azOn').checked?'1':'0';updBadge()};updBadge();
let azRec=null;
function encodeWav(f32,inRate){const r=16000,ratio=inRate/r,n=Math.floor(f32.length/ratio),pcm=new Int16Array(n);
 for(let i=0;i<n;i++){const s0=Math.floor(i*ratio),s1=Math.min(f32.length,Math.floor((i+1)*ratio));let sum=0;for(let j=s0;j<s1;j++)sum+=f32[j];let v=sum/Math.max(1,s1-s0);v=Math.max(-1,Math.min(1,v));pcm[i]=v<0?v*0x8000:v*0x7fff}
 const b=new ArrayBuffer(44+n*2),d=new DataView(b);const ws=(o,s)=>{for(let i=0;i<s.length;i++)d.setUint8(o+i,s.charCodeAt(i))};
 ws(0,'RIFF');d.setUint32(4,36+n*2,true);ws(8,'WAVE');ws(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,r,true);d.setUint32(28,r*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);ws(36,'data');d.setUint32(40,n*2,true);
 new Int16Array(b,44).set(pcm);return new Blob([b],{type:'audio/wav'})}
function b64utf8(s){const by=new TextEncoder().encode(s);let bin='';by.forEach(c=>bin+=String.fromCharCode(c));return btoa(bin)}
function azReset(){busy=false;$('rec').textContent='● 錄音並評分'}
async function azureAssess(){
 if(azRec){azRec.stop();return}
 let st;try{st=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}})}catch(e){status('無法使用麥克風：'+e.message);return}
 const ctx=new (window.AudioContext||window.webkitAudioContext)();const src=ctx.createMediaStreamSource(st);const proc=ctx.createScriptProcessor(4096,1,1);
 const bufs=[];let peak=0;proc.onaudioprocess=e=>{const c=new Float32Array(e.inputBuffer.getChannelData(0));for(let i=0;i<c.length;i++){const a=Math.abs(c[i]);if(a>peak)peak=a}bufs.push(c)};
 const mute=ctx.createGain();mute.gain.value=0;src.connect(proc);proc.connect(mute);mute.connect(ctx.destination);
 busy=true;$('rec').textContent='■ 停止並評分';status('🎙️ Azure 模式：請唸出整句，唸完按「停止並評分」（最長 30 秒）');
 const timer=setTimeout(()=>azRec&&azRec.stop(),30000);
 azRec={stop:async()=>{clearTimeout(timer);azRec=null;proc.disconnect();src.disconnect();st.getTracks().forEach(t=>t.stop());const rate=ctx.sampleRate;await ctx.close();azReset();
  const len=bufs.reduce((a,b)=>a+b.length,0),all=new Float32Array(len);let o=0;for(const b of bufs){all.set(b,o);o+=b.length}
  lastCap={data:all,rate};const wav=encodeWav(all,rate);const a=$('myAudio');a.src=URL.createObjectURL(wav);a.style.display='block';
  if(peak<0.01){status(`⚠️ 麥克風幾乎沒有聲音（峰值 ${peak.toFixed(4)}）。請到 Chrome 網址列左側 🔒 / chrome://settings/content/microphone 確認選到正確的麥克風，並檢查 macOS 系統設定 → 隱私權 → 麥克風。`);return}
  status(`上傳到 Azure 評分中…（${(len/rate).toFixed(1)} 秒）`);
  try{const pa=b64utf8(JSON.stringify({ReferenceText:cur.e,GradingSystem:'HundredMark',Granularity:'Phoneme',Dimension:'Comprehensive',EnableMiscue:true,EnableProsodyAssessment:true,PhonemeAlphabet:'IPA',NBestPhonemeCount:5}));
   const resp=await fetch(`https://${localStorage.azRegion}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`,{method:'POST',headers:{'Ocp-Apim-Subscription-Key':localStorage.azKey,'Content-Type':'audio/wav; codecs=audio/pcm; samplerate=16000','Accept':'application/json','Pronunciation-Assessment':pa},body:wav});
   const txt=await resp.text();if(!resp.ok){status(`Azure HTTP ${resp.status} ${resp.statusText}：${esc(txt.slice(0,400))}`);return}
   const j=JSON.parse(txt);if(j.RecognitionStatus!=='Success'||!j.NBest||!j.NBest.length){status('Azure RecognitionStatus：'+esc(j.RecognitionStatus||txt.slice(0,300)));return}
   renderAzure(j)}catch(e){status('Azure 錯誤：'+esc(e.message)+' → 改用預設模式，請再唸一次');defaultRecognize()}}};
}
let lastCap=null,playCtx=null;
const PTIPS=[
 [['θ'],['s','f','t'],'/θ/（如 think）：舌尖輕放上下門牙之間，往外吹氣，不要振動聲帶；不是 s 或 f。'],
 [['ð'],['d','z','l'],'/ð/（如 this）：舌尖放在上下齒之間，邊吹氣邊振動聲帶；不要唸成 d 或 z。'],
 [['v'],['w','b','f'],'/v/：上排牙齒輕咬下唇，振動聲帶持續出聲；不要嘟嘴唸成 w，也不要雙唇閉合成 b。'],
 [['w'],['v'],'/w/：嘴唇圓起像吹口哨，牙齒不碰嘴唇，再快速張開。'],
 [['æ'],['ɛ','e','ɑ','a'],'/æ/（如 cat）：嘴巴張大、嘴角往兩側拉，下巴下降，介於「ㄝ」和「ㄚ」之間，比 /ɛ/ 開很多。'],
 [['ɪ'],['i','iː'],'/ɪ/（如 sit）：短而放鬆，舌頭比 /i/ 低一點，嘴角不要用力拉；不是中文的「一」。'],
 [['i','iː'],['ɪ'],'/iː/（如 seat）：長音，嘴角用力往兩側拉、舌頭前高，拉長一點。'],
 [['ʊ'],['u','uː'],'/ʊ/（如 book）：短而放鬆，嘴唇輕微圓起；不要拉長成 /uː/。'],
 [['u','uː'],['ʊ'],'/uː/（如 food）：嘴唇用力嘟圓、拉長音。'],
 [['l'],['n'],'/l/：舌尖頂住上排牙齦，氣從舌頭兩側出，鼻子不出氣；捏鼻子試試仍能發出聲音。'],
 [['n'],['l'],'/n/：舌尖頂上牙齦，氣從鼻腔出去（捏鼻子會發不出來）。'],
 [['ɹ','r'],['l','w'],'/r/：舌尖往後捲、不碰上顎，嘴唇微圓；跟 /l/ 不同，舌頭不接觸任何地方。'],
 [['l'],['ɹ','r'],'/l/：舌尖要確實頂到上牙齦。'],
 [['ʃ'],['s'],'/ʃ/（如 she）：嘴唇嘟起往前、舌頭稍往後，像「噓」；/s/ 則是嘴角拉開。'],
 [['s'],['ʃ'],'/s/：嘴角拉開、舌尖靠近上牙齦，氣流細而直；不要嘟嘴變成 /ʃ/。'],
 [['z'],['s'],'/z/：跟 /s/ 同位置但要振動聲帶（摸喉嚨有震動），像蜜蜂聲 zzz。'],
 [['dʒ'],['z','ʒ','tʃ','d'],'/dʒ/（如 job）：舌面先貼上顎再放開，嘴唇微嘟，振動聲帶；比中文「ㄐ」更圓唇。'],
 [['ʌ'],['ɑ','a','ɔ'],'/ʌ/（如 cup）：短而放鬆，嘴巴半開，像輕輕的「ㄜ/ㄚ」之間；不要張太大成 /ɑ/。'],
 [['ɑ'],['ʌ','ɔ'],'/ɑ/（如 hot）：嘴巴張大、舌頭放低往後，聲音拉長一點。'],
 [['ɝ','ɚ'],['ɛ','ə','ɛɹ','ɔ','ɜ','ʌ'],'/ɝ/ /ɚ/（如 work, teacher）：舌頭捲起來不碰上顎，嘴唇微圓，整個母音都帶捲舌；不要唸成「ㄝ」或「ㄜ」。'],
 [['eɪ'],['ɛ','e'],'/eɪ/（如 make）：是雙母音，從「ㄝ」滑到「一」，尾巴要滑出來。'],
 [['oʊ'],['ɔ','o','ɑ'],'/oʊ/（如 go）：雙母音，從「ㄡ」嘴唇逐漸收圓，尾巴要滑到 /ʊ/。'],
 [['n'],['ŋ'],'/n/（字尾）：舌尖頂上牙齦收尾，像「ㄣ」；不要變成後鼻音 /ŋ/。'],
 [['ŋ'],['n'],'/ŋ/（如 sing）：舌根抬起貼住軟顎，氣從鼻子出，像「ㄥ」；不要唸成 /n/。'],
 [['ʒ'],['z','dʒ'],'/ʒ/（如 usually）：像 /ʃ/ 但振動聲帶。'],
 [['tʃ'],['ʃ','ts'],'/tʃ/（如 chair）：舌面先貼上顎再爆開，嘴唇嘟起。'],
];
const FINAL_TIP={t:'字尾 /t/：舌尖碰上牙齦「停住」再輕輕放開，不能完全省略。',d:'字尾 /d/：舌尖頂上牙齦並帶聲帶振動，輕輕收尾。',k:'字尾 /k/：舌根抵住軟顎收住，輕輕放開。',p:'字尾 /p/：雙唇閉合收尾。',b:'字尾 /b/：雙唇閉合並振動。',g:'字尾 /g/：舌根抵住並振動。',s:'字尾 /s/（複數/第三人稱）一定要發出來。',z:'字尾 /z/（複數 -s 常唸 /z/）要振動聲帶發出來。',v:'字尾 /v/：上齒咬下唇並振動，不要吞掉。',l:'字尾 /l/（dark L）：舌尖仍要頂上牙齦，像輕輕的「ㄡ」+舌尖頂住。',m:'字尾 /m/：雙唇閉合收尾。',n:'字尾 /n/：舌尖頂上牙齦收尾。'};
const ERR_ZH={None:'',Mispronunciation:'發音錯誤',Omission:'漏唸',Insertion:'多唸',UnexpectedBreak:'不當停頓',MissingBreak:'缺少停頓',Monotone:'語調平板'};
function phTip(exp,heard,isFinal,word){
 if(heard==='—'||heard===''){if(isFinal&&FINAL_TIP[exp]){let t=FINAL_TIP[exp];if(/ed$/.test(word)&&/[td]/.test(exp))t+='（過去式 -ed：清音後唸 /t/、濁音後唸 /d/、t/d 後唸 /ɪd/）';return t}return `/${exp}/ 沒有唸出來，請把這個音補上。`}
 for(const [e,h,t] of PTIPS)if(e.includes(exp)&&h.some(x=>heard===x||heard.startsWith(x)))return t;
 for(const [e,h,t] of PTIPS)if(e.includes(exp))return `應該是 /${exp}/，你唸成 /${heard}/。`+t;
 if(isFinal&&FINAL_TIP[exp])return `應該是 /${exp}/，你唸成 /${heard}/。`+FINAL_TIP[exp];
 return `應該是 /${exp}/，你唸成 /${heard}/。`}
const IPA={
'ʌ':['cup','u','嘴巴半開、短促放鬆的「ㄚ」（cup、but、son 的 u/o）'],
'ɑ':['hot','o','嘴巴張大、舌頭放低的長「ㄚ」（hot、father）'],
'æ':['cat','a','嘴角往兩邊拉、下巴往下，介於「ㄝ」和「ㄚ」之間（cat、bad）'],
'ɛ':['bed','e','嘴巴微開的「ㄝ」，短促（bed、head）'],
'ɪ':['sit','i','短而放鬆的「ㄧ」，嘴巴不要拉太開，有點像「ㄧ」加一點「ㄝ」（sit、big）'],
'i':['see','ee','嘴角拉開、拉長的「ㄧ～」（see、eat）'],
'ʊ':['book','oo','嘴唇微圓、短而放鬆的「ㄨ」（book、good）'],
'u':['food','oo','嘴唇圓起來、拉長的「ㄨ～」（food、blue）'],
'ə':['about','a','最輕最弱的「ㄜ」，幾乎一帶而過（about 的 a、sofa 的 a）'],
'ɚ':['teacher','er','輕聲捲舌的「ㄦ」，舌頭往後捲但不用力（teacher、doctor 的 er/or）'],
'ɝ':['bird','ir','重音捲舌的「ㄦ～」，舌頭後捲、嘴唇微圓（bird、work、her）'],
'eɪ':['day','ay','「ㄝ」滑到「ㄧ」，像「ㄟ」（day、make）'],
'aɪ':['my','y','「ㄚ」滑到「ㄧ」，像「ㄞ」（my、like）'],
'ɔɪ':['boy','oy','「ㄛ」滑到「ㄧ」（boy、coin）'],
'aʊ':['now','ow','「ㄚ」滑到「ㄨ」，像「ㄠ」（now、out）'],
'oʊ':['go','o','「ㄛ」滑到「ㄨ」，像「ㄡ」，嘴唇要收圓（go、home）'],
'ɔ':['law','aw','嘴巴圓而張開的「ㄛ」（law、thought；很多美國人唸得接近 ɑ）'],
'p':['pen','p','雙唇閉緊再爆開，送氣（ㄆ）'],'b':['bed','b','雙唇閉緊再爆開，聲帶要震動（比ㄅ更有聲）'],
't':['top','t','舌尖頂上牙齦後彈開，送氣（ㄊ）'],'d':['dog','d','舌尖頂上牙齦後彈開，聲帶震動（比ㄉ更有聲）'],
'k':['cat','c','舌根頂軟顎後爆開，送氣（ㄎ）'],'g':['go','g','舌根頂軟顎後爆開，聲帶震動（比ㄍ更有聲）'],
'f':['fish','f','上齒輕咬下唇吹氣（ㄈ）'],'v':['very','v','上齒輕咬下唇，聲帶震動，嘴唇會麻麻的（不是 ㄨ 也不是 b）'],
'θ':['think','th','舌尖輕放上下齒間吹氣，不震動（不是 s 也不是 f）'],
'ð':['this','th','舌尖輕放上下齒間，聲帶震動（不是 d 也不是 z）'],
's':['see','s','舌尖靠近上牙齦吹氣，像「ㄙ」'],'z':['zoo','z','跟 s 一樣但聲帶震動，像蜜蜂「zzz」'],
'ʃ':['she','sh','嘴唇微噘往前、吹氣，像「ㄒ」+「ㄕ」之間（she）'],'ʒ':['vision','s','跟 sh 一樣但聲帶震動（vision、usually）'],
'tʃ':['chair','ch','嘴唇噘起的「ㄑ」（chair、watch）'],'dʒ':['job','j','嘴唇噘起、有聲的「ㄐ」（job、age）'],
'm':['man','m','雙唇閉起來的鼻音「ㄇ」；字尾要閉嘴'],
'n':['no','n','舌尖頂上牙齦的鼻音「ㄋ」；字尾舌頭要頂住（ㄣ）'],
'ŋ':['sing','ng','舌根頂住的鼻音，像「ㄥ」的尾巴，不要加 g 音'],
'l':['let','l','舌尖頂上牙齦（ㄌ）；字尾的 l 舌尖要頂住，聽起來像輕輕的「ㄡ」'],
'ɹ':['red','r','舌頭往後捲但不碰上顎，嘴唇微圓（不是 ㄖ 也不是 ㄌ）'],
'w':['we','w','嘴唇先圓起來再放開，像快速的「ㄨ」'],
'j':['yes','y','快速的「ㄧ」，滑向後面的母音（yes、million 的 i）'],
'h':['hat','h','輕輕的哈氣，喉嚨不用力（比ㄏ輕）'],
'ɾ':['water','t','美式「彈舌」t/d：舌尖快速輕點上牙齦，聽起來像輕的「ㄉ」（water、better）'],
'ʔ':['button','tt','喉嚨瞬間卡一下（button 中間），不唸出 t'],
'n̩':['button','on','舌頭頂住直接發「ㄣ」的成音節鼻音'],'l̩':['bottle','le','成音節的 l，舌尖頂住直接發 l']};
const IPA_N={'r':'ɹ','ɜ':'ɝ','ɜr':'ɝ','ɝr':'ɝ','ər':'ɚ','ɒ':'ɑ','e':'eɪ','o':'oʊ','ɡ':'g','ʧ':'tʃ','ʤ':'dʒ','ɐ':'ə','ɫ':'l','ɨ':'ɪ','ʉ':'u','ɘ':'ə','x':'h','a':'ɑ','ai':'aɪ','au':'aʊ','ei':'eɪ','ou':'oʊ','əʊ':'oʊ','oi':'ɔɪ','ɔi':'ɔɪ'};
function ipaNorm(p){if(!p)return p;let s=String(p).replace(/[ːˑˈˌ\/\[\]]/g,'').replace(/\u0329/g,'').trim();return IPA_N[s]||s}
function ipaInfo(p){const n=ipaNorm(p);return IPA[n]?{k:n,w:IPA[n][0],l:IPA[n][1],h:IPA[n][2]}:null}
function ipaHint(p){const x=ipaInfo(p);return x?`${x.k}：像 ${x.w} 的 ${x.l}，${x.h}`:`/${p}/`}
const GRAPH={'ʌ':'u o ou oo','ɑ':'o a au','æ':'a ai','ɛ':'e ea a ai ie','ɪ':'i y e ui','i':'ee ea e ie ei y i ey eo','ʊ':'oo u ou','u':'oo u ue ew o ou ui oe','ə':'a e i o u io ou ia ai','ɚ':'er or ar ur ure our re','ɝ':'er ir ur or ear our','eɪ':'a ay ai ey ei ea eigh','aɪ':'i y igh ie ai uy ye','ɔɪ':'oy oi','aʊ':'ou ow','oʊ':'o oa ow oe ou ough','ɔ':'o aw au ough a augh','p':'p pp','b':'b bb','t':'t tt ed th','d':'d dd ed','k':'c k ck ch q cc','g':'g gg gu gh','f':'f ff ph gh','v':'v f','θ':'th','ð':'th','s':'s ss c ce sc','z':'z s zz es','ʃ':'sh ti ci ch s ss','ʒ':'s si g','tʃ':'ch tch t','dʒ':'j g dg ge','m':'m mm','n':'n nn kn gn','ŋ':'ng n','l':'l ll','ɹ':'r rr wr','w':'w wh u o','j':'y i u','h':'h wh','ɾ':'t tt d dd','ʔ':'t tt'};
function alignLetters(word,phs){const L=(word||'').toLowerCase().replace(/[^a-z']/g,'');const P=phs.map(ipaNorm);const n=L.length,m=P.length;
 if(!m)return [];if(!n)return P.map(()=>'?');
 const g=P.map(p=>(GRAPH[p]||'').split(' ').filter(Boolean));
 const cost=(j,ch)=>{if(g[j].includes(ch))return 0;if(ch.length===1&&g[j].some(x=>x[0]===ch))return 1.2;if(g[j].some(x=>x.startsWith(ch)||ch.startsWith(x)))return 1.6;return 2.5*ch.length};
 const INF=1e9,D=Array.from({length:n+1},()=>Array(m+1).fill(INF)),B=Array.from({length:n+1},()=>Array(m+1).fill(null));D[0][0]=0;
 for(let i=0;i<=n;i++)for(let j=0;j<=m;j++){const c=D[i][j];if(c>=INF)continue;
  if(j<m)for(let k=1;k<=4&&i+k<=n;k++){const v=c+cost(j,L.slice(i,i+k))+0.05*(k-1);if(v<D[i+k][j+1]){D[i+k][j+1]=v;B[i+k][j+1]=[i,j]}}
  if(j<m){const v=c+3;if(v<D[i][j+1]){D[i][j+1]=v;B[i][j+1]=[i,j]}}
  if(j>0&&i<n){const v=c+1.4;if(v<D[i+1][j]){D[i+1][j]=v;B[i+1][j]=[i,j,1]}}}
 const out=P.map(()=>'');let i=n,j=m;while(i>0||j>0){const b=B[i][j];if(!b)break;if(b[2])out[j-1]=L[i-1]+out[j-1];else if(j>0&&b[1]===j-1)out[j-1]=L.slice(b[0],i)+out[j-1];i=b[0];j=b[1]}
 return out.map(s=>s||'·')}

function analyzeWord(w){const wa=w.PronunciationAssessment||w;const et=wa.ErrorType||'None';const phs=w.Phonemes||[];
 const rows=phs.map((ph,i)=>{const pa=ph.PronunciationAssessment||ph;const s=pa.AccuracyScore;const nb=(pa.NBestPhonemes||ph.NBestPhonemes||[]).slice().sort((a,b)=>b.Score-a.Score);
  let heard=nb.length?nb[0].Phoneme:ph.Phoneme;if(et==='Omission')heard='—';
  const bad=et==='Omission'||(s<60)||(heard!==ph.Phoneme&&s<80);if(bad&&heard===ph.Phoneme){heard=(nb.find(x=>x.Phoneme!==ph.Phoneme)||{}).Phoneme||'?';if(s<45&&nb.length&&nb[0].Phoneme===ph.Phoneme&&nb[0].Score>=90)heard=ph.Phoneme}
  if(bad&&s<30&&nb.length&&nb[0].Score<30)heard='—';
  return {exp:ph.Phoneme,heard,score:s,bad:bad&&heard!==ph.Phoneme,isFinal:i===phs.length-1,off:ph.Offset,dur:ph.Duration}});
 const lt=alignLetters(w.Word,rows.map(r=>r.exp));rows.forEach((r,i)=>r.let=lt[i]);
 return {word:w.Word,et,score:wa.AccuracyScore,rows,offset:w.Offset,dur:w.Duration}}
function getConf(){try{return JSON.parse(localStorage.phConf||'{}')}catch(e){return {}}}
function renderConf(){const c=getConf();const arr=Object.entries(c).sort((a,b)=>b[1].n-a[1].n).slice(0,15);
 $('confList').innerHTML=arr.length?'<table class="cmp"><tr><th>標準</th><th>你常唸成</th><th>次數</th><th>例字</th><th>建議</th></tr>'+arr.map(([k,v])=>{const [e,h]=k.split('→');return `<tr><td class="pe">/${esc(e)}/</td><td class="ph-bad">/${esc(h)}/</td><td>${v.n}</td><td>${esc((v.w||[]).slice(-4).join(', '))}</td><td><small>${esc(phTip(e,h,false,''))}</small></td></tr>`}).join('')+'</table>':'<small>尚無紀錄（使用 Azure 模式後會累積）</small>'}
function playSeg(startSec,endSec,pad){pad=pad==null?0.08:pad;if(!lastCap)return;playCtx=playCtx||new (window.AudioContext||window.webkitAudioContext)();
 const r=lastCap.rate,s0=Math.max(0,Math.floor((startSec-pad)*r)),s1=Math.min(lastCap.data.length,Math.ceil((endSec+pad)*r));if(s1<=s0)return;
 const b=playCtx.createBuffer(1,s1-s0,r);b.copyToChannel(lastCap.data.subarray(s0,s1),0);const src=playCtx.createBufferSource();src.buffer=b;src.connect(playCtx.destination);src.start();return (s1-s0)/r}
function speakThen(text,rate,cb){const v=localStorage.voice||'google';speak(text,rate);
 if(v==='google'){const done=()=>{player.removeEventListener('ended',done);setTimeout(cb,250)};player.addEventListener('ended',done);setTimeout(()=>{player.removeEventListener('ended',done)},15000)}
 else setTimeout(cb,600+text.length*120/rate)}
function renderAzure(j){const nb=j.NBest[0],p=nb.PronunciationAssessment||nb;const text=j.DisplayText||nb.Display||nb.Lexical||'';
 const base=scoreHyp(cur.e,text);suppressRec=true;showResult(base,[text]);suppressRec=false;const f=v=>v==null?'-':Math.round(v);
 const words=(nb.Words||[]).map(analyzeWord);window._azWords=words;
 const issues=[];const conf=getConf();
 for(const w of words){if(w.et==='Insertion')continue;for(const r of w.rows)if(r.bad||w.et==='Omission'){const k=r.exp+'→'+r.heard;issues.push({w:w.word,k,r,score:r.score});conf[k]=conf[k]||{n:0,w:[]};conf[k].n++;if(!conf[k].w.includes(w.word))conf[k].w.push(w.word);conf[k].w=conf[k].w.slice(-8)}}
 localStorage.phConf=JSON.stringify(conf);renderConf();
 // dedupe by confusion, worst first
 const seen=new Set(),top=[];for(const x of issues.sort((a,b)=>a.score-b.score)){if(seen.has(x.k))continue;seen.add(x.k);top.push(x);if(top.length>=5)break}
 let h=`<hr><b>Azure 評估</b>：總分 ${f(p.PronScore)}・準確度 ${f(p.AccuracyScore)}・流暢度 ${f(p.FluencyScore)}・完整度 ${f(p.CompletenessScore)}・韻律 ${f(p.ProsodyScore)}
 <div style="margin:6px 0"><button id="abAll">🔁 整句 A/B（標準 → 我的）</button></div>`;
 if(top.length)h+='<div class="issues"><b>🎯 你這句最需要改的音</b><ol>'+top.map(x=>`<li><b>${esc(x.w)}</b>：/<span class="pe">${esc(x.r.exp)}</span>/ → /<span class="ph-bad">${esc(x.r.heard)}</span>/ — ${esc(phTip(x.r.exp,x.r.heard,x.r.isFinal,x.w))}</li>`).join('')+'</ol></div>';
 else h+='<div class="issues">🎉 沒有明顯的錯誤音素！</div>';
 h+='<div class="cards">'+words.map((w,i)=>{const cls=w.et==='Omission'?'miss':(w.et==='None'&&w.score>=80?'ok':'bad');
  return `<div class="wcard ${cls}"><div><b style="font-size:18px">${esc(w.word)}</b> <small>${f(w.score)}分 ${ERR_ZH[w.et]?'・'+ERR_ZH[w.et]:''}</small>
  <button class="sm" data-std="${i}">🔊 標準</button>${w.et!=='Omission'&&lastCap?`<button class="sm" data-mine="${i}">🎤 我的</button>`:''}</div>
  <table class="cmp"><tr><th>字母</th>${w.rows.map(r=>`<td class="lt">${esc(r.let||'')}</td>`).join('')}</tr>
  <tr><th>標準<br><small>（點我聽）</small></th>${w.rows.map((r,k)=>`<td class="phc ${r.bad?'pe':''}" data-pe="${i},${k}" title="${esc(ipaHint(r.exp))}">${esc(r.exp)}</td>`).join('')}</tr>
  <tr><th>你的<br><small>（點我聽）</small></th>${w.rows.map((r,k)=>`<td class="phc ${r.bad?'ph-bad':'ph-ok'}" data-ph="${i},${k}" title="${esc(r.heard!==r.exp&&r.heard!=='—'?'你唸成 '+ipaHint(r.heard):'點我聽你自己這個音')}">${esc(r.heard)}</td>`).join('')}</tr>
  <tr><th>分數</th>${w.rows.map(r=>`<td><small>${f(r.score)}</small></td>`).join('')}</tr></table><div class="phint" id="phint${i}"></div></div>`}).join('')+'</div>';
 $('azure').innerHTML=h+'<small>👉 點「標準」格：聽這個音的示範字；點「你的」格：只播你自己唸的那一小段。點單字卡其他地方：先播標準發音（慢速）再播你自己的那段錄音。紅色＝不準的音素；「你的發音」為 Azure 判斷最像的音。</small>';
 status('Azure 評估完成');recordAttempt(p.PronScore!=null?p.PronScore:base.score)}
document.addEventListener('click',e=>{const t=e.target;if(!t.closest)return;
 const std=t.closest('[data-std]'),mine=t.closest('[data-mine]'),card=t.closest('.wcard'),ab=t.closest('#abAll');const W=window._azWords||[];
 const pe=t.closest('[data-pe]'),pm=t.closest('[data-ph]');
 if(pe||pm){const [wi,k]=(pe||pm).dataset[pe?'pe':'ph'].split(',').map(Number);const w=W[wi],r=w&&w.rows[k];if(!r)return;
  document.querySelectorAll('.phc.sel').forEach(x=>x.classList.remove('sel'));(pe||pm).classList.add('sel');const box=document.getElementById('phint'+wi);
  if(pe){const x=ipaInfo(r.exp);if(box)box.innerHTML=`🔊 <b>${esc(r.let||'')}</b> → ${esc(ipaHint(r.exp))}`+(x?`　<small>示範字：<b>${esc(x.w)}</b>，接著唸 ${esc(w.word)}</small>`:'');
   if(x)speakThen(x.w,0.7,()=>speak(w.word,0.7));else speak(w.word,0.7)}
  else{let m='🎤 你的這個音';if(r.heard==='—')m='⚠️ 這個音你沒唸出來（漏音）';else if(r.heard!==r.exp)m+=`：你唸成 ${esc(ipaHint(r.heard))}<br>✅ 應該是 ${esc(ipaHint(r.exp))}`;else m+=`：${esc(ipaHint(r.exp))}`;
   if(!lastCap||r.off==null||w.et==='Omission')m+='<br><small>（沒有錄音或時間資料可播）</small>';else playSeg(r.off/1e7,(r.off+r.dur)/1e7,0.06);if(box)box.innerHTML=m}
  return}
 if(std){speak(W[+std.dataset.std].word,0.7);return}
 if(mine){const w=W[+mine.dataset.mine];playSeg(w.offset/1e7,(w.offset+w.dur)/1e7);return}
 if(ab){speakThen(cur.e,1,()=>{const a=$('myAudio');a.currentTime=0;a.play()});return}
 if(card){const i=[...card.parentNode.children].indexOf(card);const w=W[i];if(!w)return;speakThen(w.word,0.7,()=>{if(w.et!=='Omission')playSeg(w.offset/1e7,(w.offset+w.dur)/1e7)})}});
const _sr=showResult;showResult=function(b,a){$('azure').innerHTML='';_sr(b,a)};
fillVoices();$('voice').onchange=e=>{localStorage.voice=e.target.value};renderWeak();renderConf();$('clearConf').onclick=()=>{if(confirm('清除常錯音紀錄？')){localStorage.removeItem('phConf');renderConf()}};
$('vlist').addEventListener('scroll',()=>requestAnimationFrame(drawRows));
$('vinner').onclick=e=>{const g=e.target.closest('[data-g]');if(g){const L=g.dataset.g;const ea=!!fQuery||fStatus!=='all';if(ea){openG.has('x'+L)?openG.delete('x'+L):openG.add('x'+L)}else{openG.has(L)?openG.delete(L):openG.add(L)}renderList();return}
 const i=e.target.closest('[data-i]');if(i)show(byId.get(+i.dataset.i))};
$('chips').onclick=e=>{const c=e.target.closest('[data-st]');if(!c)return;fStatus=c.dataset.st;applyFilter();renderDash()};
$('stats').onclick=e=>{const c=e.target.closest('[data-chip]');if(!c)return;fStatus=c.dataset.chip;applyFilter();renderDash();document.body.classList.add('side-open')};
$('tchips').onclick=e=>{const c=e.target.closest('[data-t]');if(!c)return;fType=c.dataset.t;document.querySelectorAll('#tchips .chip').forEach(x=>x.classList.toggle('on',x===c));applyFilter()};
let qT;$('q').oninput=()=>{clearTimeout(qT);qT=setTimeout(()=>{fQuery=$('q').value.trim().toLowerCase();applyFilter()},150)};
$('jump').onclick=()=>{const d=byId.get(+$('jid').value);d?show(d):alert('找不到此編號')};
$('jid').onkeydown=e=>{if(e.key==='Enter')$('jump').onclick()};
$('rand').onclick=()=>{const a=filtered.length?filtered:ORDERED;show(a[Math.floor(Math.random()*a.length)],'🎲 隨機')};
$('prev').onclick=()=>step(-1);$('next').onclick=()=>step(1);$('smart').onclick=next;
$('menuBtn').onclick=()=>document.body.classList.toggle('side-open');
document.addEventListener('keydown',e=>{if(e.target.matches&&e.target.matches('input,select,textarea')||e.metaKey||e.ctrlKey||e.altKey)return;
 if(e.code==='Space'){e.preventDefault();$('rec').click()}else if(e.key==='n'||e.key==='N'){next()}else if(e.key==='r'||e.key==='R'){$('listen').click()}});
$('exportBtn').onclick=()=>{const o={version:1,exported:new Date().toISOString()};for(const k of ['progress','days','weakWords','weakItems','phConf'])o[k]=lsGet(k,{});
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(o,null,1)],{type:'application/json'}));a.download='pronunciation_progress_'+dkey(Date.now())+'.json';a.click()};
$('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const o=JSON.parse(await f.text());if(!confirm('匯入會覆蓋目前進度，確定？'))return;
 for(const k of ['progress','days','weakWords','weakItems','phConf'])if(o[k])localStorage[k]=JSON.stringify(o[k]);localStorage.progMigrated='1';PROG=lsGet('progress',{});renderDash();applyFilter();renderWeak();renderConf();alert('已匯入')}catch(err){alert('匯入失敗：'+err.message)}};
applyFilter();renderDash();
if(innerWidth>=900)document.body.classList.add('side-open');
{const h=+location.hash.slice(1);if(byId.get(h))show(byId.get(h));else{const r=smartPick(ORDERED);r?show(r.d,r.why):show(ORDERED[0])}}

window.forgetData=forgetData;}

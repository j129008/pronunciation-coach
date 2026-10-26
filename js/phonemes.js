// Phoneme-level knowledge: Chinese hints per IPA symbol, confusion tips, letter↔sound mapping,
// and conversion of an Azure word result into per-phoneme rows.
export const PTIPS=[
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
export const FINAL_TIP={t:'字尾 /t/：舌尖碰上牙齦「停住」再輕輕放開，不能完全省略。',d:'字尾 /d/：舌尖頂上牙齦並帶聲帶振動，輕輕收尾。',k:'字尾 /k/：舌根抵住軟顎收住，輕輕放開。',p:'字尾 /p/：雙唇閉合收尾。',b:'字尾 /b/：雙唇閉合並振動。',g:'字尾 /g/：舌根抵住並振動。',s:'字尾 /s/（複數/第三人稱）一定要發出來。',z:'字尾 /z/（複數 -s 常唸 /z/）要振動聲帶發出來。',v:'字尾 /v/：上齒咬下唇並振動，不要吞掉。',l:'字尾 /l/（dark L）：舌尖仍要頂上牙齦，像輕輕的「ㄡ」+舌尖頂住。',m:'字尾 /m/：雙唇閉合收尾。',n:'字尾 /n/：舌尖頂上牙齦收尾。'};
export const ERR_ZH={None:'',Mispronunciation:'發音錯誤',Omission:'漏唸',Insertion:'多唸',UnexpectedBreak:'不當停頓',MissingBreak:'缺少停頓',Monotone:'語調平板'};
export function phTip(exp,heard,isFinal,word){
 if(heard==='—'||heard===''){if(isFinal&&FINAL_TIP[exp]){let t=FINAL_TIP[exp];if(/ed$/.test(word)&&/[td]/.test(exp))t+='（過去式 -ed：清音後唸 /t/、濁音後唸 /d/、t/d 後唸 /ɪd/）';return t}return `/${exp}/ 沒有唸出來，請把這個音補上。`}
 for(const [e,h,t] of PTIPS)if(e.includes(exp)&&h.some(x=>heard===x||heard.startsWith(x)))return t;
 for(const [e,h,t] of PTIPS)if(e.includes(exp))return `應該是 /${exp}/，你唸成 /${heard}/。`+t;
 if(isFinal&&FINAL_TIP[exp])return `應該是 /${exp}/，你唸成 /${heard}/。`+FINAL_TIP[exp];
 return `應該是 /${exp}/，你唸成 /${heard}/。`}
export const IPA={
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
'ɔ':['law','aw','嘴巴圓而張開的「ㄛ」（law、thought；很多美國人唸得接近 hot 的 o）'],
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
export const IPA_N={'r':'ɹ','ɜ':'ɝ','ɜr':'ɝ','ɝr':'ɝ','ər':'ɚ','ɒ':'ɑ','e':'eɪ','o':'oʊ','ɡ':'g','ʧ':'tʃ','ʤ':'dʒ','ɐ':'ə','ɫ':'l','ɨ':'ɪ','ʉ':'u','ɘ':'ə','x':'h','a':'ɑ','ai':'aɪ','au':'aʊ','ei':'eɪ','ou':'oʊ','əʊ':'oʊ','oi':'ɔɪ','ɔi':'ɔɪ'};
export function ipaNorm(p){if(!p)return p;let s=String(p).replace(/[ːˑˈˌ\/\[\]]/g,'').replace(/\u0329/g,'').trim();return IPA_N[s]||s}
export function ipaInfo(p){const n=ipaNorm(p);return IPA[n]?{k:n,w:IPA[n][0],l:IPA[n][1],h:IPA[n][2]}:null}
export function ipaHint(p){const x=ipaInfo(p);return x?`${x.k}：像 ${x.w} 的 ${x.l}，${x.h}`:`/${p}/`}
export const GRAPH={'ʌ':'u o ou oo','ɑ':'o a au','æ':'a ai','ɛ':'e ea a ai ie','ɪ':'i y e ui','i':'ee ea e ie ei y i ey eo','ʊ':'oo u ou','u':'oo u ue ew o ou ui oe','ə':'a e i o u io ou ia ai','ɚ':'er or ar ur ure our re','ɝ':'er ir ur or ear our','eɪ':'a ay ai ey ei ea eigh','aɪ':'i y igh ie ai uy ye','ɔɪ':'oy oi','aʊ':'ou ow','oʊ':'o oa ow oe ou ough','ɔ':'o aw au ough a augh','p':'p pp','b':'b bb','t':'t tt ed th','d':'d dd ed','k':'c k ck ch q cc','g':'g gg gu gh','f':'f ff ph gh','v':'v f','θ':'th','ð':'th','s':'s ss c ce sc','z':'z s zz es','ʃ':'sh ti ci ch s ss','ʒ':'s si g','tʃ':'ch tch t','dʒ':'j g dg ge','m':'m mm','n':'n nn kn gn','ŋ':'ng n','l':'l ll','ɹ':'r rr wr','w':'w wh u o','j':'y i u','h':'h wh','ɾ':'t tt d dd','ʔ':'t tt'};
export function alignLetters(word,phs){const L=(word||'').toLowerCase().replace(/[^a-z']/g,'');const P=phs.map(ipaNorm);const n=L.length,m=P.length;
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

export function analyzeWord(w){const wa=w.PronunciationAssessment||w;const et=wa.ErrorType||'None';const phs=w.Phonemes||[];
 const rows=phs.map((ph,i)=>{const pa=ph.PronunciationAssessment||ph;const s=pa.AccuracyScore;const nb=(pa.NBestPhonemes||ph.NBestPhonemes||[]).slice().sort((a,b)=>b.Score-a.Score);
  let heard=nb.length?nb[0].Phoneme:ph.Phoneme;if(et==='Omission')heard='—';
  const bad=et==='Omission'||(s<60)||(heard!==ph.Phoneme&&s<80);if(bad&&heard===ph.Phoneme){heard=(nb.find(x=>x.Phoneme!==ph.Phoneme)||{}).Phoneme||'?';if(s<45&&nb.length&&nb[0].Phoneme===ph.Phoneme&&nb[0].Score>=90)heard=ph.Phoneme}
  if(bad&&s<30&&nb.length&&nb[0].Score<30)heard='—';
  // recognizer confidence: NBest score of the sound we report as heard, and of the expected sound (null = not listed)
  const nbScore=p=>{const x=nb.find(c=>c.Phoneme===p);return x?x.Score:null};
  return {exp:ph.Phoneme,heard,score:s,bad:bad&&heard!==ph.Phoneme,isFinal:i===phs.length-1,off:ph.Offset,dur:ph.Duration,heardConf:nb.length?nbScore(heard):null,expConf:nb.length?nbScore(ph.Phoneme):null}});
 const lt=alignLetters(w.Word,rows.map(r=>r.exp));rows.forEach((r,i)=>r.let=lt[i]);
 return {word:w.Word,et,score:wa.AccuracyScore,rows,offset:w.Offset,dur:w.Duration}}

'use strict';
const C=require('./campaign.js');
const copy=x=>JSON.parse(JSON.stringify(x));
const all=(r,fn)=>{for(const [role,g]of Object.entries(r.games))fn(g.s,role,g);};
function checkpoint(r,id,label){if(r.checkpoints.some(c=>c.id===id))return;const state=copy({shared:r.shared,games:Object.fromEntries(Object.entries(r.games).map(([k,g])=>[k,g.s])),arrived:r.arrived,decisions:r.decisions,ready:r.ready,qresults:r.qresults,qstarts:r.qstarts,votes:r.votes});r.checkpoints.push({id,label,time:Date.now(),state});}
function bothView(r,view){r.arrived={};all(r,s=>{delete s.waiting;s.view=view;s.insight=null;});}
function start(r,key){const c=r.shared.campaign;Object.assign(c,{chapter:key,stage:'intro',found:{A:[],B:[]},witness:{},puzzle:{},verdict:{},drum:{},sharedNotes:false,lastVerdict:null,experiment:{A:0,B:0}});r.shared.stats.EVIDENCE=0;r.decisions={};r.votes={};r.ready={};r.qresults={};r.qstarts={};all(r,s=>{s.qte=null;s.notice='';s.event=null;delete s.waiting;});if(key==='qujiang'){all(r,(s,role,g)=>g.enter('intro'+role));}else if(key==='final')r.enterBoth('finalDescent');else r.enterBoth('cIntro');checkpoint(r,'chapter:'+key,C.chapters[key].title+' · 更鼓');}
function finish(r,event){const c=r.shared.campaign;
 if(event==='meeting'){r.enterBoth('mirrorChoice');return true;}
 if(event==='mirrorChoice'){r.ready={};r.qresults={};r.qstarts={};all(r,s=>{s.view='qteReady';s.qte={type:'mirror',step:0,success:0};});return true;}
 if(event==='mirrorAfter'||event==='cIntro'){c.stage='investigation';bothView(r,'map');return true;}
 if(event==='cJoint'){c.sharedNotes=true;c.stage='puzzle';bothView(r,'chapterPuzzle');return true;}
 if(event==='cResolution'||event==='qujiangReflection'){c.stage='drum';bothView(r,'chapterDrum');return true;}
 if(event==='finalDescent'){c.stage='final';bothView(r,'finalChoice');checkpoint(r,'final:choice','万象台 · 两座阵眼');return true;}
 return false;
}
function command(r,role,msg){const g=r.games[role],s=g.s,c=r.shared.campaign,key=c.chapter,ch=C.current(s);
 if(msg.type==='chapterContinue'){
 if(s.view==='end'&&key==='qujiang'){if(r.wait(role,'qujiangReflection')){c.results.push({chapter:'qujiang',verdict:s.flags.correct?0:s.flags.partial?2:1,evidence:s.stats.EVIDENCE});r.enterBoth('qujiangReflection');}return true;}
 throw Error('当前没有可继续的章节。');}
 if(msg.type==='drumConfirm'){if(s.view!=='chapterDrum')throw Error('尚未到达更鼓。');c.drum[role]=true;if(c.drum.A&&c.drum.B){if(s.stats.TRUTH>=30&&!c.anchors.length)s.stats.TRUTH--;const next=C.order[C.order.indexOf(key)+1];if(s.stats.CHAOS>=80&&next!=='final'){s.flags.earlyFinal=true;start(r,'final');}else start(r,next);}return true;}
 if(msg.type==='finalSubmit'){
 if(s.view!=='finalChoice')throw Error('尚未到达阵眼。');const opt=C.finalOptions(s).find(x=>x.id===msg.id);if(!opt||opt.lock)throw Error(opt?.lock||'无效选择。');c.verdict[role]=msg.id;s.waiting='final';
 if(c.verdict.A&&c.verdict.B){const a=c.verdict.A,b=c.verdict.B;let end;if(a==='release'&&b==='release')end='true';else if(b==='erase')end='dreamer';else if(a==='break')end='broken';else if((a==='leave')!==(b==='leave'))end='alone';else if(a==='stay'&&['stay','block'].includes(b))end='night';
 if(!end){all(r,x=>{delete x.waiting;x.notice='双方尚未作出能共同执行的决定。请交流后重新选择；谁也不能替对方松手。';});c.verdict={};}else{c.ending=end;c.departures={A:a==='leave',B:b==='leave'};bothView(r,'campaignEnd');c.stage='ended';}}
 return true;}
 if(key==='qujiang')return false;
 if(msg.type==='location'){
 if(s.view!=='map')throw Error('现在不能前往那里。');
 if(key==='prologue'&&c.stage==='intro'){if(msg.id!==ch.site)throw Error('先到东市，追上抱镜的工匠。');if(r.wait(role,'meeting'))r.enterBoth('meeting');return true;}
 if(msg.id===ch.witness){g.enter('cWitness'+role);return true;}
 if(msg.id!==ch.site){s.notice='当前线索指向'+ch.title+'；先查现场，也可去证人所在的建筑。';return true;}
 s.view='chapterInvestigate';s.scene=ch.scene;return true;
 }
 if(msg.type==='chapterCollect'){
 if(s.view!=='chapterInvestigate')throw Error('请先进入本案现场。');const clue=[...ch.clues[role]].sort((a,b)=>a.w*a.h-b.w*b.h).find(x=>Number.isFinite(msg.x)&&Number.isFinite(msg.y)&&Math.abs(msg.x-x.x)<=x.w/2&&Math.abs(msg.y-x.y)<=x.h/2);if(!clue)throw Error('这里没有新的发现。');const lock=g.choiceLock(clue);if(lock)throw Error(lock);
 if(!c.found[role].includes(clue.id)){c.found[role].push(clue.id);g.apply({stats:{EVIDENCE:clue.score,TRUTH:clue.truth||0},flags:clue.flag?{[clue.flag]:true}:{}});if(clue.anchor&&!c.anchors.includes(clue.anchor))c.anchors.push(clue.anchor);}
 s.insight={chapterClue:clue.id};return true;}
 if(msg.type==='chapterMap'){if(!['chapterInvestigate','chapterPuzzle'].includes(s.view))throw Error('现在不能返回地图。');if(s.view==='chapterPuzzle')throw Error('请先完成当前共同验证。');s.insight=null;g.map();return true;}
 if(msg.type==='chapterMeet'){
 if(!['map','chapterInvestigate'].includes(s.view))throw Error('现在不能发起会合。');if(!['A','B'].every(x=>c.found[x].length>=2&&c.witness[x]))throw Error('双方各需至少两项现场记录，并完成各自问询。');if(r.wait(role,'cJoint:'+key))r.enterBoth('cJoint');return true;}
 if(msg.type==='chapterExperiment'){if(s.view!=='chapterPuzzle'||key!=='palace')throw Error('这里没有更鼓实验。');c.experiment??={A:0,B:0};c.experiment[role]=Math.min(3,(c.experiment[role]||0)+1);return true;}
 if(msg.type==='chapterPuzzle'){
 if(s.view!=='chapterPuzzle')throw Error('当前没有共同机关。');if(key==='palace'&&(c.experiment?.[role]||0)<3)throw Error('请先亲手完成记号、更鼓与复查。');const p=ch.puzzle[role];if(!Number.isInteger(msg.answer)&&typeof msg.answer!=='string')throw Error('请选择验证步骤。');c.puzzle[role]=msg.answer;s.waiting='puzzle';
 if(c.puzzle.A!==undefined&&c.puzzle.B!==undefined){if(['A','B'].every(x=>String(c.puzzle[x])===String(ch.puzzle[x].answer))){bothView(r,'chapterVerdict');c.stage='verdict';g.apply({stats:{TRUTH:key==='prologue'?4:3}});}else{if(!s.flags['puzzleMiss:'+key])g.apply({stats:{CHAOS:3},flags:{['puzzleMiss:'+key]:true}});c.puzzle={};all(r,x=>{delete x.waiting;x.notice='两端记录没有吻合。请对照各自的案卷重新验证；可以重复尝试。';});}}return true;}
 if(msg.type==='chapterVerdict'){
 if(s.view!=='chapterVerdict'||![0,1,2].includes(msg.answer))throw Error('请选择本案判断。');if(msg.answer===0&&s.stats.EVIDENCE<6)throw Error('完整推理需要证据完整度 ≥ 6；可先保留疑点。');c.verdict[role]=msg.answer;s.waiting='verdict';
 if(c.verdict.A!==undefined&&c.verdict.B!==undefined){if(c.verdict.A!==c.verdict.B){c.verdict={};all(r,x=>{delete x.waiting;x.notice='两份指认不同。请核对证据，再共同落笔。';});}else{c.lastVerdict=msg.answer;c.results.push({chapter:key,verdict:msg.answer,evidence:s.stats.EVIDENCE});g.apply({stats:msg.answer===0?{TRUTH:8}:msg.answer===1?{CHAOS:5}:{}});if(ch.after)g.apply({stats:ch.after});r.enterBoth('cResolution');}}return true;}
 return false;
}
module.exports={start,finish,command,checkpoint};

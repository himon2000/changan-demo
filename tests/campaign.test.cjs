const {test}=require('node:test'),assert=require('node:assert/strict');
const {Room}=require('../multiplayer.cjs'),C=require('../campaign.js'),D=require('../data.js'),Game=require('../core.js');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function harness(r=new Room('FULL01'),policy){
 if(!r.members.A)r.join('A');if(!r.members.B)r.join('B');
 const cmd=(role,type,data={})=>r.command(role,{type,...data});
 function drain(choose=policy){for(let i=0;i<180;i++){let n=0;for(const role of ['A','B']){const g=r.games[role];if(g.s.view!=='dialog'||g.s.waiting)continue;const l=g.currentLine();if(l.choices&&l.who!==role&&['A','B'].includes(l.who)&&r.decisions[g.s.event+':'+g.s.index]===undefined)continue;const choice=l.choices?(choose?.(g,l)??l.choices.findIndex(x=>!g.choiceLock(x))):0;cmd(role,'next',{choice});n++;}if(!n)return;}throw Error('dialog did not settle');}
 function qte(pass=true){cmd('A','beginQte');cmd('B','beginQte');for(const role of ['A','B'])for(let step=0;step<3;step++)cmd(role,'qte',{step,key:pass?r.games[role].qteSteps()[step][1]:''});drain();}
 function collect(role,id){const c=D.clues[id];cmd(role,'collect',{x:c.x,y:c.y});}
 function standard(){const ch=C.current(r.games.A.s);assert.equal(r.games.A.s.view,'map');
 for(const role of ['A','B']){cmd(role,'location',{id:ch.site});for(const clue of ch.clues[role].slice(0,2))cmd(role,'chapterCollect',{x:clue.x,y:clue.y});cmd(role,'chapterMap');}
 for(const role of ['A','B']){cmd(role,'location',{id:ch.site});const c=ch.clues[role][2];if(!r.games[role].choiceLock(c))cmd(role,'chapterCollect',{x:c.x,y:c.y});cmd(role,'chapterMap');cmd(role,'location',{id:ch.witness});drain();}
 assert.equal(r.snapshot('A').campaign.found.B.length,0);assert.equal(r.snapshot('B').campaign.found.A.length,0);
 cmd('A','chapterMeet');cmd('B','chapterMeet');drain();assert.equal(r.games.A.s.view,'chapterPuzzle');
 if(r.shared.campaign.chapter==='palace')for(const role of ['A','B'])for(let i=0;i<3;i++)cmd(role,'chapterExperiment');
 for(const role of ['A','B'])cmd(role,'chapterPuzzle',{answer:ch.puzzle[role].answer});assert.equal(r.games.A.s.view,'chapterVerdict');
 cmd('A','chapterVerdict',{answer:0});cmd('B','chapterVerdict',{answer:0});drain();assert.equal(r.games.A.s.view,'chapterDrum');
 }
 function drum(){cmd('A','drumConfirm');cmd('B','drumConfirm');drain();}
 function qujiang(){for(const role of ['A','B'])cmd(role,'location',{id:'boat'});drain();
 for(const role of ['A','B']){cmd(role,'location',{id:'boat'});collect(role,role==='A'?'poem':'latch');cmd(role,'finishInvest');cmd(role,'location',{id:role==='A'?'shrine':'academy'});drain();}
 for(const id of ['books','incense','bell','dock','tavern','apricot','lake']){cmd('A','location',{id});drain();}
 cmd('A','location',{id:'boat'});cmd('B','location',{id:'boat'});drain();cmd('A','match',{id:'poem'});cmd('B','match',{id:'latch'});drain();
 for(const role of ['A','B']){for(const id of ['gear','rope','channel'])collect(role,id);cmd(role,'finishInvest');}drain();qte();qte();
 for(const role of ['A','B'])for(const [key,value]of Object.entries({suspect:'host',method:'mechanism',motive:'poem'}))cmd(role,'deduce',{key,value});cmd('A','submit');cmd('B','submit');assert.equal(r.shared.flags.correct,true);cmd('A','chapterContinue');cmd('B','chapterContinue');drain();
 }
 return {r,cmd,drain,qte,standard,drum,qujiang};
}
function full(policy){const h=harness(new Room('FULL01'),policy);h.drain();h.cmd('A','location',{id:'market'});h.cmd('B','location',{id:'market'});h.drain();assert.equal(h.r.games.A.s.qte.type,'mirror');h.qte();assert.equal(h.r.shared.flags.chaseDone,undefined);h.standard();h.drum();h.qujiang();h.drum();for(const chapter of ['west','palace','ward','granary','arsenal','master']){assert.equal(h.r.shared.campaign.chapter,chapter);h.standard();h.drum();}return h;}
test('full campaign: independent opening → rooftop QTE → eight cases → reachable true ending without stat overrides',()=>{const {r,cmd}=full();assert.equal(r.games.A.s.view,'finalChoice');assert.equal(C.trueLock(r.games.A.s),'');assert.equal(r.shared.campaign.results.length,8);assert.ok(r.shared.campaign.anchors.length>=3);assert.ok(r.checkpoints.length>=15);cmd('A','finalSubmit',{id:'release'});assert.equal(r.games.A.s.view,'finalChoice');cmd('B','finalSubmit',{id:'release'});assert.equal(r.shared.campaign.ending,'true');assert.equal(r.games.A.s.view,'campaignEnd');assert.equal(r.games.B.s.view,'campaignEnd');});
test('thresholds, owned clue hit areas, deduplicated evidence and puzzle retry',()=>{const h=harness(),{r,cmd}=h;require('../campaign-room.cjs').start(r,'granary');h.drain();cmd('A','location',{id:'dock'});const ch=C.chapters.granary;assert.throws(()=>cmd('A','chapterCollect',{x:ch.clues.A[2].x,y:ch.clues.A[2].y}),/TRUTH|EVIDENCE/);assert.throws(()=>cmd('A','chapterCollect',{x:-1,y:-1}),/没有/);const c=ch.clues.A[0];cmd('A','chapterCollect',{x:c.x,y:c.y});const evidence=r.shared.stats.EVIDENCE;cmd('A','chapterCollect',{x:c.x,y:c.y});assert.equal(r.shared.stats.EVIDENCE,evidence);assert.equal(r.snapshot('B').campaign.found.A.length,0);
 r.games.A.s.view=r.games.B.s.view='chapterPuzzle';cmd('A','chapterPuzzle',{answer:1});cmd('B','chapterPuzzle',{answer:0});assert.equal(r.shared.stats.CHAOS,3);assert.equal(r.games.A.s.waiting,undefined);cmd('A','chapterPuzzle',{answer:1});cmd('B','chapterPuzzle',{answer:0});assert.equal(r.shared.stats.CHAOS,3);cmd('A','chapterPuzzle',{answer:0});cmd('B','chapterPuzzle',{answer:0});assert.equal(r.games.A.s.view,'chapterVerdict');assert.throws(()=>cmd('A','chapterVerdict',{answer:0}),/证据/);cmd('A','chapterVerdict',{answer:2});cmd('B','chapterVerdict',{answer:2});h.drain();assert.equal(r.games.A.s.view,'chapterDrum');});
test('all five endings have distinct constraints, disagreement never chooses for the partner',()=>{
 for(const [ending,a,b,stats] of [['night','stay','stay',{}],['broken','break','block',{TRUTH:70,CHAOS:80,TA:30}],['dreamer','stay','erase',{TB:20,DREAM:70}],['alone','leave','stay',{TRUTH:85,TA:30}]]){const {r,cmd}=harness();r.shared.campaign.chapter='final';Object.assign(r.shared.stats,stats);r.games.A.s.view=r.games.B.s.view='finalChoice';cmd('A','finalSubmit',{id:a});cmd('B','finalSubmit',{id:b});assert.equal(r.shared.campaign.ending,ending);}
 const {r,cmd}=harness();r.shared.campaign.chapter='final';Object.assign(r.shared.stats,{TRUTH:85,TA:30});r.games.A.s.view=r.games.B.s.view='finalChoice';assert.throws(()=>cmd('A','finalSubmit',{id:'release'}),/TA|CHAOS|锚定/);cmd('A','finalSubmit',{id:'leave'});cmd('B','finalSubmit',{id:'leave'});assert.equal(r.shared.campaign.ending,undefined);assert.equal(r.games.A.s.waiting,undefined);assert.match(r.games.A.s.notice,/交流/);
});
test('chapter checkpoint restores shared campaign and both cursors, with role credentials preserved',()=>{const h=full(),{r,cmd}=h;const a=r.members.A.hash;cmd('A','loadRequest',{id:'chapter:palace'});cmd('B','loadAgree');assert.equal(r.shared.campaign.chapter,'palace');assert.equal(r.shared.stats.EVIDENCE,0);assert.equal(r.games.A.s.event,'cIntro');assert.equal(r.games.B.s.event,'cIntro');assert.equal(r.members.A.hash,a);assert.equal(r.shared.campaign.results.length,3);h.drain();assert.equal(r.games.A.s.view,'map');});
test('B stage plan really locks A branches; high chaos opens final early',()=>{const h=harness(),{r,cmd}=h;r.shared.campaign.chapter='west';r.enterBoth('cJoint');assert.throws(()=>cmd('A','next',{choice:0}),/搭档/);cmd('B','next',{choice:1});cmd('A','next',{choice:0});assert.ok(r.games.A.choiceLock(r.games.A.currentLine().choices[0]));assert.equal(r.games.A.choiceLock(r.games.A.currentLine().choices[2]),'');r.shared.stats.CHAOS=80;r.games.A.s.view=r.games.B.s.view='chapterDrum';cmd('A','drumConfirm');cmd('B','drumConfirm');assert.equal(r.shared.campaign.chapter,'final');assert.equal(r.shared.flags.earlyFinal,true);});
test('all new page states and chapter dialogs render for both roles',()=>{
 const app={innerHTML:'',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]}},context={console,Game,GAME_DATA:D,URLSearchParams,location:{protocol:'file:',search:'',origin:'http://localhost:8790'},performance:{now:()=>0},Image:class{},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},document:{getElementById:id=>id==='app'?app:null,querySelector:()=>null,addEventListener(){},hidden:false},addEventListener(){}};context.window=context;vm.createContext(context);for(const f of ['layers.js','campaign.js','campaign-ui.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../'+f),'utf8'),context);
 let source=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8').replace("if(location.protocol!=='file:')fetch('/api/host')","window.testUI={set:g=>{game=g;connection={room:'FULL01'}},render};if(location.protocol!=='file:')fetch('/api/host')");vm.runInContext(source,context);
 for(const role of ['A','B'])for(const chapter of C.order.filter(x=>x!=='qujiang')){const g=new Game();g.s.role=role;g.s.campaign.chapter=chapter;g.s.net={room:'FULL01'};g.s.campaign.ending='true';const views=chapter==='final'?['finalChoice','campaignEnd']:['map','chapterInvestigate','chapterPuzzle','chapterVerdict','chapterDrum'];for(const view of views){g.s.view=view;context.testUI.set(g);context.testUI.render();assert.ok(app.innerHTML.includes('<main'));assert.ok(!app.innerHTML.includes('undefined'),chapter+':'+view);}g.enter(chapter==='final'?'finalDescent':'cIntro');for(let i=0;i<g.lines().length;i++){g.s.index=i;context.testUI.render();assert.ok(!app.innerHTML.includes('undefined'));}}
});

test('a distrustful route organically unlocks dreamer without editing stats',()=>{const h=full((g,l)=>l.choices[1]&&!g.choiceLock(l.choices[1])?1:l.choices.findIndex(c=>!g.choiceLock(c)));assert.ok(h.r.shared.stats.TB<=25);assert.ok(h.r.shared.stats.DREAM>=60);h.cmd('A','finalSubmit',{id:'stay'});h.cmd('B','finalSubmit',{id:'erase'});assert.equal(h.r.shared.campaign.ending,'dreamer');});


test('all 42 chapter clues are physical scene crops with reachable, distinct hit centres',()=>{
 let count=0;
 const context={};context.window=context;vm.createContext(context);
 for(const file of ['campaign.js','campaign-ui.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../'+file),'utf8'),context);
 for(const [chapter,ch]of Object.entries(C.chapters)){
  if(!ch.clues)continue;
  assert.ok(fs.existsSync(path.join(__dirname,'../assets/scenes/'+ch.scene+'.png')),chapter);
  const {r,cmd}=harness();r.shared.campaign.chapter=chapter;
  Object.assign(r.shared.stats,{TRUTH:100,EVIDENCE:10,TA:100,TB:100});r.shared.flags.oldMark=true;
  for(const role of ['A','B']){
   const g=r.games[role];g.s.view='chapterInvestigate';
   for(const clue of ch.clues[role]){
    count++;assert.equal(clue.painted,true);assert.equal(clue.scene,ch.scene);
    assert.ok(clue.x-clue.w/2>=0&&clue.x+clue.w/2<=1,chapter+':'+clue.id+' horizontal bounds');
    assert.ok(clue.y-clue.h/2>=0&&clue.y+clue.h/2<=1,chapter+':'+clue.id+' vertical bounds');
    cmd(role,'chapterCollect',{x:clue.x,y:clue.y});assert.equal(g.s.insight.chapterClue,clue.id,chapter+':'+clue.id);
    const html=context.CAMPAIGN_UI.page(g.s,g);
    assert.ok(!html.includes('chapter-object')&&!html.includes('<svg'),chapter+': no sticker layer');
    assert.ok(html.includes('painted-preview')&&html.includes(ch.scene+'.png'),chapter+': same scene evidence crop');
   }
  }
 }
 assert.equal(count,42);
});

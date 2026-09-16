const {test}=require('node:test'),assert=require('node:assert/strict');
const {Room}=require('../multiplayer.cjs'),{createServer}=require('../server.cjs'),Game=require('../core.js'),D=require('../data.js');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function play(choice=0,pass=true){
 const r=new Room('ABC123'),a=r.join('A'),b=r.join('B');assert.equal(r.auth(a),'A');assert.equal(r.auth(b),'B');assert.throws(()=>r.join('A'));
 const cmd=(role,type,extra={})=>r.command(role,{type,...extra});
 function drain(){for(let rounds=0;rounds<150;rounds++){let changed=false;for(const role of ['A','B']){const g=r.games[role];if(g.s.view!=='dialog'||g.s.waiting)continue;const l=g.currentLine(),owner=l.choices&&['A','B'].includes(l.who)?l.who:role;if(l.choices&&owner!==role&&r.decisions[g.s.event+':'+g.s.index]===undefined)continue;cmd(role,'next',{choice:Math.min(choice,(l.choices?.length||1)-1)});changed=true;}if(!changed)return;}assert.fail('dialog deadlock');}
 function find(role,id){const c=D.clues[id];cmd(role,'collect',{x:c.x,y:c.y});}
 drain();cmd('A','location',{id:'boat'});assert.ok(r.games.A.s.waiting);assert.equal(r.games.B.s.view,'map');cmd('B','location',{id:'boat'});
 // Nobody may make the other player's decision.
 while(r.games.B.s.index<8)cmd('B','next',{choice:0});assert.throws(()=>cmd('B','next',{choice:0}),/搭档/);drain();
 for(const role of ['A','B']){cmd(role,'location',{id:'boat'});find(role,role==='A'?'poem':'latch');cmd(role,'finishInvest');cmd(role,'location',{id:role==='A'?'shrine':'academy'});drain();}
 assert.ok(r.games.A.readyToMeet());assert.deepEqual(r.snapshot('A').observations.B,[]);assert.deepEqual(r.snapshot('B').observations.A,[]);assert.equal(r.games.A.s.role,'A');assert.equal(r.games.B.s.role,'B');
 for(const id of ['books','incense','bell','dock','tavern','apricot','lake']){cmd('A','location',{id});drain();}
 const truth=r.shared.stats.TRUTH;cmd('A','location',{id:'apricot'});drain();assert.equal(r.shared.stats.TRUTH,truth);
 cmd('A','location',{id:'boat'});cmd('B','location',{id:'boat'});drain();assert.equal(r.games.A.s.view,'match');assert.throws(()=>cmd('A','match',{id:'latch'}),/自己/);
 cmd('A','match',{id:'testimony'});cmd('B','match',{id:'model'});assert.equal(r.games.A.s.view,'match');cmd('A','match',{id:'poem'});cmd('B','match',{id:'latch'});drain();
 for(const role of ['A','B']){find(role,'gear');find(role,'rope');find(role,'channel');cmd(role,'finishInvest');}drain();
 assert.equal(r.games.A.s.view,'qteReady');assert.notDeepEqual(r.games.A.qteSteps(),r.games.B.qteSteps());
 for(let phase=0;phase<2;phase++){cmd('A','beginQte');assert.equal(r.games.A.s.view,'qteReady');cmd('B','beginQte');for(const role of ['A','B'])for(let step=0;step<3;step++){const key=pass?r.games[role].qteSteps()[step][1]:'';cmd(role,'qte',{step,key});}drain();}
 assert.equal(r.games.A.s.view,'deduce');for(const role of ['A','B'])for(const [key,value]of Object.entries({suspect:'host',method:'mechanism',motive:'ledger'}))cmd(role,'deduce',{key,value});cmd('A','submit');assert.equal(r.games.A.s.view,'deduce');cmd('B','submit');assert.equal(r.games.A.s.view,'end');assert.equal(r.games.B.s.view,'end');assert.equal(r.shared.flags.correct,true);assert.equal(r.shared.flags.chaseSuccess,pass);assert.equal(r.shared.flags.saved,choice===0);
 assert.equal(r.games.A.s.role,'A');assert.equal(r.games.B.s.role,'B');return r;
}
for(const c of [0,1])for(const pass of [true,false])test(`two-player complete story choice=${c} qte=${pass}`,()=>play(c,pass));
test('restored room keeps private role credentials and independent cursors',()=>{const r=new Room('ABC124'),token=r.join('A');r.join('B');r.command('A',{type:'next',choice:0});const restore=new Room(r.id,JSON.parse(JSON.stringify(r.serialize())));assert.equal(restore.auth(token),'A');assert.equal(restore.games.A.s.index,1);assert.equal(restore.games.B.s.index,0);assert.equal(restore.games.A.s.flags,restore.games.B.s.flags);assert.throws(()=>restore.command('A',{type:'switch'}));});
test('actual HTTP room join, authenticated commands, live stream and reconnect',async()=>{
 const server=createServer({storeDir:null});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;let controller;
 try{async function post(url,body,token){const res=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});return {status:res.status,data:await res.json()};}
 const A=(await post('/api/rooms',{role:'A'})).data;const B=(await post('/api/join',{room:A.room,role:'B'})).data;assert.equal(B.state.role,'B');assert.equal((await post('/api/join',{room:A.room,role:'B'})).status,400);
 assert.equal((await post('/api/action',{room:A.room,action:{type:'next',choice:0}},'wrong')).status,401);
 controller=new AbortController();const stream=await fetch(base+'/api/events?room='+A.room+'&token='+A.token,{signal:controller.signal});const reader=stream.body.getReader();const first=new TextDecoder().decode((await reader.read()).value);assert.match(first,/"role":"A"/);
 const action=await post('/api/action',{room:A.room,action:{type:'next',choice:0}},A.token);assert.equal(action.data.state.index,1);const event=new TextDecoder().decode((await reader.read()).value);assert.match(event,/"index":1/);controller.abort();
 const resumed=await fetch(base+'/api/events?room='+B.room+'&token='+B.token,{signal:(controller=new AbortController()).signal});const rr=resumed.body.getReader();const snapshot=new TextDecoder().decode((await rr.read()).value);assert.match(snapshot,/"role":"B"/);assert.match(snapshot,/"index":0/);controller.abort();
 assert.equal((await fetch(base+'/.rooms/'+A.room+'.json')).status,404);assert.equal((await fetch(base+'/server.cjs')).status,404);assert.equal((await fetch(base+'/index.html')).status,200);
 }finally{controller?.abort();server.stopStreams();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('all network page states render, with only owned evidence choices and no role switch',()=>{
 const app={innerHTML:'',addEventListener(){},querySelector(){return null},querySelectorAll(){return[]}};
 const context={console,Game,GAME_DATA:D,URLSearchParams,location:{protocol:'file:',search:'',origin:'http://localhost:8787'},performance:{now:()=>0},Image:class{},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}},requestAnimationFrame:()=>0,cancelAnimationFrame(){},setTimeout:()=>0,clearTimeout(){},document:{getElementById:id=>id==='app'?app:null,querySelector:()=>null,addEventListener(){},hidden:false},addEventListener(){}};context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../layers.js'),'utf8'),context);
 let source=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');source=source.replace("if(location.protocol!=='file:')fetch('/api/host')","window.testUI={set:g=>{game=g;connection={room:'ABC123'}},render,modal:m=>{modal=m}};if(location.protocol!=='file:')fetch('/api/host')");vm.runInContext(source,context);
 const room=play(),g=new Game(room.snapshot('A'));
 for(const view of ['start','lobby','map','dialog','investigate','match','qteReady','qte','deduce','end']){delete g.s.waiting;g.s.view=view;g.s.net=room.snapshot('A').net;if(view==='dialog')g.enter('witness');if(view==='investigate')g.s.scene='cabin';if(view.startsWith('qte'))g.s.qte={type:'water',step:0,success:0,deadline:Date.now()+6500};context.testUI.set(g);context.testUI.render();assert.ok(app.innerHTML.includes('<main'));assert.ok(!app.innerHTML.includes('undefined'),view);assert.ok(!app.innerHTML.includes('data-action="switch"'));if(view==='map')assert.equal((app.innerHTML.match(/data-location=/g)||[]).length,12);if(view==='match')assert.ok(!app.innerHTML.includes('data-match-role="B"'));}
 for(const modal of ['settings','help','progress','notebook']){context.testUI.modal(modal);context.testUI.render();assert.ok(app.innerHTML.includes('role="dialog"'));}context.testUI.modal(null);g.s.waiting='board:feast';context.testUI.render();assert.match(app.innerHTML,/留一盏灯/);
});

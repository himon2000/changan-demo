const {test}=require('node:test'),assert=require('node:assert/strict'),{DatabaseSync}=require('node:sqlite'),fs=require('node:fs');
function database(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(fs.readFileSync('drizzle/0000_lonely_cargill.sql','utf8'));
 return {
  withSession(){return this;},
  prepare(query){return {
   bind(...args){return {
    async first(){return sql.prepare(query).get(...args)||null;},
    async run(){const x=sql.prepare(query).run(...args);return {meta:{changes:Number(x.changes)}};}
   };}
  };}
 };
}

test('bundled cloud worker: durable room, simultaneous actions, authenticated polling and retry deduplication',async()=>{
 const worker=(await import('../dist/server/index.js')).default,env={DB:database(),ASSETS:{fetch:()=>new Response('asset')}};
 async function post(url,data,token){const req=new Request('https://game.example'+url,{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://game.example',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});const r=await worker.fetch(req,env);return {status:r.status,body:await r.json()};}
 const a=(await post('/api/rooms',{role:'A'})).body;assert.equal(a.state.role,'A');assert.equal(a.room.length,8);
 const b=(await post('/api/join',{room:a.room,role:'B'})).body;assert.equal(b.state.role,'B');assert.equal((await post('/api/join',{room:a.room,role:'B'})).status,400);
 const actions=await Promise.all([post('/api/action',{room:a.room,requestId:'a1',action:{type:'next',choice:0}},a.token),post('/api/action',{room:b.room,requestId:'b1',action:{type:'next',choice:0}},b.token)]);assert.ok(actions.every(x=>x.status===200));
 const again=await post('/api/action',{room:a.room,requestId:'a1',action:{type:'next',choice:0}},a.token);assert.equal(again.body.state.index,1);
 const read=await worker.fetch(new Request('https://game.example/api/state?room='+a.room,{headers:{Authorization:'Bearer '+b.token}}),env);const state=(await read.json()).state;assert.equal(state.index,1);assert.equal(state.role,'B');assert.equal(state.net.peerOnline,true);assert.deepEqual(state.observations.A,[]);
 assert.equal((await worker.fetch(new Request('https://game.example/api/state?room='+a.room),env)).status,401);
 const forged=await worker.fetch(new Request('https://game.example/api/rooms',{method:'POST',headers:{Origin:'https://evil.example'},body:JSON.stringify({role:'A'})}),env);assert.equal(forged.status,403);
 assert.equal(await (await worker.fetch(new Request('https://game.example/index.html'),env)).text(),'asset');
 const host=await (await worker.fetch(new Request('https://game.example/api/host'),env)).json();assert.equal(host.transport,'poll');assert.equal(host.urls[0],'https://game.example');
});

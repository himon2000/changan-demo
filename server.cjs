'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {Room}=require('./multiplayer.cjs');
function createServer({storeDir=path.join(__dirname,'.rooms')}={}){
 const rooms=new Map(),streams=new Map();if(storeDir){fs.mkdirSync(storeDir,{recursive:true});for(const file of fs.readdirSync(storeDir)){if(!/^[A-Z0-9]{6}\.json$/.test(file))continue;try{const data=JSON.parse(fs.readFileSync(path.join(storeDir,file)));if(Date.now()-data.updated<7*86400000)rooms.set(data.id,new Room(data.id,data));}catch{}}}
 const persist=room=>{if(storeDir){const file=path.join(storeDir,room.id+'.json');fs.writeFileSync(file+'.tmp',JSON.stringify(room.serialize()),{mode:0o600});fs.renameSync(file+'.tmp',file);}};
 const snapshot=(room,role)=>{const s=room.snapshot(role);s.net.peerOnline=!!streams.get(room.id+(role==='A'?'B':'A'))?.size;return s;};
 const emit=room=>{for(const role of Object.keys(room.members))for(const res of streams.get(room.id+role)||[])res.write('data: '+JSON.stringify(snapshot(room,role))+'\n\n');};
 const broadcast=room=>{persist(room);emit(room);};
 const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const rates=new Map();
 const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')){
 if(req.method==='POST'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)return reply(res,403,{error:'请从游戏所在地址操作。'});
 if(req.method==='POST'){
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return reply(res,413,{error:'请求过大。'});}let body;try{body=JSON.parse(raw||'{}');}catch{return reply(res,400,{error:'请求格式不正确。'});}
 if(url.pathname==='/api/rooms'){
 const ip=req.socket.remoteAddress,limit=rates.get(ip)||{n:0,t:Date.now()};if(Date.now()-limit.t>60000){limit.n=0;limit.t=Date.now();}if(++limit.n>15)return reply(res,429,{error:'创建过于频繁，请稍候。'});rates.set(ip,limit);
 if(rooms.size>1000)return reply(res,503,{error:'房间已满。'});const id=crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase(),room=new Room(id),token=room.join(body.role);rooms.set(id,room);broadcast(room);return reply(res,200,{room:id,token,state:snapshot(room,body.role)});
 }
 const room=rooms.get(String(body.room||'').toUpperCase());if(!room)return reply(res,404,{error:'没有找到房间，请核对六位房间码。'});
 if(url.pathname==='/api/join'){const token=room.join(body.role);broadcast(room);return reply(res,200,{room:room.id,token,state:snapshot(room,body.role)});}
 const role=room.auth(req.headers.authorization?.replace(/^Bearer /,''));if(!role)return reply(res,401,{error:'身份凭证失效，请使用原浏览器重连。'});
 if(url.pathname==='/api/action'){room.command(role,body.action||{});broadcast(room);return reply(res,200,{state:snapshot(room,role)});}
 }
 if(req.method==='GET'&&url.pathname==='/api/events'){
 const room=rooms.get(url.searchParams.get('room')),role=room?.auth(url.searchParams.get('token'));if(!role)return reply(res,401,{error:'身份凭证失效。'});
 res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-store','Connection':'keep-alive','X-Accel-Buffering':'no'});const key=room.id+role,set=streams.get(key)||new Set();streams.set(key,set);set.add(res);emit(room);const timer=setInterval(()=>res.write(': heartbeat\n\n'),15000);req.on('close',()=>{clearInterval(timer);set.delete(res);emit(room);});return;
 }
 if(req.method==='GET'&&url.pathname==='/api/host'){const port=server.address().port,urls=Object.values(os.networkInterfaces()).flat().filter(i=>i.family==='IPv4'&&!i.internal).map(i=>`http://${i.address}:${port}`);return reply(res,200,{urls});}
 return reply(res,404,{error:'未知接口。'});
 }
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
 const rel=decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname);
 if(!/^\/(index\.html|style\.css|script\.js|data\.js|campaign\.js|campaign-ui\.js|core\.js|layers\.js|assets\/[a-zA-Z0-9_./-]+)$/.test(rel)||rel.includes('..')){res.writeHead(404);return res.end();}
 const file=path.join(__dirname,rel);if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);return res.end();}
 const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.webp':'image/webp','.json':'application/json'};
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(error){if(!res.headersSent)reply(res,400,{error:error.message});else res.end();}});
 server.rooms=rooms;server.stopStreams=()=>{for(const set of streams.values())for(const res of set)res.end();};return server;
}
if(require.main===module){const server=createServer();server.listen(Number(process.env.PORT)||8787,'0.0.0.0',()=>{console.log('\n未·央 · 双人联机\n本机：http://localhost:'+server.address().port);for(const i of Object.values(os.networkInterfaces()).flat())if(i.family==='IPv4'&&!i.internal)console.log('同一网络的搭档：http://'+i.address+':'+server.address().port);console.log('保持此窗口打开。按 Control+C 停止。\n');if(process.argv.includes('--open')&&process.platform==='darwin')require('node:child_process').execFile('open',['http://localhost:'+server.address().port]);});}
module.exports={createServer};

import multiplayer from '../multiplayer.cjs';
const {Room}=multiplayer;
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
const DAYS=7*86400000;
function snapshot(room,role,row){const s=room.snapshot(role);s.net.peerOnline=Date.now()-(role==='A'?row.seen_b:row.seen_a)<30000;s.net.serverNow=Date.now();return s;}
async function readRoom(db,id){const row=await db.prepare('SELECT * FROM game_rooms WHERE id = ?').bind(id).first();if(!row||Date.now()-row.updated>DAYS)return null;return row;}
export default {
 async fetch(request,env){const url=new URL(request.url);
 if(!url.pathname.startsWith('/api/'))return env.ASSETS.fetch(request);
 if(url.pathname==='/api/host')return json({urls:[url.origin],transport:'poll'});
 if(!env.DB)return json({error:'房间服务暂时无法连接，请稍后重试。'},503);
 try{
 const db=env.DB.withSession?env.DB.withSession('first-primary'):env.DB;
 const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');
 if(request.method==='GET'&&url.pathname==='/api/state'){
  const id=(url.searchParams.get('room')||'').toUpperCase();const row=await readRoom(db,id);if(!row)return json({error:'房间不存在或已过期，请重新创建。'},404);
  const room=new Room(id,JSON.parse(row.data)),role=room.auth(token);if(!role)return json({error:'身份凭证失效，请返回原页面。'},401);
  const field=role==='A'?'seen_a':'seen_b';if(Date.now()-row[field]>10000)await db.prepare(`UPDATE game_rooms SET ${field} = ? WHERE id = ?`).bind(Date.now(),id).run();return json({state:snapshot(room,role,row)});
 }
 if(request.method!=='POST')return json({error:'未知操作。'},404);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'请从游戏页面操作。'},403);
 const raw=await request.text();if(raw.length>4096)return json({error:'请求过大。'},413);const body=JSON.parse(raw);
 if(url.pathname==='/api/rooms'){
  await db.prepare('DELETE FROM game_rooms WHERE updated < ?').bind(Date.now()-DAYS).run();
  const capacity=await db.prepare('SELECT COUNT(*) AS count FROM game_rooms').bind().first();if(capacity.count>=1000)return json({error:'当前房间已满，请稍后再来。'},503);
  if(!['A','B'].includes(body.role))return json({error:'请选择身份。'},400);
  for(let attempt=0;attempt<4;attempt++){
   const id=Array.from(crypto.getRandomValues(new Uint8Array(4)),n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
   const room=new Room(id),credential=room.join(body.role),now=Date.now(),row={seen_a:body.role==='A'?now:0,seen_b:body.role==='B'?now:0};
   const result=await db.prepare('INSERT OR IGNORE INTO game_rooms (id,version,data,updated,seen_a,seen_b) VALUES (?,?,?,?,?,?)').bind(id,room.revision,JSON.stringify(room.serialize()),now,row.seen_a,row.seen_b).run();
   if(result.meta.changes)return json({room:id,token:credential,state:snapshot(room,body.role,row)});
  }return json({error:'暂时无法创建房间，请重试。'},503);
 }
 const id=String(body.room||'').toUpperCase();
 for(let attempt=0;attempt<6;attempt++){
  const row=await readRoom(db,id);if(!row)return json({error:'房间不存在或已过期，请核对房间码。'},404);
  const room=new Room(id,JSON.parse(row.data));let role,credential;
  if(url.pathname==='/api/join'){role=body.role;credential=room.join(role);}
  else if(url.pathname==='/api/action'){
   role=room.auth(token);if(!role)return json({error:'身份凭证失效。'},401);
   const action=body.action||{},dedup=body.requestId;if(typeof dedup!=='string'||dedup.length>80)return json({error:'请求标识缺失。'},400);
   room.receipts ||= [];if(room.receipts.some(r=>r.role===role&&r.id===dedup))return json({state:snapshot(room,role,row)});
   room.command(role,action);room.receipts.push({role,id:dedup});room.receipts=room.receipts.slice(-60);
  }else return json({error:'未知操作。'},404);
  const now=Date.now(),field=role==='A'?'seen_a':'seen_b';row[field]=now;
  const result=await db.prepare(`UPDATE game_rooms SET data = ?, version = ?, updated = ?, ${field} = ? WHERE id = ? AND version = ?`).bind(JSON.stringify(room.serialize()),room.revision,now,now,id,row.version).run();
  if(result.meta.changes)return json({room:id,...(credential?{token:credential}:{}),state:snapshot(room,role,row)});
 }
 return json({error:'搭档正在同步，请稍后再试。'},409);
 }catch(error){console.error('room_request',error.message);return json({error:error.message?.includes('D1')?'房间服务暂时繁忙，进度已保留，请稍后重试。':error.message||'暂时无法完成操作。'},400);}
 }
};

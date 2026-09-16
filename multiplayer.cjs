'use strict';
const Game=require('./core.js'),D=require('./data.js'),crypto=require('node:crypto');
const SHARED=['stats','flags','evidence','observations'];
const JOINT=new Set(['feast','reunion','waterEntry','alarm','afterWater','beforeChase','afterChase']);
const hash=t=>crypto.createHash('sha256').update(t).digest('hex');
class Room{
 constructor(id,saved){this.id=id;this.games={};this.members={};this.arrived={};this.decisions={};this.ready={};this.qresults={};this.qstarts={};this.votes={};this.revision=0;this.updated=Date.now();this.shared=Object.fromEntries(SHARED.map(k=>[k,new Game().s[k]]));if(saved){Object.assign(this,saved);for(const r of Object.keys(this.games))this.games[r]=new Game(this.games[r]);}this.bind();}
 bind(){for(const g of Object.values(this.games))for(const k of SHARED)g.s[k]=this.shared[k];}
 join(role){if(!['A','B'].includes(role)||this.members[role])throw Error('这个身份已有人选择，请使用另一个身份。');const token=crypto.randomBytes(32).toString('hex');this.members[role]={hash:hash(token)};this.games[role]=new Game();this.bind();this.games[role].s.role=role;this.games[role].s.lead=role;this.games[role].s.view='lobby';if(this.members.A&&this.members.B){this.games.A.enter('introA');this.games.B.enter('introB');}this.touch();return token;}
 auth(token){return Object.keys(this.members).find(r=>this.members[r].hash===hash(token||''));}
 touch(){this.revision++;this.updated=Date.now();}
 enterBoth(event){this.arrived={};for(const g of Object.values(this.games)){delete g.s.waiting;g.enter(event);}}
 wait(role,key){this.arrived[role]=key;this.games[role].s.waiting=key;return this.arrived.A===key&&this.arrived.B===key;}
 finishJoint(role,event){if(!this.wait(role,event))return;for(const g of Object.values(this.games))delete g.s.waiting;this.arrived={};const a=this.games.A;
 if(event==='feast'){this.shared.flags.murder=true;for(const g of Object.values(this.games)){g.s.phase='investigation';g.map();}}
 if(event==='reunion')for(const g of Object.values(this.games))g.s.view='match';
 if(event==='waterEntry')for(const g of Object.values(this.games)){g.s.view='investigate';g.s.scene='water';}
 if(event==='alarm'||event==='beforeChase'){const type=event==='alarm'?'water':'chase';this.ready={};this.qresults={};this.qstarts={};for(const g of Object.values(this.games)){g.s.view='qteReady';g.s.qte={type,step:0,success:0};}}
 if(event==='afterWater'){if(!this.shared.flags.saved)a.apply({stats:{TRUTH:3}});this.enterBoth('beforeChase');}
 if(event==='afterChase')for(const g of Object.values(this.games)){g.s.view='deduce';g.s.phase='deduction';}
 }
 command(role,msg){const g=this.games[role],s=g.s,other=role==='A'?'B':'A';if(!g||!this.games[other])throw Error('等待另一位玩家加入。');if(s.waiting&&!['match','submit','deduce','setting'].includes(msg.type))throw Error('你已完成这一步，正在等待搭档。');
 switch(msg.type){
 case 'location':{
 if(s.view!=='map'||!D.locations.some(l=>l.id===msg.id))throw Error('现在不能前往那里。');
 if(msg.id==='boat'&&(!s.flags.murder||(g.readyToMeet()&&!s.flags.validated))){const e=s.flags.murder?'reunion':'feast';if(this.wait(role,'board:'+e))this.enterBoth(e);break;}g.location(msg.id);break;}
 case 'next':{
 if(s.view!=='dialog')throw Error('当前没有对话。');const l=g.currentLine(),key=s.event+':'+s.index;
 if(l.choices){const owner=['A','B'].includes(l.who)?l.who:role;if(owner!==role){if(!(key in this.decisions))throw Error('这项决定由搭档作出。');}else{if(!Number.isInteger(msg.choice)||!l.choices[msg.choice])throw Error('无效选择。');if(!(key in this.decisions)){g.apply(l.choices[msg.choice].effects);if(JOINT.has(s.event))this.decisions[key]=msg.choice;}}}
 s.index++;if(s.index>=g.lines().length){if(JOINT.has(s.event))this.finishJoint(role,s.event);else g.finishEvent();}break;}
 case 'collect':{
 if(s.view!=='investigate')throw Error('请先进入调查场景。');const id=Game.hitTest(s.scene,msg.x,msg.y);if(!id)throw Error('这里没有新的发现。');g.collect(id);break;}
 case 'finishInvest':{
 if(s.view!=='investigate'||!g.canFinishInvest())throw Error('还缺少关键的现场痕迹。');s.insight=null;if(s.scene==='water'){if(this.wait(role,'water-inspected')){s.flags.waterDone=true;this.enterBoth('alarm');}}else g.finishInvest();break;}
 case 'match':{
 if(s.view!=='match'||!s.observations[role].includes(msg.id))throw Error('只能提交自己掌握的记录。');s.match[role]=msg.id;delete s.waiting;this.votes[role]=msg.id;const pa=this.votes.A,pb=this.votes.B;
 if(pa&&pb){if(!['cup','poem','footprints'].includes(pa)||pb!=='latch'){this.votes={};for(const x of Object.values(this.games)){x.s.match={A:null,B:null};x.s.notice='两份记录还不能解释同一手法，请各自重新选取。';}}else{g.apply({stats:{TA:3,TB:3,EVIDENCE:1},flags:{validated:true}});this.votes={};this.enterBoth('waterEntry');}}break;}
 case 'beginQte':{
 if(s.view!=='qteReady')throw Error('尚未准备动作。');this.ready[role]=true;if(this.ready.A&&this.ready.B){const now=Date.now();for(const [r,x]of Object.entries(this.games)){x.s.view='qte';this.qstarts[r]=now;x.s.qte.deadline=now+(x.s.slowQte?11000:6500);}}break;}
 case 'qte':{
 if(s.view!=='qte'||msg.step!==s.qte.step)throw Error('动作已判定。');const expected=g.qteSteps()[s.qte.step][1],ok=msg.key===expected&&Date.now()<=s.qte.deadline;if(ok)s.qte.success++;s.qte.step++;
 if(s.qte.step<3)s.qte.deadline=Date.now()+(s.slowQte?11000:6500)+480;
 else{this.qresults[role]=s.qte.success;s.waiting='qte';if(Object.keys(this.qresults).length===2){const pass=this.qresults.A>=2&&this.qresults.B>=2,type=s.qte.type;g.apply({stats:pass?{EVIDENCE:1}:{CHAOS:5},flags:type==='water'?{waterSuccess:pass}:{chaseDone:true,chaseSuccess:pass}});this.enterBoth(type==='water'?'afterWater':'afterChase');for(const x of Object.values(this.games))x.s.qte=null;}}break;}
 case 'deduce':{
 if(s.view!=='deduce')throw Error('尚未开始推理。');const options={suspect:['host','boatwoman','accident'],method:['mechanism','poison','unknown'],motive:['ledger','poem','unknown']};if(!options[msg.key]?.includes(msg.value))throw Error('无效推理。');if(msg.value==='mechanism'&&!g.precise())throw Error('机关证据不足。');if(msg.key==='motive'&&msg.value==='ledger'&&!s.evidence.includes('ledger'))throw Error('尚未取得账目。');s.deduction[msg.key]=msg.value;delete this.votes[role];delete s.waiting;break;}
 case 'submit':{
 if(s.view!=='deduce'||!Object.values(s.deduction).every(Boolean))throw Error('请完成三项判断。');this.votes[role]={...s.deduction};s.waiting='deduction';if(this.votes.A&&this.votes.B){if(JSON.stringify(this.votes.A)!==JSON.stringify(this.votes.B)){for(const x of Object.values(this.games)){delete x.s.waiting;x.s.notice='双方判断不同，请结合搭档提交的判断再核对。';}}else{this.games.A.submit();for(const x of Object.values(this.games)){delete x.s.waiting;x.s.view='end';x.s.phase='end';}}}break;}
 case 'setting':if(['debug','slowQte'].includes(msg.key))s[msg.key]=!!msg.value;break;
 default:throw Error('不支持的操作。');}
 this.touch();return this.snapshot(role);
 }
 snapshot(role){const g=this.games[role],s=JSON.parse(JSON.stringify(g.s)),other=role==='A'?'B':'A';if(!s.flags.validated){s.observations[other]=[];s.evidence=[...s.observations[role]];}s.match={A:this.votes.A||null,B:this.votes.B||null};s.net={room:this.id,revision:this.revision,joined:!!this.members[other],partnerRole:other,ready:this.ready,decision:this.decisions[s.event+':'+s.index],partnerCount:this.shared.observations[other].length,partnerVote:s.view==='deduce'?this.votes[other]:null};return s;}
 serialize(){return {...this,games:Object.fromEntries(Object.entries(this.games).map(([r,g])=>[r,g.s]))};}
}
module.exports={Room};

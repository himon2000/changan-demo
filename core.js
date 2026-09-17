(function(root){
const D=root.GAME_DATA||(typeof require==='function'?require('./data.js'):null);
const line=(who,text,pose='idle',choices=null)=>({who,text,pose,choices});
const choice=(text,effects={},hint='',requires=null)=>({text,effects,hint,requires});
class Game{
 static hitTest(scene,x,y){if(!Number.isFinite(x)||!Number.isFinite(y))return null;return Object.entries(D.clues).find(([,c])=>c.scene===scene&&c.x!==undefined&&Math.abs(x-c.x)<=c.w/2&&Math.abs(y-c.y)<=c.h/2)?.[0]||null;}
 constructor(saved){this.s=saved||{version:2,view:'start',role:'A',lead:'A',phase:'opening',scene:'lake',event:null,index:0,stats:{TA:50,TB:50,TRUTH:5,DREAM:65,CHAOS:0,EVIDENCE:0},flags:{},observations:{A:[],B:[]},evidence:[],visits:{A:[],B:[]},journal:[],debug:false,slowQte:false,qte:null,match:{A:null,B:null},deduction:{suspect:null,method:null,motive:null},insight:null};}
 apply(e={}){const s=this.s;for(const [k,v] of Object.entries(e.stats||{})){s.stats[k]=Math.max(0,Math.min(k==='EVIDENCE'?10:100,s.stats[k]+v));}Object.assign(s.flags,e.flags||{});if(e.ev)this.collect(e.ev,e.role||s.role);if(e.role)s.role=e.role;}
 setRole(role){if(this.s.flags.roleLocked)return false;this.s.flags.roleLocked=true;this.s.role=role;this.s.lead=role;this.enter('intro'+role);}
 enter(event){this.s.event=event;this.s.index=0;this.s.view='dialog';this.s.insight=null;this.s.scene=this.sceneFor(event);}
 sceneFor(e){return {introA:'temple',introB:'academy',feast:'boat',witness:'shrine',workshop:'academy',reunion:'boat',waterEntry:'water',alarm:'water',afterWater:'water',beforeChase:'dock',afterChase:'dock',revisit:'boat'}[e]||(e.startsWith('side:')?e.slice(5):'boat');}
 lines(){const s=this.s,f=s.flags,a=s.role==='A';const L=line,C=choice;
 switch(s.event){
 case 'introA':return [L('n','入夜，大理寺的灯还没有熄。桌上压着一封未署名的报案信。'),L('clerk','曲江诗会有人借画舫欠账。你去问清，别惊了客人。'),L('A','写信的人在哪？','examine'),L('clerk','船上。他说，今夜一定把账拿出来。'),L('A','我先看账，再听人说。')];
 case 'introB':return [L('n','幻术院里，镜面映着一只没有点燃的灯。画舫旧图被摊在案上。'),L('B','门闩、席板、配重……都是老师早年做的。','examine'),L('n','领用簿缺了一页。留下的压痕里，有诗社的印。'),L('B','今夜他们只报了诗会，没有报水戏。我要上船看看。')];
 case 'feast':return [L('n',a?'巡捕把腰牌收进衣袖，随客人登上画舫。':'幻术师沿船舷走了一圈。灯座朝向被人改过。'),L('host','请坐。今夜只论诗，旁的事，改日再说。'),L('poet','有些事，过了今夜就说不清了。','write'),L('n','主持笑着转身。诗人独自走进侧舱。片刻后，灯火暗了一息。'),L('boatwoman','舱门怎么扣上了？公子？','point'),L('n','门被撞开。诗人伏在矮桌前，袖口滴水，面前的银杯倒着。'),L('A','脉息没了。谁也别碰桌子。','examine'),L('B','这扇门可以从外面扣上。我需要看看灯座。','examine'),L('A','我去问人，你留下查船。', 'idle',[C('把机关调查交给幻术师',{stats:{TA:5,TB:3},flags:{delegated:true}},'幻术师可独立拆验灯座'),C('先封存机关，要求每步留痕',{stats:{TB:-3},flags:{delegated:false}},'幻术师需要先取得结构证据')]),L('n','两人分开。一人追问岸上的时间，一人追索船里的光线。')];
 case 'witness':return [L('n','船娘坐在祠亭石阶上，反复拧着袖口。'),L('boatwoman','是我送他上去的。他说，等诗会散了，就替我们把工钱讨回来。'),L('A','你后来为什么离船？','examine'),L('boatwoman','主持让我去拿新灯油。回来时，门已经扣住了。'),L('A','我需要你再想一遍。', 'idle',[C('先让她暖一暖手，再问时间',{stats:{TB:5},flags:{boatwomanSupport:true}},'她会为幻术师指出船底通道'),C('追问她湿鞋印为何留在门外',{stats:{EVIDENCE:1},flags:{strictWitness:true}},'保留更精确的走动时间')]),...(f.sharedMechanism?[L('A','幻术师说，灯座能牵动门闩。换灯时，主持身边还有谁？','examine'),L('boatwoman','没有。他连扶梯的人都支走了。')]:[L('boatwoman','那阵金属声很轻。我还以为是酒杯碰在一起。')]),L('A','记下了。这回，你不用替任何人圆话。')];
 case 'workshop':return [L('n','幻术师独自回到学院。旧图上，画舫的席板下藏着一层水舱。'),L('B','只要转动铜轮，桌子与地板都会落下去。','examine'),L('n','灯座后还有一条牵线孔，正好通到门闩。'),L('B','这段结构，得让巡捕知道。','examine',[
 C('把结构图交给巡捕',{stats:{TA:5},flags:{sharedMechanism:true}},'巡捕获得换灯追问与配重救援选项'),C('先自己留着，等看过实物再说',{stats:{TA:-3},flags:{sharedMechanism:false}},'巡捕暂时只能从门外救援'),]),L('B','再附一份验证方法，还是先把旧图送去？','examine',[C('另附灯座牵线的验证方法',{stats:{TA:3},flags:{mirrorSignal:true}},'',{stats:{TA:55},flags:{delegated:'巡捕已委托机关调查'}}),C('只保留现有记录',{})])];
 case 'reunion':return [L('A','岸上问到的，未必能解释船里发生的事。','examine'),L('B',s.stats.TB>=55?'我把没说完的也带来了。你看这道水痕，我用结构来验。':'先把各自能确认的摆出来。其余的，再看看。','examine'),L('n','两人各取出一条自己掌握的记录，尝试让它们指向同一种手法。')];
 case 'waterEntry':return [L('n',f.boatwomanSupport?'船娘移开舱边木箱，露出一条干燥的检修梯。':'检修口被箱子挡住。两人从侧板缝里挤下去。'),L('B','先找铜轮，再看止水绳。它们应当连在一起。','examine'),L('A','别离开我伸手能到的地方。')];
 case 'alarm':return [L('n','铜轮逆转。系过两次的绳结忽然松脱，舱门落下，冷水冲进来。'),L('B','配重在滑！','action'),L('A','我在上面。听我的。','action',[
 C('踩住配重，给搭档留出转轮时间',{stats:{TB:5},flags:{support:'weight'}},'',{flags:{sharedMechanism:'已取得幻术师分享的结构图'}}),C('顶住舱门，让搭档拉住止水绳',{stats:{CHAOS:2},flags:{support:'door'}},'幻术师使用绳索、撑门、攀梯动作')])];
 case 'afterWater':return [L('n',f.waterSuccess?'水势缓了下来。舱门上方传来奔跑声。':'水冲断了木楔。幻术师抓住横梁，上方传来奔跑声。'),L('boatwoman','深色披风！他去了旧船坞！','point'),L('A','你还撑得住吗？','action'),L('B','还能。你决定。','action'),L('A','只有这一刻。','action',[C('先拉幻术师上来',{stats:{TB:8,EVIDENCE:-2},flags:{saved:true}},'搭档获救，追凶更晚开始'),C('先截住逃跑的人',{stats:{TB:-5},flags:{saved:false}},'幻术师从旧暗渠自行脱身')])];
 case 'beforeChase':return [L('n',f.saved?'巡捕把搭档拉上甲板。岸边的披风已掠过第一座桥。':'幻术师从石渠里爬出。披风掠过岸边，前方的桥板正往水里沉。'),L('B','桥只剩半边了。我先替你开路。','action',[C('转镜引光，标出还撑得住的桥板',{stats:{TA:5,TRUTH:2},flags:{chasePlan:'light'}},''),C('把绳索系在岸桩，留一条稳路',{stats:{TB:3},flags:{chasePlan:'rope'}},'')]),L('A','我看见了。','action',[C('循着光点跃过断桥',{stats:{TB:5},flags:{chaseRoute:'light'}},'',{stats:{TA:60},values:{chasePlan:['light','幻术师已选择转镜引光']}}),C('借绳索荡到桥侧截人',{stats:{TA:3},flags:{chaseRoute:'rope'}},'',{values:{chasePlan:['rope','幻术师已选择系绳开路']}}),C('沿岸绕行，先堵住船坞出口',{stats:{CHAOS:2},flags:{chaseRoute:'shore'}},'')]),L('n',f.chaseRoute==='light'?'一枚光点亮在湿木上。巡捕踏上去，第二枚已落在桥的另一端。':f.chaseRoute==='rope'?'绳索一紧，巡捕越过桥侧。幻术师在岸上稳稳压住绳结。':'巡捕沿岸追去。幻术师收起手中的物件，从另一侧赶向船坞。')];
 case 'afterChase':return [L('n',f.chaseSuccess?'披风被船篙绊住。巡捕扣住主持的手腕，一卷细铜丝从袖中落下。':'披风消失在桥后。地上只留下沾油的衣角，主持的去向尚待查明。'),L('host',f.chaseSuccess?'船坏了，总得有人去修。我只是怕你们把事弄得更糟。':'……','defend'),L('A','那就把你修过的地方，一处一处说清。','examine'),L('B','我们先把证据对上。','examine')];
 default:return this.sideLines(s.event.slice(5));
 }}
 sideLines(id){const s=this.s,a=s.role==='A',L=line,C=choice;if(s.flags['side:'+s.role+':'+id])return [L('n','这里的发现已经记进案卷。夜风从刚才停留的地方吹过。')];
 const scenes={
 temple:[L('clerk',a?'诗人昨日来过。他想递的不是诗稿，是账页。':'案卷不能带走。你若要看，得把巡捕的腰牌带来。'),L(a?'A':'B',a?'我只核对他留下的日期。':'日期对得上，主持的说法便有一个缺口。','examine')],
 academy:[L('B','旧图上没有这道石渠。等案子结束，我再去找它的来处。','examine')],
 market:[L('n','市门将闭，挑担的人从灯下经过。烟气向湖上飘去。'),L(a?'A':'B',a?'船舱里也有这股味道。':'沉水香。市门边那只炉子里正烧着。','examine')],
 tavern:[L('vendor','买铜丝的？诗社那位。说是修琴，却连琴弦都没问。'),L(a?'A':'B',a?'他什么时候来的？':'这根铜丝的粗细，能借我比一比吗？','examine'),L('vendor','午后，灯还没点。剩下这截，你拿去吧。')],
 dock:[L('n','油桶边压着送货单。末尾是诗社主持的签记。'),L(a?'A':'B',a?'他说只换了一盏灯。却买了这么多机油。':'这种青油用来润重轮，点灯反而会熏黑灯罩。','examine')],
 books:[L('n','账本夹在新诗集里。画舫早被抵押，船工的工钱却始终没有入账。'),L(a?'A':'B',a?'诗人想把这页账公开，主持却想把今夜拖过去。':'新纸压着旧字。有人想改日期，终究没敢撕掉签名。','examine')],
 incense:[L('vendor','这香要隔着帘子烧，不能关门。诗社一次拿了两包。'),L(a?'A':'B',a?'关着门，会怎么样？':'青灰遇水成膜，与杯底那层一样。','examine'),L('vendor','人会犯困，自己还当是酒喝多了。')],
 bell:[L('keeper','我按更牌击鼓。船上的漏刻，我可管不着。'),L(a?'A':'B',a?'船上比这里晚半刻。主持来得及回舱。':'漏孔里残着蜡。他们故意让水流慢下来。','examine')],
 shrine:[L('n','祠亭下，折纸压在石缝中。诗人曾在这里约船娘核账。'),L(a?'A':'B',a?'她有理由等他活着下船。':'折纸边角是干的。后来那场水，只发生在船里。','examine')],
 apricot:[L('n','一片花瓣落在石凳边。更鼓一响，枝头又落下一片，恰好盖住它。'),L(a?'A':'B',a?'这片花……刚才落过一次。':'风停了，它却还沿着相同的弧线落下。','examine',[C('留下细小的记号',{stats:{TRUTH:3},flags:{flowerMarked:true}}),C('把花拾回枝旁',{stats:{DREAM:3}})])],
 lake:[L('n','岸上的灯都亮着。水中的灯，却有一盏迟迟没有出现。'),L(a?'A':'B',a?'抬头看时，它又在那里。':'镜面不在这里。这个倒影，我暂时解释不了。','examine',[C('和搭档一起记录差异',{stats:{TRUTH:3,TA:2,TB:2},flags:{reflectionRecorded:true}}),C('暂且只记在心里',{stats:{DREAM:3}})])]
 };return scenes[id]||[L('n','夜色未尽。')];}
 choiceLock(c){const r=c?.requires;if(!r)return '';const parts=[];for(const [k,v]of Object.entries(r.stats||{}))if(this.s.stats[k]<v)parts.push(`${k} ≥ ${v}（当前 ${this.s.stats[k]}，还差 ${v-this.s.stats[k]}）`);for(const [k,label]of Object.entries(r.flags||{}))if(!this.s.flags[k])parts.push(label);for(const [k,[value,label]]of Object.entries(r.values||{}))if(this.s.flags[k]!==value)parts.push(label);return parts.length?'未满足：'+parts.join('；'):'';}
 currentLine(){return this.lines()[this.s.index];}
 advance(i=0){if(this.s.view!=='dialog')return false;const l=this.currentLine();if(l.choices){const c=l.choices[i];if(!c||this.choiceLock(c))return false;this.apply(c.effects);}this.s.index++;if(this.s.index>=this.lines().length)this.finishEvent();return true;}
 finishEvent(){const s=this.s,e=s.event;s.event=null;s.index=0;if(e==='introA'||e==='introB'){s.flags[e]=true;return this.map();}if(e==='feast'){s.flags.murder=true;s.phase='investigation';return this.map();}if(e==='witness'){s.flags.witness=true;this.collect('testimony','A');return this.map();}if(e==='workshop'){s.flags.workshop=true;this.collect('model','B');return this.map();}if(e==='reunion'){s.view='match';return;}if(e==='waterEntry'){s.view='investigate';s.scene='water';return;}if(e==='alarm'){s.view='qteReady';s.qte={type:'water',step:0,success:0};return;}if(e==='afterWater'){if(!s.flags.saved)this.apply({stats:{TRUTH:3}});return this.enter('beforeChase');}if(e==='beforeChase'){s.view='qteReady';s.qte={type:'chase',step:0,success:0};return;}if(e==='afterChase'){s.phase='deduction';s.view='deduce';return;}if(e.startsWith('side:')){let id=e.slice(5),key='side:'+s.role+':'+id;if(!s.flags[key]){s.flags[key]=true;const evidence={temple:'ledger',books:'ledger',tavern:'wire',dock:'oil',incense:'incense',bell:'clock'}[id];if(evidence)this.collect(evidence,s.role);}return this.map();}this.map();}
 map(){this.s.view='map';this.s.insight=null;}

 routeDone(role){return !!(this.s.flags['cabin'+role]&&this.s.flags[role==='A'?'witness':'workshop']);}
 readyToMeet(){return this.routeDone('A')&&this.routeDone('B');}
 location(id){const s=this.s;if(s.view!=='map')return;if(!s.visits[s.role].includes(id))s.visits[s.role].push(id);if(id==='boat'){
 if(!s.flags.murder)return this.enter('feast');
 if(!s.flags['cabin'+s.role]){s.view='investigate';s.scene='cabin';return;}
 if(!this.readyToMeet())return this.enter('side:boat');
 if(!s.flags.validated)return this.enter('reunion');
 if(!s.flags.waterDone)return this.enter('waterEntry');
 if(!s.flags.chaseDone)return this.enter('alarm');
 s.view='deduce';return;
 }if(s.flags.murder&&id==='shrine'&&s.role==='A'&&!s.flags.witness)return this.enter('witness');if(s.flags.murder&&id==='academy'&&s.role==='B'&&!s.flags.workshop)return this.enter('workshop');this.enter('side:'+id);}
 collect(id,role=this.s.role){const s=this.s,c=D.clues[id];if(!c||s.observations[role].includes(id))return false;s.observations[role].push(id);if(!s.evidence.includes(id)){s.evidence.push(id);this.apply({stats:{EVIDENCE:c.score||0,TRUTH:c.truth||0}});}s.insight={id,role};return true;}
 canFinishInvest(){const s=this.s,owned=s.observations[s.role];if(s.scene==='water')return s.evidence.includes('gear')&&s.evidence.includes('rope');return s.role==='A'?(owned.includes('cup')||owned.includes('poem')):owned.includes('latch');}
 finishInvest(){if(!this.canFinishInvest())return false;const s=this.s;s.insight=null;if(s.scene==='water'){s.flags.waterDone=true;this.enter('alarm');}else{s.flags['cabin'+s.role]=true;this.map();}return true;}
 validate(){const s=this.s;if(!this.readyToMeet())return false;const valid=['cup','poem','footprints'].includes(s.match.A)&&s.match.B==='latch';if(valid){s.flags.validated=true;this.apply({stats:{TA:3,TB:3,EVIDENCE:1}});s.phase='water';this.enter('waterEntry');}return valid;}
 qteSteps(){const s=this.s;if(s.qte.type==='water'&&s.role==='A')return s.flags.support==='door'?[['顶住落下的舱门','A','向左撑门'],['将检修梯推入水中','D','向右放梯'],['拉住搭档的手','W','向上拉起']]:[['压住下滑的配重','D','向右抵住'],['稳住检修梯','A','向左支撑'],['拉住搭档的手','W','向上拉起']];if(s.qte.type==='water')return s.flags.support==='weight'?[['逆转铜轮','A','转轮向左'],['卡住齿口','D','把木楔推入'],['打开泄水闸','W','提起闸杆']]:[['攥紧止水绳','A','稳住绳索'],['顶开落下的舱门','D','撑住门缘'],['抓住上方横梁','W','向上攀住']];if(s.flags.chaseRoute==='shore')return s.role==='A'?[['穿过岸边货架','A','侧身绕过'],['越过系船缆绳','W','向前跨越'],['封住船坞出口','D','抢先截住']]:[['循声辨认脚步','A','侧耳寻声'],['拉开挡路的竹帘','W','向上揭帘'],['合拢船坞侧门','D','推门拦截']];if(s.flags.chaseRoute==='rope')return s.role==='A'?[['握绳荡向桥侧','W','借力荡起'],['避开倾倒的栏杆','A','向左收身'],['落地扣住披风','D','向右截住']]:[['收紧岸桩绳结','A','拉紧绳索'],['稳住搭档的落点','D','向右牵引'],['提起绳网封路','W','向上收网']];return s.role==='A'?[['跃过松动桥板','W','向前跃起'],['避开迎面船篙','A','向左闪身'],['截住深色披风','D','扣住手腕']]:[['将月光引向安全的桥板','A','偏转铜镜'],['抛出绳索封住去路','D','向右投绳'],['压住配重，为搭档落脚','W','稳住踏板']];}
 qteResult(success){const s=this.s;if(s.view!=='qte')return false;if(success)s.qte.success++;s.qte.step++;if(s.qte.step>=3){const pass=s.qte.success>=2;if(s.qte.type==='water'){s.flags.waterSuccess=pass;this.apply({stats:pass?{EVIDENCE:1}:{CHAOS:5}});this.enter('afterWater');}else{s.flags.chaseDone=true;s.flags.chaseSuccess=pass;this.apply({stats:pass?{EVIDENCE:1}:{CHAOS:3}});this.enter('afterChase');}s.qte=null;}return true;}
 precise(){return this.s.stats.EVIDENCE>=6&&['latch','gear'].every(id=>this.s.evidence.includes(id));}
 submit(){const s=this.s,d=s.deduction;if(!d.suspect||!d.method||!d.motive)return false;if(d.method==='mechanism'&&!this.precise())return false;s.flags.correct=d.suspect==='host'&&d.method==='mechanism'&&d.motive==='ledger'&&s.evidence.includes('ledger');s.flags.partial=d.suspect==='host'&&!s.flags.correct;this.apply({stats:s.flags.correct?{TRUTH:3}:s.flags.partial?{CHAOS:2}:{CHAOS:5,DREAM:3}});s.view='end';s.phase='end';return true;}
 task(){const s=this.s;if(!s.flags.murder)return '赴湖中画舫，出席今夜诗会。';if(!s.flags['cabin'+s.role])return s.role==='A'?'回画舫查验杯盏、诗笺与地上的水痕。':'回画舫检查门闩，寻找从舱外牵动机关的方式。';if(s.role==='A'&&!s.flags.witness)return '去岸边祠亭，听船娘说完她的经过。';if(s.role==='B'&&!s.flags.workshop)return '回幻术院核对旧图，再决定向搭档分享什么。';if(!this.readyToMeet())return '你的调查已告一段落。等待搭档完成调查，也可以继续探访街巷。';if(!s.flags.validated)return '双方记录已经齐备。回画舫，将两份发现相互验证。';if(!s.flags.waterDone)return '回画舫，下到水舱查验铜轮与止水绳。';return '将现有证据串起，给出案件判断。';}
}
root.Game=Game;if(typeof module!=='undefined')module.exports=Game;
})(typeof window!=='undefined'?window:globalThis);

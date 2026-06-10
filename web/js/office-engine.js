// ===================== VIRTUAL OFFICE ENGINE — 2.5D ISOMETRIC =====================
const canvas=document.getElementById('office');
const ctx=canvas.getContext('2d');
if(!ctx.roundRect){ctx.roundRect=function(x,y,w,h,r){if(typeof r==='number')r=[r,r,r,r];this.moveTo(x+r[0],y);this.lineTo(x+w-r[1],y);this.arcTo(x+w,y,x+w,y+r[1],r[1]);this.lineTo(x+w,y+h-r[2]);this.arcTo(x+w,y+h,x+w-r[2],y+h,r[2]);this.lineTo(x+r[3],y+h);this.arcTo(x,y+h,x,y+h-r[3],r[3]);this.lineTo(x,y+r[0]);this.arcTo(x,y,x+r[0],y,r[0]);return this;};}

// plan space (logic) — characters & rooms live on a flat 800x560 grid, projected to iso at draw time
const TILE=40, COLS=20, ROWS=14;
const GW=COLS*TILE, GH=ROWS*TILE;
const TOP_PAD=86;                       // space above for back walls + name pills
const VW=GW+GH, VH=(GW+GH)/2+TOP_PAD+44; // projected viewport 1360 x ~810
function di(x,y){return {x:(x-y)+GH, y:(x+y)*0.5+TOP_PAD};}

const PAL={
  bg:'#070b16',
  platTop:'#0f1626',platL:'#0a101e',platR:'#070c17',rim:'#2ce0ff',
  floorA:'#162038',floorB:'#121a2d',floorLine:'rgba(110,150,255,0.08)',
  wallFace:'#1a2342',wallSide:'#141b31',wallTop:'#27345c',
  deskTop:'#36426e',deskL:'#272f55',deskR:'#1d2440',
  screen:'#7ff3ff',screenGlow:'#aef7ff',screenFrame:'#0c1220',
  chair:'#2a3458',chairHi:'#3c4a7a',
  rack:'#131a2f',rackHi:'#1d2746',
  plant:'#2fae62',plantHi:'#4fe08a',plantPot:'#222b49',
  shadow:'rgba(2,6,16,0.45)',
  pm:'#ff5a52',reporter:'#3aa0ff',writer:'#46c46a',guardian:'#b06cff',graphic:'#ff9838',publisher:'#ffd23f',
  skin:'#ffce9e',skinSh:'#d99a64',hair:'#3d2a1c',hairLight:'#5a4030',
};

const GUT=24, WT=9, WALLH=48;
const RW=(GW-GUT)/2, RH=(GH-GUT)/2;
const ROOMS=[
  {id:'lead',    en:'LEADERSHIP',th:'บริหาร',  color:PAL.pm,       x:0,      y:0,      w:RW, h:RH},
  {id:'news',    en:'NEWSROOM',  th:'กองข่าว', color:PAL.reporter, x:RW+GUT, y:0,      w:RW, h:RH},
  {id:'review',  en:'REVIEW',    th:'ตรวจสอบ', color:PAL.guardian, x:0,      y:RH+GUT, w:RW, h:RH},
  {id:'creative',en:'CREATIVE',  th:'ครีเอทีฟ',color:PAL.graphic,  x:RW+GUT, y:RH+GUT, w:RW, h:RH},
];

const TEAM=[
  {id:'pm',       file:'pm.json',       name:'PM',       role:'ผู้จัดการ',    icon:'👔',roomId:'lead'},
  {id:'reporter', file:'reporter.json', name:'นักข่าว',  role:'หาข่าว',       icon:'📰',roomId:'news'},
  {id:'writer',   file:'writer.json',   name:'นักเขียน', role:'เขียนแคปชั่น', icon:'✍️',roomId:'news'},
  {id:'guardian', file:'guardian.json', name:'ตรวจสอบ',  role:'ตรวจคุณภาพ',   icon:'🔍',roomId:'review'},
  {id:'graphic',  file:'graphic.json',  name:'กราฟิก',   role:'ทำภาพ',        icon:'🎨',roomId:'creative'},
  {id:'publisher',file:'publisher.json',name:'โพสต์',    role:'ลงเพจ',        icon:'📱',roomId:'creative'},
];

const reduceMotionMQ=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):{matches:false};
let prefersReduced=reduceMotionMQ.matches;
reduceMotionMQ.addEventListener&&reduceMotionMQ.addEventListener('change',e=>{prefersReduced=e.matches;});

function chromeFor(w){
  if(w<1180) return {left:0,right:0,top:122,bottom:104};
  return {left:210,right:248,top:60,bottom:104};
}
let W,H,scale=1,OX=0,OY=0,CH={left:0,right:0,top:60,bottom:104};
const bg=document.createElement('canvas');
function resize(){
  W=window.innerWidth;H=window.innerHeight;
  const dpr=window.devicePixelRatio||1;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
  CH=chromeFor(W);
  const availW=Math.max(120,W-CH.left-CH.right);
  const availH=Math.max(120,H-CH.top-CH.bottom);
  scale=Math.min(availW/VW,availH/VH);
  OX=CH.left+(availW-VW*scale)/2;
  const slackV=availH-VH*scale;
  OY=CH.top+(W<1180?Math.min(slackV/2,12):slackV/2);
  renderBG();
}
window.addEventListener('resize',resize);

class Character{
  constructor(id,name,color,room,hx,hy){
    this.id=id;this.name=name;this.color=color;this.room=room;
    this.homeX=hx;this.homeY=hy;
    this.x=hx;this.y=hy;this.targetX=hx;this.targetY=hy;
    this.state='working';this.dir=3;this.frame=0;this.frameTick=0;
    this.wanderTimer=180+Math.random()*240;
    this.bubble=null;this.bubbleTimer=0;this.working=false;this.highlightTimer=0;
    this.desk={x:Math.round(hx-26),y:Math.round(hy-42)};
  }
  bounds(){const r=this.room;return {x0:r.x+WT+12,y0:r.y+WT+26,x1:r.x+r.w-18,y1:r.y+r.h-18};}
  update(){
    this.frameTick++;if(this.frameTick>8){this.frame=(this.frame+1)%6;this.frameTick=0;}
    if(this.bubbleTimer>0)this.bubbleTimer--;else this.bubble=null;
    if(this.highlightTimer>0)this.highlightTimer--;
    const dx=this.targetX-this.x,dy=this.targetY-this.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist>2){
      const spd=1.1;
      this.x+=dx/dist*spd;this.y+=dy/dist*spd;this.state='walking';
      // pick sprite facing from on-screen (projected) velocity, not plan velocity
      const sdx=dx-dy, sdy=(dx+dy)*0.5;
      if(Math.abs(sdx)>Math.abs(sdy)*1.4)this.dir=sdx<0?1:2;else this.dir=sdy<0?3:0;
    }else{
      this.x=this.targetX;this.y=this.targetY;
      if(this.state==='walking'){
        const atHome=Math.abs(this.x-this.homeX)<5&&Math.abs(this.y-this.homeY)<5;
        this.state=atHome?'working':'idle';
        if(this.state==='working')this.dir=3; // face the desk screen (away from camera)
        this.wanderTimer=200+Math.random()*260;
      }
      this.wanderTimer--;
      if(this.wanderTimer<=0&&!this.working&&!prefersReduced){
        const atHome=Math.abs(this.x-this.homeX)<5&&Math.abs(this.y-this.homeY)<5;
        if(atHome){
          if(Math.random()<0.25){
            const b=this.bounds();
            this.targetX=b.x0+Math.random()*(b.x1-b.x0);
            this.targetY=b.y0+Math.random()*(b.y1-b.y0);
            this.state='walking';
          }else this.wanderTimer=320+Math.random()*360;
        }else{this.targetX=this.homeX;this.targetY=this.homeY;this.state='walking';}
      }
    }
  }
  showBubble(t,d){this.bubble=t;this.bubbleTimer=d||120;}
  say(t,d){this.bubble=t;this.bubbleTimer=d||220;}
  ping(){this.highlightTimer=72;this.showBubble('👋',72);}
  goHome(){this.targetX=this.homeX;this.targetY=this.homeY;this.working=true;}
  relax(){this.working=false;this.wanderTimer=60+Math.random()*100;}
}

const characters=[];const charById={};
ROOMS.forEach(room=>{
  const mem=TEAM.filter(t=>t.roomId===room.id);const N=mem.length;
  mem.forEach((t,k)=>{
    const cx=Math.round(room.x+room.w*(k+1)/(N+1));
    const cy=Math.round(room.y+room.h*0.56);
    const c=new Character(t.id,t.name,PAL[t.id],room,cx,cy);
    characters.push(c);charById[t.id]=c;
  });
});
window.characters=characters;
window.TEAM=TEAM;
window.pingCharacter=(id)=>{const c=charById[id];if(c)c.ping();};
window.getAgentStates=()=>characters.map(c=>({id:c.id,name:c.name,color:c.color,state:c.state,working:c.working}));
window.sayLine=(id,text,dur)=>{const c=charById[id];if(!c)return;c.say(text,dur);if(window.onAgentSay)window.onAgentSay(id,c.name,c.color,text);};

// click / hover a character → open profile (hit test in projected space)
function charAtScreen(cx,cy){
  const rect=canvas.getBoundingClientRect();
  const mu=(cx-rect.left-OX)/scale, mv=(cy-rect.top-OY)/scale;
  for(const c of characters){const p=di(c.x,c.y);if(Math.abs(mu-p.x)<20&&mv>p.y-52&&mv<p.y+8)return c;}
  return null;
}
canvas.addEventListener('click',e=>{const c=charAtScreen(e.clientX,e.clientY);if(c&&window.openProfile)window.openProfile(c.id);});
canvas.addEventListener('mousemove',e=>{canvas.style.cursor=charAtScreen(e.clientX,e.clientY)?'pointer':'default';});

const AGENT_SPRITE={pm:'boss',reporter:'listing',writer:'dev',guardian:'tech',graphic:'marketing',publisher:'admin'};
const DIR_NAME=['down','left','right','up'];
const sprites={};
for(const type of Object.values(AGENT_SPRITE)){
  sprites[type]={};
  for(const d of DIR_NAME){const img=new Image();img.src='assets/sprites/agent-'+type+'-walk-'+d+'.png';sprites[type][d]=img;}
}

let particles=[];
function addParticle(x,y,color,text){particles.push({x,y,color,text,life:60,vy:-0.8,vx:(Math.random()-0.5)*0.5});}
window.addParticle=addParticle;

window.gameState={pipelineRunning:false,lastEvent:''};
function startPipelineAnim(){
  characters.forEach(c=>{c.goHome();c.showBubble('💪',90);});
  setTimeout(()=>characters.forEach((c,i)=>setTimeout(()=>c.showBubble('⚡',70),i*350)),1400);
}
function endPipelineAnim(ok){characters.forEach(c=>{c.relax();c.showBubble(ok?'🎉':'😢',100);if(ok)addParticle(c.x,c.y-30,'#ffd54f','✨');});}
window.startPipelineAnim=startPipelineAnim;window.endPipelineAnim=endPipelineAnim;

function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=(n>>16)+amt,g=((n>>8)&255)+amt,b=(n&255)+amt;r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));return '#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1);}
function hexA(hex,a){const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${(n>>8)&255},${n&255},${a})`;}

// ---------- iso drawing helpers (static scene → offscreen bg canvas) ----------
let B=null; // bg 2d context while rendering
function poly(pts){B.beginPath();B.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)B.lineTo(pts[i].x,pts[i].y);B.closePath();}
function lift(p,h){return {x:p.x,y:p.y-h};}
function isoQuad(x,y,w,d,h,fill){const a=lift(di(x,y),h),b=lift(di(x+w,y),h),c=lift(di(x+w,y+d),h),e=lift(di(x,y+d),h);poly([a,b,c,e]);B.fillStyle=fill;B.fill();return [a,b,c,e];}
function isoBox(x,y,w,d,h,top,left,right){
  const a0=di(x,y),b0=di(x+w,y),c0=di(x+w,y+d),e0=di(x,y+d);
  const a=lift(a0,h),b=lift(b0,h),c=lift(c0,h),e=lift(e0,h);
  poly([e,c,c0,e0]);B.fillStyle=left;B.fill();   // front-left face
  poly([b,c,c0,b0]);B.fillStyle=right;B.fill();  // front-right face
  poly([a,b,c,e]);B.fillStyle=top;B.fill();      // top face
  return {a,b,c,e};
}
function neonStroke(pts,color,blur,width){
  B.save();B.shadowColor=color;B.shadowBlur=blur;B.strokeStyle=color;B.lineWidth=width||1.5;
  poly(pts);B.stroke();B.restore();
}

function drawPlatform(){
  const M=30,TH=26;
  const f=isoBox(-M,-M,GW+2*M,GH+2*M,0,PAL.platTop,PAL.platL,PAL.platR);
  // sides extend down — redraw with thickness
  const a0=di(-M,-M),b0=di(GW+M,-M),c0=di(GW+M,GH+M),e0=di(-M,GH+M);
  const dn=p=>({x:p.x,y:p.y+TH});
  poly([e0,c0,dn(c0),dn(e0)]);B.fillStyle=PAL.platL;B.fill();
  poly([b0,c0,dn(c0),dn(b0)]);B.fillStyle=PAL.platR;B.fill();
  poly([a0,b0,c0,e0]);B.fillStyle=PAL.platTop;B.fill();
  neonStroke([a0,b0,c0,e0],hexA(PAL.rim,0.55),12,2);
  // walkway glow lines through the gutters
  const gx=RW+GUT/2, gy=RH+GUT/2;
  B.save();B.shadowColor=PAL.rim;B.shadowBlur=10;B.strokeStyle=hexA(PAL.rim,0.35);B.lineWidth=2;
  let p1=di(gx,-M+6),p2=di(gx,GH+M-6);B.beginPath();B.moveTo(p1.x,p1.y);B.lineTo(p2.x,p2.y);B.stroke();
  p1=di(-M+6,gy);p2=di(GW+M-6,gy);B.beginPath();B.moveTo(p1.x,p1.y);B.lineTo(p2.x,p2.y);B.stroke();
  B.restore();
}

function drawFloor(r){
  const ix=r.x+WT,iy=r.y+WT,iw=r.w-WT-4,ih=r.h-WT-4;
  const T=40;
  B.save();
  const a=di(ix,iy),b=di(ix+iw,iy),c=di(ix+iw,iy+ih),e=di(ix,iy+ih);
  poly([a,b,c,e]);B.clip();
  for(let row=0;row*T<ih+T;row++)for(let col=0;col*T<iw+T;col++){
    const tx=ix+col*T,ty=iy+row*T;
    isoQuad(tx,ty,T,T,0,((col+row)%2===0)?PAL.floorA:PAL.floorB);
  }
  // subtle room-color wash near back walls
  const g=B.createLinearGradient(a.x,a.y,a.x,c.y);
  g.addColorStop(0,hexA(r.color,0.10));g.addColorStop(0.5,'rgba(0,0,0,0)');
  poly([a,b,c,e]);B.fillStyle=g;B.fill();
  B.restore();
  neonStroke([a,b,c,e],hexA(r.color,0.28),6,1);
}

function drawWalls(r){
  // back-right wall (along top edge) + back-left wall (along left edge), neon strip on top
  const t=isoBox(r.x,r.y,r.w,WT,WALLH,PAL.wallTop,PAL.wallFace,PAL.wallSide);
  const l=isoBox(r.x,r.y+WT,WT,r.h-WT,WALLH,PAL.wallTop,PAL.wallFace,PAL.wallSide);
  neonStroke([t.a,t.b],r.color,9,2.5);
  neonStroke([l.a,l.e],r.color,9,2.5);
}
function drawFrontRims(r){
  // low glass rims on the two front edges so each room reads as a room (kept low so characters stay visible)
  const RIMH=11;
  const b=isoBox(r.x+WT,r.y+r.h-5,r.w-WT,5,RIMH,PAL.wallTop,PAL.wallFace,PAL.wallSide);
  const rt=isoBox(r.x+r.w-5,r.y+WT,5,r.h-WT-5,RIMH,PAL.wallTop,PAL.wallFace,PAL.wallSide);
  neonStroke([b.a,b.b],hexA(r.color,0.55),6,1.5);
  neonStroke([rt.a,rt.e],hexA(r.color,0.55),6,1.5);
}

function drawWindowOnWall(r){
  // skewed star-sky window on the back-right wall face
  const x1=r.x+r.w*0.36,x2=r.x+r.w*0.78,wy=r.y+WT;
  const hTop=WALLH-10,hBot=14;
  const p1=lift(di(x1,wy),hTop),p2=lift(di(x2,wy),hTop),p3=lift(di(x2,wy),hBot),p4=lift(di(x1,wy),hBot);
  poly([p1,p2,p3,p4]);B.fillStyle='#0a1228';B.fill();
  B.save();poly([p1,p2,p3,p4]);B.clip();
  const g=B.createLinearGradient(p1.x,p1.y,p4.x,p4.y);
  g.addColorStop(0,'#101b3a');g.addColorStop(1,'#1b2c5c');
  poly([p1,p2,p3,p4]);B.fillStyle=g;B.fill();
  B.fillStyle='rgba(255,255,255,0.8)';
  for(let i=0;i<14;i++){const fx=p1.x+((i*73)%100)/100*(p2.x-p1.x),fy=p1.y+((i*37)%100)/100*(p4.y-p1.y)*0.7;B.fillRect(fx,fy,1.4,1.4);}
  // skyline
  B.fillStyle='#0d162e';
  for(let i=0;i<8;i++){const bw=(p2.x-p1.x)/8,bx=p1.x+i*bw,bh=8+((i*53)%12);B.fillRect(bx,p3.y-bh+(p4.y-p3.y)*0,bw-2,bh);}
  B.restore();
  neonStroke([p1,p2,p3,p4,p1],hexA('#5ad0ff',0.5),5,1);
}

function drawDeskIso(dk,roomColor){
  const x=dk.x,y=dk.y,w=52,d=24,h=18;
  // chair (front of desk)
  isoBox(x+18,y+d+8,16,12,9,PAL.chairHi,PAL.chair,shade(PAL.chair,-10));
  // desk body
  const f=isoBox(x,y,w,d,h,PAL.deskTop,PAL.deskL,PAL.deskR);
  neonStroke([f.a,f.b,f.c,f.e],hexA(roomColor,0.7),6,1.4);
  // monitor standing on the back edge of the desk top
  const mx=x+14,mw=24;
  const m1=lift(di(mx,y+5),h+24),m2=lift(di(mx+mw,y+5),h+24),m3=lift(di(mx+mw,y+5),h+2),m4=lift(di(mx,y+5),h+2);
  poly([{x:m1.x-1,y:m1.y-1},{x:m2.x+1,y:m2.y-1},{x:m3.x+1,y:m3.y+1},{x:m4.x-1,y:m4.y+1}]);B.fillStyle=PAL.screenFrame;B.fill();
  B.save();B.shadowColor=PAL.screen;B.shadowBlur=14;
  poly([m1,m2,m3,m4]);B.fillStyle=hexA(PAL.screen,0.92);B.fill();B.restore();
  poly([m1,{x:m1.x+(m2.x-m1.x)*0.45,y:m1.y},{x:m4.x+(m3.x-m4.x)*0.45,y:m4.y},m4]);B.fillStyle=hexA(PAL.screenGlow,0.5);B.fill();
  // glow pool on floor in front of the screen
  const gp=di(x+w/2,y+d+18);
  const rg=B.createRadialGradient(gp.x,gp.y,2,gp.x,gp.y,30);
  rg.addColorStop(0,hexA(PAL.screen,0.10));rg.addColorStop(1,'rgba(0,0,0,0)');
  B.fillStyle=rg;B.beginPath();B.ellipse(gp.x,gp.y,30,13,0,0,Math.PI*2);B.fill();
}

function drawRack(x,y){
  const f=isoBox(x,y,30,14,40,PAL.rackHi,PAL.rack,shade(PAL.rack,-6));
  const leds=['#3ddc84','#ffd23f','#3aa0ff','#ff5a52'];
  for(let i=0;i<4;i++){
    const p=lift(di(x+5,y+14),8+i*8);
    B.save();B.shadowColor=leds[i];B.shadowBlur=5;B.fillStyle=leds[i];B.fillRect(p.x+2,p.y-2,3,3);B.restore();
    B.fillStyle='rgba(160,190,255,0.25)';B.fillRect(p.x+8,p.y-2,12,2);
  }
  neonStroke([f.a,f.b],hexA('#5ad0ff',0.35),4,1);
}

function drawPlantIso(x,y){
  isoBox(x,y,16,14,14,'#3c4a7a',PAL.plantPot,shade(PAL.plantPot,-8));
  const p=lift(di(x+8,y+7),22);
  B.save();B.shadowColor=PAL.plantHi;B.shadowBlur=8;
  B.fillStyle=PAL.plant;
  B.beginPath();B.arc(p.x,p.y,9,0,Math.PI*2);B.fill();
  B.beginPath();B.arc(p.x-7,p.y+4,6,0,Math.PI*2);B.fill();
  B.beginPath();B.arc(p.x+7,p.y+4,6,0,Math.PI*2);B.fill();
  B.fillStyle=PAL.plantHi;B.beginPath();B.arc(p.x-2,p.y-3,4,0,Math.PI*2);B.fill();
  B.restore();
}

const pillPos={}; // roomId → {x,y} for the dynamic status dot
function drawPill(r){
  const c=di(r.x+r.w*0.5,r.y+WT/2);
  const py=c.y-WALLH-16;
  B.font='10px "Press Start 2P"';
  const label=r.en;
  const tw=B.measureText(label).width;
  const bw=tw+38,bh=24;
  B.save();B.shadowColor=hexA(r.color,0.8);B.shadowBlur=10;
  B.fillStyle='rgba(8,12,26,0.92)';B.beginPath();B.roundRect(c.x-bw/2,py-bh/2,bw,bh,10);B.fill();
  B.strokeStyle=r.color;B.lineWidth=1.5;B.beginPath();B.roundRect(c.x-bw/2,py-bh/2,bw,bh,10);B.stroke();
  B.restore();
  B.fillStyle='#eaf2ff';B.textBaseline='middle';B.fillText(label,c.x-bw/2+12,py+1);B.textBaseline='alphabetic';
  pillPos[r.id]={x:c.x+bw/2-11,y:py};
}

function drawSign(){
  const cx=GW/2,cy=GH/2;
  isoBox(cx-52,cy-12,104,24,14,'#101a33','#0c1426','#0a111f');
  const p=di(cx,cy);
  const label='PANG NEWS';
  B.font='13px "Press Start 2P"';
  const tw=B.measureText(label).width;
  B.save();B.shadowColor=PAL.rim;B.shadowBlur=16;
  B.fillStyle='rgba(8,14,30,0.95)';B.beginPath();B.roundRect(p.x-tw/2-16,p.y-50,tw+32,30,8);B.fill();
  B.strokeStyle=PAL.rim;B.lineWidth=1.5;B.beginPath();B.roundRect(p.x-tw/2-16,p.y-50,tw+32,30,8);B.stroke();
  B.fillStyle=PAL.rim;B.textBaseline='middle';B.fillText(label,p.x-tw/2,p.y-34);B.textBaseline='alphabetic';
  B.restore();
  // sign post glow
  B.save();B.strokeStyle=hexA(PAL.rim,0.5);B.shadowColor=PAL.rim;B.shadowBlur=8;B.lineWidth=2;
  B.beginPath();B.moveTo(p.x,p.y-20);B.lineTo(p.x,p.y-8);B.stroke();B.restore();
}

function renderBG(){
  const dpr=window.devicePixelRatio||1;
  bg.width=canvas.width;bg.height=canvas.height;
  B=bg.getContext('2d');
  B.setTransform(dpr,0,0,dpr,0,0);
  // deep-space backdrop + faint stars (screen space)
  const bgrad=B.createLinearGradient(0,0,0,H);
  bgrad.addColorStop(0,'#060a14');bgrad.addColorStop(1,'#0a1020');
  B.fillStyle=bgrad;B.fillRect(0,0,W,H);
  B.fillStyle='rgba(160,190,255,0.20)';
  for(let i=0;i<70;i++){const sx=((i*1973)%997)/997*W,sy=((i*877)%613)/613*H;B.fillRect(sx,sy,1.2,1.2);}
  B.translate(OX,OY);B.scale(scale,scale);
  drawPlatform();
  const sorted=[...ROOMS].sort((a,b)=>(a.x+a.y)-(b.x+b.y));
  sorted.forEach(r=>{
    drawFloor(r);
    drawWalls(r);
    drawWindowOnWall(r);
    // furniture back→front
    drawRack(r.x+WT+8,r.y+WT+6);
    characters.filter(c=>c.room===r).forEach(c=>drawDeskIso(c.desk,r.color));
    drawPlantIso(r.x+WT+6,r.y+r.h-36);
    drawPlantIso(r.x+r.w-32,r.y+r.h-36);
    drawFrontRims(r);
    drawPill(r);
  });
  drawSign();
  B=null;
}
document.fonts&&document.fonts.ready&&document.fonts.ready.then(()=>renderBG());

function drawCharacter(c){
  const s=2;const walk=c.state==='walking';const f=c.frame;
  const p=di(c.x,c.y);const px=p.x,py=p.y;
  const bob=(walk||prefersReduced)?0:(Math.sin(tick*0.07+c.homeX*0.13)>0.3?-1:0);
  const hl=c.highlightTimer>0;
  const jump=hl?-Math.abs(Math.sin((72-c.highlightTimer)*0.26))*5:0;
  const bx=px-5*s,by=py-8*s+bob+jump;
  const dark=shade(c.color,-45),lite=shade(c.color,35);
  if(hl){ctx.strokeStyle='#ffd54f';ctx.lineWidth=2;ctx.globalAlpha=0.4+0.4*Math.sin(c.highlightTimer*0.4);ctx.beginPath();ctx.ellipse(px,py+8*s,9*s,3.2*s,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  ctx.fillStyle=PAL.shadow;ctx.beginPath();ctx.ellipse(px,py+8*s,6*s,2.2*s,0,0,Math.PI*2);ctx.fill();
  const sprType=AGENT_SPRITE[c.id];
  const sprImg=sprType&&sprites[sprType]&&sprites[sprType][DIR_NAME[c.dir]||'down'];
  if(sprImg&&sprImg.complete&&sprImg.naturalWidth>0){
    const FR=64,SPR=46;const fr=walk?(c.frame%6):0;ctx.imageSmoothingEnabled=false;
    ctx.drawImage(sprImg,fr*FR,0,FR,FR,Math.round(px-SPR/2),Math.round(py+12-SPR+bob+jump),SPR,SPR);
  }else{
    ctx.fillStyle='#3a4046';const legOff=walk?(f%2===0?2:-2):0;
    ctx.fillRect(bx+2*s,by+11*s+Math.max(0,legOff),2*s,4*s);ctx.fillRect(bx+6*s,by+11*s+Math.max(0,-legOff),2*s,4*s);
    const armOff=(c.state==='working'&&f%2===0)?-1:0;ctx.fillStyle=dark;
    ctx.fillRect(bx-1*s,by+7*s+armOff,2*s,4*s);ctx.fillRect(bx+9*s,by+7*s-armOff,2*s,4*s);
    ctx.fillStyle=dark;ctx.fillRect(bx+1*s-1,by+6*s,8*s+2,6*s+1);
    ctx.fillStyle=c.color;ctx.fillRect(bx+1*s,by+6*s,8*s,6*s);
    ctx.fillStyle=lite;ctx.fillRect(bx+1*s,by+6*s,8*s,1*s);ctx.fillStyle=dark;ctx.fillRect(bx+1*s,by+11*s,8*s,1*s);
    ctx.fillStyle=PAL.hair;ctx.fillRect(bx+1*s-1,by,8*s+2,6*s);
    ctx.fillStyle=PAL.skin;ctx.fillRect(bx+1*s,by+1*s,8*s,5*s);
    ctx.fillStyle=PAL.skinSh;ctx.fillRect(bx+7*s,by+1*s,2*s,5*s);
    ctx.fillStyle=PAL.hair;ctx.fillRect(bx+1*s,by,8*s,2*s);ctx.fillRect(bx+1*s,by+1*s,1*s,2*s);ctx.fillRect(bx+8*s,by+1*s,1*s,2*s);
    ctx.fillStyle=PAL.hairLight;ctx.fillRect(bx+2*s,by,3*s,1*s);
    if(c.dir!==3){
      ctx.fillStyle='#2b2b2b';ctx.fillRect(bx+3*s,by+3*s,s,s+1);ctx.fillRect(bx+6*s,by+3*s,s,s+1);
      ctx.fillStyle='rgba(255,255,255,0.85)';ctx.fillRect(bx+3*s,by+3*s,1,1);ctx.fillRect(bx+6*s,by+3*s,1,1);
      ctx.fillStyle='#7a4a3a';ctx.fillRect(bx+4*s,by+5*s,2*s,1);
    }
  }
  ctx.fillStyle='rgba(6,10,20,0.78)';ctx.font='9px "Press Start 2P"';
  const tw=ctx.measureText(c.name).width;
  ctx.fillRect(px-tw/2-3,by-12,tw+6,12);
  ctx.fillStyle=c.color;ctx.fillText(c.name,px-tw/2,by-3);
  if(c.state==='idle'&&!c.bubble){ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText('💤',px,by-15);ctx.textAlign='left';}
  if(c.bubble){
    const isEmoji=[...c.bubble].length<=2;
    ctx.font=isEmoji?'13px sans-serif':'10px "DotGothic16",sans-serif';
    let txt=c.bubble;if(!isEmoji&&txt.length>28)txt=txt.slice(0,27)+'…';
    const tw2=ctx.measureText(txt).width;const bw=Math.max(22,tw2+12),bh=17;const cx2=px,cy2=by-30;
    ctx.fillStyle='rgba(255,253,245,0.97)';ctx.strokeStyle='#1a1208';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.roundRect(cx2-bw/2,cy2-bh/2,bw,bh,5);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx2-3,cy2+bh/2-1);ctx.lineTo(cx2+3,cy2+bh/2-1);ctx.lineTo(cx2,cy2+bh/2+5);ctx.closePath();ctx.fillStyle='rgba(255,253,245,0.97)';ctx.fill();
    ctx.fillStyle='#1a1208';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,cx2,cy2);ctx.textAlign='left';ctx.textBaseline='alphabetic';
  }
}
function drawParticles(){
  particles=particles.filter(p=>p.life>0);
  particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;const q=di(p.x,p.y);ctx.globalAlpha=p.life/60;ctx.font='14px sans-serif';ctx.fillStyle=p.color;ctx.fillText(p.text||'⭐',q.x,q.y);ctx.globalAlpha=1;});
}
function getTimeColor(){const h=new Date().getHours();if(h>=6&&h<10)return 'rgba(255,200,100,0.04)';if(h>=10&&h<17)return 'rgba(255,255,255,0)';if(h>=17&&h<20)return 'rgba(255,150,50,0.05)';return 'rgba(10,14,40,0.14)';}

let tick=0;
function gameLoop(){
  tick++;
  ctx.setTransform(window.devicePixelRatio||1,0,0,window.devicePixelRatio||1,0,0);
  ctx.clearRect(0,0,W,H);
  if(bg.width>0)ctx.drawImage(bg,0,0,bg.width,bg.height,0,0,W,H);
  ctx.save();ctx.translate(OX,OY);ctx.scale(scale,scale);
  // dynamic status dots on room pills
  ROOMS.forEach(r=>{
    const pp=pillPos[r.id];if(!pp)return;
    const anyWorking=characters.some(c=>c.room===r&&c.state!=='idle');
    ctx.save();ctx.shadowColor=anyWorking?'#3ddc84':'#ffd23f';ctx.shadowBlur=6;
    ctx.fillStyle=anyWorking?'#3ddc84':'#ffd23f';
    ctx.beginPath();ctx.arc(pp.x,pp.y,3.4,0,Math.PI*2);ctx.fill();ctx.restore();
  });
  characters.forEach(c=>c.update());
  [...characters].sort((a,b)=>(a.x+a.y)-(b.x+b.y)).forEach(drawCharacter);
  drawParticles();
  ctx.restore();
  ctx.fillStyle=getTimeColor();ctx.fillRect(0,0,W,H);
  requestAnimationFrame(gameLoop);
}
resize();
gameLoop();

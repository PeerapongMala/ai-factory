// ===================== VIRTUAL OFFICE ENGINE =====================
const canvas=document.getElementById('office');
const ctx=canvas.getContext('2d');
if(!ctx.roundRect){ctx.roundRect=function(x,y,w,h,r){if(typeof r==='number')r=[r,r,r,r];this.moveTo(x+r[0],y);this.lineTo(x+w-r[1],y);this.arcTo(x+w,y,x+w,y+r[1],r[1]);this.lineTo(x+w,y+h-r[2]);this.arcTo(x+w,y+h,x+w-r[2],y+h,r[2]);this.lineTo(x+r[3],y+h);this.arcTo(x,y+h,x,y+h-r[3],r[3]);this.lineTo(x,y+r[0]);this.arcTo(x,y,x+r[0],y,r[0]);return this;};}

const TILE=40, COLS=20, ROWS=14;
const GW=COLS*TILE, GH=ROWS*TILE; // 800 x 560

const PAL={
  floor1:'#caa46e',floor2:'#bd9760',floorLine:'#a8854f',
  wall:'#5a4636',wallTop:'#7a5f48',wallDark:'#2c2018',wallBase:'#241a12',wallEdge:'#9c7a5a',
  desk:'#b78457',deskTop:'#cd9d70',deskDark:'#8c6038',deskLeg:'#6b4628',
  screen:'#7fd4ff',screenGlow:'#c4ecff',screenFrame:'#1f262c',
  chair:'#4f3c2a',chairSeat:'#665033',
  plant:'#3f9450',plantHi:'#57b366',plantPot:'#bd6a3e',plantPotHi:'#d4824f',
  shadow:'rgba(20,12,5,0.22)',
  sky:'#8fd0ff',skyLow:'#cdecff',cloud:'#ffffff',sun:'#ffe08a',
  pm:'#ff5a52',reporter:'#3aa0ff',writer:'#46c46a',guardian:'#b06cff',graphic:'#ff9838',publisher:'#ffd23f',
  skin:'#ffce9e',skinSh:'#d99a64',hair:'#3d2a1c',hairLight:'#5a4030',
};

const GUT=20;
const RW=(GW-GUT)/2, RH=(GH-GUT)/2;
const WT=8, HH=26;
const ROOMS=[
  {id:'lead',    en:'LEADERSHIP CORE', th:'บริหาร',  color:PAL.pm,       x:0,      y:0,      w:RW, h:RH},
  {id:'news',    en:'NEWSROOM CORE',   th:'กองข่าว', color:PAL.reporter, x:RW+GUT, y:0,      w:RW, h:RH},
  {id:'review',  en:'REVIEW CORE',     th:'ตรวจสอบ', color:PAL.guardian, x:0,      y:RH+GUT, w:RW, h:RH},
  {id:'creative',en:'CREATIVE CORE',   th:'ครีเอทีฟ',color:PAL.graphic,  x:RW+GUT, y:RH+GUT, w:RW, h:RH},
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
function resize(){
  W=window.innerWidth;H=window.innerHeight;
  const dpr=window.devicePixelRatio||1;
  canvas.width=W*dpr;canvas.height=H*dpr;
  canvas.style.width=W+'px';canvas.style.height=H+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
  CH=chromeFor(W);
  const availW=Math.max(120,W-CH.left-CH.right);
  const availH=Math.max(120,H-CH.top-CH.bottom);
  scale=Math.min(availW/GW,availH/GH);
  OX=CH.left+(availW-GW*scale)/2;
  const slackV=availH-GH*scale;
  // portrait/narrow: anchor near top so the office sits under the toolbar instead of floating with big gaps
  OY=CH.top+(W<1180?Math.min(slackV/2,12):slackV/2);
}
window.addEventListener('resize',resize);resize();

class Character{
  constructor(id,name,color,room,hx,hy){
    this.id=id;this.name=name;this.color=color;this.room=room;
    this.homeX=hx;this.homeY=hy;
    this.x=hx;this.y=hy;this.targetX=hx;this.targetY=hy;
    this.state='working';this.dir=0;this.frame=0;this.frameTick=0;
    this.wanderTimer=180+Math.random()*240;
    this.bubble=null;this.bubbleTimer=0;this.working=false;this.highlightTimer=0;
    this.desk={x:Math.round(hx-20),y:Math.round(hy-24)};
  }
  bounds(){const r=this.room;return {x0:r.x+WT+14,y0:r.y+HH+34,x1:r.x+r.w-WT-14,y1:r.y+r.h-WT-16};}
  update(){
    this.frameTick++;if(this.frameTick>8){this.frame=(this.frame+1)%6;this.frameTick=0;}
    if(this.bubbleTimer>0)this.bubbleTimer--;else this.bubble=null;
    if(this.highlightTimer>0)this.highlightTimer--;
    const dx=this.targetX-this.x,dy=this.targetY-this.y;
    const dist=Math.sqrt(dx*dx+dy*dy);
    if(dist>2){
      const spd=1.1;
      this.x+=dx/dist*spd;this.y+=dy/dist*spd;this.state='walking';
      if(Math.abs(dx)>Math.abs(dy))this.dir=dx<0?1:2;else this.dir=dy<0?3:0;
    }else{
      this.x=this.targetX;this.y=this.targetY;
      if(this.state==='walking'){
        const atHome=Math.abs(this.x-this.homeX)<5&&Math.abs(this.y-this.homeY)<5;
        this.state=atHome?'working':'idle';
        if(this.state==='working')this.dir=0;
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
    const cy=Math.round(room.y+HH+(room.h-HH)*0.60);
    const c=new Character(t.id,t.name,PAL[t.id],room,cx,cy);
    characters.push(c);charById[t.id]=c;
  });
});
window.characters=characters;
window.TEAM=TEAM;
window.pingCharacter=(id)=>{const c=charById[id];if(c)c.ping();};
window.getAgentStates=()=>characters.map(c=>({id:c.id,name:c.name,color:c.color,state:c.state,working:c.working}));
window.sayLine=(id,text,dur)=>{const c=charById[id];if(!c)return;c.say(text,dur);if(window.onAgentSay)window.onAgentSay(id,c.name,c.color,text);};

// click / hover a character on the canvas → open their profile (core loop: manage your staff)
function charAtScreen(cx,cy){
  const rect=canvas.getBoundingClientRect();
  const ox=(cx-rect.left-OX)/scale, oy=(cy-rect.top-OY)/scale;
  for(const c of characters){ if(Math.abs(ox-c.x)<18 && oy>c.y-46 && oy<c.y+8) return c; }
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
function rr(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}

function drawRoomFloor(ix,iy,iw,ih){
  ctx.save();ctx.beginPath();ctx.rect(ix,iy,iw,ih);ctx.clip();
  const T=34;
  for(let r=0;r*T<ih+T;r++)for(let c=0;c*T<iw+T;c++){
    const px=ix+c*T,py=iy+r*T;
    ctx.fillStyle=((c+r)%2===0)?PAL.floor1:PAL.floor2;ctx.fillRect(px,py,T,T);
    ctx.fillStyle=PAL.floorLine;ctx.fillRect(px,py,T,1);ctx.fillRect(px,py,1,T);
  }
  ctx.fillStyle='rgba(0,0,0,0.10)';ctx.fillRect(ix,iy,iw,8);
  ctx.restore();
}
function drawBookshelf(x,y){
  ctx.fillStyle=PAL.shadow;ctx.fillRect(x+3,y+30,34,3);
  ctx.fillStyle=PAL.deskLeg;ctx.fillRect(x+2,y,36,30);
  ctx.fillStyle=PAL.wallBase;ctx.fillRect(x+4,y+2,32,26);
  const colors=['#e57373','#64b5f6','#81c784','#fff176','#ce93d8','#ffab91'];
  for(let r=0;r<3;r++){
    for(let b=0;b<4;b++){ctx.fillStyle=colors[(r*4+b+(x>>5))%colors.length];const bh=5+((b+r)%2)*2;ctx.fillRect(x+6+b*8,y+3+r*8+(7-bh),6,bh);}
    ctx.fillStyle=PAL.deskLeg;ctx.fillRect(x+4,y+10+r*8,32,2);
  }
}
function drawWindowPanel(x,y){
  const w=46,h=24;
  ctx.fillStyle=PAL.wallDark;ctx.fillRect(x-2,y-2,w+4,h+4);
  const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,PAL.sky);g.addColorStop(1,PAL.skyLow);
  ctx.fillStyle=g;ctx.fillRect(x,y,w,h);
  ctx.fillStyle=PAL.cloud;ctx.fillRect(x+9,y+13,13,3);ctx.fillRect(x+12,y+9,8,3);
  ctx.fillStyle=PAL.sun;ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(x+w-11,y+8,4,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  ctx.fillStyle=PAL.wallDark;ctx.fillRect(x+w/2-1,y,2,h);ctx.fillRect(x,y+h/2-1,w,2);
}
function drawPlant(x,y){
  ctx.fillStyle=PAL.shadow;ctx.fillRect(x+11,y+33,18,3);
  ctx.fillStyle=PAL.plantPot;ctx.fillRect(x+12,y+22,16,12);
  ctx.fillStyle=PAL.plantPotHi;ctx.fillRect(x+12,y+22,4,12);
  ctx.fillStyle=PAL.plantPot;ctx.fillRect(x+10,y+20,20,4);
  ctx.fillStyle=PAL.plant;
  ctx.beginPath();ctx.arc(x+20,y+15,10,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x+14,y+13,6,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x+26,y+12,6,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=PAL.plantHi;
  ctx.beginPath();ctx.arc(x+17,y+11,4,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(x+24,y+10,3,0,Math.PI*2);ctx.fill();
}
function drawDesk(x,y){
  ctx.fillStyle=PAL.chair;ctx.fillRect(x+15,y+23,10,9);
  ctx.fillStyle=PAL.chairSeat;ctx.fillRect(x+15,y+21,10,4);
  ctx.fillStyle=PAL.shadow;ctx.fillRect(x+3,y+31,34,5);
  ctx.fillStyle=PAL.deskLeg;ctx.fillRect(x+5,y+30,3,6);ctx.fillRect(x+32,y+30,3,6);
  ctx.fillStyle=PAL.deskDark;ctx.fillRect(x+4,y+26,32,6);
  ctx.fillStyle=PAL.desk;ctx.fillRect(x+2,y+15,36,11);
  ctx.fillStyle=PAL.deskTop;ctx.fillRect(x+2,y+12,36,4);
  ctx.fillStyle=PAL.screenFrame;ctx.fillRect(x+11,y,18,14);
  ctx.fillStyle=PAL.screen;ctx.fillRect(x+13,y+2,14,9);
  ctx.fillStyle=PAL.screenGlow;ctx.fillRect(x+14,y+3,5,3);
  ctx.fillStyle='#4a4f55';ctx.fillRect(x+19,y+14,2,3);
  ctx.fillStyle=PAL.deskDark;ctx.fillRect(x+15,y+16,10,2);
  ctx.fillStyle='#3a3f44';ctx.fillRect(x+9,y+19,14,4);ctx.fillRect(x+26,y+19,4,3);
}
function drawRoom(room){
  const {x,y,w,h,color}=room;
  ctx.fillStyle='rgba(0,0,0,0.45)';rr(x+5,y+7,w,h,12);ctx.fill();
  ctx.fillStyle=PAL.wallDark;rr(x,y,w,h,12);ctx.fill();
  ctx.fillStyle=PAL.wall;rr(x+3,y+3,w-6,h-6,9);ctx.fill();
  const ix=x+WT,iy=y+HH,iw=w-2*WT,ih=h-HH-WT;
  ctx.save();rr(ix,iy,iw,ih,5);ctx.clip();drawRoomFloor(ix,iy,iw,ih);ctx.restore();
  drawBookshelf(ix+6,iy+4);drawBookshelf(ix+iw-44,iy+4);
  drawWindowPanel(ix+iw/2-23,iy+6);
  drawPlant(ix-2,iy+ih-38);drawPlant(ix+iw-38,iy+ih-38);
  const hg=ctx.createLinearGradient(0,y,0,y+HH);hg.addColorStop(0,shade(color,38));hg.addColorStop(1,color);
  ctx.fillStyle=hg;ctx.beginPath();ctx.roundRect(x,y,w,HH,[12,12,0,0]);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.22)';ctx.fillRect(x+4,y+2,w-8,1);
  ctx.font='8px "Press Start 2P"';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,0.35)';ctx.fillText(room.en,x+13,y+HH/2+1);
  ctx.fillStyle='#fff';ctx.fillText(room.en,x+12,y+HH/2);
  ctx.textBaseline='alphabetic';
  const anyWorking=characters.some(c=>c.room===room&&c.state!=='idle');
  ctx.fillStyle=anyWorking?'#9dffc4':'#ffd98a';
  ctx.beginPath();ctx.arc(x+w-16,y+HH/2,3.5,0,Math.PI*2);ctx.fill();
}

function drawCharacter(c){
  const s=2;const walk=c.state==='walking';const f=c.frame;
  const bob=(walk||prefersReduced)?0:(Math.sin(tick*0.07+c.homeX*0.13)>0.3?-1:0);
  const hl=c.highlightTimer>0;
  const jump=hl?-Math.abs(Math.sin((72-c.highlightTimer)*0.26))*5:0;
  const bx=c.x-5*s,by=c.y-8*s+bob+jump;
  const dark=shade(c.color,-45),lite=shade(c.color,35);
  if(hl){ctx.strokeStyle='#ffd54f';ctx.lineWidth=2;ctx.globalAlpha=0.4+0.4*Math.sin(c.highlightTimer*0.4);ctx.beginPath();ctx.ellipse(c.x,c.y+8*s,9*s,3.2*s,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
  ctx.fillStyle=PAL.shadow;ctx.beginPath();ctx.ellipse(c.x,c.y+8*s,6*s,2.2*s,0,0,Math.PI*2);ctx.fill();
  const sprType=AGENT_SPRITE[c.id];
  const sprImg=sprType&&sprites[sprType]&&sprites[sprType][DIR_NAME[c.dir]||'down'];
  if(sprImg&&sprImg.complete&&sprImg.naturalWidth>0){
    const FR=64,SPR=46;const fr=walk?(c.frame%6):0;ctx.imageSmoothingEnabled=false;
    ctx.drawImage(sprImg,fr*FR,0,FR,FR,Math.round(c.x-SPR/2),Math.round(c.y+12-SPR+bob+jump),SPR,SPR);
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
  ctx.fillRect(c.x-tw/2-3,by-12,tw+6,12);
  ctx.fillStyle=c.color;ctx.fillText(c.name,c.x-tw/2,by-3);
  if(c.state==='idle'&&!c.bubble){ctx.font='13px sans-serif';ctx.textAlign='center';ctx.fillText('💤',c.x,by-15);ctx.textAlign='left';}
  if(c.bubble){
    const isEmoji=[...c.bubble].length<=2;
    ctx.font=isEmoji?'13px sans-serif':'10px "DotGothic16",sans-serif';
    let txt=c.bubble;if(!isEmoji&&txt.length>28)txt=txt.slice(0,27)+'…';
    const tw2=ctx.measureText(txt).width;const bw=Math.max(22,tw2+12),bh=17;const cx=c.x,cy=by-30;
    ctx.fillStyle='rgba(255,253,245,0.97)';ctx.strokeStyle='#1a1208';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.roundRect(cx-bw/2,cy-bh/2,bw,bh,5);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(cx-3,cy+bh/2-1);ctx.lineTo(cx+3,cy+bh/2-1);ctx.lineTo(cx,cy+bh/2+5);ctx.closePath();ctx.fillStyle='rgba(255,253,245,0.97)';ctx.fill();
    ctx.fillStyle='#1a1208';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(txt,cx,cy);ctx.textAlign='left';ctx.textBaseline='alphabetic';
  }
}
function drawParticles(){
  particles=particles.filter(p=>p.life>0);
  particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;ctx.globalAlpha=p.life/60;ctx.font='14px sans-serif';ctx.fillStyle=p.color;ctx.fillText(p.text||'⭐',p.x,p.y);ctx.globalAlpha=1;});
}
function getTimeColor(){const h=new Date().getHours();if(h>=6&&h<10)return 'rgba(255,200,100,0.04)';if(h>=10&&h<17)return 'rgba(255,255,255,0)';if(h>=17&&h<20)return 'rgba(255,150,50,0.06)';return 'rgba(20,24,60,0.18)';}

let tick=0;
function gameLoop(){
  tick++;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='#0a0e1a';ctx.fillRect(0,0,W,H);
  ctx.save();ctx.translate(OX,OY);ctx.scale(scale,scale);
  ROOMS.forEach(drawRoom);
  characters.forEach(c=>drawDesk(c.desk.x,c.desk.y));
  characters.forEach(c=>c.update());
  [...characters].sort((a,b)=>a.y-b.y).forEach(drawCharacter);
  drawParticles();
  ctx.fillStyle=getTimeColor();ctx.fillRect(-OX/scale,-OY/scale,W/scale,H/scale);
  ctx.restore();
  requestAnimationFrame(gameLoop);
}
gameLoop();

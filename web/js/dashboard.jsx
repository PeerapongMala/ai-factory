const {useState,useEffect,useRef,useCallback}=React;
const API=window.location.origin;
const ROOM_LABELS={lead:'บริหาร',news:'กองข่าว',review:'ตรวจสอบ',creative:'ครีเอทีฟ'};
// some server feedback is stored as a structured object — never hand React an object to render
const asText=(v)=>{
  if(v==null)return '';
  if(typeof v==='string')return v;
  if(typeof v==='number'||typeof v==='boolean')return String(v);
  if(Array.isArray(v))return v.map(asText).filter(Boolean).join(' · ');
  if(typeof v==='object')return Object.values(v).map(asText).filter(Boolean).join(' — ');
  return String(v);
};

function App(){
  const TEAM=window.TEAM;
  const [panel,setPanel]=useState(null);
  const [logs,setLogs]=useState([]);
  const [running,setRunning]=useState(false);
  const [postMode,setPostMode]=useState('auto');
  const [tokens,setTokens]=useState([]);
  const [agents,setAgents]=useState([]);
  const [stats,setStats]=useState({});
  const [chatLogs,setChatLogs]=useState([{from:'pm',text:'สวัสดีครับ PM พร้อมทำงานแล้ว! 🎮'}]);
  const [chatInput,setChatInput]=useState('');
  const [chatLoading,setChatLoading]=useState(false);
  const [trainAgent,setTrainAgent]=useState('writer.json');
  const [trainText,setTrainText]=useState('');
  const [trainResult,setTrainResult]=useState('');
  const [time,setTime]=useState('');
  const [today,setToday]=useState('');
  const [notifs,setNotifs]=useState([]);
  const [loaded,setLoaded]=useState(false);
  const [agentStates,setAgentStates]=useState([]);
  const [pipelineStep,setPipelineStep]=useState(-1);
  const [pending,setPending]=useState([]);
  const [analytics,setAnalytics]=useState(null);
  const [analyticsLoading,setAnalyticsLoading]=useState(false);
  const [profileId,setProfileId]=useState(null);
  const [profileMem,setProfileMem]=useState([]);
  const [profileLoading,setProfileLoading]=useState(false);
  const [teamChat,setTeamChat]=useState([]);
  const chatEndRef=useRef(null);
  const logEndRef=useRef(null);

  const addLog=(msg,err)=>setLogs(p=>[...p.slice(-50),{t:new Date().toLocaleTimeString('th-TH'),msg,err}]);
  const addNotif=(msg)=>{const id=Date.now();setNotifs(p=>[...p,{id,msg}]);setTimeout(()=>setNotifs(p=>p.filter(n=>n.id!==id)),4000);};

  useEffect(()=>{
    const upd=()=>{const d=new Date();setTime(d.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));setToday(d.toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'}));};
    upd();const i=setInterval(upd,1000);return()=>clearInterval(i);
  },[]);

  const lastFocusRef=useRef(null);
  useEffect(()=>{
    if(!panel){if(lastFocusRef.current){lastFocusRef.current.focus?.();lastFocusRef.current=null;}return;}
    lastFocusRef.current=document.activeElement;
    const focusables=()=>{const p=document.querySelector('.panel');if(!p)return [];return [...p.querySelectorAll('button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled&&el.offsetParent!==null);};
    requestAnimationFrame(()=>{const els=focusables();(els[0]||document.querySelector('.panel'))?.focus?.();});
    const onKey=e=>{
      if(e.key==='Escape'){setPanel(null);return;}
      if(e.key==='Tab'){const els=focusables();if(!els.length)return;const first=els[0],last=els[els.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    };
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[panel]);

  const fetchAll=useCallback(async()=>{
    try{
      const [tRes,aRes,mRes,pRes,sRes]=await Promise.all([
        fetch(API+'/api/tokens').then(r=>r.json()).catch(()=>[]),
        fetch(API+'/api/agents').then(r=>r.json()).catch(()=>[]),
        fetch(API+'/api/postmode').then(r=>r.json()).catch(()=>({mode:'auto'})),
        fetch(API+'/api/pending').then(r=>r.json()).catch(()=>[]),
        fetch(API+'/api/stats').then(r=>r.json()).catch(()=>({})),
      ]);
      setTokens(tRes);setAgents(aRes);setPostMode(mRes.mode);
      setPending(Array.isArray(pRes)?pRes:[]);setStats(sRes&&typeof sRes==='object'?sRes:{});
    }catch{}finally{setLoaded(true);}
  },[]);
  const fetchPending=useCallback(async()=>{try{const r=await fetch(API+'/api/pending');const d=await r.json();setPending(Array.isArray(d)?d:[]);}catch{}},[]);
  const approveItem=async(id,item)=>{try{await fetch(API+`/api/pending/${id}/approve?item=${item}`,{method:'POST'});addNotif('อนุมัติแล้ว — กำลังโพสต์ ✅');addLog(`✅ อนุมัติโพสต์ ${id}#${item}`);}catch(e){addNotif('อนุมัติไม่ได้');}fetchPending();};
  const rejectItem=async(id,item)=>{try{await fetch(API+`/api/pending/${id}/reject?item=${item}`,{method:'POST'});addNotif('ไม่อนุมัติ ✕');addLog(`✕ ปฏิเสธโพสต์ ${id}#${item}`);}catch(e){addNotif('ทำไม่ได้');}fetchPending();};
  const clearPending=async()=>{try{await fetch(API+'/api/pending/clear',{method:'POST'});addNotif('ล้าง pending แล้ว');}catch{}fetchPending();};
  const loadAnalytics=useCallback(async()=>{setAnalyticsLoading(true);try{const r=await fetch(API+'/api/analytics');const d=await r.json();setAnalytics(d);}catch(e){setAnalytics({error:e.message});}setAnalyticsLoading(false);},[]);
  const sendToOpenClaw=async()=>{const msg=chatInput.trim();if(!msg)return;setChatInput('');setChatLogs(p=>[...p,{from:'user',text:msg},{from:'sys',text:'📨 ส่งให้ PM (OpenClaw) ใน Discord แล้ว — รอคำตอบในช่อง Discord'}]);try{await fetch(API+'/api/chat/discord',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});}catch(e){setChatLogs(p=>[...p,{from:'sys',text:'ส่งไม่ได้: '+e.message}]);}};
  // open an employee profile: ping the character + load their REAL learned lessons
  const openProfile=useCallback(async(id)=>{
    window.pingCharacter&&window.pingCharacter(id);
    setProfileId(id);setPanel('profile');setProfileLoading(true);setProfileMem([]);
    const t=TEAM.find(x=>x.id===id);if(!t){setProfileLoading(false);return;}
    try{const r=await fetch(API+'/api/memory?agent='+encodeURIComponent(t.file));const d=await r.json();setProfileMem(Array.isArray(d)?d:[]);}catch{setProfileMem([]);}
    setProfileLoading(false);
  },[TEAM]);
  const loadTeamChat=useCallback(async()=>{try{const r=await fetch(API+'/api/team_chat');const d=await r.json();setTeamChat(Array.isArray(d)?d:[]);}catch{}},[]);

  useEffect(()=>{fetchAll();const i=setInterval(fetchAll,20000);return()=>clearInterval(i);},[fetchAll]);

  const runPipeline=async()=>{
    if(running)return;
    setRunning(true);window.gameState.pipelineRunning=true;window.startPipelineAnim();
    addLog('🚀 Pipeline เริ่มทำงาน...');addNotif('Pipeline เริ่มแล้ว!');setPanel(null);
    setPipelineStep(0);
    let stepTimer=setInterval(()=>setPipelineStep(s=>(s>=0&&s<4)?s+1:s),1600);
    let shownChat=0;
    const chatPoll=setInterval(async()=>{try{const r=await fetch(API+'/api/team_chat');const arr=await r.json();if(Array.isArray(arr)&&arr.length>shownChat){for(let i=shownChat;i<arr.length;i++){const m=arr[i];window.sayLine&&window.sayLine(m.id,m.text,240);}shownChat=arr.length;}}catch{}},1500);
    const finish=(ok)=>{clearInterval(stepTimer);clearInterval(chatPoll);setRunning(false);window.gameState.pipelineRunning=false;window.endPipelineAnim(ok);if(ok){setPipelineStep(5);setTimeout(()=>setPipelineStep(-1),3000);}else setPipelineStep(-1);fetchPending();};
    try{
      await fetch(API+'/api/run',{method:'POST'});
      const poll=setInterval(async()=>{try{const r=await fetch(API+'/api/run/status');const d=await r.json();if(d.status==='done'||d.status==='idle'){clearInterval(poll);finish(true);addLog('✅ Pipeline เสร็จแล้ว!');addNotif('Pipeline เสร็จสมบูรณ์!');if(d.log){d.log.split('\n').filter(l=>l.trim()).slice(-10).forEach(l=>addLog(l));}}}catch{clearInterval(poll);finish(false);}},3000);
    }catch(e){finish(false);addLog('❌ Pipeline error: '+e.message,true);}
  };
  const toggleMode=async()=>{try{const r=await fetch(API+'/api/postmode',{method:'POST'});const d=await r.json();setPostMode(d.mode);addNotif('โหมด: '+(d.mode==='auto'?'โพสต์เลย ⚡':'ถามก่อนโพสต์ 🔍'));}catch{}};
  const sendChat=async()=>{
    if(!chatInput.trim()||chatLoading)return;const msg=chatInput.trim();setChatInput('');
    setChatLogs(p=>[...p,{from:'user',text:msg}]);setChatLoading(true);
    try{const r=await fetch(API+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});const d=await r.json();setChatLogs(p=>[...p,{from:'pm',text:asText(d.reply)||asText(d.error)||'...'}]);if(d.trained)addNotif('PM สั่งเทรนพนักงานแล้ว!');}catch(e){setChatLogs(p=>[...p,{from:'sys',text:'Error: '+e.message}]);}
    setChatLoading(false);
  };
  const doTrain=async()=>{
    if(!trainText.trim())return;setTrainResult('กำลังเทรน...');
    try{const r=await fetch(API+'/api/train',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agent:trainAgent,feedback:trainText})});const d=await r.json();
      setTrainResult(`✅ ${d.name} จำแล้ว (${d.memoryCount} ความจำ)`);setTrainText('');addNotif('เทรนสำเร็จ!');
      const cid=trainAgent.replace('.json','');const ch=window.characters?.find(c=>c.id===cid);if(ch){ch.showBubble('📚',100);window.addParticle?.(ch.x,ch.y-30,'#ffd54f','+EXP');}
    }catch(e){setTrainResult('❌ '+e.message);}
  };

  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:'smooth'});},[chatLogs]);
  useEffect(()=>{logEndRef.current?.scrollIntoView({behavior:'smooth'});},[logs]);
  useEffect(()=>{const i=setInterval(()=>{if(window.getAgentStates)setAgentStates(window.getAgentStates());},250);return()=>clearInterval(i);},[]);
  useEffect(()=>{if(panel==='analytics'&&analytics===null)loadAnalytics();},[panel,analytics,loadAnalytics]);
  useEffect(()=>{if(panel==='pending')fetchPending();},[panel,fetchPending]);
  useEffect(()=>{if(panel==='activity'){loadTeamChat();const i=setInterval(loadTeamChat,8000);return()=>clearInterval(i);}},[panel,loadTeamChat]);

  useEffect(()=>{
    const load=async()=>{
      if(window.gameState&&window.gameState.pipelineRunning)return;
      try{const r=await fetch(API+'/api/team_chat');const arr=await r.json();
        if(Array.isArray(arr)&&arr.length){const recent=arr.slice(-3);recent.forEach((m,i)=>setTimeout(()=>window.sayLine&&window.sayLine(m.id,m.text,200),i*1200));}
      }catch{}
    };
    const i=setInterval(load,30000);return()=>clearInterval(i);
  },[]);

  const stateOf=(id)=>agentStates.find(a=>a.id===id);
  const onlineCount=agentStates.length||TEAM.length;        // present in office
  const workingNow=agentStates.filter(a=>a.state!=='idle').length; // actively at work
  const pendingCount=pending.reduce((n,p)=>n+(p.items?.length||0),0);
  const STAGES=[{id:'reporter',label:'นักข่าว'},{id:'writer',label:'นักเขียน'},{id:'guardian',label:'ตรวจสอบ'},{id:'graphic',label:'กราฟิก'},{id:'publisher',label:'โพสต์'}];
  const roomCount=(rid)=>TEAM.filter(t=>t.roomId===rid).length;
  const avgAccuracy=(()=>{const arr=TEAM.map(t=>stats[t.file]).filter(s=>s&&s.runs>0);if(!arr.length)return null;return Math.round(arr.reduce((a,s)=>a+(s.accuracy||0),0)/arr.length);})();

  const NAV=[
    {key:'office',ic:'🏠',label:'ภาพรวมออฟฟิศ',onClick:()=>setPanel(null)},
    {key:'run',ic:running?'⏳':'▶️',label:running?'กำลังรัน...':'รันงาน',onClick:runPipeline,disabled:running,cls:'run'},
    {key:'staff',ic:'👥',label:'รายชื่อทีม',onClick:()=>setPanel('staff')},
    {key:'chat',ic:'💬',label:'คุยกับ PM',onClick:()=>setPanel('chat')},
    {key:'train',ic:'🎓',label:'เทรนพนักงาน',onClick:()=>setPanel('train')},
    {key:'activity',ic:'💬',label:'ทีมคุยกัน',onClick:()=>setPanel('activity')},
    {key:'pending',ic:'✅',label:'รออนุมัติ',onClick:()=>setPanel('pending'),badge:pendingCount},
    {key:'analytics',ic:'📊',label:'สถิติเพจ',onClick:()=>setPanel('analytics')},
    {key:'log',ic:'📋',label:'บันทึกงาน',onClick:()=>setPanel('log')},
  ];

  const dirRows=TEAM.map((t,i)=>{
    const st=stateOf(t.id);const stat=stats[t.file];
    const dot=!st?'idle':(st.state==='working'?'on':st.state==='walking'?'busy':'idle');
    const col=`var(--c-${t.id})`;
    return <button key={t.id} className="dir-row" onClick={()=>openProfile(t.id)} title={stat?`Lv.${stat.level} ${stat.title} · ${stat.runs} งาน · เรียนรู้ ${stat.lessons} บทเรียน — คลิกดูโปรไฟล์`:`ดูโปรไฟล์ ${t.name}`}>
      <span className="dir-num">{String(i+1).padStart(2,'0')}</span>
      <span className="dir-av" style={{borderColor:col,color:col}}>{t.icon}</span>
      <span className="dir-meta">
        <span className="dir-name" style={{color:col}}>{t.name}{stat&&<span className="dir-lv">Lv.{stat.level}</span>}</span>
        <span className="dir-role">{t.role} · {ROOM_LABELS[t.roomId]}</span>
      </span>
      <span className={`dir-dot ${dot}`}/>
    </button>;
  });

  return <>
    {/* ===== TOP BAR ===== */}
    <div className="top-bar">
      <div className="brand">
        <div className="logo">🎮</div>
        <div className="bt"><div className="n">PANG NEWS CO.</div><div className="s">โรงงานข่าวเกมอัตโนมัติ</div></div>
      </div>
      <div className="tb-spacer"/>
      <div className="tb-pill"><span className="led"/>ทีมงาน {onlineCount}/{TEAM.length} ออนไลน์{workingNow>0?` · ${workingNow} กำลังทำงาน`:''}</div>
      <div className="tb-pill"><span className="status-badge status-auto" style={{padding:'1px 6px'}}>GitHub Actions 24/7</span></div>
      <div className="tb-clock"><div className="d">{today}</div><div className="t">{time}</div></div>
      <button className="tb-bell" onClick={()=>setPanel('pending')} aria-label="การแจ้งเตือน">🔔{pendingCount>0&&<span className="badge">{pendingCount}</span>}</button>
    </div>

    {/* ===== COMPACT TOOLBAR (mobile) ===== */}
    <div className="toolbar-c">
      {NAV.filter(n=>n.key!=='office').map(n=><button key={n.key} className="btn-game" onClick={n.onClick} disabled={n.disabled}>{n.ic} {n.label}{n.badge>0?` (${n.badge})`:''}</button>)}
      <button className="btn-game" style={{borderColor:'var(--gold)',color:'var(--gold)'}} onClick={toggleMode}>{postMode==='auto'?'⚡ AUTO':'🔍 APPROVE'}</button>
    </div>

    {/* ===== LEFT SIDEBAR ===== */}
    <aside className="sidebar-l" aria-label="เมนูออฟฟิศ">
      <div className="nav-group-label">เมนูหลัก</div>
      {NAV.map(n=>{
        const active=(n.key==='office'&&!panel)||panel===n.key;
        return <button key={n.key} className={`nav-item ${active?'active':''} ${n.cls||''}`} onClick={n.onClick} disabled={n.disabled}>
          <span className="ic">{n.ic}</span><span>{n.label}</span>{n.badge>0&&<span className="nb">{n.badge}</span>}
        </button>;
      })}
      <div className="spacer-grow"/>
      <div className="office-status">
        <div className="h">สถานะออฟฟิศ</div>
        <div className="os-row"><span>การทำงาน</span><span className="ok">{running?'กำลังรัน':'เปิด & พร้อม'}</span></div>
        <div className="os-row"><span>ทีมออนไลน์</span><b>{onlineCount}/{TEAM.length}</b></div>
        <div className="os-row"><span>รออนุมัติ</span><b>{pendingCount}</b></div>
        <div className="os-row"><span>ความแม่นเฉลี่ย</span><b>{avgAccuracy!==null?avgAccuracy+'%':'—'}</b></div>
        <button className="mode-toggle" onClick={toggleMode}>{postMode==='auto'?'⚡ โหมด: โพสต์เลย':'🔍 โหมด: ขออนุมัติ'}</button>
      </div>
    </aside>

    {/* ===== RIGHT SIDEBAR (TEAM DIRECTORY) ===== */}
    <aside className="sidebar-r" aria-label="รายชื่อทีมงาน">
      <div className="dir-head">รายชื่อทีม <span className="c">{TEAM.length} คน</span></div>
      <div className="dir-list">{dirRows}</div>
      <div className="dir-foot">
        <div className="all">✓ ทีมงานทั้งหมดออนไลน์</div>
        <div className="sys-row"><span className="ck">✓</span> AI พนักงานพร้อมทำงาน</div>
        <div className="sys-row"><span className="ck">✓</span> Pipeline อัตโนมัติ</div>
        <div className="sys-row"><span className="ck">✓</span> GitHub Actions 24/7</div>
        <div className="sys-row"><span className="ck">✓</span> โหมดโพสต์: {postMode==='auto'?'AUTO':'APPROVE'}</div>
      </div>
    </aside>

    {/* ===== PIPELINE STRIP (running) ===== */}
    {running&&<div className="pipeline" role="group" aria-label="ความคืบหน้า pipeline">
      <span className="plabel">PIPELINE</span>
      {STAGES.map((st,i)=>{const done=pipelineStep===5||(pipelineStep>=0&&pipelineStep>i);const active=pipelineStep===i;
        return <div key={st.id} className={`pstep ${done?'done':''} ${active?'active':''}`}><span className="chip"><span className="n">{done?'✓':i+1}</span>{st.label}</span>{i<STAGES.length-1&&<span className="arrow">▸</span>}</div>;})}
    </div>}

    {/* ===== BOTTOM BAR (stat cards) ===== */}
    <div className="bottom-bar">
      <button className="stat-tile" style={{'--accent':'var(--cyan)'}} onClick={()=>setPanel('staff')} title="ดูรายชื่อทีม"><span className="ic2">👥</span><div className="big">{TEAM.length}</div><div className="lb">ทีมงานทั้งหมด</div></button>
      <button className="stat-tile" style={{'--accent':'var(--c-pm)'}} onClick={()=>openProfile('pm')} title="โปรไฟล์ PM"><span className="ic2">👔</span><div className="big">{roomCount('lead')}</div><div className="lb">บริหาร</div></button>
      <button className="stat-tile" style={{'--accent':'var(--c-reporter)'}} onClick={()=>openProfile('reporter')} title="โปรไฟล์กองข่าว"><span className="ic2">📰</span><div className="big">{roomCount('news')}</div><div className="lb">กองข่าว</div></button>
      <button className="stat-tile" style={{'--accent':'var(--c-guardian)'}} onClick={()=>openProfile('guardian')} title="โปรไฟล์ตรวจสอบ"><span className="ic2">🔍</span><div className="big">{roomCount('review')}</div><div className="lb">ตรวจสอบ</div></button>
      <button className="stat-tile" style={{'--accent':'var(--c-graphic)'}} onClick={()=>openProfile('graphic')} title="โปรไฟล์ครีเอทีฟ"><span className="ic2">🎨</span><div className="big">{roomCount('creative')}</div><div className="lb">ครีเอทีฟ</div></button>
      <button className="automation" onClick={runPipeline} disabled={running} title={running?'กำลังรัน':'กดเพื่อรันงาน'}>
        <div className="bot">🤖</div>
        <div className="at"><div className="t">{running?'กำลังผลิตคอนเทนต์...':'พร้อมทำงาน 24/7'}</div><div className="s">AI × ข่าวเกม × อัตโนมัติ — โพสต์ FB + IG</div></div>
      </button>
    </div>

    {/* ===== NOTIFICATIONS ===== */}
    <div className="notif">{notifs.map(n=><div key={n.id} className="notif-card">{n.msg}</div>)}</div>

    {/* ===== PANELS ===== */}
    {panel==='staff'&&<div className="panel-overlay" onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}>
      <div className="panel" role="dialog" aria-modal="true" aria-label="รายชื่อพนักงาน" tabIndex={-1}>
        <div className="panel-title">👥 รายชื่อพนักงาน<button className="btn-game btn-close" onClick={()=>setPanel(null)} aria-label="ปิด">✕</button></div>
        <div className="panel-body">
          {!loaded&&[0,1,2,3].map(i=><div key={i} className="skeleton skel-card"/>)}
          {loaded&&TEAM.map((t,i)=>{const a=agents.find(x=>x.file===t.file)||{};const stat=stats[t.file];const col=`var(--c-${t.id})`;
            return <div key={t.id} className="emp-card" onClick={()=>openProfile(t.id)} style={{cursor:'pointer'}} title={`ดูโปรไฟล์ ${t.name}`}>
              <div className="emp-avatar" style={{borderColor:col,color:col}}>{t.icon}</div>
              <div className="emp-info">
                <div className="emp-name" style={{color:col}}>{t.name} <span style={{color:'var(--muted)',fontSize:'8px'}}>· {ROOM_LABELS[t.roomId]}</span></div>
                <div className="emp-role">{t.role}{a.role?` — ${a.role}`:''}</div>
                <div style={{display:'flex',gap:'8px',marginTop:'4px',fontSize:'10px',flexWrap:'wrap'}}>
                  <span style={{color:'var(--muted)'}}>{a.model?`AI: ${a.provider}/${a.model}`:'⚙️ อัตโนมัติ'}</span>
                  <span style={{color:'var(--gold)'}}>💾 {a.memoryCount||0} mem</span>
                </div>
                {stat&&<div style={{marginTop:'5px'}}>
                  <div style={{display:'flex',gap:'8px',fontSize:'10px',alignItems:'center',flexWrap:'wrap'}}>
                    <span style={{color:'var(--gold)',fontWeight:'bold'}}>⚡Lv.{stat.level} {stat.title}</span>
                    {stat.runs>0&&<span style={{color:'var(--muted)'}}>🎯 แม่น {stat.accuracy}%</span>}
                    <span style={{color:'var(--muted)'}}>📚 {stat.lessons} บทเรียน</span>
                  </div>
                  <div style={{height:'4px',background:'rgba(255,255,255,0.12)',borderRadius:'2px',marginTop:'3px',overflow:'hidden'}}><div style={{height:'4px',width:(stat.xpPct||0)+'%',background:col,borderRadius:'2px'}}/></div>
                </div>}
              </div>
              <div className="emp-stars">{'⭐'.repeat(Math.min(5,Math.max(1,stat?stat.level:Math.ceil((a.memoryCount||1)/3))))}</div>
            </div>;})}
        </div>
      </div>
    </div>}

    {panel==='chat'&&<div className="panel-overlay" onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}>
      <div className="panel" role="dialog" aria-modal="true" aria-label="แชทกับ PM" tabIndex={-1}>
        <div className="panel-title">💬 คุยกับ PM<button className="btn-game btn-close" onClick={()=>setPanel(null)} aria-label="ปิด">✕</button></div>
        <div className="panel-body">
          <div className="chat-box">
            {chatLogs.map((m,i)=><div key={i} className={`chat-msg ${m.from}`}><strong>{m.from==='pm'?'🤖 PM':m.from==='user'?'👤 คุณ':'⚙️ ระบบ'}:</strong> {m.text}</div>)}
            {chatLoading&&<div className="chat-msg pm" style={{opacity:.5}}>🤖 PM กำลังคิด...</div>}
            <div ref={chatEndRef}/>
          </div>
          <input className="chat-input" placeholder="พิมพ์ข้อความถึง PM..." value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')sendChat()}}/>
          <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
            <button className="btn-game btn-chat" style={{flex:1}} onClick={sendChat} disabled={chatLoading}>💬 ถาม PM</button>
            <button className="btn-game btn-analytics" style={{flex:1}} onClick={sendToOpenClaw} title="ส่งให้ OpenClaw ตอบใน Discord">📨 ส่งให้ OpenClaw</button>
          </div>
        </div>
      </div>
    </div>}

    {panel==='train'&&<div className="panel-overlay" onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}>
      <div className="panel" role="dialog" aria-modal="true" aria-label="เทรนพนักงาน" tabIndex={-1}>
        <div className="panel-title">🎓 เทรนพนักงาน<button className="btn-game btn-close" onClick={()=>setPanel(null)} aria-label="ปิด">✕</button></div>
        <div className="panel-body">
          <div style={{marginBottom:'8px',fontSize:'12px',color:'var(--muted)'}}>เลือกพนักงานที่จะสอน แล้วพิมพ์ feedback</div>
          <select className="train-select" value={trainAgent} onChange={e=>setTrainAgent(e.target.value)}>
            {TEAM.map(t=><option key={t.file} value={t.file}>{t.icon} {t.name}</option>)}
          </select>
          <textarea className="train-textarea" placeholder="เช่น: caption สั้นลง ไม่เกิน 3 บรรทัด" value={trainText} onChange={e=>setTrainText(e.target.value)}/>
          <button className="btn-game btn-train" style={{width:'100%',padding:'11px'}} onClick={doTrain}>🎓 เทรน!</button>
          {trainResult&&<div style={{marginTop:'8px',fontSize:'12px',color:trainResult.startsWith('✅')?'var(--good)':'var(--bad)'}}>{trainResult}</div>}
        </div>
      </div>
    </div>}

    {panel==='log'&&<div className="panel-overlay" onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}>
      <div className="panel" role="dialog" aria-modal="true" aria-label="บันทึกกิจกรรม" tabIndex={-1}>
        <div className="panel-title">📋 บันทึกงาน<button className="btn-game btn-close" onClick={()=>setPanel(null)} aria-label="ปิด">✕</button></div>
        <div className="panel-body">
          <div className="log-box">
            {logs.length===0&&<div className="empty-state"><div className="icon">📭</div><div className="head">ยังไม่มี activity</div><div className="sub">กด <strong>รันงาน</strong> เพื่อเริ่มผลิต content แล้ว log จะขึ้นที่นี่</div></div>}
            {logs.map((l,i)=><div key={i} className={`log-line ${l.err?'err':''}`}>[{l.t}] {l.msg}</div>)}
            <div ref={logEndRef}/>
          </div>
        </div>
      </div>
    </div>}

    {panel==='pending'&&<div className="panel-overlay" onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}>
      <div className="panel" role="dialog" aria-modal="true" aria-label="โพสต์รออนุมัติ" tabIndex={-1}>
        <div className="panel-title">✅ รออนุมัติ ({pendingCount})<button className="btn-game btn-close" onClick={()=>setPanel(null)} aria-label="ปิด">✕</button></div>
        <div className="panel-body">
          {pendingCount===0&&<div className="empty-state"><div className="icon">🗳️</div><div className="head">ไม่มีโพสต์รออนุมัติ</div><div className="sub">โพสต์จะมาที่นี่เมื่ออยู่โหมด <strong>Approve</strong> แล้ว pipeline ทำงาน</div></div>}
          {pending.map(grp=>(grp.items||[]).map((it,idx)=><div key={grp.id+'_'+idx} className="pending-card">
            {it.image&&<img src={it.image} alt={it.headline} loading="lazy"/>}
            <div className="pending-head">{it.headline}</div>
            <div className="pending-cap">{it.caption}</div>
            {it.sourceName&&<div className="pending-src">📰 {it.sourceName}</div>}
            <div className="pending-actions"><button className="btn-game btn-ok" onClick={()=>approveItem(grp.id,idx)}>✅ อนุมัติ + โพสต์</button><button className="btn-game btn-no" onClick={()=>rejectItem(grp.id,idx)}>✕ ไม่อนุมัติ</button></div>
          </div>))}
          {pendingCount>0&&<button className="btn-game btn-no" style={{width:'100%',marginTop:'4px'}} onClick={clearPending}>🗑 ล้างทั้งหมด</button>}
        </div>
      </div>
    </div>}

    {panel==='analytics'&&<div className="panel-overlay" onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}>
      <div className="panel" role="dialog" aria-modal="true" aria-label="สถิติ Facebook" tabIndex={-1}>
        <div className="panel-title">📊 สถิติเพจ<button className="btn-game btn-close" onClick={()=>setPanel(null)} aria-label="ปิด">✕</button></div>
        <div className="panel-body">
          {analyticsLoading&&[0,1,2].map(i=><div key={i} className="skeleton skel-card"/>)}
          {!analyticsLoading&&analytics&&analytics.error&&<div className="empty-state"><div className="icon">📉</div><div className="head">ดึงสถิติไม่ได้</div><div className="sub">{analytics.error}</div></div>}
          {!analyticsLoading&&Array.isArray(analytics)&&analytics.length===0&&<div className="empty-state"><div className="icon">📊</div><div className="head">ยังไม่มีโพสต์</div><div className="sub">โพสต์ลง Facebook แล้วสถิติจะขึ้นที่นี่</div></div>}
          {!analyticsLoading&&Array.isArray(analytics)&&analytics.map(p=><div key={p.id} className="stat-card">
            {p.image&&<img src={p.image} alt="" loading="lazy"/>}
            <div className="sc-body"><div className="stat-msg">{p.message||'(ไม่มีข้อความ)'}</div>
              <div className="stat-row"><span><b>{p.likes}</b>👍</span><span><b>{p.comments}</b>💬</span><span><b>{p.shares}</b>🔁</span><span><b>{p.reach}</b>👁</span></div>
              {p.permalink_url&&<a className="sc-link" href={p.permalink_url} target="_blank" rel="noopener noreferrer">ดูโพสต์ ↗</a>}
            </div>
          </div>)}
        </div>
      </div>
    </div>}

    {panel==='profile'&&(()=>{const t=TEAM.find(x=>x.id===profileId);if(!t)return null;const stat=stats[t.file];const col=`var(--c-${t.id})`;
      return <div className="panel-overlay" onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}>
        <div className="panel" role="dialog" aria-modal="true" aria-label={`โปรไฟล์ ${t.name}`} tabIndex={-1}>
          <div className="panel-title">{t.icon} โปรไฟล์พนักงาน<button className="btn-game btn-close" onClick={()=>setPanel(null)} aria-label="ปิด">✕</button></div>
          <div className="panel-body">
            <div className="prof-top">
              <div className="prof-av" style={{borderColor:col,color:col}}>{t.icon}</div>
              <div className="prof-id">
                <div className="prof-name" style={{color:col}}>{t.name}</div>
                <div className="prof-sub">{t.role} · {ROOM_LABELS[t.roomId]}</div>
                {stat&&<div className="prof-lv">⚡ Lv.{stat.level} {stat.title}</div>}
              </div>
            </div>
            {stat?<>
              <div className="prof-xpwrap">
                <div className="prof-xplabel"><span>EXP</span><span>{stat.xp} XP · ไปเลเวลถัดไป {stat.xpPct}%</span></div>
                <div className="prof-xpbar"><div style={{width:(stat.xpPct||0)+'%',background:col}}/></div>
              </div>
              <div className="prof-grid">
                <div className="prof-stat"><div className="v">{stat.runs}</div><div className="k">งานทั้งหมด</div></div>
                <div className="prof-stat"><div className="v" style={{color:'var(--good)'}}>{stat.accuracy}%</div><div className="k">ความแม่น</div></div>
                <div className="prof-stat"><div className="v" style={{color:'var(--warn)'}}>{stat.retries}</div><div className="k">แก้งาน</div></div>
                <div className="prof-stat"><div className="v" style={{color:'var(--gold)'}}>{stat.lessons}</div><div className="k">บทเรียน</div></div>
              </div>
            </>:<div className="empty-state" style={{padding:'10px 0 14px'}}><div className="sub">พนักงานคนนี้เป็นระบบอัตโนมัติ (ไม่ใช้ LLM) — ยังไม่มีสถิติการเรียนรู้</div></div>}
            <div className="sect-label">📚 บทเรียนที่เรียนรู้ <span className="c">{profileMem.length} รายการ</span></div>
            {profileLoading&&[0,1].map(i=><div key={i} className="skeleton skel-card"/>)}
            {!profileLoading&&profileMem.length===0&&<div className="empty-state"><div className="icon">🌱</div><div className="head">ยังไม่มีบทเรียน</div><div className="sub">เมื่อ PM/ตรวจสอบ ให้ feedback ระหว่างทำงานจริง บทเรียนจะถูกบันทึกที่นี่</div></div>}
            {!profileLoading&&profileMem.map((m,i)=><div key={i} className="lesson">
              <div className="lesson-meta"><span className="from">🎓 {asText(m.from)}</span><span>{(()=>{try{return new Date(m.date).toLocaleDateString('th-TH',{day:'numeric',month:'short',year:'2-digit'})}catch{return ''}})()}</span></div>
              <div className="lesson-txt">{asText(m.feedback)}</div>
            </div>)}
            <div className="prof-actions">
              <button className="btn-game btn-train" onClick={()=>{setTrainAgent(t.file);setPanel('train');}}>🎓 เทรนคนนี้</button>
              <button className="btn-game btn-chat" onClick={()=>window.pingCharacter&&window.pingCharacter(t.id)}>👋 ทักทาย</button>
            </div>
          </div>
        </div>
      </div>;})()}

    {panel==='activity'&&<div className="panel-overlay" onClick={e=>{if(e.target===e.currentTarget)setPanel(null)}}>
      <div className="panel" role="dialog" aria-modal="true" aria-label="ทีมคุยกัน" tabIndex={-1}>
        <div className="panel-title">💬 ทีมคุยกัน<button className="btn-game btn-close" onClick={()=>setPanel(null)} aria-label="ปิด">✕</button></div>
        <div className="panel-body">
          <div style={{fontSize:'12px',color:'var(--muted)',marginBottom:'10px'}}>บทประสานงานจริงจากงานล่าสุด — owner → PM → พนักงาน (อัปเดตทุก 8 วินาที)</div>
          <div className="feed">
            {teamChat.length===0&&<div className="empty-state"><div className="icon">💭</div><div className="head">ยังไม่มีบทสนทนา</div><div className="sub">กด <strong>รันงาน</strong> แล้วทีมจะเริ่มประสานงานกันจริง</div></div>}
            {teamChat.map((m,i)=>{const col=(window.PAL&&window.PAL[m.id])||'#9fb0cc';const tm=TEAM.find(x=>x.id===m.id);
              return <div key={i} className="feed-line">
                <div className="feed-av" style={{borderColor:col}}>{tm?tm.icon:'💬'}</div>
                <div className="feed-body"><div className="feed-who" style={{color:col}}>{asText(m.name)}</div><div className="feed-txt">{asText(m.text)}</div></div>
                <div className="feed-t">{m.t}</div>
              </div>;})}
          </div>
        </div>
      </div>
    </div>}
  </>;
}

window.PAL={pm:'#ff5a52',reporter:'#3aa0ff',writer:'#46c46a',guardian:'#b06cff',graphic:'#ff9838',publisher:'#ffd23f'};
ReactDOM.createRoot(document.getElementById('root')).render(<App/>);

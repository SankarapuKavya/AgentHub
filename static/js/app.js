/* Agentic Studio v13 — reference UI + repo output fix */
let agents=[], pipelines=[], libFiles=[], histRuns=[];
let flowSteps=[], delTarget=null;
let selectedPipeId=null, selectedFileIds=new Set();
let activeRunId=null, pollTimer=null;
let renderedStepKeys=new Set(), hilRendered=false, finalRendered=false;

// ── Formats ──────────────────────────────────────────────────────────────
const FMT_RE={xlsx:/\b(excel|xlsx|spreadsheet)\b/i,docx:/\b(word|docx|word\s*doc(?:ument)?)\b/i,pptx:/\b(powerpoint|pptx|presentation|slides?)\b/i,pdf:/\b(pdf)\b/i,csv:/\b(csv|comma[\s\-]separated)\b/i,json:/\b(json)\b/i,html:/\b(html|web\s*page)\b/i,md:/\b(markdown|\.md)\b/i,py:/\b(python\s*(?:script|code)|\.py)\b/i,js:/\b(javascript\s*(?:script|file)|\.js)\b/i};
const REPO_RE=/\b(repo(sitory)?|project folder|code project|codebase|generate.*project|scaffold|boilerplate|folder structure|directory structure)\b/i;
function detectFmts(p){if(REPO_RE.test(p))return['repo'];const r=Object.entries(FMT_RE).filter(([,re])=>re.test(p)).map(([k])=>k);return r.length?r:['txt']}
function fb(fmt){return`<span class="fbadge fb-${fmt}">${fmt==='repo'?'REPO':fmt.toUpperCase()}</span>`}

const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const fmtSz=b=>b<1024?b+'B':b<1048576?(b/1024).toFixed(1)+'KB':(b/1048576).toFixed(1)+'MB';
const fmtDt=s=>{try{return new Date(s).toLocaleString()}catch{return s||''}};
const fmtTok=n=>n>=1000?(n/1000).toFixed(1)+'k':String(n||0);
function timeAgo(s){const d=(Date.now()-new Date(s).getTime())/1000;if(d<60)return'just now';if(d<3600)return Math.floor(d/60)+'m ago';if(d<86400)return Math.floor(d/3600)+'h ago';return Math.floor(d/86400)+'d ago'}

function toast(msg,type='ok'){const el=document.getElementById('toast');el.className=`toast ${type}`;el.textContent=msg;clearTimeout(el._t);el._t=setTimeout(()=>el.classList.add('hidden'),3200)}
function openM(id){document.getElementById(id).classList.remove('hidden')}
function closeM(id){document.getElementById(id).classList.add('hidden')}
document.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeM(b.dataset.close)));
document.querySelectorAll('.modal-bg').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)closeM(el.id)}));

// ── Theme ────────────────────────────────────────────────────────────────
let theme=localStorage.getItem('as13-theme')||'light';
function applyTheme(t){
  theme=t;document.documentElement.setAttribute('data-theme',t);localStorage.setItem('as13-theme',t);
  const icon=document.getElementById('theme-avatar-icon');
  const lbl=document.getElementById('theme-label');
  if(icon)icon.innerHTML=t==='dark'?'<i class="ti ti-sun" style="font-size:13px"></i>':'<i class="ti ti-moon" style="font-size:13px"></i>';
  if(lbl)lbl.textContent=t==='dark'?'Light mode':'Dark mode';
}
applyTheme(theme);
document.getElementById('btn-theme-toggle')?.addEventListener('click',()=>applyTheme(theme==='dark'?'light':'dark'));

// ── Nav ──────────────────────────────────────────────────────────────────
function navTo(page){
  document.querySelectorAll('.nav-item[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('hidden',p.id!=='page-'+page));
  if(page==='run') initRunPage();
  if(page==='runs'||page==='history') loadHistory(page);
  if(page==='dashboard') refreshDashboard();
}
document.querySelectorAll('.nav-item[data-page]').forEach(btn=>btn.addEventListener('click',()=>navTo(btn.dataset.page)));
document.getElementById('nav-settings-btn')?.addEventListener('click',()=>{loadSettings();openM('modal-settings')});

// Update greeting
function updateGreeting(){
  const h=new Date().getHours();
  const greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  const el=document.getElementById('greeting-text');
  if(el)el.textContent=greet;
}
updateGreeting();

// ── Settings ─────────────────────────────────────────────────────────────
const PRESETS={groq:{p:'openai',url:'https://api.groq.com/openai/v1',m:'llama-3.1-8b-instant'},openai:{p:'openai',url:'https://api.openai.com/v1',m:'gpt-4o'},gemini:{p:'gemini',url:'https://generativelanguage.googleapis.com/v1beta',m:'gemini-2.0-flash'},claude:{p:'openai',url:'https://api.anthropic.com/v1',m:'claude-3-5-sonnet-20241022'},ollama:{p:'openai',url:'http://localhost:11434/v1',m:'llama3.2'}};
async function loadSettings(){
  const s=await fetch('/api/settings').then(r=>r.json());
  const row=document.getElementById('llm-status-row');
  if(s.model&&s.api_key){
    if(row)row.innerHTML=`<i class="ti ti-circle-check" style="color:#1D9E75"></i> Configured: <strong>${esc(s.model)}</strong>`;
  } else {
    if(row)row.innerHTML=`<i class="ti ti-alert-circle" style="color:#E24B4A"></i> Not configured — add your API key and model`;
  }
  if(s.api_url)document.getElementById('s-url').value=s.api_url;
  if(s.model)document.getElementById('s-model').value=s.model;
  if(s.provider)document.querySelector(`input[name="s-prov"][value="${s.provider}"]`).checked=true;
  if(s.api_key_masked){const h=document.getElementById('key-hint');h.textContent='Current: '+s.api_key_masked;h.classList.remove('hidden')}
  updateGreetingSub(s);
}
function updateGreetingSub(s){
  const sub=document.getElementById('greeting-sub');
  if(sub) sub.textContent=`${agents.length} agent${agents.length===1?'':'s'} · ${s&&s.model?s.model:'not configured'}`;
}
document.getElementById('btn-open-settings')?.addEventListener('click',()=>{loadSettings();openM('modal-settings')});
document.getElementById('pw-show').addEventListener('click',function(){const i=document.getElementById('s-key');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'Show':'Hide'});
document.querySelectorAll('.preset').forEach(b=>b.addEventListener('click',()=>{const p=PRESETS[b.dataset.p];if(!p)return;document.getElementById('s-url').value=p.url;document.getElementById('s-model').value=p.m;document.querySelector(`input[name="s-prov"][value="${p.p}"]`).checked=true;toast(`${b.textContent} preset loaded`)}));
document.getElementById('btn-save-settings').addEventListener('click',async()=>{
  const url=document.getElementById('s-url').value.trim(),key=document.getElementById('s-key').value.trim(),mdl=document.getElementById('s-model').value.trim(),prv=document.querySelector('input[name="s-prov"]:checked').value;
  if(!url||!mdl){toast('URL and Model required','err');return}
  const body={provider:prv,api_url:url,model:mdl};if(key)body.api_key=key;
  const r=await fetch('/api/settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok){toast('Save failed','err');return}
  closeM('modal-settings');await loadSettings();toast('Settings saved');
});

// ── Dropdown ─────────────────────────────────────────────────────────────
function mkDD(inpId,menuId,getItems,onSelect){
  const inp=document.getElementById(inpId),menu=document.getElementById(menuId);
  function render(q=''){
    const fl=q.toLowerCase(),items=getItems().filter(i=>i.name.toLowerCase().includes(fl)||(i.description||'').toLowerCase().includes(fl));
    if(!items.length){menu.innerHTML='<div class="ss-nil">No matches</div>';return}
    menu.innerHTML=items.map(i=>`<div class="ss-opt" data-id="${i.id}"><div class="ss-opt-n">${esc(i.name)}</div>${i.description?`<div class="ss-opt-d">${esc(i.description)}</div>`:''}</div>`).join('');
    menu.querySelectorAll('.ss-opt').forEach(opt=>opt.addEventListener('click',()=>{onSelect(getItems().find(x=>x.id===opt.dataset.id));inp.value='';menu.classList.add('hidden')}));
  }
  inp.addEventListener('focus',()=>{render(inp.value);menu.classList.remove('hidden')});
  inp.addEventListener('input',()=>{render(inp.value);menu.classList.remove('hidden')});
  document.addEventListener('click',e=>{if(!inp.contains(e.target)&&!menu.contains(e.target))menu.classList.add('hidden')});
}

// ── Dashboard ────────────────────────────────────────────────────────────
function refreshDashboard(){
  // Stat cards
  document.getElementById('stat-agents').textContent=agents.length;
  document.getElementById('stat-agents-delta').textContent=agents.length?`${agents.length} agent${agents.length===1?'':'s'} configured`:'No agents yet';
  document.getElementById('stat-pipes').textContent=pipelines.length;
  document.getElementById('stat-pipes-delta').textContent=pipelines.length?`${pipelines.length} pipeline${pipelines.length===1?'':'s'}`:'No pipelines yet';
  document.getElementById('stat-runs').textContent=histRuns.length;
  document.getElementById('stat-runs-delta').textContent=histRuns.length?`${histRuns.length} total run${histRuns.length===1?'':'s'}`:'No runs yet';
  document.getElementById('stat-files').textContent=libFiles.length;
  document.getElementById('stat-files-delta').textContent=libFiles.length?`${libFiles.length} file${libFiles.length===1?'':'s'} uploaded`:'No files yet';

  // Agent grid (show up to 5 + create card)
  const COLORS=['purple','teal','coral','blue','amber','pink'];
  const ICONS=['ti-cpu','ti-bolt','ti-file-text','ti-code','ti-chart-bar','ti-mail'];
  const grid=document.getElementById('dash-agents-grid');
  let html='';
  agents.slice(0,5).forEach((a,i)=>{
    const fmts=detectFmts(a.prompt);
    html+=`<div class="agent-card" onclick="navTo('agents')">
      <div class="agent-card-top">
        <div class="agent-icon ${COLORS[i%COLORS.length]}"><i class="ti ${ICONS[i%ICONS.length]}"></i></div>
        <div class="status-dot active"></div>
      </div>
      <div class="agent-name">${esc(a.name)}</div>
      <div class="agent-desc">${esc(a.description||a.prompt.slice(0,60)+'…')}</div>
      <div class="agent-footer">
        <span class="agent-runs">${fmts.map(f=>f.toUpperCase()).join(', ')} output</span>
        <span class="tag">${fmts[0].toUpperCase()}</span>
      </div>
    </div>`;
  });
  html+=`<div class="agent-card dashed-card" onclick="navTo('agents');setTimeout(()=>document.getElementById('btn-new-agent').click(),80)">
    <i class="ti ti-plus" style="font-size:22px;color:var(--t3)"></i>
    <span style="font-size:13px;color:var(--t2)">Create agent ↗</span>
  </div>`;
  grid.innerHTML=html;

  // Activity feed from recent runs
  const actList=document.getElementById('dash-activity-list');
  if(histRuns.length){
    actList.innerHTML=histRuns.slice(0,5).map(r=>{
      const dot=r.status==='completed'?'success':r.status==='error'?'err':'info';
      return`<div class="activity-item"><div class="activity-dot ${dot}"></div><div><div class="activity-text">${esc(r.pipeline_name)} — ${r.status}</div><div class="activity-time">${timeAgo(r.started_at)}</div></div></div>`;
    }).join('');
  }

  // Update badge counts
  document.getElementById('cnt-agents').textContent=agents.length;
  document.getElementById('cnt-pipes').textContent=pipelines.length;
  document.getElementById('cnt-files').textContent=libFiles.length;
  document.getElementById('cnt-runs').textContent=histRuns.length;
  updateGreetingSub(null);
}

// ── Agents page ───────────────────────────────────────────────────────────
async function loadAgents(){agents=await fetch('/api/agents').then(r=>r.json());renderAgents();refreshDashboard()}
const ACOLORS=['purple','teal','coral','blue','amber','pink'];
const AICONS=['ti-cpu','ti-bolt','ti-file-text','ti-code','ti-chart-bar','ti-mail'];
function renderAgents(){
  const el=document.getElementById('agents-grid');
  if(!agents.length){el.innerHTML=`<div class="agent-card dashed-card" onclick="document.getElementById('btn-new-agent').click()" style="grid-column:1/-1"><i class="ti ti-plus" style="font-size:22px;color:var(--t3)"></i><span style="font-size:13px;color:var(--t2)">Create your first agent</span></div>`;return}
  el.innerHTML=agents.map((a,i)=>{
    const fmts=detectFmts(a.prompt);
    return`<div class="agent-card">
      <div class="agent-card-top">
        <div class="agent-icon ${ACOLORS[i%ACOLORS.length]}"><i class="ti ${AICONS[i%AICONS.length]}"></i></div>
        <div class="status-dot active"></div>
      </div>
      <div class="agent-name">${esc(a.name)}</div>
      <div class="agent-desc">${esc(a.description||a.prompt.slice(0,80)+'…')}</div>
      <div class="agent-footer">
        <span class="agent-runs">${new Date(a.created_at).toLocaleDateString()}</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${fmts.map(fb).join('')}
          <button class="btn-icon" onclick="event.stopPropagation();editAgent('${a.id}')" title="Edit" style="width:24px;height:24px"><i class="ti ti-pencil" style="font-size:12px"></i></button>
          <button class="btn-icon del" onclick="event.stopPropagation();confirmDel('agent','${a.id}','${esc(a.name)}')" title="Delete" style="width:24px;height:24px"><i class="ti ti-trash" style="font-size:12px"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}
document.getElementById('btn-new-agent').addEventListener('click',()=>{['ag-id','ag-name','ag-desc','ag-prompt'].forEach(id=>document.getElementById(id).value='');document.getElementById('modal-agent-title').textContent='New Agent';document.getElementById('fmt-live').textContent='TXT';document.getElementById('fmt-banner').classList.add('hidden');openM('modal-agent')});
document.getElementById('ag-prompt').addEventListener('input',function(){const fmts=detectFmts(this.value);document.getElementById('fmt-live').textContent=fmts.map(f=>f.toUpperCase()).join(', ');document.getElementById('fmt-tags').innerHTML=fmts.map(fb).join(' ');document.getElementById('fmt-banner').classList.toggle('hidden',fmts[0]==='txt'&&fmts.length===1)});
window.editAgent=id=>{const a=agents.find(x=>x.id===id);if(!a)return;document.getElementById('ag-id').value=a.id;document.getElementById('ag-name').value=a.name;document.getElementById('ag-desc').value=a.description||'';document.getElementById('ag-prompt').value=a.prompt||'';document.getElementById('modal-agent-title').textContent='Edit Agent';const fmts=detectFmts(a.prompt||'');document.getElementById('fmt-live').textContent=fmts.map(f=>f.toUpperCase()).join(', ');document.getElementById('fmt-tags').innerHTML=fmts.map(fb).join(' ');document.getElementById('fmt-banner').classList.toggle('hidden',fmts[0]==='txt'&&fmts.length===1);openM('modal-agent')};
document.getElementById('btn-save-agent').addEventListener('click',async()=>{
  const id=document.getElementById('ag-id').value.trim(),name=document.getElementById('ag-name').value.trim(),desc=document.getElementById('ag-desc').value.trim(),prom=document.getElementById('ag-prompt').value.trim();
  if(!name||!prom){toast('Name and Prompt required','err');return}
  const r=await fetch(id?`/api/agents/${id}`:'/api/agents',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,description:desc,prompt:prom,type:'llm'})});
  if(!r.ok){toast('Save failed','err');return}
  closeM('modal-agent');await loadAgents();toast(id?'Agent updated':'Agent created');
});

// ── Pipelines ─────────────────────────────────────────────────────────────
async function loadPipelines(){pipelines=await fetch('/api/super_agents').then(r=>r.json());renderPipelines();refreshDashboard()}
function renderPipelines(){
  const el=document.getElementById('pipes-grid');
  if(!pipelines.length){el.innerHTML=`<div class="agent-card dashed-card" onclick="document.getElementById('btn-new-pipe').click()" style="grid-column:1/-1"><i class="ti ti-plus" style="font-size:22px;color:var(--t3)"></i><span style="font-size:13px;color:var(--t2)">Create your first pipeline</span></div>`;return}
  el.innerHTML=pipelines.map(sa=>{
    const flow=(sa.flow||[]).map((step,i)=>{if(step.type==='hil')return`${i>0?'<span class="flow-arr">→</span>':''}<span class="flow-chip hil-chip">${esc(step.label||'Review')}</span>`;const a=agents.find(x=>x.id===step.agent_id);return`${i>0?'<span class="flow-arr">→</span>':''}<span class="flow-chip">${esc(a?a.name:'?')}</span>`}).join('');
    return`<div class="agent-card">
      <div class="agent-card-top">
        <div class="agent-icon purple"><i class="ti ti-git-branch"></i></div>
        <div class="status-dot active"></div>
      </div>
      <div class="agent-name">${esc(sa.name)}</div>
      <div class="agent-desc">${esc(sa.description||'No description')}</div>
      <div class="flow-chips" style="margin:8px 0;flex-wrap:wrap">${flow||'<span style="color:var(--t3);font-size:12px">No steps</span>'}</div>
      <div class="agent-footer">
        <span class="agent-runs">${(sa.flow||[]).length} steps · ${new Date(sa.created_at).toLocaleDateString()}</span>
        <div style="display:flex;gap:4px">
          <button class="btn-icon" onclick="event.stopPropagation();editPipe('${sa.id}')" style="width:24px;height:24px"><i class="ti ti-pencil" style="font-size:12px"></i></button>
          <button class="btn-icon del" onclick="event.stopPropagation();confirmDel('pipe','${sa.id}','${esc(sa.name)}')" style="width:24px;height:24px"><i class="ti ti-trash" style="font-size:12px"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
}
document.getElementById('btn-new-pipe').addEventListener('click',()=>{['sa-id','sa-name','sa-desc'].forEach(id=>document.getElementById(id).value='');flowSteps=[];document.getElementById('modal-pipe-title').textContent='New Pipeline';renderSL();initAgentSearch();openM('modal-pipe')});
window.editPipe=id=>{const sa=pipelines.find(x=>x.id===id);if(!sa)return;document.getElementById('sa-id').value=sa.id;document.getElementById('sa-name').value=sa.name;document.getElementById('sa-desc').value=sa.description||'';flowSteps=(sa.flow||[]).map(step=>{if(step.type==='hil')return{type:'hil',id:step.id||('hil-'+Date.now()),label:step.label||'Review checkpoint'};const a=agents.find(x=>x.id===step.agent_id);return{type:'agent',id:step.id||('step-'+Date.now()),agent_id:step.agent_id,name:a?a.name:'?',prompt:a?a.prompt||'':''}});document.getElementById('modal-pipe-title').textContent='Edit Pipeline';renderSL();initAgentSearch();openM('modal-pipe')};
function initAgentSearch(){document.getElementById('ss-agent-inp').value='';mkDD('ss-agent-inp','ss-agent-menu',()=>agents,item=>{flowSteps.push({type:'agent',id:'step-'+Date.now()+Math.random(),agent_id:item.id,name:item.name,prompt:item.prompt||''});renderSL()})}
document.getElementById('btn-add-agent-step').addEventListener('click',()=>{const v=document.getElementById('ss-agent-inp').value.trim();const a=agents.find(x=>x.name.toLowerCase()===v.toLowerCase());if(a){flowSteps.push({type:'agent',id:'step-'+Date.now(),agent_id:a.id,name:a.name,prompt:a.prompt||''});renderSL();document.getElementById('ss-agent-inp').value=''}else toast('Select an agent from the list','err')});
document.getElementById('btn-add-hil-step').addEventListener('click',()=>{const label=window.prompt('Label for this review checkpoint:','Review checkpoint');if(!label)return;flowSteps.push({type:'hil',id:'hil-'+Date.now(),label});renderSL()});
let dragSrc=null;
function renderSL(){
  const wrap=document.getElementById('sl-nodes');
  if(!flowSteps.length){wrap.innerHTML='<div class="sl-empty">Add agent steps above — use "Human review" to add a pause checkpoint</div>';return}
  wrap.innerHTML=flowSteps.map((s,i)=>{const isHil=s.type==='hil',fmts=isHil?[]:detectFmts(s.prompt||'');
    return`${i>0?'<div class="sl-conn"></div>':''}
    <div class="sl-node${isHil?' hil-node':''}" draggable="true" data-idx="${i}">
      <div class="sl-handle"><i class="ti ti-grip-vertical" style="font-size:14px"></i></div>
      <div class="sl-idx${isHil?' hil-idx':''}">${i+1}</div>
      <div class="sl-info">
        <div class="sl-nm">${isHil?`<span class="hil-step-tag">HIL</span> ${esc(s.label)}`:esc(s.name)}</div>
        <div class="sl-fmt">${isHil?'Pauses — re-runs previous step on your feedback':'→ '+fmts.map(f=>f.toUpperCase()).join(', ')}</div>
      </div>
      <button class="sl-rm" onclick="slRm(${i})"><i class="ti ti-x" style="font-size:13px"></i></button>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.sl-node').forEach(node=>{
    node.addEventListener('dragstart',e=>{dragSrc=+node.dataset.idx;setTimeout(()=>node.classList.add('dragging'),0);e.dataTransfer.effectAllowed='move'});
    node.addEventListener('dragend',()=>{node.classList.remove('dragging');wrap.querySelectorAll('.sl-node').forEach(n=>n.classList.remove('dragover'))});
    node.addEventListener('dragover',e=>{e.preventDefault();wrap.querySelectorAll('.sl-node').forEach(n=>n.classList.remove('dragover'));node.classList.add('dragover')});
    node.addEventListener('drop',e=>{e.preventDefault();const tgt=+node.dataset.idx;if(dragSrc===null||dragSrc===tgt)return;const mv=flowSteps.splice(dragSrc,1)[0];flowSteps.splice(tgt,0,mv);dragSrc=null;renderSL()});
  });
}
window.slRm=i=>{flowSteps.splice(i,1);renderSL()};
document.getElementById('btn-save-pipe').addEventListener('click',async()=>{
  const id=document.getElementById('sa-id').value.trim(),name=document.getElementById('sa-name').value.trim(),desc=document.getElementById('sa-desc').value.trim();
  if(!name){toast('Name required','err');return}
  const flow=flowSteps.map(s=>s.type==='hil'?{type:'hil',id:s.id,label:s.label}:{type:'agent',id:s.id,agent_id:s.agent_id});
  const r=await fetch(id?`/api/super_agents/${id}`:'/api/super_agents',{method:id?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,description:desc,flow})});
  if(!r.ok){toast('Save failed','err');return}
  closeM('modal-pipe');await loadPipelines();toast(id?'Pipeline updated':'Pipeline created');
});

// ── Files ─────────────────────────────────────────────────────────────────
async function loadFiles(){libFiles=await fetch('/api/files').then(r=>r.json());renderFiles();refreshDashboard()}
function renderFiles(){
  const el=document.getElementById('files-grid');
  if(!libFiles.length){el.innerHTML=`<div class="agent-card dashed-card" onclick="document.getElementById('btn-upload-file').click()" style="grid-column:1/-1"><i class="ti ti-upload" style="font-size:22px;color:var(--t3)"></i><span style="font-size:13px;color:var(--t2)">Upload your first file</span></div>`;return}
  el.innerHTML=libFiles.map(f=>`<div class="file-card"><div class="file-ic"><i class="ti ti-file"></i></div><div class="file-info"><div class="file-nm">${esc(f.name)}</div><div class="file-mt">${fmtSz(f.size)} · ${new Date(f.uploaded_at).toLocaleDateString()}</div></div><button class="btn-icon del" onclick="delFile('${f.id}','${esc(f.name)}')" title="Delete"><i class="ti ti-trash" style="font-size:12px"></i></button></div>`).join('');
}
document.getElementById('btn-upload-file').addEventListener('click',()=>document.getElementById('file-upload-input').click());
document.getElementById('file-upload-input').addEventListener('change',async function(){for(const f of this.files){const fd=new FormData();fd.append('file',f);await fetch('/api/files/upload',{method:'POST',body:fd})}await loadFiles();toast(`Uploaded ${this.files.length} file(s)`);this.value=''});
window.delFile=async(id,name)=>{if(!confirm(`Delete "${name}"?`))return;await fetch(`/api/files/${id}`,{method:'DELETE'});await loadFiles();toast('File deleted')};

// ── Run page ──────────────────────────────────────────────────────────────
function initRunPage(){
  if(pollTimer){clearInterval(pollTimer);pollTimer=null}
  activeRunId=null;renderedStepKeys=new Set();hilRendered=false;finalRendered=false;
  document.getElementById('out-empty').classList.remove('hidden');
  document.getElementById('out-panel').classList.add('hidden');
  document.getElementById('out-timeline').innerHTML='';
  document.getElementById('out-acts').innerHTML='';
  document.getElementById('token-bar-container').innerHTML='';
  selectedPipeId=null;selectedFileIds=new Set();
  document.getElementById('pipe-val').value='';document.getElementById('ss-pipe-inp').value='';
  document.getElementById('ss-pipe-x').classList.add('hidden');document.getElementById('flow-preview').classList.add('hidden');
  mkDD('ss-pipe-inp','ss-pipe-menu',()=>pipelines,item=>{
    selectedPipeId=item.id;document.getElementById('pipe-val').value=item.id;
    document.getElementById('ss-pipe-inp').value=item.name;document.getElementById('ss-pipe-x').classList.remove('hidden');
    renderFlowPreview(item.id);
  });
  document.getElementById('ss-pipe-x').onclick=()=>{selectedPipeId=null;document.getElementById('pipe-val').value='';document.getElementById('ss-pipe-inp').value='';document.getElementById('ss-pipe-x').classList.add('hidden');document.getElementById('flow-preview').classList.add('hidden')};
  buildFilePicker();
}
function renderFlowPreview(sid){
  const sa=pipelines.find(x=>x.id===sid),prev=document.getElementById('flow-preview');
  if(!sa||!sa.flow.length){prev.classList.add('hidden');return}
  prev.classList.remove('hidden');
  document.getElementById('flow-chips').innerHTML=(sa.flow||[]).map((step,i)=>{if(step.type==='hil')return`${i>0?'<span class="flow-arr">→</span>':''}<span class="flow-chip hil-chip">${esc(step.label||'Review')}</span>`;const a=agents.find(x=>x.id===step.agent_id);return`${i>0?'<span class="flow-arr">→</span>':''}<span class="flow-chip">${esc(a?a.name:'?')}</span>`}).join('');
}
function buildFilePicker(){
  const el=document.getElementById('file-picker');
  if(!libFiles.length){el.innerHTML='<div class="fp-empty">No files — upload from Datasets</div>';return}
  el.innerHTML=libFiles.map(f=>`<div class="fp-row" data-fid="${f.id}"><div class="fp-chk"></div><span class="fp-name">${esc(f.name)}</span><span class="fp-sz">${fmtSz(f.size)}</span></div>`).join('');
  el.querySelectorAll('.fp-row').forEach(row=>row.addEventListener('click',()=>{const fid=row.dataset.fid;if(selectedFileIds.has(fid)){selectedFileIds.delete(fid);row.classList.remove('sel')}else{selectedFileIds.add(fid);row.classList.add('sel')}}));
}
const dz=document.getElementById('dropzone'),dzIn=document.getElementById('run-upload');
dz.addEventListener('click',()=>dzIn.click());dzIn.addEventListener('change',()=>syncDz());
dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('over')});dz.addEventListener('dragleave',()=>dz.classList.remove('over'));
dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('over');if(e.dataTransfer.files[0]){const dt=new DataTransfer();dt.items.add(e.dataTransfer.files[0]);dzIn.files=dt.files;syncDz()}});
function syncDz(){const f=dzIn.files[0];document.getElementById('dz-lbl').textContent=f?f.name:'Drop or click to upload';dz.classList.toggle('has-file',!!f)}

document.getElementById('btn-execute').addEventListener('click',async()=>{
  if(!selectedPipeId){toast('Select a pipeline first','err');return}
  const text=document.getElementById('run-text').value.trim(),file=dzIn.files[0];
  if(!text&&selectedFileIds.size===0&&!file){toast('Provide text, select files, or upload a file','err');return}
  const btn=document.getElementById('btn-execute');
  document.getElementById('exec-lbl').textContent='Running…';btn.disabled=true;
  document.getElementById('out-empty').classList.add('hidden');
  document.getElementById('out-panel').classList.remove('hidden');
  document.getElementById('out-timeline').innerHTML='<div class="step-waiting"><div class="step-spin"></div><span>Starting pipeline…</span></div>';
  renderedStepKeys=new Set();hilRendered=false;finalRendered=false;
  const form=new FormData();
  form.append('input_text',text);selectedFileIds.forEach(fid=>form.append('file_ids',fid));if(file)form.append('upload',file);
  try{
    const r=await fetch(`/api/pipelines/${selectedPipeId}/run`,{method:'POST',body:form});
    const data=await r.json();
    if(!r.ok){toast(data.error||'Start failed','err');resetExecBtn();document.getElementById('out-empty').classList.remove('hidden');document.getElementById('out-panel').classList.add('hidden');return}
    activeRunId=data.run_id;
    pollTimer=setInterval(pollStatus,1500);
  }catch(e){toast('Error: '+e.message,'err');resetExecBtn()}
});
function resetExecBtn(){document.getElementById('exec-lbl').innerHTML='<i class="ti ti-bolt"></i> Execute Pipeline';document.getElementById('btn-execute').disabled=false}

// ── Polling ───────────────────────────────────────────────────────────────
async function pollStatus(){
  if(!activeRunId)return;
  try{
    const r=await fetch(`/api/runs/${activeRunId}/status`);if(!r.ok){clearInterval(pollTimer);return}
    const data=await r.json();
    applyData(data);
    if(data.status==='done'||data.status==='error'){clearInterval(pollTimer);pollTimer=null;resetExecBtn();await loadHistory('silent')}
  }catch(e){console.error(e)}
}
function stepKey(s){return`${s.step_type||'llm'}-${s.step}-${s.revision_num||0}`}

function updateTokenBar(data){
  const steps=data.steps_done||[];
  const total=steps.reduce((sum,s)=>sum+(s.tokens?.total_tokens||0),0);
  if(!total)return;
  const c=document.getElementById('token-bar-container');
  c.innerHTML=`<div class="token-summary"><i class="ti ti-clock" style="color:var(--acc);font-size:14px"></i><span class="token-total">${fmtTok(total)} tokens total</span>${steps.filter(s=>s.tokens?.total_tokens).map(s=>`<span class="step-tokens">${esc(s.agent_name)}: ${fmtTok(s.tokens.total_tokens)}</span>`).join('')}</div>`;
}

function applyData(data){
  const tl=document.getElementById('out-timeline');
  const steps=data.steps_done||[];
  updateTokenBar(data);

  for(const s of steps){
    const key=stepKey(s);if(renderedStepKeys.has(key))continue;renderedStepKeys.add(key);
    tl.querySelector('.step-waiting')?.remove();
    const wrap=document.createElement('div');
    if(s.step_type==='hil'){
      wrap.className='tl-item hil-done';
      wrap.innerHTML=`<div class="hil-done-card"><i class="ti ti-check" style="font-size:14px"></i><strong>${esc(s.agent_name)}</strong> — ${s.hil_approved?'Approved':'Processed'}${s.revision_count?` <span class="fbadge fb-txt">${s.revision_count} revision${s.revision_count===1?'':'s'}</span>`:''}</div>`;
    } else if(s.step_type==='hil_revision'){
      wrap.className='tl-item rev-done';
      const dls=buildDls(s,activeRunId);
      wrap.innerHTML=`<div class="rev-card"><div class="rev-card-hd" onclick="toggleStep(this)"><span class="rev-badge">Rev ${s.revision_num}</span><span class="step-nm">${esc(s.agent_name)}</span>${(s.files||[]).map(f=>fb(f.format)).join('')}${s.tokens?.total_tokens?`<span class="step-tokens">${fmtTok(s.tokens.total_tokens)}</span>`:''}<i class="ti ti-chevron-down step-chev"></i></div><div class="step-body">${buildOutputContent(s.output||'',s.files||[],activeRunId,s.step)}${dls?`<div class="step-dls">${dls}</div>`:''}</div></div>`;
    } else {
      wrap.className='tl-item done';
      const dls=buildDls(s,activeRunId);
      wrap.innerHTML=`<div class="step-card"><div class="step-hd" onclick="toggleStep(this)"><span class="step-num">${s.step}</span><span class="step-nm">${esc(s.agent_name)}</span>${(s.files||[]).map(f=>fb(f.format)).join('')}${s.tokens?.total_tokens?`<span class="step-tokens">${fmtTok(s.tokens.total_tokens)}</span>`:''}<i class="ti ti-chevron-down step-chev"></i></div><div class="step-body">${buildOutputContent(s.output||'',s.files||[],activeRunId,s.step)}${dls?`<div class="step-dls">${dls}</div>`:''}</div></div>`;
    }
    tl.appendChild(wrap);wrap.scrollIntoView({behavior:'smooth',block:'nearest'});
    setTimeout(()=>wrap.querySelectorAll('.mermaid-block').forEach(b=>{const c=decodeURIComponent(b.dataset.code||'');if(c)doRenderMermaid(b,c)}),200);
  }

  // Running indicator
  const runIndId='run-ind';
  if(data.status==='running'&&data.current_step_running){
    let ind=document.getElementById(runIndId);
    if(!ind){ind=document.createElement('div');ind.id=runIndId;ind.className='tl-item running';tl.appendChild(ind)}
    if(ind.dataset.step!==String(data.current_step_running)){ind.dataset.step=data.current_step_running;ind.innerHTML=`<div class="tl-running"><div class="tl-running-dot"></div><span>Step ${data.current_step_running} running…</span></div>`}
  } else {document.getElementById(runIndId)?.remove()}

  // HIL block — NEVER re-render while user is typing
  if(data.status==='hil_waiting'&&data.hil_info){
    if(!hilRendered){
      hilRendered=true;document.getElementById(runIndId)?.remove();tl.querySelector('.step-waiting')?.remove();
      const hilWrap=document.createElement('div');hilWrap.id='hil-block';hilWrap.className='tl-item hil-waiting';tl.appendChild(hilWrap);
      renderHIL(hilWrap,data.hil_info);hilWrap.scrollIntoView({behavior:'smooth',block:'nearest'});
    }
  } else if(data.status!=='hil_waiting'){const hb=document.getElementById('hil-block');if(hb){hb.remove();hilRendered=false}}

  if(data.status==='done'&&!finalRendered){
    finalRendered=true;document.getElementById(runIndId)?.remove();document.getElementById('hil-block')?.remove();
    const fc=document.createElement('div');fc.id='final-card-wrap';fc.className='tl-item done';
    fc.innerHTML=`<div class="final-card"><div class="final-hd"><i class="ti ti-circle-check"></i><h3>Pipeline Complete</h3></div><div class="final-text">${esc(data.final_output||'')}</div></div>`;
    tl.appendChild(fc);
    document.getElementById('out-acts').innerHTML=`${data.total_tokens?`<span class="step-tokens"><i class="ti ti-clock"></i>${fmtTok(data.total_tokens)} total</span>`:''}
    <a class="btn-dl" href="/api/runs/${activeRunId}/download" download><i class="ti ti-download"></i> Download all</a>`;
    fc.scrollIntoView({behavior:'smooth'});toast('Pipeline complete');
  }
  if(data.status==='error'&&!finalRendered){
    finalRendered=true;
    const ec=document.createElement('div');ec.className='tl-item';ec.innerHTML=`<div class="error-card"><i class="ti ti-alert-circle"></i> Error: ${esc(data.error||'Unknown')}</div>`;
    tl.appendChild(ec);toast(data.error||'Run failed','err');
  }
}

function buildDls(s,runId){return(s.files||[]).filter(f=>f.format!=='repo').map(f=>`<a class="btn-dl" href="/api/runs/${runId}/steps/${s.step}/download/${f.format}" download><i class="ti ti-download"></i> ${fb(f.format)}</a>`).join('')}

// ── Output content ────────────────────────────────────────────────────────
function buildOutputContent(text,files,runId,stepNum){
  const repoFile=files.find(f=>f.format==='repo');
  const parts=[];
  if(repoFile)parts.push(buildRepoPreview(repoFile,runId,stepNum));
  if(text)parts.push(buildTextContent(text));
  return parts.join('')||'<div class="step-output">(no output)</div>';
}
function buildTextContent(text){
  const isMarkdown=/^#{1,6}\s|^\*\*|^- |^\* |```|\[.+\]\(/.test(text.trim());
  const hasMermaid=/```mermaid/i.test(text);
  if(isMarkdown||hasMermaid){
    const uid='t'+Math.random().toString(36).slice(2);
    return`<div class="output-tabs"><button class="otab active" onclick="switchTab(this,'prev','${uid}')">Preview</button><button class="otab" onclick="switchTab(this,'raw','${uid}')">Source</button></div>
    <div class="otab-pane" data-uid="${uid}" data-pane="prev">${mdToHtml(text)}</div>
    <div class="otab-pane otab-raw hidden" data-uid="${uid}" data-pane="raw"><pre>${esc(text)}</pre></div>`;
  }
  return`<div class="step-output">${esc(text)}</div>`;
}
window.switchTab=function(btn,pane,uid){
  document.querySelectorAll(`[data-uid="${uid}"].otab-pane`).forEach(p=>p.classList.toggle('hidden',p.dataset.pane!==pane));
  btn.closest('.output-tabs').querySelectorAll('.otab').forEach(t=>t.classList.remove('active'));btn.classList.add('active');
};
function mdToHtml(md){
  const mermaidBlocks=[];
  let p=md.replace(/```mermaid\n?([\s\S]*?)```/gi,(_,c)=>{const i=mermaidBlocks.length;mermaidBlocks.push(c.trim());return`%%MMD_${i}%%`});
  let h=p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  h=h.replace(/```\w*\n?([\s\S]*?)```/g,(_,c)=>`<pre>${c}</pre>`).replace(/`([^`]+)`/g,'<code>$1</code>');
  h=h.replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g,(_,hdr,rows)=>{const ths=hdr.split('|').filter(c=>c.trim()).map(c=>`<th>${c.trim()}</th>`).join('');const trs=rows.trim().split('\n').map(row=>{const tds=row.split('|').filter(c=>c.trim()).map(c=>`<td>${c.trim()}</td>`).join('');return`<tr>${tds}</tr>`}).join('');return`<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`});
  h=h.replace(/^#### (.+)$/gm,'<h4>$1</h4>').replace(/^### (.+)$/gm,'<h3>$1</h3>').replace(/^## (.+)$/gm,'<h2>$1</h2>').replace(/^# (.+)$/gm,'<h1>$1</h1>');
  h=h.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>').replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
  h=h.replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  h=h.replace(/^[\-\*\+] (.+)$/gm,'<li>$1</li>').replace(/^\d+\. (.+)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/gs,m=>`<ul>${m}</ul>`);
  h=h.replace(/^---+$/gm,'<hr/>').replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br/>');
  mermaidBlocks.forEach((code,idx)=>{
    const bid='mmd-'+Math.random().toString(36).slice(2);
    h=h.replace(`%%MMD_${idx}%%`,`<div class="mermaid-block" id="${bid}" data-code="${encodeURIComponent(code)}"><div class="mermaid-loading"><div class="step-spin"></div><span>Rendering diagram…</span></div></div>`);
    requestAnimationFrame(()=>setTimeout(()=>autoRenderMermaid(bid,code),100));
  });
  return`<div class="md-preview"><p>${h}</p></div>`;
}
async function autoRenderMermaid(blockId,rawCode){
  const block=document.getElementById(blockId);if(!block)return;
  if(!window.mermaid){if(!window._mermaidLoading){window._mermaidLoading=new Promise(resolve=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';s.onload=()=>{window.mermaid.initialize({startOnLoad:false,securityLevel:'loose',theme:theme==='dark'?'dark':'neutral'});resolve()};document.head.appendChild(s)});}await window._mermaidLoading;}
  await doRenderMermaid(block,rawCode);
}
async function doRenderMermaid(block,rawCode){
  try{const code=typeof rawCode==='string'?rawCode:decodeURIComponent(block.dataset.code||'');const id='mmd'+Math.random().toString(36).slice(2);const{svg}=await window.mermaid.render(id,code);block.innerHTML=`<div class="mermaid-rendered">${svg}</div>`;document.querySelectorAll('[id^="d"][style*="position: absolute"]').forEach(el=>{if(el.tagName==='DIV'&&!el.closest('.mermaid-rendered'))el.remove()});}catch(e){block.innerHTML=`<div class="mermaid-err"><i class="ti ti-alert-circle"></i> ${esc(e.message||String(e))}</div>`}
}
const FI={py:'🐍',js:'⚡',ts:'💠',jsx:'⚛',tsx:'⚛',html:'🌐',css:'🎨',scss:'🎨',json:'🔣',md:'📝',txt:'📄',yml:'⚙️',yaml:'⚙️',toml:'⚙️',sh:'🖥',dockerfile:'🐳',gitignore:'👁',go:'🐹',rs:'🦀',java:'☕',rb:'💎',sql:'🗄',csv:'📊'};
function buildRepoPreview(f,runId,stepNum){
  const rows=(f.repo_files||[]).map(p=>{const parts=p.split('/');const depth=parts.length-1;const name=parts[parts.length-1];const ext=name.split('.').pop().toLowerCase();return`<div class="repo-file-row" style="padding-left:${depth*14+14}px"><span class="repo-file-icon">${FI[ext]||'📄'}</span><span class="repo-file-path">${esc(name)}</span></div>`}).join('');
  return`<div class="repo-preview"><div class="repo-preview-hd"><div class="repo-preview-title"><i class="ti ti-folder-code" style="font-size:16px"></i> ${esc(f.filename||'Project')} <span class="repo-file-count">${f.file_count||0} files</span></div><a class="btn-repo-dl" href="/api/runs/${runId}/steps/${stepNum}/repo" download><i class="ti ti-download"></i> Download folder</a></div><div class="repo-tree">${rows}</div></div>`;
}

// ── HIL ───────────────────────────────────────────────────────────────────
function renderHIL(wrap,info){
  const llmSteps=info.llm_steps||[];const prevName=info.prev_step_name||'previous step';const multiAgent=llmSteps.length>1;
  const selOpts=llmSteps.map(s=>`<option value="${s.agent_id}">${esc(s.agent_name)} (Step ${s.step})</option>`).join('');
  const revBadge=info.revision_count>0?`<span class="hil-rev-badge"><i class="ti ti-refresh"></i> Revision ${info.revision_count}</span>`:'';
  wrap.innerHTML=`<div class="hil-card">
    <div class="hil-card-hd"><div class="hil-ring-ic"><i class="ti ti-user-check"></i></div>
    <div><div class="hil-title">Review checkpoint — ${esc(info.label||'Checkpoint')}</div><div class="hil-sub">Step ${info.step} · Reviewing output from <strong>${esc(prevName)}</strong></div>${revBadge}</div></div>
    <div class="hil-preview-wrap">
      <div class="hil-preview-tabs"><button class="hil-tab active" onclick="hilTab(this,'hil-prev')">Preview</button><button class="hil-tab" onclick="hilTab(this,'hil-src')">Source</button></div>
      <div class="hil-pane" id="hil-prev">${mdToHtml(info.current_output||'')}</div>
      <div class="hil-pane hidden" id="hil-src"><pre>${esc(info.current_output||'')}</pre></div>
    </div>
    <div class="hil-actions-row">
      <button class="btn-hil-approve" id="btn-hil-approve" onclick="hilApprove()"><i class="ti ti-check"></i> Looks good — continue</button>
      <div class="hil-revise-col">
        <div class="hil-revise-hd"><span class="hil-revise-lbl">Request changes to</span>${multiAgent?`<select class="hil-agent-sel" id="hil-agent-sel"><option value="">Previous step…</option>${selOpts}</select>`:`<span class="hil-prev-step-name">${esc(prevName)}</span><input type="hidden" id="hil-agent-sel" value="${llmSteps[0]?.agent_id||''}"/>`}</div>
        <textarea class="hil-fb" id="hil-feedback" rows="3" placeholder="Describe what needs to change — the previous step will re-run with your feedback…"></textarea>
        <button class="btn-hil-revise" id="btn-hil-revise" onclick="hilRevise()"><i class="ti ti-refresh"></i> Re-run with feedback</button>
      </div>
    </div></div>`;
  setTimeout(()=>wrap.querySelectorAll('.mermaid-block').forEach(b=>{const c=decodeURIComponent(b.dataset.code||'');if(c)doRenderMermaid(b,c)}),300);
}
window.hilTab=function(btn,paneId){document.querySelectorAll('.hil-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.hil-pane').forEach(p=>p.classList.add('hidden'));btn.classList.add('active');document.getElementById(paneId)?.classList.remove('hidden')};
window.hilApprove=async()=>{const btn=document.getElementById('btn-hil-approve');if(btn)btn.disabled=true;const r=await fetch(`/api/runs/${activeRunId}/hil`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approve'})});if(!r.ok){toast('Error','err');if(btn)btn.disabled=false;return}const hb=document.getElementById('hil-block');if(hb){hb.innerHTML='<div class="hil-done-card"><i class="ti ti-check"></i> Approved — pipeline continuing…</div>';hilRendered=false}};
window.hilRevise=async()=>{const feedback=document.getElementById('hil-feedback')?.value.trim();const agentId=document.getElementById('hil-agent-sel')?.value||'';if(!feedback){toast('Describe what needs to change','err');return}const btn=document.getElementById('btn-hil-revise');if(btn)btn.disabled=true;const r=await fetch(`/api/runs/${activeRunId}/hil`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'revise',feedback,agent_id:agentId})});if(!r.ok){toast('Error','err');if(btn)btn.disabled=false;return}const hb=document.getElementById('hil-block');if(hb){hb.innerHTML=`<div class="tl-running"><div class="tl-running-dot"></div><span>Re-running previous step with your feedback…</span></div>`;hilRendered=false}};
window.toggleStep=h=>{h.classList.toggle('open');const b=h.nextElementSibling;if(b&&b.classList.contains('step-body'))b.classList.toggle('open')};

// ── History ───────────────────────────────────────────────────────────────
async function loadHistory(mode='history'){
  histRuns=await fetch('/api/runs').then(r=>r.json());
  if(mode!=='silent'){renderHistory(mode==='runs'?'hist-rows':'hist-rows2')}
  refreshDashboard();
}
function renderHistory(elId='hist-rows2'){
  const el=document.getElementById(elId);if(!el)return;
  if(!histRuns.length){el.innerHTML='<div class="hist-empty"><i class="ti ti-history" style="font-size:28px;opacity:.2;display:block;margin-bottom:8px"></i>No runs yet — execute a pipeline to see history</div>';return}
  el.innerHTML=histRuns.map(r=>`<div class="run-row" onclick="showRunDetail('${r.id}')"><div class="run-dot rd-${r.status||'completed'}"></div><div class="run-pipe">${esc(r.pipeline_name)}</div><div class="run-steps">${(r.steps||[]).length} steps</div><div class="run-time">${fmtDt(r.started_at)}</div><i class="ti ti-chevron-right" style="color:var(--t3);font-size:13px"></i></div>`).join('');
}
['hist-q','hist-q2'].forEach(id=>{document.getElementById(id)?.addEventListener('input',function(){const q=this.value.toLowerCase();const rows=histRuns.filter(r=>r.pipeline_name.toLowerCase().includes(q)||r.steps?.some(s=>s.agent_name?.toLowerCase().includes(q)));const el=document.getElementById(id==='hist-q'?'hist-rows':'hist-rows2');if(el)el.innerHTML=rows.length?rows.map(r=>`<div class="run-row" onclick="showRunDetail('${r.id}')"><div class="run-dot rd-${r.status||'completed'}"></div><div class="run-pipe">${esc(r.pipeline_name)}</div><div class="run-steps">${(r.steps||[]).length} steps</div><div class="run-time">${fmtDt(r.started_at)}</div><i class="ti ti-chevron-right" style="color:var(--t3);font-size:13px"></i></div>`).join(''):'<div class="hist-empty">No matching runs</div>'})});
window.showRunDetail=async id=>{
  const r=await fetch(`/api/runs/${id}`).then(res=>res.json());
  document.getElementById('run-detail-title').textContent=r.pipeline_name;
  const totalTok=(r.steps||[]).reduce((s,x)=>s+(x.tokens?.total_tokens||0),0);
  const stepsHtml=(r.steps||[]).map(s=>{const dls=buildDls(s,r.id);const out=s.revised_output||s.output||'';const numEl=s.step_type==='hil_revision'?`<span class="step-num rev-num">Rev ${s.revision_num||''}</span>`:`<span class="step-num">${s.step}</span>`;const tokEl=s.tokens?.total_tokens?`<span class="step-tokens">${fmtTok(s.tokens.total_tokens)}</span>`:'';return`<div class="step-card" style="margin-bottom:8px"><div class="step-hd" onclick="toggleStep(this)">${numEl}<span class="step-nm">${esc(s.agent_name)}</span>${(s.files||[]).map(f=>fb(f.format)).join('')}${tokEl}<i class="ti ti-chevron-down step-chev"></i></div><div class="step-body">${buildOutputContent(out,s.files||[],r.id,s.step)}${dls?`<div class="step-dls">${dls}</div>`:''}</div></div>`}).join('');
  document.getElementById('run-detail-bd').innerHTML=`
    <div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--t3);margin-bottom:14px"><span><i class="ti ti-calendar"></i> ${fmtDt(r.started_at)}</span><span>${(r.steps||[]).length} steps</span>${totalTok?`<span><i class="ti ti-clock"></i> ${fmtTok(totalTok)} tokens</span>`:''}</div>
    ${r.input_text?`<div style="background:var(--bg-secondary);border:0.5px solid var(--bd-tertiary);border-radius:var(--r);padding:10px 12px;font-size:12px;white-space:pre-wrap;max-height:80px;overflow:auto;margin-bottom:12px;font-family:var(--mono)">${esc(r.input_text)}</div>`:''}
    <div class="final-card" style="margin-bottom:14px"><div class="final-hd"><i class="ti ti-circle-check"></i><h3>Final Output</h3></div><div class="final-text">${esc(r.final_output||'')}</div></div>
    ${stepsHtml}`;
  openM('modal-run-detail');
  setTimeout(()=>document.querySelectorAll('#run-detail-bd .mermaid-block').forEach(b=>{const c=decodeURIComponent(b.dataset.code||'');if(c)doRenderMermaid(b,c)}),300);
};

// ── Delete ────────────────────────────────────────────────────────────────
window.confirmDel=(type,id,name)=>{delTarget={type,id};document.getElementById('del-msg').textContent=`"${name}" will be permanently deleted.`;openM('modal-del')};
document.getElementById('btn-del-ok').addEventListener('click',async()=>{
  if(!delTarget)return;const{type,id}=delTarget;
  await fetch(type==='agent'?`/api/agents/${id}`:`/api/super_agents/${id}`,{method:'DELETE'});
  closeM('modal-del');delTarget=null;
  if(type==='agent'){await loadAgents();toast('Agent deleted')}else{await loadPipelines();toast('Pipeline deleted')}
});

// ── Boot ──────────────────────────────────────────────────────────────────
(async()=>{
  await loadSettings();
  await loadAgents();
  await loadPipelines();
  await loadFiles();
  await loadHistory('silent');
  refreshDashboard();
})();

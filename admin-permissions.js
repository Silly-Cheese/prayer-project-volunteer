import { getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const app=getApp();
const db=getFirestore(app);

const PERMISSIONS=[
  {id:'activity:create',label:'Activity Updates',description:'Can submit general volunteer activity updates.',group:'Volunteer Work'},
  {id:'service:log',label:'Service Logs',description:'Can submit service time and work summaries.',group:'Volunteer Work'},
  {id:'outreach:create',label:'Care Projects',description:'Can propose outreach or care projects.',group:'Volunteer Work'},
  {id:'chapter:request',label:'Request Chapters',description:'Can request a new chapter for review.',group:'Chapters'},
  {id:'chapter:lead',label:'Chapter Leadership',description:'Can lead or help manage a chapter.',group:'Chapters'},
  {id:'prayer:team',label:'Prayer Team',description:'Can serve on prayer support functions.',group:'Prayer Support'},
  {id:'training:complete',label:'Complete Training',description:'Can submit training reflections for trainer review.',group:'Training'},
  {id:'training:trainer',label:'Verified Trainer',description:'Can train and verify other volunteers.',group:'Training'},
  {id:'service:approve',label:'Approve Service Logs',description:'Can approve or reject volunteer service logs.',group:'Leadership Review'},
  {id:'performance:review',label:'Performance Reviews',description:'Can create volunteer performance reviews.',group:'Leadership Review'},
  {id:'admin:limited',label:'Limited Admin Assistance',description:'Can assist with limited administrative work.',group:'Administration'}
];

const PRESETS={
  basic:['activity:create','service:log','training:complete'],
  standard:['activity:create','service:log','chapter:request','outreach:create','training:complete'],
  chapter:['activity:create','service:log','chapter:request','chapter:lead','outreach:create','training:complete'],
  trainer:['activity:create','service:log','chapter:request','outreach:create','training:complete','training:trainer','service:approve'],
  admin:['activity:create','service:log','chapter:request','chapter:lead','outreach:create','prayer:team','training:complete','training:trainer','service:approve','performance:review','admin:limited']
};

let pendingPermissionSet=null;
let lastVolunteerId=null;

installPermissionStyles();
loadV2AdminLayer();
waitForPermissionSelect();

document.addEventListener('click',async event=>{
  const editButton=event.target.closest('.update-volunteer');
  const acceptButton=event.target.closest('.accept-app');
  if(acceptButton){
    lastVolunteerId=null;
    pendingPermissionSet=null;
    setTimeout(()=>applyPreset('standard'),80);
  }
  if(editButton){
    lastVolunteerId=editButton.dataset.id||'';
    try{
      const snap=await getDoc(doc(db,'volunteers',lastVolunteerId));
      const data=snap.exists()?snap.data():{};
      pendingPermissionSet=Array.isArray(data.permissions)?data.permissions:PRESETS.standard;
      setTimeout(()=>setPermissions(pendingPermissionSet),80);
    }catch(error){
      console.warn('Could not load volunteer permissions.',error);
      setTimeout(()=>setPermissions(PRESETS.standard),80);
    }
  }
},true);

function loadV2AdminLayer(){
  if(!document.querySelector('link[href="./v2-volunteer-network.css"]')){
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href='./v2-volunteer-network.css';
    document.head.appendChild(link);
  }
  import('./v2-admin-review-center.js').catch(error=>console.warn('V2 admin review center unavailable.',error));
}

function waitForPermissionSelect(){
  const timer=setInterval(()=>{
    const select=document.getElementById('provPermissions');
    if(!select)return;
    clearInterval(timer);
    buildPermissionInterface(select);
  },100);
}

function buildPermissionInterface(select){
  if(document.getElementById('permissionDesigner'))return;
  select.style.display='none';
  select.setAttribute('aria-hidden','true');
  select.insertAdjacentHTML('afterend',renderDesigner());
  document.getElementById('permissionDesigner').addEventListener('change',event=>{
    const checkbox=event.target.closest('[data-permission]');
    if(checkbox) syncSelectFromCards();
  });
  document.getElementById('permissionDesigner').addEventListener('click',event=>{
    const preset=event.target.closest('[data-permission-preset]');
    const clear=event.target.closest('[data-permission-clear]');
    if(preset) applyPreset(preset.dataset.permissionPreset);
    if(clear) setPermissions([]);
  });
  setPermissions(PRESETS.standard);
}

function renderDesigner(){
  const groups=[...new Set(PERMISSIONS.map(p=>p.group))];
  return `<section class="permission-designer" id="permissionDesigner"><div class="permission-head"><div><h3>Permission Access</h3><p>Choose only what this volunteer should be allowed to do. Presets are optional and can be adjusted.</p></div><div class="permission-count" id="permissionCount">0 selected</div></div><div class="permission-presets"><button type="button" data-permission-preset="basic">Basic</button><button type="button" data-permission-preset="standard">Standard</button><button type="button" data-permission-preset="chapter">Chapter Lead</button><button type="button" data-permission-preset="trainer">Trainer</button><button type="button" data-permission-preset="admin">Limited Admin</button><button type="button" data-permission-clear>Clear</button></div><div class="permission-groups">${groups.map(group=>`<div class="permission-group"><h4>${escapeHtml(group)}</h4>${PERMISSIONS.filter(p=>p.group===group).map(permissionCard).join('')}</div>`).join('')}</div></section>`;
}

function permissionCard(permission){return `<label class="permission-card"><input type="checkbox" value="${escapeHtml(permission.id)}" data-permission="${escapeHtml(permission.id)}"><span><strong>${escapeHtml(permission.label)}</strong><small>${escapeHtml(permission.description)}</small></span></label>`;}
function applyPreset(name){setPermissions(PRESETS[name]||PRESETS.standard);}
function setPermissions(permissionIds){const ids=new Set(permissionIds||[]);document.querySelectorAll('[data-permission]').forEach(input=>{input.checked=ids.has(input.value);});const select=document.getElementById('provPermissions');if(select){[...select.options].forEach(option=>{option.selected=ids.has(option.value);});}updateCount();}
function syncSelectFromCards(){const selected=[...document.querySelectorAll('[data-permission]:checked')].map(input=>input.value);const select=document.getElementById('provPermissions');if(select){[...select.options].forEach(option=>{option.selected=selected.includes(option.value);});}updateCount();}
function updateCount(){const count=document.querySelectorAll('[data-permission]:checked').length;const target=document.getElementById('permissionCount');if(target)target.textContent=count===1?'1 selected':`${count} selected`;}

function installPermissionStyles(){
  if(document.getElementById('permissionDesignerStyles'))return;
  const style=document.createElement('style');
  style.id='permissionDesignerStyles';
  style.textContent=`.permission-designer{margin-top:10px;padding:18px;border:1px solid var(--line);border-radius:24px;background:rgba(216,195,165,.045)}.permission-head{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;margin-bottom:14px}.permission-head h3{margin:0 0 6px;color:var(--text)}.permission-head p{margin:0;color:var(--soft);line-height:1.55;font-size:13px}.permission-count{white-space:nowrap;border:1px solid var(--line);border-radius:999px;padding:8px 11px;color:var(--warm2);font-size:12px;font-weight:900;background:rgba(0,0,0,.24)}.permission-presets{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px}.permission-presets button{border:1px solid var(--line);background:rgba(0,0,0,.24);color:var(--muted);border-radius:999px;padding:9px 11px;font-weight:900;cursor:pointer}.permission-presets button:hover{color:var(--warm2);border-color:var(--line2);background:rgba(216,195,165,.10)}.permission-groups{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.permission-group{border:1px solid rgba(216,195,165,.12);border-radius:20px;padding:12px;background:rgba(0,0,0,.16)}.permission-group h4{margin:0 0 10px;color:var(--warm);font-size:12px;letter-spacing:.12em;text-transform:uppercase}.permission-card{display:flex!important;grid-template-columns:none!important;align-items:flex-start;gap:10px;padding:12px;border:1px solid rgba(216,195,165,.10);border-radius:16px;background:rgba(255,255,255,.025);margin:8px 0!important;cursor:pointer}.permission-card:hover{border-color:var(--line2);background:rgba(216,195,165,.07)}.permission-card input{margin-top:4px;width:18px!important;height:18px!important;accent-color:var(--warm)}.permission-card span{display:block}.permission-card strong{display:block;color:var(--text);font-size:14px}.permission-card small{display:block;color:var(--soft);line-height:1.45;margin-top:3px;font-size:12px}@media(max-width:720px){.permission-head{display:grid}.permission-count{width:max-content}.permission-groups{grid-template-columns:1fr}}`;
  document.head.appendChild(style);
}

function escapeHtml(value=''){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');}

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { openNotice, openConfirm } from "./admin-modals.js";

const firebaseConfig={apiKey:"AIzaSyAaaABQB1T_SaZ6TARafIXjJ6Zk-upjLO0",authDomain:"prayer-projec.firebaseapp.com",projectId:"prayer-projec",storageBucket:"prayer-projec.firebasestorage.app",messagingSenderId:"47966669764",appId:"1:47966669764:web:b875d2ea5bf75e3b7b3291"};
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app);
const $=id=>document.getElementById(id);
let cache={applications:[],chapterRequests:[],chapters:[],volunteers:[],projects:[],training:[],assignments:[],suggestions:[],activity:[],logs:[],contacts:[],leaves:[]};

setupAdminTabs();
setupSearchFilters();
onAuthStateChanged(auth,async user=>{if(user) await refreshCommandCenter();});

document.addEventListener('click',async event=>{
  const setting=event.target.closest('[data-setting-placeholder]');
  if(setting) await openNotice('Settings Module Prepared','This section is now visually prepared. The next backend pass can connect these controls to volunteer_settings.');
  const quick=event.target.closest('[data-quick-action]');
  if(quick) await handleQuickAction(quick.dataset);
});

async function refreshCommandCenter(){
  await Promise.all([
    load('applications','volunteer_applications'),
    load('chapterRequests','volunteer_chapter_requests'),
    load('chapters','volunteer_chapters'),
    load('volunteers','volunteers',false),
    load('projects','volunteer_care_projects'),
    load('training','volunteer_training_completions'),
    load('assignments','volunteer_assignments'),
    load('suggestions','volunteer_suggestions'),
    load('activity','volunteer_activity_updates'),
    load('logs','volunteer_service_logs'),
    load('contacts','volunteer_contacts'),
    load('leaves','volunteer_leave_requests')
  ]);
  const pending=countPending();
  set('pendingCount',pending);
  renderOverview();
  renderTraining();
  renderAssignments();
  renderCareProjects();
  enhanceExistingSections();
}
async function load(key,name,ordered=true){try{const snap=await getDocs(ordered?query(collection(db,name),orderBy('createdAt','desc')):collection(db,name));cache[key]=[];snap.forEach(d=>cache[key].push({id:d.id,...d.data()}));}catch(e){cache[key]=[];}}
function countPending(){return cache.applications.filter(x=>['submitted','under review','Submitted'].includes(String(x.status||'submitted'))).length+cache.chapterRequests.filter(x=>String(x.status||'submitted')==='submitted').length+cache.projects.filter(x=>String(x.status||'submitted')==='submitted').length+cache.suggestions.filter(x=>String(x.status||'submitted')==='submitted').length+cache.contacts.filter(x=>String(x.status||'open')==='open').length+cache.leaves.filter(x=>String(x.status||'submitted')==='submitted').length;}
function renderOverview(){const target=$('overviewList');if(!target)return;const urgent=[...cache.applications.filter(x=>(x.status||'submitted')==='submitted').slice(0,4).map(x=>mini('Application',x.name||x.email,x.why,'applications')),...cache.chapterRequests.filter(x=>(x.status||'submitted')==='submitted').slice(0,4).map(x=>mini('Chapter Request',x.chapterName,x.purpose,'chapters')),...cache.projects.filter(x=>(x.status||'submitted')==='submitted').slice(0,4).map(x=>mini('Care Project',x.title,x.purpose,'projects')),...cache.contacts.filter(x=>(x.status||'open')==='open').slice(0,4).map(x=>mini('Contact Request',x.subject,x.message,'records')),...cache.leaves.filter(x=>(x.status||'submitted')==='submitted').slice(0,4).map(x=>mini('Leave Request',x.name||x.email,x.reason,'records'))];target.innerHTML=urgent.join('')||'<div class="empty-state">No urgent pending items right now.</div>';}
function renderTraining(){const target=$('trainingList');if(!target)return;target.innerHTML=cache.training.map(x=>card('Training Completion',x.name||x.email,x.reflection||'No reflection provided.',`Status: ${x.status||'submitted'}`)).join('')||'<div class="empty-state">No training reflections submitted yet.</div>';}
function renderAssignments(){const target=$('assignmentListAdmin');if(!target)return;target.innerHTML=cache.assignments.map(x=>`<article class="record-card"><span class="pill">Assignment</span><h3>${esc(x.title||'Assignment')}</h3><p>${esc(x.description||'')}</p><div class="meta"><span>${esc(x.assignedToEmail||'Unassigned')}</span><span>${esc(x.status||'open')}</span><span>${esc(x.priority||'normal')}</span><span>${esc(x.dueDate||'No due date')}</span></div><div class="toolbar"><button class="btn" data-quick-action="status" data-col="volunteer_assignments" data-id="${x.id}" data-status="completed">Mark Complete</button><button class="btn danger" data-quick-action="delete" data-col="volunteer_assignments" data-id="${x.id}" data-label="assignment">Delete</button></div></article>`).join('')||'<div class="empty-state">No assignments have been created yet.</div>';}
function renderCareProjects(){const target=$('careProjectList');if(!target)return;target.innerHTML=cache.projects.map(x=>`<article class="record-card"><span class="pill ${x.status==='approved'?'ok':''}">Care Project: ${esc(x.status||'submitted')}</span><h3>${esc(x.title||'Care Project')}</h3><p>${esc(x.purpose||'')}</p><div class="meta"><span>${esc(x.name||x.email||'Volunteer')}</span><span>${esc(x.type||'Project')}</span></div><div class="toolbar"><button class="btn primary" data-quick-action="status" data-col="volunteer_care_projects" data-id="${x.id}" data-status="approved">Approve</button><button class="btn" data-quick-action="status" data-col="volunteer_care_projects" data-id="${x.id}" data-status="rejected">Reject</button><button class="btn danger" data-quick-action="delete" data-col="volunteer_care_projects" data-id="${x.id}" data-label="care project">Delete</button></div></article>`).join('')||'<div class="empty-state">No care projects submitted yet.</div>';}
function enhanceExistingSections(){document.querySelectorAll('.item').forEach(x=>x.classList.add('record-card'));}
async function handleQuickAction(data){if(data.quickAction==='status'){const ok=await openConfirm('Update Record Status',`Set this record to ${data.status}?`,{confirmText:'Update'});if(!ok)return;await updateDoc(doc(db,data.col,data.id),{status:data.status,updatedAt:serverTimestamp()});await refreshCommandCenter();return;}if(data.quickAction==='delete'){const ok=await openConfirm(`Delete ${data.label||'record'}`,'This record will be permanently deleted.',{confirmText:'Delete',danger:true});if(!ok)return;await deleteDoc(doc(db,data.col,data.id));await refreshCommandCenter();}}
function setupAdminTabs(){document.querySelectorAll('.admin-tab').forEach(button=>button.addEventListener('click',()=>{document.querySelectorAll('.admin-tab').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.admin-section').forEach(x=>x.classList.remove('active'));button.classList.add('active');const section=$('section-'+button.dataset.adminSection);if(section)section.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});}));}
function setupSearchFilters(){document.addEventListener('input',event=>{const target=event.target;if(target?.id==='applicationSearch')filterCards('applicationList',target.value);if(target?.id==='volunteerSearch')filterCards('volunteerList',target.value);});}
function filterCards(listId,value){const list=$(listId);if(!list)return;const q=String(value||'').toLowerCase();list.querySelectorAll('.item,.record-card').forEach(card=>{card.style.display=card.textContent.toLowerCase().includes(q)?'':'none';});}
function mini(type,title,body,section){return `<article class="record-card"><span class="pill">${esc(type)}</span><h3>${esc(title||type)}</h3><p>${esc(body||'Needs review.')}</p><button class="btn" onclick="document.querySelector('[data-admin-section=${section}]')?.click()">Open Section</button></article>`;}
function card(type,title,body,meta){return `<article class="record-card"><span class="pill">${esc(type)}</span><h3>${esc(title||type)}</h3><p>${esc(body||'')}</p><div class="meta"><span>${esc(meta||'')}</span></div></article>`;}
function set(id,value){const el=$(id);if(el)el.textContent=value;}
function esc(value=''){return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;');}

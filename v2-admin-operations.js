import { getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, getDocs, addDoc, doc, updateDoc, serverTimestamp, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAccessProfile } from "./access-control.js";
import { openNotice, openConfirm, openForm } from "./admin-modals.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);
let allowed = false;
let cache = {};

onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    const access = await getAccessProfile(user);
    allowed = access.admin || access.trainer;
    if (allowed) await renderOperationsCenter();
  } catch (error) { console.warn('V2 admin operations could not load.', error); }
});

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-v26-action]');
  if (!button || !allowed) return;
  try {
    const action = button.dataset.v26Action;
    if (action === 'announcement') await createAnnouncement();
    if (action === 'recognition') await createRecognition();
    if (action === 'close-contact') await closeContact(button.dataset.id);
    if (action === 'export-summary') exportSummary();
    await renderOperationsCenter();
  } catch (error) {
    console.error(error);
    await openNotice('V2 Operation Failed', error?.message || 'The operation could not be completed.');
  }
});

async function renderOperationsCenter() {
  const target = $('section-overview')?.querySelector('.panel') || document.querySelector('.admin-content .panel');
  if (!target) return;
  if (!$('v26OperationsCenter')) target.insertAdjacentHTML('afterend', `<section class="panel v2-panel" id="v26OperationsCenter"><p class="eyebrow">V2.6-V2.10 Operations</p><h2>Communications, reporting, recognition, security, and polish.</h2><div class="v2-toolbar"><button class="btn primary" data-v26-action="announcement">Post Announcement</button><button class="btn" data-v26-action="recognition">Give Recognition</button><button class="btn" data-v26-action="export-summary">Export Summary</button></div><div class="v2-grid" id="v26Metrics"></div><div class="v2-list" id="v26Lists">Loading...</div></section>`);
  const [volunteers, contacts, logs, badges, announcements, audits] = await Promise.all([read('volunteers'), read('volunteer_contacts'), read('volunteer_service_logs'), read('volunteer_badges'), read('volunteer_announcements'), read('audit_logs')]);
  cache = { volunteers, contacts, logs, badges, announcements, audits };
  const openContacts = contacts.filter(x => String(x.status || 'open') === 'open');
  const approvedMinutes = logs.filter(x => ['Approved','approved'].includes(String(x.approvalStatus || x.status || ''))).reduce((sum,x)=>sum+Number(x.minutes||0),0);
  $('v26Metrics').innerHTML = `<article class="v2-card"><strong>${openContacts.length}</strong><span>Open Messages</span></article><article class="v2-card"><strong>${badges.length}</strong><span>Recognition</span></article><article class="v2-card"><strong>${Math.round(approvedMinutes/60*100)/100}</strong><span>Approved Hours</span></article>`;
  $('v26Lists').innerHTML = `${renderMessages(openContacts)}${renderAnnouncements(announcements)}${renderSecurity(audits)}`;
}

async function read(name) {
  const rows = [];
  try {
    const snap = await getDocs(query(collection(db, name), orderBy('createdAt', 'desc'), limit(40)));
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
  } catch (error) {
    try { const snap = await getDocs(collection(db, name)); snap.forEach(d => rows.push({ id: d.id, ...d.data() })); } catch (e) {}
  }
  return rows;
}

function renderMessages(rows) {
  return `<section class="v2-panel"><h3>V2.6 Internal Communication Queue</h3>${rows.length ? rows.slice(0,10).map(x => `<article class="v2-record"><h4>${esc(x.subject || 'Message')}</h4><p>${esc(x.message || '')}</p><div class="v2-meta"><span>${esc(x.name || x.email || '')}</span><span>${esc(x.type || '')}</span><span class="v2-badge warn">${esc(x.status || 'open')}</span></div><div class="v2-toolbar"><button class="btn" data-v26-action="close-contact" data-id="${x.id}">Close Message</button></div></article>`).join('') : '<p class="v2-quiet">No open leadership messages.</p>'}</section>`;
}

function renderAnnouncements(rows) {
  return `<section class="v2-panel"><h3>V2.6 Announcements</h3>${rows.length ? rows.slice(0,6).map(x => `<article class="v2-record"><h4>${esc(x.title || 'Announcement')}</h4><p>${esc(x.message || x.body || '')}</p><div class="v2-meta"><span>${esc(x.audience || 'All Volunteers')}</span><span>${esc(x.priority || 'Normal')}</span></div></article>`).join('') : '<p class="v2-quiet">No announcements posted yet.</p>'}</section>`;
}

function renderSecurity(rows) {
  return `<section class="v2-panel"><h3>V2.9 Security Activity</h3><p class="v2-note">Audit logs remain append-only. This panel surfaces recent activity without adding delete controls.</p>${rows.length ? rows.slice(0,8).map(x => `<article class="v2-record"><h4>${esc(x.action || 'Audit Event')}</h4><div class="v2-meta"><span>${esc(x.actor || x.adminEmail || '')}</span><span>${date(x.createdAt)}</span></div></article>`).join('') : '<p class="v2-quiet">No audit logs loaded.</p>'}</section>`;
}

async function createAnnouncement() {
  const result = await openForm('Post Announcement', 'Create an internal notice for volunteers.', [{ name:'title', label:'Title', required:true }, { name:'message', label:'Message', type:'textarea', required:true }, { name:'priority', label:'Priority', type:'select', value:'Normal', options:[{value:'Normal',label:'Normal'},{value:'Important',label:'Important'},{value:'Urgent',label:'Urgent'}] }], { confirmText:'Post' });
  if (!result) return;
  await addDoc(collection(db, 'volunteer_announcements'), { title: result.title, message: result.message, priority: result.priority || 'Normal', audience: 'All Volunteers', createdBy: auth.currentUser?.email || 'Admin', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await audit('v2_announcement_created', { title: result.title });
}

async function createRecognition() {
  const volunteers = cache.volunteers || [];
  const result = await openForm('Give Recognition', 'Add a badge or recognition note to a volunteer.', [{ name:'uid', label:'Volunteer', type:'select', required:true, options: volunteers.map(v => ({ value: v.id, label: `${v.name || v.email || v.id}` })) }, { name:'title', label:'Recognition Title', required:true }, { name:'message', label:'Recognition Note', type:'textarea' }], { confirmText:'Give Recognition' });
  if (!result) return;
  const volunteer = volunteers.find(v => v.id === result.uid) || {};
  await addDoc(collection(db, 'volunteer_badges'), { uid: result.uid, email: volunteer.email || '', volunteerName: volunteer.name || volunteer.email || '', title: result.title, message: result.message || '', createdBy: auth.currentUser?.email || 'Admin', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await audit('v2_recognition_created', { uid: result.uid, title: result.title });
}

async function closeContact(id) {
  const ok = await openConfirm('Close Message', 'Mark this leadership message as closed?', { confirmText:'Close' });
  if (!ok) return;
  await updateDoc(doc(db, 'volunteer_contacts', id), { status: 'closed', closedBy: auth.currentUser?.email || 'Admin', closedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await audit('v2_contact_closed', { id });
}

function exportSummary() {
  const rows = [
    ['Metric','Value'],
    ['Volunteers', String((cache.volunteers || []).length)],
    ['Open Messages', String((cache.contacts || []).filter(x => String(x.status || 'open') === 'open').length)],
    ['Recognition Records', String((cache.badges || []).length)],
    ['Service Logs', String((cache.logs || []).length)]
  ];
  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g,'""')}"`).join(',')).join('\n');
  navigator.clipboard?.writeText(csv);
  openNotice('Summary Copied', 'The V2 operations summary CSV has been copied to your clipboard.');
}

async function audit(action, details) { try { await addDoc(collection(db, 'audit_logs'), { action, details, actor: auth.currentUser?.email || 'system', createdAt: serverTimestamp() }); } catch (error) {} }
function date(value) { return value?.toDate ? value.toDate().toLocaleString() : 'Recently'; }
function esc(value = '') { return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\"/g,'&quot;').replace(/'/g,'&#039;'); }

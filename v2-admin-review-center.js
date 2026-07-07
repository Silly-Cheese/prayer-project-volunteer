import { getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, query, where, limit, setDoc } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";
import { getAccessProfile } from "./access-control.js";
import { openNotice, openConfirm, openForm } from "./admin-modals.js";

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);

let isReady = false;
onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    const profile = await getAccessProfile(user);
    if (!profile.admin && !profile.trainer) return;
    isReady = true;
    await renderV2AdminCenter();
  } catch (error) {
    console.warn('V2 admin center could not load.', error);
  }
});

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-v2-action]');
  if (!button || !isReady) return;
  try {
    const action = button.dataset.v2Action;
    if (action === 'approve-training') await approveTraining(button.dataset.id, button.dataset.uid);
    if (action === 'return-training') await returnTraining(button.dataset.id, button.dataset.uid);
    if (action === 'approve-service') await reviewService(button.dataset.id, 'Approved');
    if (action === 'reject-service') await reviewService(button.dataset.id, 'Rejected');
    if (action === 'create-review') await createPerformanceReview(button.dataset.uid, button.dataset.name);
    if (action === 'update-chapter') await updateChapter(button.dataset.id, button.dataset.name);
    await renderV2AdminCenter();
  } catch (error) {
    console.error(error);
    await openNotice('V2 Action Failed', error?.message || 'The V2 action could not be completed.');
  }
});

async function renderV2AdminCenter() {
  const overview = $('section-overview')?.querySelector('.panel') || document.querySelector('.admin-content .panel');
  if (!overview) return;
  let panel = $('v2AdminCenter');
  if (!panel) {
    overview.insertAdjacentHTML('afterend', `<section class="panel v2-panel" id="v2AdminCenter"><p class="eyebrow">Volunteer Network V2</p><h2>Review center</h2><p class="muted">V2.1-V2.5 keeps the flow coherent: profile expansion, trainer-reviewed training, approved service logs, performance reviews, and managed chapters.</p><div class="v2-grid" id="v2AdminMetrics"></div><div class="v2-list" id="v2AdminLists">Loading...</div></section>`);
    panel = $('v2AdminCenter');
  }
  const [training, logs, volunteers, chapters] = await Promise.all([
    read('volunteer_training_completions'),
    read('volunteer_service_logs'),
    read('volunteers'),
    read('volunteer_chapters')
  ]);
  const pendingTraining = training.filter(x => ['submitted', 'Needs Review', 'Submitted'].includes(String(x.status || 'submitted')));
  const pendingLogs = logs.filter(x => !['Approved', 'Rejected', 'approved', 'rejected'].includes(String(x.approvalStatus || x.status || '')));
  const activeVolunteers = volunteers.filter(x => !['Suspended', 'Inactive', 'Removed', 'Archived'].includes(String(x.status || 'Active')));
  $('v2AdminMetrics').innerHTML = `<article class="v2-card"><strong>${pendingTraining.length}</strong><span>Training Reviews</span></article><article class="v2-card"><strong>${pendingLogs.length}</strong><span>Service Logs</span></article><article class="v2-card"><strong>${activeVolunteers.length}</strong><span>Active Volunteers</span></article>`;
  $('v2AdminLists').innerHTML = `${renderTrainingList(pendingTraining)}${renderServiceList(pendingLogs)}${renderPerformanceList(activeVolunteers)}${renderChapterList(chapters)}`;
}

async function read(collectionName) {
  const rows = [];
  try {
    const snap = await getDocs(collection(db, collectionName));
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
  } catch (error) {
    console.warn('Could not read ' + collectionName, error);
  }
  return rows;
}

function renderTrainingList(rows) {
  return `<section class="v2-panel"><h3>V2.2 Training Approval Queue</h3>${rows.length ? rows.map(x => `<article class="v2-record"><h4>${esc(x.name || x.email || 'Training Submission')}</h4><p>${esc(x.reflection || 'No reflection provided.')}</p><div class="v2-meta"><span class="v2-badge warn">${esc(x.status || 'submitted')}</span><span>${esc(x.email || '')}</span></div><div class="v2-toolbar"><button class="btn primary" data-v2-action="approve-training" data-id="${x.id}" data-uid="${esc(x.uid || '')}">Approve Training</button><button class="btn" data-v2-action="return-training" data-id="${x.id}" data-uid="${esc(x.uid || '')}">Return for Revision</button></div></article>`).join('') : '<p class="v2-quiet">No training reflections are waiting for review.</p>'}</section>`;
}

function renderServiceList(rows) {
  return `<section class="v2-panel"><h3>V2.3 Service Log Approval Queue</h3>${rows.length ? rows.map(x => `<article class="v2-record"><h4>${esc(x.name || x.email || 'Service Log')}</h4><p>${esc(x.summary || '')}</p><div class="v2-meta"><span class="v2-badge warn">${esc(x.approvalStatus || x.status || 'Pending')}</span><span>${esc(x.type || 'Service')}</span><span>${esc(x.date || '')}</span><span>${Number(x.minutes || 0)} minutes</span></div><div class="v2-toolbar"><button class="btn primary" data-v2-action="approve-service" data-id="${x.id}">Approve Log</button><button class="btn" data-v2-action="reject-service" data-id="${x.id}">Reject Log</button></div></article>`).join('') : '<p class="v2-quiet">No service logs are waiting for review.</p>'}</section>`;
}

function renderPerformanceList(rows) {
  return `<section class="v2-panel"><h3>V2.4 Performance Review Starter</h3><p class="v2-note">Create a lightweight monthly review without changing existing volunteer records.</p>${rows.slice(0, 8).map(v => `<article class="v2-record"><h4>${esc(v.name || v.email || 'Volunteer')}</h4><div class="v2-meta"><span>${esc(v.role || 'Volunteer')}</span><span>${esc(v.team || '')}</span><span>${esc(v.status || 'Active')}</span></div><div class="v2-toolbar"><button class="btn" data-v2-action="create-review" data-uid="${v.id}" data-name="${esc(v.name || v.email || 'Volunteer')}">Create Review</button></div></article>`).join('') || '<p class="v2-quiet">No active volunteers loaded.</p>'}</section>`;
}

function renderChapterList(rows) {
  return `<section class="v2-panel"><h3>V2.5 Chapter Management</h3><p class="v2-note">Add chapter goals and health notes without disrupting the chapter directory.</p>${rows.map(c => `<article class="v2-record"><h4>${esc(c.chapterName || c.name || c.id)}</h4><p>${esc(c.chapterGoal || c.purpose || 'No chapter goal recorded yet.')}</p><div class="v2-meta"><span>${esc(c.chapterType || 'Chapter')}</span><span>${esc(c.location || '')}</span><span>${esc(c.status || 'active')}</span></div><div class="v2-toolbar"><button class="btn" data-v2-action="update-chapter" data-id="${c.id}" data-name="${esc(c.chapterName || c.name || c.id)}">Update Chapter Health</button></div></article>`).join('') || '<p class="v2-quiet">No active chapters loaded.</p>'}</section>`;
}

async function approveTraining(id, uid) {
  const ok = await openConfirm('Approve Training', 'Approve this training submission and unlock the volunteer for active service?', { confirmText: 'Approve' });
  if (!ok) return;
  await updateDoc(doc(db, 'volunteer_training_completions', id), { status: 'Approved', reviewedBy: auth.currentUser?.email || 'Trainer', reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (uid) await updateDoc(doc(db, 'volunteers', uid), { trainingCompleted: true, trainingCompletedAt: serverTimestamp(), trainingReviewStatus: 'Approved', status: 'Active', updatedAt: serverTimestamp() });
  await audit('v2_training_approved', { id, uid });
}

async function returnTraining(id, uid) {
  const result = await openForm('Return Training', 'Add a note explaining what needs revision.', [{ name: 'note', label: 'Trainer Note', type: 'textarea', required: true }], { confirmText: 'Return' });
  if (!result) return;
  await updateDoc(doc(db, 'volunteer_training_completions', id), { status: 'Returned', trainerNote: result.note, reviewedBy: auth.currentUser?.email || 'Trainer', reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  if (uid) await updateDoc(doc(db, 'volunteers', uid), { trainingCompleted: false, trainingReviewStatus: 'Returned', updatedAt: serverTimestamp() });
  await audit('v2_training_returned', { id, uid });
}

async function reviewService(id, status) {
  const ok = await openConfirm(status === 'Approved' ? 'Approve Service Log' : 'Reject Service Log', `Mark this service log as ${status}?`, { confirmText: status });
  if (!ok) return;
  await updateDoc(doc(db, 'volunteer_service_logs', id), { status, approvalStatus: status, reviewedBy: auth.currentUser?.email || 'Admin', reviewedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await audit('v2_service_log_' + status.toLowerCase(), { id, status });
}

async function createPerformanceReview(uid, name) {
  const result = await openForm('Create Performance Review', `Create a review for ${name}.`, [{ name: 'rating', label: 'Overall Rating', type: 'select', value: 'Good', options: [{ value: 'Excellent', label: 'Excellent' }, { value: 'Good', label: 'Good' }, { value: 'Needs Growth', label: 'Needs Growth' }, { value: 'Concern', label: 'Concern' }] }, { name: 'strengths', label: 'Strengths', type: 'textarea' }, { name: 'growth', label: 'Growth Opportunities', type: 'textarea' }], { confirmText: 'Create Review' });
  if (!result) return;
  await addDoc(collection(db, 'volunteer_performance_reviews'), { uid, volunteerName: name, rating: result.rating, strengths: result.strengths || '', growth: result.growth || '', createdBy: auth.currentUser?.email || 'Admin', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await audit('v2_performance_review_created', { uid, name });
}

async function updateChapter(id, name) {
  const result = await openForm('Update Chapter Health', `Update chapter management notes for ${name}.`, [{ name: 'chapterGoal', label: 'Chapter Goal', type: 'textarea' }, { name: 'chapterHealth', label: 'Health Status', type: 'select', value: 'Healthy', options: [{ value: 'Healthy', label: 'Healthy' }, { value: 'Needs Attention', label: 'Needs Attention' }, { value: 'Inactive Risk', label: 'Inactive Risk' }, { value: 'Paused', label: 'Paused' }] }], { confirmText: 'Save Chapter Health' });
  if (!result) return;
  await updateDoc(doc(db, 'volunteer_chapters', id), { chapterGoal: result.chapterGoal || '', chapterHealth: result.chapterHealth || 'Healthy', chapterHealthUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await audit('v2_chapter_health_updated', { id, name });
}

async function audit(action, details) {
  try { await addDoc(collection(db, 'audit_logs'), { action, details, actor: auth.currentUser?.email || 'system', createdAt: serverTimestamp() }); } catch (error) { console.warn('Audit failed.', error); }
}

function esc(value = '') { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }

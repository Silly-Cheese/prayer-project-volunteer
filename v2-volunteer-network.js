import { getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, getDoc, updateDoc, serverTimestamp, limit } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

let app;
try { app = getApp(); } catch (error) { console.warn('V2 layer is waiting for the main Firebase app.'); }
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const $ = id => document.getElementById(id);

if (auth && db) {
  onAuthStateChanged(auth, async user => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'volunteers', user.uid));
      if (!snap.exists()) return;
      const volunteer = { id: user.uid, ...snap.data() };
      if ($('dashboard')) await enhanceDashboard(volunteer);
      if ($('trainingForm')) enhanceTrainingPage(volunteer);
      if ($('assignmentList')) enhanceAssignments();
      if ($('chapterDirectory')) enhanceChapterDirectory();
    } catch (error) {
      console.warn('V2 volunteer layer could not load.', error);
    }
  });
}

async function enhanceDashboard(volunteer) {
  injectLifecycle(volunteer);
  injectProfileExpansion(volunteer);
  await injectServiceSummary(volunteer);
}

function injectLifecycle(v) {
  const host = document.querySelector('.portal-main') || $('dashboard');
  if (!host || $('v2Lifecycle')) return;
  const steps = ['Agreement', 'Training Review', 'Active Service', 'Approved Logs', 'Recognition'];
  const done = [v.agreementAccepted, v.trainingCompleted || v.trainingReviewStatus === 'Approved', isServiceReady(v), false, Array.isArray(v.recognitions) && v.recognitions.length > 0];
  const next = done.findIndex(x => !x);
  const html = `<section class="v2-panel" id="v2Lifecycle"><p class="eyebrow">V2 Service Flow</p><h2>Volunteer journey</h2><p class="v2-quiet">Your account now follows a clearer lifecycle: agreement, trainer review, active service, approved logs, and recognition.</p><div class="v2-flow">${steps.map((s, i) => `<div class="v2-step ${done[i] ? 'done' : i === next ? 'active' : ''}"><strong>${i + 1}. ${esc(s)}</strong><br>${done[i] ? 'Complete' : 'In progress'}</div>`).join('')}</div></section>`;
  host.insertAdjacentHTML('afterbegin', html);
}

function injectProfileExpansion(v) {
  const sidebar = document.querySelector('.portal-sidebar');
  if (!sidebar || $('v2ProfilePanel')) return;
  sidebar.insertAdjacentHTML('beforeend', `<section class="v2-panel" id="v2ProfilePanel"><h3>Profile Completeness</h3><p class="v2-quiet">Optional details help leadership support you better.</p><div class="v2-progress"><span style="width:${profileScore(v)}%"></span></div><p class="v2-quiet">${profileScore(v)}% complete</p><form id="v2ProfileForm" class="v2-form-grid"><label>Preferred Name<input id="v2PreferredName" value="${esc(v.preferredName || '')}"></label><label>Church / Group<input id="v2Church" value="${esc(v.church || '')}"></label><label>Emergency Contact<input id="v2EmergencyContact" value="${esc(v.emergencyContact || '')}"></label><label>General Notes<input id="v2VolunteerNotes" value="${esc(v.volunteerProfileNotes || '')}"></label><button class="btn primary full" style="grid-column:1/-1">Save Profile Details</button><p class="notice" id="v2ProfileNotice" style="grid-column:1/-1"></p></form></section>`);
  $('v2ProfileForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    const notice = $('v2ProfileNotice');
    try {
      await updateDoc(doc(db, 'volunteers', v.id), { preferredName: field('v2PreferredName'), church: field('v2Church'), emergencyContact: field('v2EmergencyContact'), volunteerProfileNotes: field('v2VolunteerNotes'), profileUpdatedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      notice.textContent = 'Profile details saved.';
      notice.className = 'notice success';
    } catch (error) {
      notice.textContent = 'Profile details could not be saved. Publish the updated Firestore rules if needed.';
      notice.className = 'notice error';
    }
  });
}

async function injectServiceSummary(v) {
  const host = document.querySelector('.portal-main');
  if (!host || $('v2ServiceSummary')) return;
  let logs = [];
  try {
    const snap = await getDocs(query(collection(db, 'volunteer_service_logs'), where('uid', '==', v.id), limit(25)));
    snap.forEach(d => logs.push({ id: d.id, ...d.data() }));
  } catch (error) { logs = []; }
  const approved = logs.filter(x => ['Approved', 'approved'].includes(String(x.approvalStatus || x.status || '')));
  const pending = logs.filter(x => !['Approved', 'approved', 'Rejected', 'rejected'].includes(String(x.approvalStatus || x.status || '')));
  const hours = Math.round(approved.reduce((sum, x) => sum + Number(x.minutes || 0), 0) / 60 * 100) / 100;
  host.insertAdjacentHTML('afterbegin', `<section class="v2-panel" id="v2ServiceSummary"><p class="eyebrow">Verified Service</p><h2>Service log status</h2><div class="v2-grid"><article class="v2-card"><strong>${logs.length}</strong><span>Total Logs</span></article><article class="v2-card"><strong>${pending.length}</strong><span>Pending Review</span></article><article class="v2-card"><strong>${hours}</strong><span>Approved Hours</span></article></div><p class="v2-note">Submitted service logs are now treated as pending until leadership approves them. Only approved logs should be used for official verification.</p></section>`);
}

function enhanceTrainingPage(v) {
  const form = $('trainingForm');
  if (!form || $('v2TrainingNotice')) return;
  form.insertAdjacentHTML('beforebegin', `<section class="v2-panel" id="v2TrainingNotice"><p class="eyebrow">V2.2 Training Review</p><h2>Training now requires trainer approval.</h2><p class="v2-note">Submitting your reflection sends it to a trainer or administrator for review. Your account is unlocked for full service only after approval.</p><div class="v2-meta"><span class="v2-badge ${v.trainingCompleted ? 'ok' : 'warn'}">${v.trainingCompleted ? 'Approved' : 'Review Required'}</span><span class="v2-badge">${esc(v.trainingReviewStatus || 'Not submitted')}</span></div></section>`);
}

function enhanceAssignments() {
  const host = $('assignmentList');
  if (!host || $('v2AssignmentNote')) return;
  host.insertAdjacentHTML('beforebegin', `<section class="v2-panel" id="v2AssignmentNote"><p class="eyebrow">V2.4 Assignments</p><h2>Assignments are tracked as part of volunteer performance.</h2><p class="v2-note">When you mark an assignment complete, leadership can use it for follow-up, reviews, and recognition.</p></section>`);
}

function enhanceChapterDirectory() {
  const host = $('chapterDirectory');
  if (!host || $('v2ChapterNote')) return;
  host.insertAdjacentHTML('beforebegin', `<section class="v2-panel" id="v2ChapterNote"><p class="eyebrow">V2.5 Chapters</p><h2>Chapters are now treated as managed service units.</h2><p class="v2-note">Active chapters can carry leaders, members, goals, projects, and service totals. The admin review center can track chapter health without changing this public directory.</p></section>`);
}

function profileScore(v) { const fields = ['name', 'email', 'volunteerId', 'preferredName', 'church', 'emergencyContact', 'chapterId', 'team', 'role', 'agreementAccepted', 'trainingCompleted']; const done = fields.filter(f => Boolean(v[f])).length; return Math.round(done / fields.length * 100); }
function isServiceReady(v) { return v.agreementAccepted && v.trainingCompleted && !['Suspended', 'Inactive', 'Removed', 'Archived'].includes(v.status); }
function field(id) { return $(id)?.value.trim() || ''; }
function esc(value = '') { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }

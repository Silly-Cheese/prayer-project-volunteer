import { getApps, getApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, orderBy, limit, doc, getDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

const app = getApps().length ? getApp() : null;
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;
const $ = id => document.getElementById(id);

installV210Polish();

if (auth && db) {
  onAuthStateChanged(auth, async user => {
    if (!user) return;
    try {
      const snap = await getDoc(doc(db, 'volunteers', user.uid));
      const volunteer = snap.exists() ? { id: user.uid, ...snap.data() } : null;
      if ($('dashboard') && volunteer) await enhanceVolunteerOps(volunteer);
      installSecurityNotice(user);
    } catch (error) {
      console.warn('V2 operations layer could not load.', error);
    }
  });
}

async function enhanceVolunteerOps(volunteer) {
  const host = document.querySelector('.portal-main');
  if (!host || $('v2OperationsHub')) return;
  const [announcements, badges, reviews, assignments] = await Promise.all([
    safeRead('volunteer_announcements', 5),
    readWhere('volunteer_badges', 'uid', volunteer.id, 8),
    readWhere('volunteer_performance_reviews', 'uid', volunteer.id, 5),
    readWhere('volunteer_assignments', 'assignedToUid', volunteer.id, 8)
  ]);
  host.insertAdjacentHTML('afterbegin', `<section class="v2-panel" id="v2OperationsHub"><p class="eyebrow">V2.6-V2.10 Operations</p><h2>Volunteer command flow</h2><div class="v2-grid"><article class="v2-card"><strong>${announcements.length}</strong><span>Notices</span></article><article class="v2-card"><strong>${badges.length}</strong><span>Recognition</span></article><article class="v2-card"><strong>${openAssignmentCount(assignments)}</strong><span>Open Tasks</span></article></div><div class="v2-list">${renderAnnouncements(announcements)}${renderRecognition(badges, reviews)}${renderSupportBox(volunteer)}</div></section>`);
  bindSupportForm(volunteer);
}

function renderAnnouncements(rows) {
  return `<section class="v2-record"><h4>V2.6 Internal Notices</h4>${rows.length ? rows.map(a => `<div class="v2-note"><strong>${esc(a.title || 'Announcement')}</strong><br>${esc(a.message || a.body || '')}</div>`).join('') : '<p class="v2-quiet">No internal notices are posted right now.</p>'}</section>`;
}

function renderRecognition(badges, reviews) {
  const badgeHtml = badges.length ? badges.map(b => `<span class="v2-badge ok">${esc(b.title || b.badgeName || 'Recognition')}</span>`).join(' ') : '<span class="v2-badge">No badges yet</span>';
  const reviewHtml = reviews.length ? reviews.map(r => `<div class="v2-note"><strong>${esc(r.rating || 'Review')}</strong><br>${esc(r.strengths || r.growth || 'Leadership review recorded.')}</div>`).join('') : '<p class="v2-quiet">No performance reviews have been recorded yet.</p>';
  return `<section class="v2-record"><h4>V2.8 Recognition and Reviews</h4><div class="v2-meta">${badgeHtml}</div>${reviewHtml}</section>`;
}

function renderSupportBox(v) {
  return `<section class="v2-record"><h4>V2.6 Quick Leadership Message</h4><p class="v2-quiet">Send a structured note to leadership without leaving your dashboard.</p><form id="v2QuickMessageForm" class="v2-form-grid"><label>Type<select id="v2MessageType"><option>General Question</option><option>Training Help</option><option>Assignment Help</option><option>Chapter Help</option><option>Concern</option></select></label><label>Subject<input id="v2MessageSubject" required></label><label style="grid-column:1/-1">Message<textarea id="v2MessageBody" rows="4" required></textarea></label><button class="btn primary full" style="grid-column:1/-1">Send Message</button><p class="notice" id="v2MessageNotice" style="grid-column:1/-1"></p></form></section>`;
}

function bindSupportForm(v) {
  const form = $('v2QuickMessageForm');
  if (!form || form.dataset.bound) return;
  form.dataset.bound = 'true';
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const notice = $('v2MessageNotice');
    try {
      await addDoc(collection(db, 'volunteer_contacts'), { uid: v.id, email: v.email || '', name: v.name || v.email || 'Volunteer', type: $('v2MessageType')?.value || 'General Question', subject: field('v2MessageSubject'), message: field('v2MessageBody'), status: 'open', source: 'v2_quick_message', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      notice.textContent = 'Message sent to leadership.';
      notice.className = 'notice success';
      form.reset();
    } catch (error) {
      notice.textContent = 'Message could not be sent. Check your connection or Firestore rules.';
      notice.className = 'notice error';
    }
  });
}

function installSecurityNotice(user) {
  if ($('v2SecurityNotice')) return;
  const main = document.querySelector('main');
  if (!main) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'v2-security-toast';
  wrapper.id = 'v2SecurityNotice';
  wrapper.innerHTML = `<strong>Secure session active</strong><span>${esc(user.email || 'Signed in')}</span>`;
  document.body.appendChild(wrapper);
  setTimeout(() => wrapper.classList.add('show'), 200);
  setTimeout(() => wrapper.classList.remove('show'), 5000);
}

function installV210Polish() {
  if (document.getElementById('v210PolishStyles')) return;
  const style = document.createElement('style');
  style.id = 'v210PolishStyles';
  style.textContent = `.v2-security-toast{position:fixed;right:18px;bottom:18px;z-index:2000;display:grid;gap:2px;max-width:320px;padding:13px 15px;border:1px solid var(--line);border-radius:18px;background:rgba(10,10,10,.92);box-shadow:0 18px 48px rgba(0,0,0,.38);opacity:0;transform:translateY(12px);transition:.24s ease}.v2-security-toast.show{opacity:1;transform:translateY(0)}.v2-security-toast strong{color:var(--warm2);font-size:13px}.v2-security-toast span{color:var(--soft);font-size:12px}.v2-panel input,.v2-panel textarea,.v2-panel select{min-height:44px}.v2-panel button:focus,.v2-panel a:focus{outline:2px solid var(--warm2);outline-offset:2px}`;
  document.head.appendChild(style);
}

async function safeRead(name, max = 10) { const rows = []; try { const snap = await getDocs(query(collection(db, name), orderBy('createdAt', 'desc'), limit(max))); snap.forEach(d => rows.push({ id: d.id, ...d.data() })); } catch (error) { try { const snap = await getDocs(query(collection(db, name), limit(max))); snap.forEach(d => rows.push({ id: d.id, ...d.data() })); } catch (e) {} } return rows; }
async function readWhere(name, fieldName, value, max = 10) { const rows = []; try { const snap = await getDocs(query(collection(db, name), where(fieldName, '==', value), limit(max))); snap.forEach(d => rows.push({ id: d.id, ...d.data() })); } catch (error) {} return rows; }
function openAssignmentCount(rows) { return rows.filter(x => !['completed', 'Completed', 'closed', 'Closed'].includes(String(x.status || 'open'))).length; }
function field(id) { return $(id)?.value.trim() || ''; }
function esc(value = '') { return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;'); }
